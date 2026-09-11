/* Static-site-agnostic dev server with the restore endpoint. Zero deps.
   node .versions/serve.js [port] [dir]   — serves the project folder (default: parent of .versions, port 4173) */
const http = require('http'), fs = require('fs'), path = require('path');
const port = Number(process.argv[2]) || 4173, root = path.resolve(process.argv[3] || path.join(__dirname, '..'));
process.env.VH_ROOT = root;
const vh = require(path.join(__dirname, 'middleware.js'))({ root });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
http.createServer((req, res) => vh(req, res, () => {
  let f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('Content-Type', types[path.extname(f)] || 'application/octet-stream'); res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(f).pipe(res);
})).listen(port, () => console.log('version-history server: http://localhost:' + port + '  (root: ' + root + ')'));
