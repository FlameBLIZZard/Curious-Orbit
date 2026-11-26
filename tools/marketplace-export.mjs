#!/usr/bin/env node
// Marketplace export: turns the shop catalogue into upload-ready folders for Teachers Pay Teachers, Etsy and Gumroad.
//
//   PowerShell:  $env:PRODUCT_KEY = '<64 hex>'; node tools/marketplace-export.mjs
//   bash:        PRODUCT_KEY=<64 hex> node tools/marketplace-export.mjs
//
// Options:  --out <dir>        where to write (default: ~/Curious-Orbit/03-marketplace)
//           --root <dir>       repo root to read lib/catalog.json, products/ and public/media/shop from (default: this repo)
//           --listings-only    skip decrypting (no PRODUCT_KEY needed): writes listings, CSV and images only
//
// For each listing it writes products/NNN-<sku>/ with:
//   listing.md   titles for each site, USD + INR price, description, 13 Etsy tags, TpT grades/subject
//   images/      listing images as JPG (the two shop previews; a 2 x 2 collage for bundles)
//   files/       the decrypted product files (PDF / JPG)
//   <sku>.zip    one upload file for TpT/Gumroad, and for Etsy when there are more than 5 files.
//                Big bundles are split into parts under 19 MB (Etsy's limit is 20 MB a file).
// plus listings.csv (one row per listing) and README.md (how to upload) at the top.
// The key is only read from the environment and never written anywhere.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDecipheriv } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { crc32 } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const ROOT = path.resolve(opt('--root', path.join(path.dirname(fileURLToPath(import.meta.url)), '..')));
const OUT = path.resolve(opt('--out', path.join(os.homedir(), 'Curious-Orbit', '03-marketplace')));
const LISTINGS_ONLY = args.includes('--listings-only');

let KEY = null;
if (!LISTINGS_ONLY) {
  KEY = Buffer.from(process.env.PRODUCT_KEY || '', 'hex');
  if (KEY.length !== 32) {
    console.error('Set PRODUCT_KEY to the same 64 hex characters as on Vercel, or pass --listings-only.');
    process.exit(1);
  }
}

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib/catalog.json'), 'utf8')).products;
const bySku = new Map(catalog.map((p) => [p.sku, p]));
const SHOTS = path.join(ROOT, 'public/media/shop');
const HAVE_FFMPEG = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;

// ---------- prices (USD for international marketplaces; the INR shop price is kept alongside) ----------
const USD = { quiz: 3.99, cards: 3.99, poster: 2.99, bingo: 3.49, kids: 3.49, tf: 2.49, walls: 1.99, book: 3.49 };
const usdOf = (p) => {
  if (p.family !== 'bundle') return USD[p.family];
  const sum = p.includes.reduce((t, s) => t + usdOf(bySku.get(s)), 0);
  const v = Math.floor(sum * (p.price / p.worth)) - 0.01;          // same discount as the INR bundle
  return Math.max(4.99, +v.toFixed(2));
};
const usdWorth = (p) => +p.includes.reduce((t, s) => t + usdOf(bySku.get(s)), 0).toFixed(2);

