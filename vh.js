#!/usr/bin/env node
/* version-history CLI (project mode). Zero dependencies.
   node vh.js init                       — set up .versions/, inject widget, snapshot as version 1
   node vh.js record "Title" [-d "details" | -f details.txt]   — snapshot changed files as a new version
   node vh.js restore <id>               — snapshot current state, then restore version <id>
   node vh.js list [query]               — list versions (optionally filtered by title/details)
   Env: VH_ROOT (project root, default cwd) */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(process.env.VH_ROOT || process.cwd());
const VDIR = path.join(ROOT, '.versions'), SNAP = path.join(VDIR, 'snapshots'), MAN = path.join(VDIR, 'manifest.json');
const IGNORE = new Set(['node_modules', '.git', '.versions', 'dist', 'build', '.next', '.nuxt', 'coverage', '.cache']);
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

const cmd = process.argv[2], args = process.argv.slice(3);
if (cmd === 'init') {
  fs.mkdirSync(SNAP, { recursive: true });
  for (const f of ['widget.js', 'vh.js', 'serve.js', 'middleware.js']) { const src = path.join(__dirname, f); if (fs.existsSync(src) && src !== path.join(VDIR, f)) fs.copyFileSync(src, path.join(VDIR, f)); }
  if (!fs.existsSync(MAN)) writeMan([]);
  const gi = path.join(ROOT, '.gitignore'); const line = '.versions/snapshots/';
  if (!fs.existsSync(gi) || !fs.readFileSync(gi, 'utf8').includes(line)) fs.appendFileSync(gi, '\n' + line + '\n');
  const where = injectWidget();
  const r = readMan().length ? null : snapshot('Initial version', 'State of the project when version history was enabled.', {});
  console.log('version-history ready.' + (where ? ' Widget injected into ' + path.relative(ROOT, where) + '.' : ' Could not find an entry HTML — add <script src="/.versions/widget.js"></script> manually.') + (r ? ' Saved version 1.' : ''));
  console.log('Serve with restore endpoint: node .versions/serve.js   (or mount .versions/middleware.js in your dev server)');
} else if (cmd === 'record') {
  const title = args[0]; if (!title) { console.error('usage: vh record "Title" [-d "details" | -f file]'); process.exit(1); }
  const di = args.indexOf('-d'), fi = args.indexOf('-f');
  const details = di >= 0 ? args[di + 1] : fi >= 0 ? fs.readFileSync(args[fi + 1], 'utf8') : '';
  const man = readMan(), prev = man.length ? stateAt(man[man.length - 1].id, man) : {};
  const r = snapshot(title, details, prev);
  console.log(r.changed ? 'Saved as version ' + r.id + ': ' + title : 'No changes since last version — nothing saved.');
  if (!r.changed) { const m = readMan(); m.pop(); writeMan(m); fs.rmSync(path.join(SNAP, String(r.id)), { recursive: true, force: true }); }
} else if (cmd === 'restore') {
  const id = Number(args[0]), man = readMan(), target = man.find(v => v.id === id);
  if (!target) { console.error('No version ' + args[0]); process.exit(1); }
  const cur = man[man.length - 1], prev = stateAt(cur.id, man);
  snapshot('Snapshot before restoring "' + target.title + '"', 'Automatic safety snapshot taken before restore.', prev);
  const want = stateAt(id, readMan()), have = walk(ROOT);
  for (const f of Object.keys(have)) if (!want[f]) fs.rmSync(path.join(ROOT, f));
  for (const f of Object.keys(want)) { const p = path.join(ROOT, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, want[f]); }
  injectWidget();
  const r = snapshot('Restored "' + target.title + '"', 'Restored the state saved as version ' + id + '.', stateAt(readMan().slice(-1)[0].id, readMan()));
  console.log('Restored version ' + id + ' (recorded as version ' + r.id + ').');
} else if (cmd === 'list') {
  const q = (args[0] || '').toLowerCase();
  for (const v of readMan()) if (!q || v.title.toLowerCase().includes(q) || (v.details || '').toLowerCase().includes(q)) console.log(String(v.id).padStart(3) + '  ' + v.time.slice(0, 16).replace('T', ' ') + '  ' + v.title);
} else { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].split('\n').slice(1).join('\n')); }
module.exports = { restore: id => { const { execFileSync } = require('child_process'); return execFileSync(process.execPath, [__filename, 'restore', String(id)], { cwd: ROOT, env: process.env }).toString(); } };
