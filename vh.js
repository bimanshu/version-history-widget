#!/usr/bin/env node
/* version-history CLI (project mode). Zero dependencies.
   node vh.js init                       — set up .versions/, inject widget, snapshot as version 1
   node vh.js record "Title" [-d "details" | -f details.txt]   — snapshot changed files as a new version
   node vh.js restore <id>               — snapshot current state, then restore version <id>
   node vh.js list [query]               — list versions (optionally filtered by title/details)
   node vh.js watch                      — auto-record every change as a new version (run alongside
                                            your dev server; also runs inside serve.js/middleware.js)
   node vh.js update                     — refresh the vendored widget.js/vh.js/serve.js/middleware.js
                                            in .versions/ from the installed package (run after upgrading)
   node vh.js skill                      — install the Claude Code skill (~/.claude/skills) so
                                            /version-history-widget works in Claude Code sessions
   Env: VH_ROOT (project root, default cwd) */
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.resolve(process.env.VH_ROOT || process.cwd());
const VDIR = path.join(ROOT, '.versions'), SNAP = path.join(VDIR, 'snapshots'), MAN = path.join(VDIR, 'manifest.json');
const LOCK = path.join(VDIR, '.restoring');
const IGNORE = new Set(['node_modules', '.git', '.versions', 'dist', 'build', '.next', '.nuxt', 'coverage', '.cache', '.DS_Store', '.claude']);
const MAX = 2 * 1024 * 1024;

const readMan = () => fs.existsSync(MAN) ? JSON.parse(fs.readFileSync(MAN, 'utf8')) : [];
const writeMan = m => fs.writeFileSync(MAN, JSON.stringify(m, null, 2));

function walk(dir, out = {}) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.has(e.name) || e.name.startsWith('.env')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && fs.statSync(p).size <= MAX) out[path.relative(ROOT, p).split(path.sep).join('/')] = fs.readFileSync(p);
  }
  return out;
}

/* Reconstruct full file state at version id by replaying snapshots. */
function stateAt(id, man) {
  const files = {};
  for (const v of man) {
    if (v.id > id) break;
    for (const d of v.deleted || []) delete files[d];
    for (const f of v.files || []) files[f] = fs.readFileSync(path.join(SNAP, String(v.id), f));
  }
  return files;
}

function lineDiff(a, b) {           // small LCS diff, unified-ish output
  const A = a.split('\n'), B = b.split('\n');
  if (A.length * B.length > 4e6) return '(diff too large to display)';
  const n = A.length, m = B.length, dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < n && j < m) { if (A[i] === B[j]) { i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push('- ' + A[i++]); else out.push('+ ' + B[j++]); }
  while (i < n) out.push('- ' + A[i++]); while (j < m) out.push('+ ' + B[j++]);
  return out.join('\n');
}

function snapshot(title, details, prevState) {
  const man = readMan(), id = man.length ? man[man.length - 1].id + 1 : 1;
  const cur = walk(ROOT), files = [], deleted = [], diffs = [];
  for (const f of Object.keys(cur)) {
    const old = prevState[f];
    if (!old || !old.equals(cur[f])) {
      files.push(f);
      const dest = path.join(SNAP, String(id), f); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, cur[f]);
      const isText = !/\.(png|jpe?g|gif|webp|ico|woff2?|ttf|pdf|zip)$/i.test(f);
      diffs.push('### ' + f + (old ? '' : ' (new)') + '\n' + (isText ? lineDiff(old ? old.toString('utf8') : '', cur[f].toString('utf8')) : '(binary)'));
    }
  }
  for (const f of Object.keys(prevState)) if (!cur[f]) { deleted.push(f); diffs.push('### ' + f + ' (deleted)'); }
  fs.mkdirSync(path.join(SNAP, String(id)), { recursive: true });
  fs.writeFileSync(path.join(SNAP, String(id), 'changes.diff'), diffs.join('\n\n'));
  const bundle = {}; for (const f of Object.keys(cur)) bundle[f] = cur[f].toString('base64');
  fs.writeFileSync(path.join(SNAP, String(id), 'files.json'), JSON.stringify({ id, title, files: bundle }));
  man.push({ id, title, time: new Date().toISOString(), details, files, deleted });
  writeMan(man);
  return { id, changed: files.length + deleted.length };
}

