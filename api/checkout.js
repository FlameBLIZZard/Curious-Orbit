// GET: does this site have a payment gateway switched on? ({ gateway: boolean })
// POST {sku, name, email}: saves an unpaid order, asks the gateway for a checkout page and returns its URL.
// The buyer pays there; the gateway calls /api/gateway-webhook, which approves the order.
import { product, newId, newKey, writeJson } from '../lib/store.js';
import { gatewayEnabled, createPayment } from '../lib/gateway.js';

const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json({ gateway: gatewayEnabled() });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use GET or POST' });
  if (!gatewayEnabled()) return res.status(503).json({ error: 'Instant checkout is not switched on. Pay the UPI ID directly instead.' });

  const b = req.body || {};
  const p = product(b.sku);
  const name = clean(b.name, 80), email = clean(b.email, 120).toLowerCase();
  if (!p) return res.status(400).json({ error: 'That product does not exist.' });
  if (!name) return res.status(400).json({ error: 'Add your name so we can match your payment.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'That email address does not look right.' });

  const now = new Date().toISOString();
  const o = { id: newId(), key: newKey(), kind: 'order', sku: p.sku, product: p.name, amount: p.price, name, email, utr: '',
    status: 'awaiting', via: 'gateway', createdAt: now, updatedAt: now, note: '', downloads: 0 };
  // where the gateway sends the buyer back to: our own domain only (never a Host header an attacker chose)
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  const origin = process.env.SITE_URL || (/^(curiousorbit\.aditya-dev\.com|[\w-]+\.vercel\.app)$/.test(host) ? `https://${host}` : /^localhost(:\d+)?$/.test(host) ? `http://${host}` : 'https://curiousorbit.aditya-dev.com');
  const url = `/order?id=${o.id}&k=${o.key}`;
  try {
    const pay = await createPayment({ orderId: o.id, amountRupees: p.price, returnUrl: origin + url });
    o.gateway = { paymentId: pay.paymentId, state: 'created', checkoutUrl: pay.checkoutUrl };
    await writeJson(`orders/${o.id}.json`, o);
    return res.status(200).json({ id: o.id, url, checkoutUrl: pay.checkoutUrl });
  } catch (err) {
    console.error('gateway create payment failed:', err.message);
    return res.status(502).json({ error: 'The checkout page could not be opened. Pay the UPI ID directly instead, or try again in a minute.' });
  }
}
