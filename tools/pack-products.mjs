// Encrypts the shop's product files into products/<sku>/<file>.enc and lists them in lib/catalog.json.
// Source files: /mnt/project-files/curious-orbit-shop/products/<sku>/ (any files; a files.json there can give labels).
// Key: PRODUCT_KEY (64 hex chars) in the environment. It must match PRODUCT_KEY on Vercel. To rotate it, make a
// new key, run this script with it, and set the same value on Vercel (Settings > Environment Variables).
// Run: PRODUCT_KEY=... node tools/pack-products.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createCipheriv, randomBytes } from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = process.env.PRODUCTS_SRC || '/mnt/project-files/curious-orbit-shop/products';
const KEY = Buffer.from(process.env.PRODUCT_KEY || '', 'hex');
if (KEY.length !== 32) { console.error('Set PRODUCT_KEY to 64 hex characters.'); process.exit(1); }
const TYPES = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.zip': 'application/zip' };
const MAX = 4 * 1024 * 1024;   // a Vercel function response must stay under 4.5 MB

const catPath = path.join(ROOT, 'lib/catalog.json');
const cat = JSON.parse(fs.readFileSync(catPath, 'utf8'));
fs.rmSync(path.join(ROOT, 'products'), { recursive: true, force: true });
for (const p of cat.products) {
  if (p.includes) continue;
  const dir = path.join(SRC, p.sku);
  if (!fs.existsSync(dir)) { p.files = []; console.log(`${p.sku}: no files yet`); continue; }
  const labels = fs.existsSync(path.join(dir, 'files.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'files.json'), 'utf8')) : {};
  const names = fs.readdirSync(dir).filter((n) => TYPES[path.extname(n).toLowerCase()]).sort();
  p.files = names.map((name) => {
    const data = fs.readFileSync(path.join(dir, name));
    if (data.length > MAX) throw new Error(`${p.sku}/${name} is ${(data.length / 1e6).toFixed(1)} MB: split or compress it under 4 MB`);
    const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', KEY, iv);
    const enc = Buffer.concat([c.update(data), c.final()]);
    const rel = `${p.sku}/${name}`;
    fs.mkdirSync(path.join(ROOT, 'products', p.sku), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'products', rel + '.enc'), Buffer.concat([iv, c.getAuthTag(), enc]));
    return { name, label: labels[name] || name, path: rel, size: data.length, type: TYPES[path.extname(name).toLowerCase()] };
  });
  console.log(`${p.sku}: ${p.files.length} files, ${(p.files.reduce((t, f) => t + f.size, 0) / 1e6).toFixed(1)} MB`);
}
fs.writeFileSync(catPath, JSON.stringify(cat, null, 2) + '\n');

// Public preview images for the shop cards: previews/<sku>-1.webp, -2.webp -> public/media/shop/
const PREV = path.join(path.dirname(SRC), 'previews'), OUT = path.join(ROOT, 'public/media/shop');
if (fs.existsSync(PREV)) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const n of fs.readdirSync(PREV)) if (/\.(webp|jpg|png)$/.test(n)) fs.copyFileSync(path.join(PREV, n), path.join(OUT, n));
}
