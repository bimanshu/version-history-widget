/* Connect/Express/Vite-compatible middleware: serves /.versions/*, handles POST /__vh/restore/:id,
   and auto-records every change as a new version while the dev server is running.
   Express:  app.use(require('./.versions/middleware.js')())
   Vite:     plugins:[{ name:'vh', configureServer(s){ s.middlewares.use(require('./.versions/middleware.js')()) } }]
   Next:     use serve.js alongside, or add a route handler that calls require('./.versions/vh.js').restore(id)
   Pass { watch: false } to opt out of auto-recording. */
const fs = require('fs'), path = require('path');
module.exports = function (opts = {}) {
  const root = path.resolve(opts.root || process.env.VH_ROOT || process.cwd()), vdir = path.join(root, '.versions');
  const types = { '.js': 'text/javascript', '.json': 'application/json', '.diff': 'text/plain' };
  if (opts.watch !== false && fs.existsSync(vdir)) {
    process.env.VH_ROOT = root;   // vh.js resolves its root from this at require time
    try { require(path.join(vdir, 'vh.js')).watch({ keepAlive: false }); }
    catch (e) { console.error('[vh] auto-record unavailable: ' + e.message); }
  }
  return function (req, res, next) {
    const url = (req.url || '').split('?')[0];
    if (req.method === 'POST' && url.startsWith('/__vh/restore/')) {
      const id = Number(url.split('/').pop());
      try { const out = require(path.join(vdir, 'vh.js')).restore(id); res.statusCode = 200; res.setHeader('Content-Type', 'text/plain'); return res.end(out); }
      catch (e) { res.statusCode = 500; return res.end(String(e.stderr || e.message)); }
    }
    if (url.startsWith('/.versions/')) {
      const f = path.join(vdir, url.slice('/.versions/'.length));
      if (!f.startsWith(vdir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end(); }
      res.setHeader('Content-Type', types[path.extname(f)] || 'application/octet-stream'); res.setHeader('Cache-Control', 'no-store');
      return fs.createReadStream(f).pipe(res);
    }
    next && next();
  };
};