// ---------- words ----------
const THEME_TAGS = {
  space: ['space', 'astronomy', 'solar system', 'planets'], ocean: ['ocean', 'marine biology', 'sea creatures'],
  earth: ['earth science', 'weather', 'geology'], physics: ['physics', 'chemistry', 'physical science'],
  body: ['human body', 'anatomy', 'biology'], animals: ['animals', 'animal facts', 'zoology'],
  dinosaurs: ['dinosaurs', 'paleontology', 'dino'], plants: ['plants', 'botany', 'fungi'],
  brain: ['brain', 'psychology', 'neuroscience'], tech: ['technology', 'math facts', 'numbers'],
  food: ['food science', 'kitchen science', 'everyday science'], history: ['history of science', 'inventors', 'scientists'],
  bugs: ['insects', 'bugs', 'microbes'], myths: ['myth busting', 'misconceptions', 'science myths'],
  mixed: ['general science', 'stem', 'science trivia'],
};
const TPT_SUBJECT = {
  space: 'Astronomy', ocean: 'Biology', earth: 'Earth Sciences', physics: 'Physics', body: 'Biology', animals: 'Biology',
  dinosaurs: 'Earth Sciences', plants: 'Biology', brain: 'Biology', tech: 'Math', food: 'Chemistry', history: 'Science',
  bugs: 'Biology', myths: 'Science', mixed: 'General Science',
};
const FAM = {
  quiz: {
    short: 'quiz', kw: ['science quiz', 'trivia night', 'pub quiz printable', 'classroom quiz', 'trivia questions'],
    tptType: 'Activities, Games, Assessment', grades: '5th-9th, Adult Education, Homeschool',
    who: 'Teachers running a review lesson or an end-of-term quiz (grades 5 to 9), homeschool families, and anyone hosting a pub or family trivia night.',
    how: 'Print the team answer sheets, split the room into teams and read the four rounds aloud. The host key has every answer with its source.',
  },
  tf: {
    short: 'true or false', kw: ['true or false game', 'task cards', 'brain break', 'classroom game', 'science game'],
    tptType: 'Task Cards, Games, Bell Ringers', grades: '3rd-8th, Homeschool',
    who: 'Warm-ups, brain breaks and early-finisher tasks for grades 3 to 8, and family game night.',
    how: 'Cut out the cards, read a statement, and have everyone vote true or false before you reveal the answer. The answer sheet gives a one-line explanation and a source for each.',
  },
  bingo: {
    short: 'bingo', kw: ['science bingo', 'bingo cards', 'classroom bingo', 'printable bingo', 'class party game'],
    tptType: 'Games, Activities', grades: '3rd-8th, Homeschool',
    who: 'A whole-class game for grades 3 to 8 (up to 30 players), clubs, parties and family game nights.',
    how: 'Hand out the bingo cards, then read questions from the caller sheet. Players mark the answer if it is on their card. First full line wins.',
  },
  cards: {
    short: 'fact cards', kw: ['fact cards', 'science flashcards', 'printable cards', 'trivia cards', 'fact of the day'],
    tptType: 'Flash Cards, Task Cards, Bulletin Board Ideas', grades: '3rd-12th, Homeschool',
    who: 'Fact-of-the-day routines, display walls, early finishers, and curious kids and adults (grade 3 and up).',
    how: 'Print double-sided, then cut along the guides: the fact is on the front, the explanation and source on the back.',
  },
  kids: {
    short: 'kids activity', kw: ['kids worksheets', 'word search', 'kids activity pack', 'science worksheet', 'ages 6 to 12'],
    tptType: 'Worksheets, Activities, Printables', grades: '1st-6th, Homeschool',
    who: 'Kids aged 6 to 12: homeschool lessons, sub plans, rainy days, travel and quiet time.',
    how: 'Print the pages and hand them out. Answers are included so you can check work quickly.',
  },
  poster: {
    short: 'poster', kw: ['science poster', 'classroom poster', 'printable poster', 'dark wall art', 'a3 poster'],
    tptType: 'Posters, Classroom Decor', grades: 'Not Grade Specific',
    who: 'Classroom walls, bedrooms, study corners and science fans of any age.',
    how: 'Print the A3 file for a wall or the A4 file for a folder or notebook, on a home printer or at any print shop.',
  },
  walls: {
    short: 'wallpaper', kw: ['phone wallpaper', 'iphone wallpaper', 'dark wallpaper', 'lock screen', 'aesthetic wallpaper'],
    tptType: 'Fun Stuff', grades: 'Not Grade Specific',
    who: 'Science fans who want a fact on their lock screen. A nice small gift for a curious teen or student.',
    how: 'Save an image to your phone and set it as your lock screen or wallpaper.',
  },
  book: {
    short: 'mini book', kw: ['mini book', 'myth busters', 'printable book', 'science myths', 'fun facts book'],
    tptType: 'Printables, Literature', grades: '5th-12th, Adult Education, Homeschool',
    who: 'Curious readers aged 10 and up, classroom libraries, and the friend who always says "actually...".',
    how: 'Read it on a phone or tablet, or print it as an A5 mini book.',
  },
};
const COMMON_TAGS = ['printable pdf', 'instant download', 'stem activity', 'teacher resource', 'homeschool science'];

