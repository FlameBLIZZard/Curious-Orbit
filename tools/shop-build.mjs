// Builds the shop catalogue and the encrypted product files.
//
//   PRODUCT_KEY=<64 hex chars> node tools/shop-build.mjs
//   then: python3 tools/build-pages.py
//
// Inputs
//   lib/catalog-base.json                          hand-made listings (myth book, solar poster, space wallpapers), UPI id, payee
//   $SHOP_SRC/catalog-gen.json                     generated listings from build/gen/gen.js in the shop folder
//   $SHOP_SRC/products/<sku>/*.pdf|jpg|png|zip     the files a buyer downloads (+ files.json {file: label})
//   $SHOP_SRC/previews/<sku>-1.webp, -2.webp       preview images for the listing
// Outputs
//   lib/catalog.json                               every listing incl. bundles, with its file list (server copy)
//   products/<sku>/<file>.enc                      AES-256-GCM: 12-byte IV + 16-byte tag + data (api/download.js decrypts)
//   public/media/shop/<sku>-N.webp                 preview images
//
// PRODUCT_KEY must match the PRODUCT_KEY environment variable on Vercel. Encryption is deterministic (the IV is
// derived from the key and the file content), so re-running with the same key and files changes nothing in git.
// To rotate the key: set a new PRODUCT_KEY here, run this script, set the same value on Vercel, redeploy.
import fs from 'node:fs';
import path from 'node:path';
import { createCipheriv, createHash, createHmac } from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SHOP = process.env.SHOP_SRC || '/mnt/project-files/curious-orbit-shop';
const KEY = Buffer.from(process.env.PRODUCT_KEY || '', 'hex');
if (KEY.length !== 32) { console.error('Set PRODUCT_KEY to 64 hex characters (openssl rand -hex 32).'); process.exit(1); }
const TYPES = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.zip': 'application/zip' };
const MAX = 4 * 1024 * 1024;   // a Vercel function response must stay under 4.5 MB

// ---- prices and bundle rules (rupees). Change here, re-run, redeploy. ----
const BUNDLE_RATE = { theme: 0.6, type: 0.5, kit: 0.6, mega: 0.25 };   // price = included total x rate, rounded down to ...9

const THEMES = {
  space: 'Space', ocean: 'Ocean', earth: 'Earth & Weather', physics: 'Physics & Chemistry', body: 'Human Body',
  animals: 'Animals', dinosaurs: 'Dinosaurs', plants: 'Plants & Fungi', brain: 'Brain & Mind', tech: 'Tech & Numbers',
  food: 'Food & Everyday Science', history: 'History of Science', bugs: 'Bugs & Microbes', myths: 'Myths', mixed: 'Mixed Science',
};
// family id -> label shown as the product "Type", the shop category, and who it is for
const FAMILIES = {
  quiz:   { type: 'Quiz packs',        category: 'Games',      plural: 'Quiz Night Packs' },
  tf:     { type: 'True or False',     category: 'Games',      plural: 'True or False Games' },
  bingo:  { type: 'Bingo',             category: 'Games',      plural: 'Science Bingo Sets' },
  cards:  { type: 'Fact cards',        category: 'Printables', plural: 'Fact Card Decks' },
  book:   { type: 'Mini books',        category: 'Printables', plural: 'Mini Books' },
  kids:   { type: 'Kids activities',   category: 'Kids',       plural: 'Kids Activity Packs' },
  poster: { type: 'Posters',           category: 'Posters',    plural: 'Facts Posters' },
  walls:  { type: 'Phone wallpapers',  category: 'Wallpapers', plural: 'Phone Wallpaper Sets' },
};
const FEATURED = new Set(['bundle-teacher', 'quiz-mixed', 'cards-mixed', 'kids-mixed', 'poster-space', 'walls-space']);   // the six on the home page and first in the shop
const FAMILY_ORDER = Object.keys(FAMILIES);
const THEME_ORDER = Object.keys(THEMES);

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const base = readJson(path.join(ROOT, 'lib/catalog-base.json'));
const gen = readJson(path.join(SHOP, 'catalog-gen.json'));

// base listings win over generated ones with the same sku
const bySku = new Map();
for (const p of [...gen, ...base.products]) bySku.set(p.sku, { ...p });
const singles = [...bySku.values()].map((p) => {
  const fam = FAMILIES[p.family];
  if (!fam) throw new Error(`${p.sku}: unknown family ${p.family}`);
  if (!THEMES[p.theme]) throw new Error(`${p.sku}: unknown theme ${p.theme}`);
  return {
    ...p, category: fam.category, type: fam.type, themeName: THEMES[p.theme],
    ...(p.family === 'kids' ? { age: '6 to 12' } : {}),
  };
}).sort((a, b) => THEME_ORDER.indexOf(a.theme) - THEME_ORDER.indexOf(b.theme) || FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family));

