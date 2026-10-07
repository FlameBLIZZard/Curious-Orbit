// Private orders page backend. Header x-admin-key must match the ADMIN_KEY env var.
// GET: every order + totals. POST {id, status, note}: approve / reject / reset an order.
import { allOrders, readJson, writeJson, isAdmin } from '../lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!isAdmin(req)) return res.status(401).json({ error: 'Wrong password.' });
  if (req.method === 'GET') {
    const orders = await allOrders();
    const sum = (f) => orders.filter(f).reduce((t, o) => t + o.amount, 0);
    return res.status(200).json({ orders, totals: {
      earned: sum((o) => o.status === 'approved'), pending: sum((o) => o.status === 'pending'),
      approvedCount: orders.filter((o) => o.status === 'approved').length, pendingCount: orders.filter((o) => o.status === 'pending').length,
    } });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use GET or POST' });
  const { id, status, note } = req.body || {};
  if (!['approved', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: 'Unknown status' });
  const o = await readJson(`orders/${id}.json`);
  if (!o) return res.status(404).json({ error: 'No such order' });
  o.status = status; o.updatedAt = new Date().toISOString();
  if (typeof note === 'string') o.note = note.slice(0, 300);
  await writeJson(`orders/${o.id}.json`, o);
  return res.status(200).json({ order: o });
}