function tags(p) {
  const out = [];
  const add = (t) => { t = t.toLowerCase().trim(); if (t && t.length <= 20 && !out.includes(t) && out.length < 13) out.push(t); };
  if (p.family === 'bundle') {
    add('science bundle'); add('printable bundle');
    if (p.theme) THEME_TAGS[p.theme].forEach(add);
    if (p.familyBundle) FAM[p.familyBundle].kw.forEach(add);
    ['classroom games', 'science activities', 'trivia night', 'science worksheet', 'fact cards'].forEach(add);
  } else {
    const f = FAM[p.family];
    add(`${THEME_TAGS[p.theme][0]} ${f.short}`);
    THEME_TAGS[p.theme].forEach(add);
    f.kw.forEach(add);
  }
  COMMON_TAGS.forEach(add);
  ['science facts', 'science printable', 'curious orbit', 'fun facts'].forEach(add);
  return out;
}

const clean = (s) => String(s).replace(/\s+/g, ' ').trim();
const ETSY_NAME = {
  quiz: 'Science Trivia Quiz', tf: 'True or False Task Cards', bingo: 'Science Bingo Game', cards: 'Science Fact Cards',
  kids: 'Science Worksheets for Kids', poster: 'Science Wall Art Print', walls: 'Facts Lock Screen', book: 'Fun Facts Mini Book',
  bundle: 'Science Printables Bundle',
};
const isWalls = (p) => p.family === 'walls' || p.familyBundle === 'walls';
function titles(p) {
  const fmt = isWalls(p) ? 'Digital Download' : 'Printable PDF';
  const theme = p.theme === 'mixed' ? 'General Science' : p.themeName;
  const extra = (isWalls(p) && p.family === 'bundle' ? 'Science Phone Wallpaper Bundle'
    : p.family === 'bundle' ? ETSY_NAME.bundle : `${theme} ${ETSY_NAME[p.family]}`)
    .replace(/\b(\w+) \1\b/gi, '$1');   // "History of Science Science Fact Cards" -> one "Science"
  const parts = [p.name, p.unit, extra, fmt, 'Instant Download'].map((s) => clean(s).replace(/\b(\w+) \1\b/gi, '$1'));
  while (parts.join(' | ').length > 140) parts.splice(parts.length - 2, 1);   // drop whole parts, never cut a word
  const etsy = parts.join(' | ');
  const tpt = clean(p.family === 'bundle' ? `${p.name} | ${p.unit} of Science Printables` : `${p.name} | ${p.unit}`).slice(0, 80);
  return { etsy, tpt, gumroad: p.name };
}

function whatYouGet(p) {
  if (p.family === 'bundle') {
    return p.includes.map((s) => { const q = bySku.get(s); return `- ${q.name} (${q.unit})`; }).join('\n');
  }
  if (p.family === 'walls') return `- ${p.files.length} phone wallpapers as JPG files (${p.files[0].label.replace(/^.*\((.*)\)$/, '$1')})`;
  return p.files.map((f) => `- ${f.label}`).join('\n');
}

function description(p) {
  const f = FAM[p.family];
  const bundleNote = p.family === 'bundle'
    ? `\nBought one by one these cost $${usdWorth(p).toFixed(2)}. The bundle saves you about ${Math.round(100 - (usdOf(p) / usdWorth(p)) * 100)}%.\n` : '';
  const printing = isWalls(p) ? 'Sized for modern phones; they crop well on most screens.'
    : 'A4 PDF. To print on US Letter, choose "Fit to page" in the print dialog.';
  // the shop text mentions the website's order page, which marketplaces don't have
  const text = p.text.replace(/,? with one payment and one order page/, '').replace(/ One payment, one order page\./, '');
  return `${text}
${bundleNote}
WHAT YOU GET
${whatYouGet(p)}
- Instant digital download. Nothing is shipped.
${p.family === 'bundle' ? '' : `
WHO IT'S FOR
${f.who}

HOW TO USE IT
${f.how}
`}
ABOUT THE FACTS
Every fact comes with a short source line (space agencies, encyclopaedias, universities, museums and peer-reviewed papers), so you can check anything a student questions.

PRINTING
${printing}

LICENCE
For personal and single-classroom use. Print as many copies as you need for your own home, class or club. Please don't resell or share the files.

ABOUT CURIOUS ORBIT
Made by Curious Orbit (@curiousorbit.daily on Instagram), a daily science-facts series. Designed with AI-assisted tools; the facts were checked against the sources listed.`;
}

// ---------- files ----------
function decrypt(rel) {
  const blob = fs.readFileSync(path.join(ROOT, 'products', rel + '.enc'));
  try {
    const d = createDecipheriv('aes-256-gcm', KEY, blob.subarray(0, 12));
    d.setAuthTag(blob.subarray(12, 28));
    return Buffer.concat([d.update(blob.subarray(28)), d.final()]);
  } catch {
    console.error(`Could not decrypt ${rel}: PRODUCT_KEY is not the key these files were encrypted with.`);
    process.exit(1);
  }
}