// ---- bundles ----
const roundDown9 = (n) => Math.max(9, Math.floor(n / 10) * 10 - 1);
const total = (skus) => skus.reduce((t, s) => t + bySku.get(s).price, 0);
function bundle(sku, name, skus, rate, text, extra = {}) {
  const worth = total(skus);
  return { sku, name, price: roundDown9(worth * rate), worth, unit: `${skus.length} products`, text, category: 'Bundles', family: 'bundle',
    type: 'Bundles', includes: skus, ...extra };
}
const bundles = [];
const themesInUse = THEME_ORDER.filter((t) => singles.some((p) => p.theme === t));
for (const t of themesInUse) {
  const skus = singles.filter((p) => p.theme === t).map((p) => p.sku);
  if (skus.length < 3) continue;
  bundles.push(bundle(`bundle-${t}`, `${THEMES[t]} Complete Pack`, skus, BUNDLE_RATE.theme,
    `Every ${THEMES[t].toLowerCase()} product in one go: ${skus.length} products, from quiz night to phone wallpapers, with one payment and one order page.`, { theme: t, themeName: THEMES[t] }));
}
for (const f of FAMILY_ORDER) {
  const skus = singles.filter((p) => p.family === f).map((p) => p.sku);
  if (skus.length < 5) continue;
  bundles.push(bundle(`bundle-all-${f}`, `All ${FAMILIES[f].plural}`, skus, BUNDLE_RATE.type,
    `All ${skus.length} ${FAMILIES[f].plural.toLowerCase()} across every topic, for about half the price of buying them one by one.`, { familyBundle: f }));
}
const mixed = (fs_) => fs_.map((f) => `${f}-mixed`).filter((s) => bySku.has(s));
bundles.push(bundle('bundle-teacher', "Teacher's Classroom Kit", mixed(['quiz', 'cards', 'tf', 'bingo', 'kids', 'poster']), BUNDLE_RATE.kit,
  'Quiz pack, fact cards, true-or-false, bingo, a kids activity pack and a poster, all mixed-science and ready to print for the classroom.'));
bundles.push(bundle('bundle-kids-mega', 'Kids Mega Pack', singles.filter((p) => p.family === 'kids' || (p.family === 'tf' && p.theme === 'mixed')).map((p) => p.sku),
  BUNDLE_RATE.kit, 'Every kids activity pack plus a true-or-false game: worksheets, word searches and match-ups for ages 6 to 12, with answers.', { age: '6 to 12' }));
bundles.push(bundle('bundle-everything', 'Everything Bundle', singles.map((p) => p.sku), BUNDLE_RATE.mega,
  `Every product in the shop: ${singles.length} quiz packs, card decks, posters, games, kids packs and wallpapers. One payment, one order page.`));

// ---- files ----
fs.rmSync(path.join(ROOT, 'products'), { recursive: true, force: true });
let bytes = 0;
for (const p of singles) {
  const dir = path.join(SHOP, 'products', p.sku);
  if (!fs.existsSync(dir)) throw new Error(`${p.sku}: no product folder at ${dir}`);
  const labels = fs.existsSync(path.join(dir, 'files.json')) ? readJson(path.join(dir, 'files.json')) : {};
  const names = fs.readdirSync(dir).filter((n) => TYPES[path.extname(n).toLowerCase()]).sort();
  if (!names.length) throw new Error(`${p.sku}: no files`);
  p.files = names.map((name) => {
    const data = fs.readFileSync(path.join(dir, name));
    if (data.length > MAX) throw new Error(`${p.sku}/${name} is ${(data.length / 1e6).toFixed(1)} MB: split or compress it under 4 MB`);
    const iv = createHmac('sha256', KEY).update(createHash('sha256').update(data).digest()).digest().subarray(0, 12);
    const c = createCipheriv('aes-256-gcm', KEY, iv);
    const enc = Buffer.concat([c.update(data), c.final()]);
    const rel = `${p.sku}/${name}`;
    fs.mkdirSync(path.join(ROOT, 'products', p.sku), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'products', rel + '.enc'), Buffer.concat([iv, c.getAuthTag(), enc]));
    bytes += data.length;
    return { name, label: labels[name] || name, path: rel, size: data.length, type: TYPES[path.extname(name).toLowerCase()] };
  });
}

// ---- previews ----
const OUT = path.join(ROOT, 'public/media/shop');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
let previews = 0;
for (const n of fs.readdirSync(path.join(SHOP, 'previews'))) {
  const sku = n.replace(/-\d\.(webp|jpg|png)$/, '');
  if (!bySku.has(sku)) continue;
  fs.copyFileSync(path.join(SHOP, 'previews', n), path.join(OUT, n)); previews++;
}

const products = [...singles, ...bundles].map((p) => ({ ...p, ...(FEATURED.has(p.sku) ? { featured: true } : {}) }));
fs.writeFileSync(path.join(ROOT, 'lib/catalog.json'), JSON.stringify({ upiId: base.upiId, payee: base.payee, products }, null, 1) + '\n');
console.log(`${singles.length} products + ${bundles.length} bundles, ${(bytes / 1e6).toFixed(1)} MB of files, ${previews} previews`);
for (const b of bundles) console.log(`  ${b.sku.padEnd(24)} ${String(b.includes.length).padStart(3)} items  worth ₹${b.worth}  price ₹${b.price}`);
