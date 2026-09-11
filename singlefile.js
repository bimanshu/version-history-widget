#!/usr/bin/env node
/* Single-file mode: embeds version history inside one HTML file. Zero deps.
   node singlefile.js init  page.html                          — inject store + widget, save version 1
   node singlefile.js record page.html "Title" [-d "details" | -f file]
   node singlefile.js list   page.html [query]                  */
const fs = require('fs'), path = require('path');
const STORE = /<script type="application\/json" id="vh-store">([\s\S]*?)<\/script>/;
const [cmd, file, ...args] = process.argv.slice(2);
if (!cmd || !file) { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].split('\n').slice(1).join('\n')); process.exit(0); }
let html = fs.readFileSync(file, 'utf8');
const m = html.match(STORE), versions = m ? JSON.parse(m[1].replace(/<\\\/script/g, '</script')) : [];
const bare = () => html.replace(/<script type="application\/json" id="vh-store">[\s\S]*?<\/script>\n?/, '').replace(/<script id="vh-widget">[\s\S]*?<\/script>\n?/, '');
const write = v => {
  let out = bare();
  const store = '<script type="application/json" id="vh-store">' + JSON.stringify(v).replace(/<\/script/g, '<\\/script') + '</script>';
  const widget = '<script id="vh-widget">' + fs.readFileSync(path.join(__dirname, 'widget.js'), 'utf8') + '</script>';
  out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, store + '\n' + widget + '\n</body>') : out + store + widget;
  fs.writeFileSync(file, out);
};
if (cmd === 'init') {
  if (versions.length) { console.log('Already initialised (' + versions.length + ' versions).'); process.exit(0); }
  versions.push({ id: 1, title: 'Initial version', time: new Date().toISOString(), details: 'State of the file when version history was enabled.', html: bare() });
  write(versions); console.log('version-history ready in ' + file + '. Saved version 1.');
} else if (cmd === 'record') {
  const title = args[0]; if (!title) { console.error('usage: singlefile record page.html "Title" [-d details]'); process.exit(1); }
  const di = args.indexOf('-d'), fi = args.indexOf('-f'), details = di >= 0 ? args[di + 1] : fi >= 0 ? fs.readFileSync(args[fi + 1], 'utf8') : '';
  const snap = bare(); if (versions.length && versions[versions.length - 1].html === snap) { console.log('No changes since last version — nothing saved.'); process.exit(0); }
  const id = versions.length ? versions[versions.length - 1].id + 1 : 1;
  versions.push({ id, title, time: new Date().toISOString(), details, html: snap }); write(versions);
  console.log('Saved as version ' + id + ': ' + title);
} else if (cmd === 'list') {
  const q = (args[0] || '').toLowerCase();
  for (const v of versions) if (!q || v.title.toLowerCase().includes(q) || (v.details || '').toLowerCase().includes(q)) console.log(String(v.id).padStart(3) + '  ' + v.time.slice(0, 16).replace('T', ' ') + '  ' + v.title);
}