function toJpg(src, dest) {
  if (!HAVE_FFMPEG) { fs.copyFileSync(src, dest.replace(/\.jpg$/, '.webp')); return; }
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', src, '-q:v', '2', dest]);
  if (r.status !== 0) throw new Error(`ffmpeg failed on ${src}: ${r.stderr}`);
}

function collage(skus, dest) {
  const shots = skus.slice(0, 4).map((s) => path.join(SHOTS, `${s}-1.webp`)).filter((f) => fs.existsSync(f));
  if (!HAVE_FFMPEG || shots.length < 4) { if (shots[0]) toJpg(shots[0], dest); return; }
  const inputs = shots.flatMap((f) => ['-i', f]);
  const filter = shots.map((_, i) => `[${i}:v]scale=600:750[v${i}]`).join(';') + ';[v0][v1][v2][v3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0[out]';
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', ...inputs, '-filter_complex', filter, '-map', '[out]', '-q:v', '2', dest]);
  if (r.status !== 0) throw new Error(`ffmpeg collage failed: ${r.stderr}`);
}

// Minimal ZIP writer (stored, no compression: PDFs and JPGs are already compressed). UTF-8 names.
function writeZip(dest, entries) {
  const chunks = []; const central = []; let offset = 0;
  for (const { name, data } of entries) {
    const n = Buffer.from(name, 'utf8'); const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(n.length, 26); local.writeUInt16LE(0, 28);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(0, 10);
    cen.writeUInt32LE(0, 12); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(n.length, 28); cen.writeUInt32LE(offset, 42);
    chunks.push(local, n, data); central.push(cen, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  fs.writeFileSync(dest, Buffer.concat([...chunks, cd, end]));
}

function zipInParts(dir, base, entries, limit = 19e6) {
  const parts = [[]]; let size = 0;
  for (const e of entries) {
    if (size + e.data.length > limit && parts.at(-1).length) { parts.push([]); size = 0; }
    parts.at(-1).push(e); size += e.data.length;
  }
  return parts.map((ents, i) => {
    const name = parts.length === 1 ? `${base}.zip` : `${base}-part${i + 1}of${parts.length}.zip`;
    writeZip(path.join(dir, name), ents);
    return name;
  });
}

// ---------- run ----------
const order = [...catalog].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)
  || (a.family === 'bundle') - (b.family === 'bundle'));
fs.rmSync(path.join(OUT, 'products'), { recursive: true, force: true });   // generated output only; numbering can change between runs
fs.mkdirSync(path.join(OUT, 'products'), { recursive: true });
const fileCache = new Map();   // sku -> [{name, data}]
const filesOf = (p) => {
  if (!fileCache.has(p.sku)) fileCache.set(p.sku, p.files.map((f) => ({ name: f.name, data: decrypt(f.path) })));
  return fileCache.get(p.sku);
};

