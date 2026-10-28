// Checks the shop end to end against a running dev server + mock gateway:
//   PRODUCT_KEY=<hex> node tools/test-shop.mjs        (dev server on :3000 with the GATEWAY_* env of tools/mock-gateway.mjs, mock on :6100)
// 1. catalogue: every product has files, every encrypted file decrypts to a real PDF/JPG/PNG, bundles only include real products
// 2. gateway: bad signature, unknown order, wrong amount, observed-only, duplicate delivery, reconciled -> approved -> download
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createDecipheriv, createHmac, randomUUID } from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SITE = process.env.SITE_URL || 'http://localhost:3000', SECRET = process.env.GATEWAY_WEBHOOK_SECRET || 'mock-secret';
const KEY = Buffer.from(process.env.PRODUCT_KEY || '', 'hex');
const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib/catalog.json'), 'utf8'));
const utr = () => String(Math.floor(1e11 + Math.random() * 9e11));   // fresh per run: the dev store remembers every UTR
let n = 0; const ok = (m) => { n++; console.log('ok', m); };

// ---- catalogue ----
const bySku = new Map(cat.products.map((p) => [p.sku, p]));
assert.equal(bySku.size, cat.products.length, 'duplicate sku');
let files = 0;
for (const p of cat.products) {
  assert.ok(Number.isInteger(p.price) && p.price > 0, `${p.sku}: price`);
  assert.ok(p.name && p.text && p.unit && p.category && p.type, `${p.sku}: missing text fields`);
  if (p.includes) { for (const s of p.includes) assert.ok(bySku.has(s) && !bySku.get(s).includes, `${p.sku}: bad include ${s}`); assert.ok(p.price < p.worth, `${p.sku}: bundle not cheaper`); continue; }
  assert.ok(p.files.length, `${p.sku}: no files`);
  for (const f of p.files) {
    const blob = fs.readFileSync(path.join(ROOT, 'products', f.path + '.enc'));
    const d = createDecipheriv('aes-256-gcm', KEY, blob.subarray(0, 12)); d.setAuthTag(blob.subarray(12, 28));
    const out = Buffer.concat([d.update(blob.subarray(28)), d.final()]);
    const head = out.subarray(0, 4).toString('latin1');
    assert.ok(head === '%PDF' || out[0] === 0xff || head.slice(1, 4) === 'PNG', `${f.path}: not a PDF/JPG/PNG`);
    assert.equal(out.length, f.size, `${f.path}: size`);
    files++;
  }
  assert.ok(fs.existsSync(path.join(ROOT, 'public/media/shop', `${p.sku}-1.webp`)), `${p.sku}: no preview`);
}
ok(`catalogue: ${cat.products.length} listings, ${files} encrypted files decrypt`);

// ---- gateway ----
const post = (url, body, headers = {}) => fetch(SITE + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const hook = (b, { secret = SECRET, id = randomUUID() } = {}) => {
  const raw = JSON.stringify({ deliveryId: id, method: 'UPI', ...b }), ts = String(Date.now());
  return post('/api/gateway-webhook', raw, { 'X-Gateway-Delivery-Id': id, 'X-Gateway-Timestamp': ts, 'X-Gateway-Signature-V2': 'sha256=' + createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex') });
};
const order = async (sku) => {
  const r = await post('/api/checkout', { sku, name: 'Test Buyer', email: 'test@example.com' });
  assert.equal(r.status, 200, 'checkout'); return r.json();
};
const get = async (o) => (await fetch(`${SITE}/api/order?id=${o.id}&k=${o.url.split('k=')[1]}`)).json();

assert.equal((await (await fetch(SITE + '/api/checkout')).json()).gateway, true); ok('gateway reported on');
assert.equal((await post('/api/checkout', { sku: 'nope', name: 'a', email: 'a@b.co' })).status, 400); ok('unknown product rejected');
assert.equal((await post('/api/checkout', { sku: 'quiz-space', name: 'a', email: 'bad' })).status, 400); ok('bad email rejected');

const o = await order('quiz-space'), U1 = utr(), price = bySku.get('quiz-space').price;
const ev = (event, extra = {}) => ({ event, orderId: o.id, amount: price.toFixed(2), amountPaise: price * 100, settlementState: event === 'RECONCILED' ? 'RECONCILED' : 'PENDING', utr: U1, ...extra });
assert.equal((await hook(ev('RECONCILED'), { secret: 'wrong' })).status, 400); ok('wrong secret rejected');
assert.equal((await post('/api/gateway-webhook', JSON.stringify(ev('RECONCILED')))).status, 400); ok('unsigned webhook rejected');
assert.equal((await hook({ ...ev('RECONCILED'), orderId: 'CO-ZZZZZZ' })).status, 404); ok('unknown order rejected');
assert.equal((await hook(ev('RECONCILED', { amountPaise: 100, amount: '1.00' }))).status, 200);
assert.equal((await get(o)).status, 'pending'); ok('wrong amount does not approve (goes to /admin To check)');
assert.equal((await hook(ev('RECONCILED', { settlementState: 'PENDING' }))).status, 200);
assert.equal((await get(o)).status, 'pending'); ok('RECONCILED event without settlement does not approve');
await hook(ev('OBSERVED_SUCCESS'));
let s = await get(o); assert.equal(s.status, 'pending'); assert.equal(s.gateway, 'observed'); assert.equal(s.files.length, 0); ok('observed only: pending, no files');
const id = randomUUID();
assert.equal((await hook(ev('RECONCILED'), { id })).status, 200);
s = await get(o); assert.equal(s.status, 'approved'); assert.ok(s.files.length); ok('reconciled: approved with files');
const dl = await fetch(SITE + s.files[0].url); assert.equal(dl.status, 200); assert.equal(Buffer.from(await dl.arrayBuffer()).subarray(0, 4).toString(), '%PDF'); ok('download works');
assert.deepEqual(await (await hook(ev('RECONCILED'), { id })).json(), { ok: true, duplicate: true }); ok('duplicate delivery ignored');
await hook(ev('FAILED')); assert.equal((await get(o)).status, 'approved'); ok('late FAILED cannot undo an approval');

const o2 = await order('quiz-mixed');
await hook({ ...ev('RECONCILED'), orderId: o2.id, utr: U1 });
assert.equal((await get(o2)).status, 'pending'); ok('a UTR already used by another order is not approved');
const o3 = await order('quiz-mixed'); await hook({ event: 'FAILED', orderId: o3.id });
assert.equal((await get(o3)).status, 'failed'); ok('failed payment shown as failed');

const b = await order('bundle-teacher');
await hook({ event: 'RECONCILED', orderId: b.id, amount: String(bySku.get('bundle-teacher').price) + '.00', amountPaise: bySku.get('bundle-teacher').price * 100, settlementState: 'RECONCILED', utr: utr() });
s = await get(b); assert.equal(s.status, 'approved'); assert.equal(s.files.length, bySku.get('bundle-teacher').includes.reduce((t, k) => t + bySku.get(k).files.length, 0)); assert.ok(s.files.every((f) => f.group)); ok('bundle approves with every file, grouped by product');
console.log(`\n${n} checks passed`);
