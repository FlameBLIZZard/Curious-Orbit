// Optional self-hosted UPI gateway (YouPI-PG, https://github.com/youpi-pg/YouPI-PG). Nothing here is vendored: the site only
// calls its HTTP API and checks the signature on its webhook. Without the three env vars below the shop keeps working in
// manual mode (buyer pays the UPI ID, sends the UTR, you approve on /admin).
//
//   GATEWAY_URL             base URL of the gateway's Payment API, e.g. https://pay.example.com  (no trailing slash)
//   GATEWAY_MERCHANT_ID     the merchant UUID from the gateway's merchant admin (sent as X-Merchant-Id)
//   GATEWAY_WEBHOOK_SECRET  the webhook secret from the same place; the gateway signs every webhook with it
//
// Setup and the trade-offs are in docs/UPI-GATEWAY.md.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const gatewayEnabled = () => !!(process.env.GATEWAY_URL && process.env.GATEWAY_MERCHANT_ID && process.env.GATEWAY_WEBHOOK_SECRET);

// POST /api/v1/payments -> { paymentId, orderId, amount, status, checkoutUrl }
export async function createPayment({ orderId, amountRupees, returnUrl }) {
  const r = await fetch(`${process.env.GATEWAY_URL.replace(/\/+$/, '')}/api/v1/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Merchant-Id': process.env.GATEWAY_MERCHANT_ID },
    body: JSON.stringify({ orderId, amount: amountRupees.toFixed(2), currency: 'INR', returnUrl }),
    signal: AbortSignal.timeout(8000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.checkoutUrl) throw new Error(`Gateway answered ${r.status}${j.error ? `: ${String(j.error).slice(0, 120)}` : ''}`);
  // The gateway is ours, but never redirect a buyer to anything but an https page on the gateway's own host.
  const base = new URL(process.env.GATEWAY_URL), to = new URL(j.checkoutUrl, base);
  if (to.host !== base.host || (to.protocol !== 'https:' && base.protocol === 'https:')) throw new Error('Gateway returned a checkout URL on another host');
  return { paymentId: j.paymentId, checkoutUrl: to.toString() };
}

const hex = (secret, data) => createHmac('sha256', secret).update(data).digest('hex');
function same(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && timingSafeEqual(x, y);
}

// raw = the request body exactly as received (bytes -> string). V2 signs "<timestamp_ms>.<raw>" and is checked whenever the
// gateway sends it (it also bounds replays: retries last up to 1 hour, so 2 hours is the limit); otherwise V1 signs <raw>.
export function verifyWebhook(raw, headers, secret, now = Date.now()) {
  const strip = (v) => String(v || '').replace(/^sha256=/, '');
  const v2 = headers['x-gateway-signature-v2'], ts = headers['x-gateway-timestamp'];
  if (v2 && ts) return Math.abs(now - Number(ts)) < 2 * 3600e3 && same(strip(v2), hex(secret, `${ts}.${raw}`));
  const v1 = headers['x-gateway-signature'];
  return !!v1 && same(strip(v1), hex(secret, raw));
}
