/* version-history widget - vanilla JS, no deps. Reads #vh-store (single-file) or /.versions/manifest.json (project). */
(function () {
  if (window.__vhLoaded) return; window.__vhLoaded = true;
  var Z = 2147483647, MODE = document.getElementById('vh-store') ? 'single' : 'project';
  var css = '\
.vh-pill{position:fixed;right:16px;bottom:16px;z-index:' + Z + ';font:13px/1 system-ui,sans-serif;background:#111;color:#fff;border:0;border-radius:999px;padding:10px 14px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25)}\
.vh-panel{position:fixed;right:16px;bottom:56px;width:440px;max-width:calc(100vw - 32px);max-height:70vh;z-index:' + Z + ';background:#fff;color:#111;border:1px solid #ddd;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.25);font:13px/1.4 system-ui,sans-serif;display:flex;flex-direction:column;overflow:hidden}\
.vh-head{display:flex;gap:8px;padding:10px;border-bottom:1px solid #eee;align-items:center}\
.vh-search{flex:1;padding:8px 10px;border:1px solid #ccc;border-radius:8px;font:inherit;outline:none}.vh-search:focus{border-color:#111}\
.vh-clear{border:0;background:#eee;border-radius:6px;padding:6px 8px;cursor:pointer}\
.vh-list{overflow:auto;padding:6px}\
.vh-row{border-bottom:1px solid #f0f0f0;padding:8px 6px}\
.vh-top{display:flex;align-items:center;gap:8px;margin-top:6px}\
.vh-title{display:block;font-weight:600;line-height:1.35}.vh-title mark{background:#fff3a3;padding:0}\
.vh-time{flex:1;color:#777;font-size:11px;white-space:nowrap}\
.vh-btn{border:1px solid #ccc;background:#fafafa;border-radius:6px;padding:4px 8px;cursor:pointer;font:inherit;font-size:12px}\
.vh-btn:disabled{opacity:.4;cursor:default}.vh-btn.vh-restore{background:#111;color:#fff;border-color:#111}\
.vh-cur{color:#0a7d34;font-size:11px}.vh-tag{color:#777;font-size:11px;font-style:italic}\
.vh-details{display:none;margin-top:8px;padding:10px;background:#f7f7f7;border-radius:8px;white-space:pre-wrap;color:#333}\
.vh-details.vh-open{display:block}.vh-empty{padding:20px;text-align:center;color:#777}\
.vh-note{padding:8px 10px;font-size:12px;background:#fff8e1;border-top:1px solid #eee;display:none}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var versions = [], pill, panel, open = false, openDetails = null, query = '';

  function load(cb) {
    if (MODE === 'single') { try { versions = JSON.parse(document.getElementById('vh-store').textContent || '[]'); } catch (e) { versions = []; } cb(); }
    else fetch('/.versions/manifest.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (m) { versions = m; cb(); }).catch(function () { versions = []; cb(); });
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hl(text, q) { if (!q) return esc(text); var out = esc(text); q.split(/\s+/).filter(Boolean).forEach(function (w) { out = out.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>'); }); return out; }
  function matches(v, q) { var words = q.toLowerCase().split(/\s+/).filter(Boolean); if (!words.length) return { ok: true }; var t = v.title.toLowerCase(), d = (v.details || '').toLowerCase(); var ok = words.every(function (w) { return t.indexOf(w) >= 0 || d.indexOf(w) >= 0; }); return { ok: ok, inTitleOnly: words.some(function (w) { return t.indexOf(w) >= 0; }) }; }
  function fmt(t) { var d = new Date(t); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); }

  function render() {
    var list = panel.querySelector('.vh-list'); list.innerHTML = '';
    var cur = versions.length ? versions[versions.length - 1].id : null, shown = 0;
    versions.slice().reverse().forEach(function (v) {
      var m = matches(v, query); if (!m.ok) return; shown++;
      var row = document.createElement('div'); row.className = 'vh-row';
      row.innerHTML = '<span class="vh-title">' + hl(v.title, query) + (query && !m.inTitleOnly ? ' <span class="vh-tag">match in details</span>' : '') + (v.id === cur ? ' <span class="vh-cur">\u25CF current</span>' : '') + '</span><div class="vh-top">' +
        '<span class="vh-time">' + esc(fmt(v.time)) + '</span>' +
        '<button class="vh-btn vh-det">Details \u25BE</button>' +
        '<button class="vh-btn vh-restore"' + (v.id === cur ? ' disabled' : '') + '>Restore</button></div>' +
        '<div class="vh-details' + (openDetails === v.id ? ' vh-open' : '') + '">' + hl(v.details || '(no details)', query) + '</div>';
      row.querySelector('.vh-det').onclick = function () { openDetails = openDetails === v.id ? null : v.id; render(); };
      row.querySelector('.vh-restore').onclick = function () { if (confirm('Restore "' + v.title + '"? Current state will be saved first.')) restore(v); };
      list.appendChild(row);
    });
    if (!shown) list.innerHTML = '<div class="vh-empty">' + (query ? 'No versions match "' + esc(query) + '"' : 'No versions yet') + '</div>';
    pill.textContent = 'Versions \u00B7 ' + versions.length;
  }

  function restore(v) {
    if (MODE === 'single') {
      var snap = versions[versions.length - 1], now = new Date().toISOString();
      var html = document.documentElement.outerHTML.replace(/<script type="application\/json" id="vh-store">[\s\S]*?<\/script>/, '');
      versions.push({ id: versions.length + 1, title: 'Snapshot before restoring "' + v.title + '"', time: now, details: 'Automatic safety snapshot taken before restore.', html: html });
      versions.push({ id: versions.length + 1, title: 'Restored "' + v.title + '"', time: now, details: 'Restored the state saved as version ' + v.id + '.', html: v.html });
      var store = '<script type="application/json" id="vh-store">' + JSON.stringify(versions).replace(/<\/script/g, '<\\/script') + '<\/script>';
      var out = v.html.replace(/<\/body>/i, store + '</body>');
      document.open(); document.write(out); document.close(); return;
    }
    fetch('/__vh/restore/' + v.id, { method: 'POST' }).then(function (r) { if (!r.ok) throw 0; location.reload(); }).catch(function () {
      fetch('/.versions/snapshots/' + v.id + '/files.json', { cache: 'no-store' }).then(function (r) { return r.blob(); }).then(function (b) {
        var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'snapshot-' + v.id + '.json'; a.click();
      }).catch(function () { });
      var n = panel.querySelector('.vh-note'); n.style.display = 'block'; n.textContent = 'No live restore endpoint here. Run locally:  node .versions/vh.js restore ' + v.id;
    });
  }

  function build() {
    pill = document.createElement('button'); pill.className = 'vh-pill'; pill.textContent = 'Versions'; pill.onclick = toggle; document.body.appendChild(pill);
    panel = document.createElement('div'); panel.className = 'vh-panel'; panel.style.display = 'none';
    panel.innerHTML = '<div class="vh-head"><input class="vh-search" placeholder="Search versions\u2026"><button class="vh-clear" title="Clear">\u00D7</button></div><div class="vh-list"></div><div class="vh-note"></div>';
    var inp = panel.querySelector('.vh-search'); inp.oninput = function () { query = inp.value; render(); };
    panel.querySelector('.vh-clear').onclick = function () { inp.value = ''; query = ''; render(); inp.focus(); };
    document.addEventListener('keydown', function (e) { if (e.key !== 'Escape' || !open) return; if (query) { inp.value = ''; query = ''; render(); } else toggle(); });
    document.body.appendChild(panel);
  }
  function toggle() { open = !open; if (open) load(function () { panel.style.display = 'flex'; render(); panel.querySelector('.vh-search').focus(); }); else panel.style.display = 'none'; }
  function init() { build(); load(render); }
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