const rows = [];
let n = 0;
for (const p of order) {
  n += 1;
  const dir = path.join(OUT, 'products', `${String(n).padStart(3, '0')}-${p.sku}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'images'), { recursive: true });

  if (p.family === 'bundle') collage(p.includes, path.join(dir, 'images', '1.jpg'));
  else for (const i of [1, 2]) { const s = path.join(SHOTS, `${p.sku}-${i}.webp`); if (fs.existsSync(s)) toJpg(s, path.join(dir, 'images', `${i}.jpg`)); }

  let uploads = [];
  if (!LISTINGS_ONLY) {
    const singles = p.family === 'bundle' ? p.includes.map((s) => bySku.get(s)) : [p];
    const entries = singles.flatMap((q) => filesOf(q).map((e) => ({ name: p.family === 'bundle' ? `${q.sku}/${e.name}` : e.name, data: e.data })));
    if (p.family !== 'bundle') {
      fs.mkdirSync(path.join(dir, 'files'), { recursive: true });
      for (const e of entries) fs.writeFileSync(path.join(dir, 'files', e.name), e.data);
    }
    if (entries.length === 1) uploads = [`files/${entries[0].name}`];
    else uploads = zipInParts(dir, p.sku, entries);
  }

  const t = titles(p); const tg = tags(p); const usd = usdOf(p);
  const f = FAM[p.family];
  const md = `# ${p.name}

| | |
|---|---|
| Price (USD: Etsy, TpT, Gumroad) | $${usd.toFixed(2)} |
| Price (INR: own shop) | ₹${p.price} |
| Upload | ${uploads.length ? uploads.map((u) => '`' + u + '`').join(', ') : '(run with PRODUCT_KEY to make the files)'} |
| Images | ${fs.readdirSync(path.join(dir, 'images')).map((i) => '`images/' + i + '`').join(', ')} |
${p.family !== 'bundle' ? `| TpT grades | ${f.grades} |\n| TpT subject | ${TPT_SUBJECT[p.theme]} |\n| TpT resource type | ${f.tptType} |\n` : `| Includes | ${p.includes.length} products (on TpT, build it with "Create a bundle" from the single listings) |\n`}
## Titles
- **Etsy** (${t.etsy.length}/140): ${t.etsy}
- **TpT** (${t.tpt.length}/80): ${t.tpt}
- **Gumroad**: ${t.gumroad}

## Etsy tags (${tg.length}/13)
${tg.join(', ')}

## Description (paste as is)
\`\`\`
${description(p)}
\`\`\`
`;
  fs.writeFileSync(path.join(dir, 'listing.md'), md);
  rows.push({ n, sku: p.sku, name: p.name, type: p.family, theme: p.theme || '', usd: usd.toFixed(2), inr: p.price,
    etsy_title: t.etsy, tpt_title: t.tpt, tags: tg.join(', '), upload: uploads.join(' + '), folder: path.basename(dir) });
}

const csvCell = (v) => `"${String(v).replace(/"/g, '""')}"`;
const header = Object.keys(rows[0]);
fs.writeFileSync(path.join(OUT, 'listings.csv'), '﻿' + [header.join(','), ...rows.map((r) => header.map((h) => csvCell(r[h])).join(','))].join('\r\n'));

const featured = rows.filter((r) => bySku.get(r.sku).featured).map((r) => `- \`products/${r.folder}\`: ${r.name} ($${r.usd})`).join('\n');
fs.writeFileSync(path.join(OUT, 'README.md'), `# Curious Orbit marketplace kit

${rows.length} listings (${rows.filter((r) => r.type !== 'bundle').length} products and ${rows.filter((r) => r.type === 'bundle').length} bundles), ready to upload to Teachers Pay Teachers, Etsy and Gumroad.
Made by \`tools/marketplace-export.mjs\` in the Curious-Orbit website repo. Re-running it replaces \`products/\` and \`listings.csv\`.

Each folder in \`products/\` has \`listing.md\` (titles, price, tags, description to paste), \`images/\` (listing photos)
and the file to upload (a PDF, or a ZIP when there is more than one file).
\`listings.csv\` has every listing in one sheet.

## Start with these (featured)
${featured}

List these first, see which ones sell, then add the rest in batches.

## Where to sell
1. **Teachers Pay Teachers** (teacherspayteachers.com). Teachers search it for exactly this: quizzes, bingo, task cards, worksheets.
   A free seller account works. Upload the PDF or ZIP, add the images as previews, paste the TpT title and description,
   pick the grades, subject and resource type from \`listing.md\`. Build each bundle from the single listings it includes.
2. **Etsy** (etsy.com). Big audience for printables, posters and phone wallpapers. There is a small fee per listing.
   Choose "Digital" as the item type. Etsy takes at most 5 files of 20 MB each, so upload the ZIP parts where there are any.
   Paste the Etsy title and the 13 tags. Keep the line about AI-assisted tools in the description: Etsy asks sellers to say so.
3. **Gumroad** (gumroad.com). The quickest to set up and the easiest link for the Instagram bio.
4. **Your own site** once it is unpaused on Vercel and \`demo\` is set to false in \`public/js/config.js\` (UPI, Indian buyers).

Check each site's current fees before you price. The USD prices here are a starting point.

## Money and tax
Each site pays out to an account in your name (PayPal, Payoneer or a bank account, depending on the site).
US marketplaces usually ask non-US sellers for a W-8BEN tax form during setup.
Keep a simple record of payouts for your own income tax.
`);

console.log(`Wrote ${rows.length} listings to ${OUT}${LISTINGS_ONLY ? ' (listings only, no product files)' : ''}.`);
if (!HAVE_FFMPEG) console.log('ffmpeg not found: images were copied as WebP. Etsy and TpT want JPG or PNG.');
