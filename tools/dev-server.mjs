// Local preview of the whole site, including the /api functions, without Vercel.
//   PRODUCT_KEY=<hex> ADMIN_KEY=test node tools/dev-server.mjs [port]
// Orders are saved in ./.data (git-ignored) instead of Vercel Blob. Set GATEWAY_URL / GATEWAY_MERCHANT_ID /
// GATEWAY_WEBHOOK_SECRET to try the UPI gateway flow, for example against tools/mock-gateway.mjs.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PUB = path.join(ROOT, 'public');
const PORT = Number(process.argv[2] || process.env.PORT || 3000);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.xml': 'application/xml', '.txt': 'text/plain' };

async function api(name, req, res, url) {
  const mod = await import(pathToFileURL(path.join(ROOT, 'api', name + '.js')).href);
  req.query = Object.fromEntries(url.searchParams);
  if (!(mod.config && mod.config.api && mod.config.api.bodyParser === false)) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8');
    try { req.body = raw ? JSON.parse(raw) : {}; } catch (e) { req.body = {}; }
  }
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); return res; };
  res.send = (data) => { res.end(data); return res; };
  await mod.default(req, res);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await api(url.pathname.slice(5).replace(/\/$/, ''), req, res, url);
    let p = path.join(PUB, decodeURIComponent(url.pathname));
    if (!p.startsWith(PUB)) { res.statusCode = 403; return res.end(); }
    for (const c of [p, p + '.html', path.join(p, 'index.html')]) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) {
        res.setHeader('Content-Type', TYPES[path.extname(c)] || 'application/octet-stream');
        return fs.createReadStream(c).pipe(res);
      }
    }
    res.statusCode = 404; res.setHeader('Content-Type', 'text/html'); fs.createReadStream(path.join(PUB, '404.html')).pipe(res);
  } catch (err) {
    console.error(err); res.statusCode = 500; res.end('dev server error: ' + err.message);
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}  (orders in ./.data)`));
