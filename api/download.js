// Streams one paid file. Product files sit in the repo encrypted (products/<sku>/<file>.enc,
// AES-256-GCM: 12-byte IV + 16-byte tag + data) and only this function holds PRODUCT_KEY.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createDecipheriv } from 'node:crypto';
import { readJson, writeJson, product, filesFor } from '../lib/store.js';

export default async function handler(req, res) {
  const { id, k, f } = req.query;
  if (!/^CO-[A-Z0-9]{6}$/.test(String(id || ''))) return res.status(400).send('Incomplete link');
  const o = await readJson(`orders/${id}.json`);
  if (!o || o.key !== k) return res.status(404).send('Order not found');
  if (o.status !== 'approved') return res.status(403).send('This order is not approved yet.');
  const file = filesFor(product(o.sku) || {})[Number(f)];
  if (!file) return res.status(404).send('File not found');
  const blob = readFileSync(path.join(process.cwd(), 'products', file.path + '.enc'));
  const d = createDecipheriv('aes-256-gcm', Buffer.from(process.env.PRODUCT_KEY, 'hex'), blob.subarray(0, 12));
  d.setAuthTag(blob.subarray(12, 28));
  const out = Buffer.concat([d.update(blob.subarray(28)), d.final()]);
  o.downloads = (o.downloads || 0) + 1; o.lastDownloadAt = new Date().toISOString();
  writeJson(`orders/${o.id}.json`, o).catch(() => {});
  res.setHeader('Content-Type', file.type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).send(out);
}
