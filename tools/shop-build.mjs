// Builds the shop catalog and its encrypted files.
//  1. lib/catalog-base.json  hand-made products, offers, UPI details, theme names (edit this one by hand)
//  2. <shop>/catalog-gen.json products made by the generator (build/gen/gen.js)
//  3. bundles are worked out here: one per theme, one per product type, a teacher kit, a kids pack, everything
// Every file in <shop>/products/<sku>/ is encrypted (AES-256-GCM: 12-byte IV + 16-byte tag + data) into
// public/p/<sku>/<file>.enc. Those are public but useless without PRODUCT_KEY, which only /api/download holds.
// Unchanged files keep their old .enc (tracked in lib/files.json) so git doesn't churn.
// Run: PRODUCT_KEY=<64 hex> node tools/shop-build.mjs && python3 tools/build-pages.py
import fs from 'node:fs';
import path from 'node:path';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SHOP = process.env.SHOP_DIR || '/mnt/project-files/curious-orbit-shop';
const SRC = path.join(SHOP, 'products');
const KEY = Buffer.from(process.env.PRODUCT_KEY || '', 'hex');
if (KEY.length !== 32) { console.error('Set PRODUCT_KEY to 64 hex characters.'); process.exit(1); }
const TYPES = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.zip': 'application/zip' };
const MAX = 4 * 1024 * 1024;   // a Vercel function response must stay under 4.5 MB
const read = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);

const base = read(path.join(ROOT, 'lib/catalog-base.json'));
const gen = read(path.join(SHOP, 'catalog-gen.json'), []);
const manifestPath = path.join(ROOT, 'lib/files.json');
const manifest = read(manifestPath, {});
const nextManifest = {};

// ---------- single products: hand-made first, then generated; only ones with files on disk ----------
const singles = [];
const seen = new Set();
for (const p of [...base.products, ...gen.map((g) => ({ sku: g.sku, name: g.name, price: g.price, unit: g.unit, text: g.text,
  category: g.category, theme: g.theme, family: g.family, factCount: g.factCount }))]) {
  if (seen.has(p.sku)) continue;
  const files = pack(p.sku);
  if (!files.length) { console.log(`skip ${p.sku}: no files yet`); continue; }
  seen.add(p.sku);
  singles.push({ ...p, files });
}

function pack(sku) {
  const dir = path.join(SRC, sku);
  if (!fs.existsSync(dir)) return [];
  let labels = read(path.join(dir, 'files.json'), {});
  if (Array.isArray(labels)) labels = Object.fromEntries(labels.map((l) => [l.name, l.label]));
  return fs.readdirSync(dir).filter((n) => TYPES[path.extname(n).toLowerCase()]).sort().map((name) => {
    const data = fs.readFileSync(path.join(dir, name));
    if (data.length > MAX) throw new Error(`${sku}/${name} is ${(data.length / 1e6).toFixed(1)} MB: keep files under 4 MB`);
    const rel = `${sku}/${name}`, sha = createHash('sha256').update(data).digest('hex');
    const out = path.join(ROOT, 'public/p', rel + '.enc');
    if (!(manifest[rel] === sha && fs.existsSync(out))) {
      const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', KEY, iv);
      const enc = Buffer.concat([c.update(data), c.final()]);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, Buffer.concat([iv, c.getAuthTag(), enc]));
    }
    nextManifest[rel] = sha;
    return { name, label: labels[name] || name, path: rel, size: data.length, type: TYPES[path.extname(name).toLowerCase()] };
  });
}