function injectWidget() {
  const cands = ['index.html', 'public/index.html', 'src/index.html', 'app/layout.tsx', 'app/layout.jsx', 'src/app/layout.tsx', 'pages/_document.tsx', 'pages/_document.jsx']
    .map(f => path.join(ROOT, f)).filter(fs.existsSync);
  for (const f of cands) {
    let s = fs.readFileSync(f, 'utf8'); if (s.includes('.versions/widget.js')) return f;
    const tag = '<script src="/.versions/widget.js"></script>';
    if (/<\/body>/i.test(s)) s = s.replace(/<\/body>/i, tag + '\n</body>');
    else if (/<\/head>/i.test(s)) s = s.replace(/<\/head>/i, tag + '\n</head>');
    else continue;
    fs.writeFileSync(f, s); return f;
  }
  return null;
}

const VITE_CONFIG = `import { createRequire } from 'module';
const require = createRequire(import.meta.url);

export default {
  plugins: [{
    name: 'version-history',
    configureServer(server) {
      server.middlewares.use(require('./.versions/middleware.js')());
    },
  }],
};
`;

function usesVite() {
  const pj = path.join(ROOT, 'package.json');
  if (!fs.existsSync(pj)) return false;
  try {
    const p = JSON.parse(fs.readFileSync(pj, 'utf8'));
    if ((p.devDependencies && p.devDependencies.vite) || (p.dependencies && p.dependencies.vite)) return true;
    return /\bvite\b/.test(Object.values(p.scripts || {}).join(' '));
  } catch (e) { return false; }
}

function viteConfigPath() {
  for (const f of ['vite.config.js', 'vite.config.mjs', 'vite.config.ts', 'vite.config.mts', 'vite.config.cjs'])
    if (fs.existsSync(path.join(ROOT, f))) return path.join(ROOT, f);
  return null;
}

/* Wire the dev server up so changes keep getting auto-recorded. Only ever
   creates a config when there isn't one — an existing config is never edited,
   since that's the user's file. Re-run after a restore so restoring to a
   version that predates the setup doesn't silently switch auto-saving off. */
function ensureDevIntegration(quiet) {
  if (!usesVite()) return null;
  const existing = viteConfigPath();
  if (existing) {
    if (!quiet && !fs.readFileSync(existing, 'utf8').includes('.versions/middleware.js'))
      console.log('Note: ' + path.basename(existing) + ' does not mount .versions/middleware.js, so changes are only auto-recorded while `vh watch` is running. See the README for the snippet to add.');
    return null;
  }
  const p = path.join(ROOT, 'vite.config.js');
  fs.writeFileSync(p, VITE_CONFIG);
  if (!quiet) console.log('Created vite.config.js mounting .versions/middleware.js — restart your dev server and every change is auto-recorded.');
  return p;
}

/* Files that differ from the newest recorded version. */
function pendingChanges() {
  const man = readMan(), prev = man.length ? stateAt(man[man.length - 1].id, man) : {};
  const cur = walk(ROOT), out = [];
  for (const f of Object.keys(cur)) { const old = prev[f]; if (!old || !old.equals(cur[f])) out.push(f); }
  for (const f of Object.keys(prev)) if (!cur[f]) out.push(f);
  return out;
}

/* Record a version in-process. Returns null when nothing changed. */
function recordNow(title, details) {
  const man = readMan(), prev = man.length ? stateAt(man[man.length - 1].id, man) : {};
  const r = snapshot(title, details, prev);
  if (!r.changed) { const m = readMan(); m.pop(); writeMan(m); fs.rmSync(path.join(SNAP, String(r.id)), { recursive: true, force: true }); return null; }
  return r;
}

