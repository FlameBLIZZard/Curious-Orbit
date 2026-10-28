// Webhook for the self-hosted UPI gateway (lib/gateway.js). Point the gateway's merchant webhook at
// https://<your domain>/api/gateway-webhook and give it the same secret as GATEWAY_WEBHOOK_SECRET.
//
// Only a bank-reconciled UPI payment for exactly the order amount unlocks files. A bank alert that has only been seen
// (OBSERVED_SUCCESS), a payment flagged for review, or anything that does not match leaves the order pending for /admin.
import { product, readJson, writeJson } from '../lib/store.js';
import { verifyWebhook } from '../lib/gateway.js';

export const config = { api: { bodyParser: false } };   // the signature covers the raw bytes

async function rawBody(req) {
  const chunks = [];
  for await (const c of req) { chunks.push(c); if (chunks.reduce((n, x) => n + x.length, 0) > 64 * 1024) throw new Error('too large'); }
  return Buffer.concat(chunks).toString('utf8');
}
const paise = (b) => Number.isInteger(b.amountPaise) ? b.amountPaise : Math.round(parseFloat(b.amount) * 100);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const secret = process.env.GATEWAY_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: 'Gateway webhook is not configured.' });

  let raw;
  try { raw = await rawBody(req); } catch (err) { return res.status(413).json({ error: 'Body too large' }); }
  if (!verifyWebhook(raw, req.headers, secret)) return res.status(400).json({ error: 'Bad signature' });
  let b;
  try { b = JSON.parse(raw); } catch (err) { return res.status(400).json({ error: 'Bad JSON' }); }

  const o = /^CO-[A-Z0-9]{6}$/.test(String(b.orderId || '')) ? await readJson(`orders/${b.orderId}.json`) : null;
  if (!o || o.via !== 'gateway') return res.status(404).json({ error: 'Unknown order' });
  const delivery = String(req.headers['x-gateway-delivery-id'] || b.deliveryId || '');
  o.deliveries = o.deliveries || [];
  if (delivery && o.deliveries.includes(delivery)) return res.status(200).json({ ok: true, duplicate: true });
  if (delivery) o.deliveries = [...o.deliveries, delivery].slice(-20);

  const ev = String(b.event || req.headers['x-gateway-event'] || '');
  const g = o.gateway = { ...o.gateway, state: o.gateway ? o.gateway.state : 'created', lastEvent: ev, paymentId: b.paymentId || (o.gateway && o.gateway.paymentId) };
  const note = (s) => { o.note = s; };
  const wasDone = o.status === 'approved' || o.status === 'rejected';

  if (ev === 'RECONCILED' && b.method === 'UPI' && b.settlementState === 'RECONCILED') {
    const utr = /^\d{12}$/.test(String(b.utr || '')) ? String(b.utr) : '';
    const owner = utr ? await readJson(`utr/${utr}.json`) : null;
    if (!product(o.sku) || paise(b) !== o.amount * 100) {
      g.state = 'mismatch'; if (!wasDone) o.status = 'pending'; note(`Gateway reports ${b.amount} INR paid; the order is ${o.amount} INR. Check the payment before approving.`);
    } else if (owner && owner.id !== o.id) {
      g.state = 'mismatch'; if (!wasDone) o.status = 'pending'; note(`UTR ${utr} is already attached to order ${owner.id}. Check before approving.`);
    } else if (!wasDone) {
      if (utr) { o.utr = utr; if (!owner) await writeJson(`utr/${utr}.json`, { id: o.id }); }
      g.state = 'reconciled'; o.status = 'approved'; note('Approved automatically: bank-reconciled UPI payment from the gateway.');
    }
  } else if (ev === 'OBSERVED_SUCCESS') {
    if (!wasDone) { g.state = 'observed'; o.status = 'pending'; if (/^\d{12}$/.test(String(b.utr || ''))) o.utr = String(b.utr); }
  } else if (ev === 'MANUAL_REVIEW') {
    if (!wasDone) { g.state = 'review'; o.status = 'pending'; note('The gateway flagged this payment for manual review.'); }
  } else if (ev === 'FAILED' || ev === 'EXPIRED' || ev === 'CANCELLED') {
    if (!wasDone && o.status !== 'pending') { g.state = ev.toLowerCase(); o.status = 'failed'; }
  }   // SUCCESS (cash on delivery / counter) and anything unknown: recorded in lastEvent, no change

  o.updatedAt = new Date().toISOString();
  await writeJson(`orders/${o.id}.json`, o);
  return res.status(200).json({ ok: true });
}
