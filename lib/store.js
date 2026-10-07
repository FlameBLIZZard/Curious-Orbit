// Orders live as small JSON files in a private Vercel Blob store (BLOB_READ_WRITE_TOKEN is set by Vercel).
import { put, get, list } from '@vercel/blob';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const catalog = JSON.parse(readFileSync(path.join(process.cwd(), 'lib/catalog.json'), 'utf8'));
export const product = (sku) => catalog.products.find((p) => p.sku === sku);

const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const newId = () => 'CO-' + [...randomBytes(6)].map((b) => ALPHA[b % ALPHA.length]).join('');
export const newKey = () => randomBytes(18).toString('base64url');

export async function readJson(pathname) {
  const r = await get(pathname, { access: 'private', useCache: false }).catch(() => null);
  if (!r || r.statusCode !== 200) return null;
  return JSON.parse(await new Response(r.stream).text());
}
export const writeJson = (pathname, data) => put(pathname, JSON.stringify(data, null, 1), {
  access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60,
});

export async function allOrders() {
  const paths = [];
  let cursor;
  do {
    const page = await list({ prefix: 'orders/', cursor, limit: 1000 });
    page.blobs.forEach((b) => paths.push(b.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  const out = [];
  for (let i = 0; i < paths.length; i += 20) out.push(...await Promise.all(paths.slice(i, i + 20).map(readJson)));
  return out.filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Buyer-safe view of an order: never includes other people's data or the admin note.
export function publicOrder(o) {
  const p = product(o.sku);
  const files = o.status === 'approved' && p ? filesFor(p).map((f, i) => ({ name: f.name, label: f.label, size: f.size, url: `/api/download?id=${o.id}&k=${o.key}&f=${i}` })) : [];
  return { id: o.id, kind: o.kind, product: p ? p.name : 'Tip', amount: o.amount, status: o.status, createdAt: o.createdAt, files };
}
// A bundle unlocks every product's files.
export function filesFor(p) {
  if (p.includes) return p.includes.flatMap((s) => (product(s) ? product(s).files : []));
  return p.files || [];
}

export function sameKey(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && timingSafeEqual(x, y);
}
export const isAdmin = (req) => !!process.env.ADMIN_KEY && sameKey(req.headers['x-admin-key'], process.env.ADMIN_KEY);
