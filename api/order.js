// POST: a buyer says they paid by UPI -> saves a pending order. GET ?id&k: the buyer's order page polls this.
import { catalog, product, newId, newKey, readJson, writeJson, publicOrder } from '../lib/store.js';
import { quote } from '../lib/pricing.js';

const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    const { id, k } = req.query;
    if (!/^CO-[A-Z0-9]{6}$/.test(String(id || ''))) return res.status(400).json({ error: 'That order link is not complete.' });
    const o = await readJson(`orders/${id}.json`);
    if (!o || o.key !== k) return res.status(404).json({ error: 'We could not find that order. Check the link.' });
    return res.status(200).json(publicOrder(o));
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  if (!catalog.upiId) return res.status(503).json({ error: 'Payments are not switched on yet.' });

  const b = req.body || {};
  const kind = b.kind === 'tip' ? 'tip' : 'order';
  const name = clean(b.name, 80), email = clean(b.email, 120).toLowerCase(), utr = clean(b.utr, 22).replace(/\s/g, '');
  const q = kind === 'order' ? quote(catalog, Array.isArray(b.items) ? b.items.slice(0, 300) : [b.sku], b.code) : null;
  if (kind === 'order' && !q.items.length) return res.status(400).json({ error: 'Your cart is empty or those products no longer exist.' });
  // The buyer paid what their screen showed: if our total differs (a price or offer changed), stop before saving.
  if (kind === 'order' && Math.round(Number(b.amount)) !== q.total) return res.status(409).json({ error: `Prices changed since you opened this page. The total is now ₹${q.total}. Refresh, and if you already paid a different amount, message us on Instagram.` });
  if (!name) return res.status(400).json({ error: 'Add your name so we can match your payment.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'That email address does not look right.' });
  if (!/^\d{12}$/.test(utr)) return res.status(400).json({ error: 'The UPI reference (UTR) is the 12-digit number in your payment app. Check it and try again.' });
  const amount = kind === 'order' ? q.total : Math.round(Number(b.amount) || 0);
  if (kind === 'tip' && (amount < 1 || amount > 100000)) return res.status(400).json({ error: 'Add the amount you sent.' });

  // One UTR = one payment: stops the same reference being used twice.
  if (await readJson(`utr/${utr}.json`)) return res.status(409).json({ error: 'That UPI reference has already been used for an order. If this is a mistake, email us.' });

  const now = new Date().toISOString();
  const names = q ? q.items.map((s) => product(s).name) : [];
  const label = !q ? 'Tip' : names.length <= 2 ? names.join(' + ') : `${names[0]} + ${names.length - 1} more`;
  const o = { id: newId(), key: newKey(), kind, sku: q ? q.items[0] : 'tip', items: q ? q.items : [], product: label, amount,
    subtotal: q ? q.subtotal : amount, discount: q ? q.tierOff + q.codeOff : 0, code: q ? q.code : '', name, email, utr,
    status: 'pending', createdAt: now, updatedAt: now, note: '', downloads: 0 };
  await writeJson(`orders/${o.id}.json`, o);
  await writeJson(`utr/${utr}.json`, { id: o.id });
  return res.status(200).json({ id: o.id, key: o.key, url: `/order?id=${o.id}&k=${o.key}` });
}