// ---------- bundles ----------
const sum = (list) => list.reduce((t, p) => t + p.price, 0);
const price = (worth, share) => Math.max(99, Math.ceil((worth * share) / 50) * 50 - 1);   // ends in 9, never silly-cheap
const bundles = [];
function bundle(sku, name, list, share, text, extra = {}) {
  if (list.length < 3) return;
  const worth = sum(list);
  bundles.push({ sku, name, price: price(worth, share), compareAt: worth, unit: `${list.length} products`, category: 'Bundle',
    text: `${text} Worth ${rupees(worth)} bought one by one.`, includes: list.map((p) => p.sku), ...extra });
}
const rupees = (n) => `₹${n.toLocaleString('en-IN')}`;
const THEMES = base.themes || {};
for (const [slug, label] of Object.entries(THEMES)) {
  const list = singles.filter((p) => p.theme === slug);
  bundle(`bundle-${slug}`, `${label} Complete Bundle`, list, 0.5, `Every ${label} product: quiz, cards, poster, wallpapers and games.`, { theme: slug });
}
const FAMILIES = {
  quiz: ['Every Quiz Night Pack', 'All the quiz packs, every topic, with answer keys and sources.'],
  cards: ['Every Fact Card Set', 'All the printable fact card sets, ready to cut.'],
  poster: ['Every Poster', 'All the posters in A3 and A4.'],
  walls: ['Every Wallpaper Pack', 'All the phone wallpaper packs.'],
  tf: ['Every True or False Game', 'All the true-or-false card games.'],
  bingo: ['Every Bingo Game', 'All the science bingo games with caller sheets.'],
  kids: ['Every Kids Activity Pack', 'All the kids activity packs with answer keys.'],
};
for (const [fam, [name, text]] of Object.entries(FAMILIES)) {
  bundle(`bundle-all-${fam}`, name, singles.filter((p) => p.family === fam), 0.4, text, { family: fam });
}
bundle('bundle-teacher', "Teacher's Classroom Kit", singles.filter((p) => ['quiz', 'cards', 'tf', 'bingo'].includes(p.family)), 0.33,
  'Every quiz pack, fact card set, true-or-false game and bingo game: a year of science starters.', { featured: true });
bundle('bundle-kids', 'Kids Mega Pack', singles.filter((p) => ['kids', 'walls', 'book'].includes(p.family)), 0.4,
  'Every kids activity pack, the myth-busters book and all the wallpapers.', { featured: true });
bundle('bundle', 'Everything Bundle', singles, 0.22, `Every product in the shop today, ${singles.length} in all.`, { featured: true });

// ---------- tidy up stale encrypted files, previews, catalog ----------
const keepEnc = new Set(Object.keys(nextManifest).map((r) => r + '.enc'));
const pdir = path.join(ROOT, 'public/p');
if (fs.existsSync(pdir)) for (const sku of fs.readdirSync(pdir)) for (const f of fs.readdirSync(path.join(pdir, sku))) {
  if (!keepEnc.has(`${sku}/${f}`)) fs.rmSync(path.join(pdir, sku, f));
}
fs.writeFileSync(manifestPath, JSON.stringify(nextManifest, null, 1) + '\n');

const PREV = path.join(SHOP, 'previews'), OUT = path.join(ROOT, 'public/media/shop');
if (fs.existsSync(PREV)) {
  fs.mkdirSync(OUT, { recursive: true });
  const want = new Set(singles.map((p) => p.sku));
  for (const n of fs.readdirSync(PREV)) if (/\.(webp|jpg|png)$/.test(n) && want.has(n.replace(/-\d\.\w+$/, ''))) fs.copyFileSync(path.join(PREV, n), path.join(OUT, n));
}

const { products: _, ...head } = base;
const catalog = { ...head, products: [...bundles.filter((b) => b.featured), ...singles, ...bundles.filter((b) => !b.featured)] };
fs.writeFileSync(path.join(ROOT, 'lib/catalog.json'), JSON.stringify(catalog, null, 1) + '\n');
const mb = Object.keys(nextManifest).reduce((t, r) => t + fs.statSync(path.join(pdir, r + '.enc')).size, 0) / 1e6;
console.log(`${singles.length} products, ${bundles.length} bundles, ${Object.keys(nextManifest).length} files, ${mb.toFixed(1)} MB encrypted`);