function autoTitle(files) {
  if (files.length === 1) return 'Updated ' + files[0];
  return 'Updated ' + files[0] + ' and ' + (files.length - 1) + ' more file' + (files.length > 2 ? 's' : '');
}

function ignoredPath(rel) {
  if (!rel) return false;
  for (const seg of String(rel).split(/[\\/]/)) if (IGNORE.has(seg) || seg.startsWith('.env')) return true;
  return false;
}

/* Auto-record changes as they happen. Debounced so a burst of edits (an editor
   or an agent writing several files) becomes one version, not twenty. */
function startWatch(opts = {}) {
  const wait = opts.debounce || 1500, log = opts.log !== false;
  let timer = null, busy = false;
  function fire() {
    timer = null;
    if (busy || fs.existsSync(LOCK)) return schedule();   // mid-restore: check again later
    busy = true;
    try {
      const files = pendingChanges();
      if (files.length) {
        const title = autoTitle(files);
        const r = recordNow(title, 'Auto-saved.\n\nChanged files:\n' + files.map(f => '  ' + f).join('\n'));
        if (r && log) console.log('[vh] saved version ' + r.id + ': ' + title);
      }
    } catch (e) { if (log) console.error('[vh] auto-save failed: ' + e.message); }
    finally { busy = false; }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(fire, wait); }

  let watcher = null;
  try { watcher = fs.watch(ROOT, { recursive: true }, (evt, name) => { if (!ignoredPath(name)) schedule(); }); }
  catch (e) { watcher = null; }   // recursive watch unsupported (older Linux)
  let poller = null;
  if (!watcher) {
    let seen = 0;
    poller = setInterval(() => {
      let newest = 0;
      (function scan(dir) {
        let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
        for (const e of entries) {
          if (IGNORE.has(e.name) || e.name.startsWith('.env')) continue;
          const p = path.join(dir, e.name);
          if (e.isDirectory()) scan(p);
          else { try { const m = fs.statSync(p).mtimeMs; if (m > newest) newest = m; } catch (e2) { } }
        }
      })(ROOT);
      if (newest > seen) { seen = newest; schedule(); }
    }, opts.poll || 2000);
  }
  if (opts.keepAlive === false) { if (watcher && watcher.unref) watcher.unref(); if (poller && poller.unref) poller.unref(); }
  schedule();   // catch up on anything changed while nothing was watching
  return { stop() { clearTimeout(timer); if (watcher) watcher.close(); if (poller) clearInterval(poller); } };
}

