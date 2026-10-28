// A stand-in for the self-hosted UPI gateway, for trying the checkout flow locally and in tests.
//   node tools/mock-gateway.mjs [port]        (needs the dev server on SITE_URL, default http://localhost:3000)
// POST /api/v1/payments {orderId, amount, currency, returnUrl} -> {checkoutUrl}. Open the checkout page, press a button:
// "Pay" sends the signed RECONCILED webhook the real gateway sends after the bank confirms, "Observed only" sends OBSERVED_SUCCESS.
import http from 'node:http';
import { createHmac, randomUUID } from 'node:crypto';

const PORT = Number(process.argv[2] || 6100), SITE = process.env.SITE_URL || 'http://localhost:3000';
const MERCHANT = process.env.GATEWAY_MERCHANT_ID || 'mock-merchant', SECRET = process.env.GATEWAY_WEBHOOK_SECRET || 'mock-secret';
const payments = new Map();

async function hook(pay, event, extra = {}) {
  const body = JSON.stringify({ event, orderId: pay.orderId, amount: pay.amount, amountPaise: Math.round(parseFloat(pay.amount) * 100), method: 'UPI',
    settlementState: event === 'RECONCILED' ? 'RECONCILED' : 'PENDING', utr: pay.utr, paymentId: pay.paymentId, deliveryId: randomUUID(), ...extra });
  const ts = String(Date.now());
  const r = await fetch(`${SITE}/api/gateway-webhook`, { method: 'POST', body, headers: { 'Content-Type': 'application/json', 'X-Gateway-Event': event, 'X-Gateway-Timestamp': ts,
    'X-Gateway-Signature': 'sha256=' + createHmac('sha256', SECRET).update(body).digest('hex'),
    'X-Gateway-Signature-V2': 'sha256=' + createHmac('sha256', SECRET).update(`${ts}.${body}`).digest('hex') } });
  return r.status;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const json = (code, o) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
  if (req.method === 'POST' && url.pathname === '/api/v1/payments') {
    if (req.headers['x-merchant-id'] !== MERCHANT) return json(401, { error: 'bad merchant' });
    let raw = ''; for await (const c of req) raw += c;
    const b = JSON.parse(raw), paymentId = randomUUID();
    payments.set(paymentId, { ...b, paymentId, utr: String(Math.floor(1e11 + Math.random() * 9e11)) });
    return json(200, { paymentId, orderId: b.orderId, amount: b.amount, status: 'ACTIVE', checkoutUrl: `http://localhost:${PORT}/checkout/${paymentId}` });
  }
  const m = url.pathname.match(/^\/checkout\/([\w-]+)(?:\/(pay|observed|review|fail))?$/);
  if (m && payments.has(m[1])) {
    const pay = payments.get(m[1]);
    if (m[2]) {
      const code = await hook(pay, { pay: 'RECONCILED', observed: 'OBSERVED_SUCCESS', review: 'MANUAL_REVIEW', fail: 'FAILED' }[m[2]]);
      res.statusCode = 302; res.setHeader('Location', `${pay.returnUrl}`); res.setHeader('X-Webhook-Status', String(code)); return res.end();
    }
    res.setHeader('Content-Type', 'text/html');
    return res.end(`<body style="font:16px sans-serif;background:#0B0E17;color:#F3EEE4;padding:40px"><h1>Mock gateway · ₹${pay.amount}</h1><p>Order ${pay.orderId}</p>
      <p><a style="color:#FF6B3D" href="/checkout/${m[1]}/pay">Pay (bank confirms)</a> · <a style="color:#FF6B3D" href="/checkout/${m[1]}/observed">Observed only</a> · <a style="color:#FF6B3D" href="/checkout/${m[1]}/review">Manual review</a> · <a style="color:#FF6B3D" href="/checkout/${m[1]}/fail">Fail</a></p></body>`);
  }
  json(404, { error: 'not found' });
}).listen(PORT, () => console.log(`mock gateway on :${PORT}, webhooks to ${SITE}/api/gateway-webhook`));