function vendorFiles() {
  fs.mkdirSync(VDIR, { recursive: true });
  for (const f of ['widget.js', 'vh.js', 'serve.js', 'middleware.js']) { const src = path.join(__dirname, f); if (fs.existsSync(src) && src !== path.join(VDIR, f)) fs.copyFileSync(src, path.join(VDIR, f)); }
  // Force CommonJS for everything under .versions/, regardless of the host
  // project's own package.json — otherwise a host with "type":"module" makes
  // Node treat these vendored .js files as ESM and `require` disappears.
  fs.writeFileSync(path.join(VDIR, 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');
}

const cmd = require.main === module ? process.argv[2] : null, args = process.argv.slice(3);
if (cmd === null) {                        // required as a library (serve.js / middleware.js)
} else if (cmd === 'init') {
  fs.mkdirSync(SNAP, { recursive: true });
  vendorFiles();
  if (!fs.existsSync(MAN)) writeMan([]);
  const gi = path.join(ROOT, '.gitignore'); const line = '.versions/snapshots/';
  if (!fs.existsSync(gi) || !fs.readFileSync(gi, 'utf8').includes(line)) fs.appendFileSync(gi, '\n' + line + '\n');
  const where = injectWidget();
  ensureDevIntegration(false);
  const r = readMan().length ? null : snapshot('Initial version', 'State of the project when version history was enabled.', {});
  console.log('version-history ready.' + (where ? ' Widget injected into ' + path.relative(ROOT, where) + '.' : ' Could not find an entry HTML — add <script src="/.versions/widget.js"></script> manually.') + (r ? ' Saved version 1.' : ''));
  console.log('Serve with restore endpoint: node .versions/serve.js   (or mount .versions/middleware.js in your dev server)');
} else if (cmd === 'record') {
  const title = args[0]; if (!title) { console.error('usage: vh record "Title" [-d "details" | -f file]'); process.exit(1); }
  const di = args.indexOf('-d'), fi = args.indexOf('-f');
  const details = di >= 0 ? args[di + 1] : fi >= 0 ? fs.readFileSync(args[fi + 1], 'utf8') : '';
  const r = recordNow(title, details);
  console.log(r ? 'Saved as version ' + r.id + ': ' + title : 'No changes since last version — nothing saved.');
} else if (cmd === 'restore') {
  const id = Number(args[0]), man = readMan(), target = man.find(v => v.id === id);
  if (!target) { console.error('No version ' + args[0]); process.exit(1); }
  fs.mkdirSync(VDIR, { recursive: true }); fs.writeFileSync(LOCK, String(process.pid));   // pause any watcher
  try {
    const cur = man[man.length - 1], prev = stateAt(cur.id, man);
    snapshot('Snapshot before restoring "' + target.title + '"', 'Automatic safety snapshot taken before restore.', prev);
    const want = stateAt(id, readMan()), have = walk(ROOT);
    for (const f of Object.keys(have)) if (!want[f]) fs.rmSync(path.join(ROOT, f));
    for (const f of Object.keys(want)) { const p = path.join(ROOT, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, want[f]); }
    injectWidget();
    ensureDevIntegration(true);
    const r = snapshot('Restored "' + target.title + '"', 'Restored the state saved as version ' + id + '.', stateAt(readMan().slice(-1)[0].id, readMan()));
    console.log('Restored version ' + id + ' (recorded as version ' + r.id + ').');
  } finally { fs.rmSync(LOCK, { force: true }); }
} else if (cmd === 'watch') {
  if (!fs.existsSync(VDIR)) { console.error('No .versions/ here — run `vh init` first.'); process.exit(1); }
  startWatch({});
  console.log('Watching ' + ROOT + ' — every change is auto-saved as a new version. Ctrl-C to stop.');
} else if (cmd === 'list') {
  const q = (args[0] || '').toLowerCase();
  for (const v of readMan()) if (!q || v.title.toLowerCase().includes(q) || (v.details || '').toLowerCase().includes(q)) console.log(String(v.id).padStart(3) + '  ' + v.time.slice(0, 16).replace('T', ' ') + '  ' + v.title);
} else if (cmd === 'update') {
  if (!fs.existsSync(VDIR)) { console.error('No .versions/ here — run `vh init` first.'); process.exit(1); }
  vendorFiles();
  console.log('Updated .versions/{widget.js,vh.js,serve.js,middleware.js} from version-history-widget@' + require('./package.json').version + '. Reload the site to pick up widget changes.');
} else if (cmd === 'skill') {
  const dest = path.join(os.homedir(), '.claude', 'skills', 'version-history-widget');
  fs.mkdirSync(dest, { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'skill', 'SKILL.md'), path.join(dest, 'SKILL.md'));
  console.log('Installed Claude Code skill to ' + dest + '. Restart Claude Code (or start a new session) and try /version-history-widget.');
} else { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].split('\n').slice(1).join('\n')); }
module.exports = {
  restore: id => { const { execFileSync } = require('child_process'); return execFileSync(process.execPath, [__filename, 'restore', String(id)], { cwd: ROOT, env: process.env }).toString(); },
  watch: startWatch, record: recordNow, pending: pendingChanges, root: ROOT,
};
