# UPI payments: manual mode and the optional self-hosted gateway

The shop always works in **manual mode**: the buyer pays the UPI ID (`lib/catalog.json` → `upiId`), sends the 12-digit UTR, and you tap Approve on `/admin`.
It can also run with a **self-hosted open-source UPI gateway**, so a paid order approves itself once the bank confirms the money.
The gateway is optional: with no `GATEWAY_*` variables set, nothing changes.

## Which gateway, and why

Searched GitHub for open-source, self-hostable UPI gateways. The realistic options:

| Project | How it confirms a payment | Verdict |
|---|---|---|
| [YouPI-PG](https://github.com/youpi-pg/YouPI-PG) (Node.js, about 2.6k stars) | Reads bank SMS / push notifications / Gmail alerts for *your* receiving account; matches amount + UTR; signed webhooks | **Chosen.** Self-hosted, no merchant-app scraping, documented REST API + HMAC webhooks |
| [UPIPay](https://www.pkgstats.com/pkg:upipay) | Wraps PhonePe Business / Paytm Business APIs | Needs those merchant accounts |
| FlossPay (`gracemann365/FlossPay`) | Claims PSP integration | Early-stage, bank integration not verifiable |
| Paymenter ManualMultiPay, LinkPe, UPI intent libraries | QR / link only, no verification | Same as our manual mode |

Read this before switching it on. YouPI-PG's own README calls it "experimental research and learning", says it is not a certified or bank-approved gateway,
and recommends about 20 transactions a day per receiving account and no high-value payments. Bank-alert parsing can be late or wrong, and a webhook
"does not prove funds settled". Its repo shows no LICENSE file we could find, so **no code from it is copied into this repo**: the site only calls its HTTP API
and checks its webhook signature (`lib/gateway.js`). A shop of ₹49 to ₹1,959 items fits its intended scale; keep manual approval available.

## How the site uses it

1. Buyer taps Buy → the checkout asks `/api/checkout` whether a gateway is on.
2. They enter name + email → `POST /api/checkout` saves an `awaiting` order and calls the gateway's `POST /api/v1/payments` (header `X-Merchant-Id`) → `checkoutUrl`.
3. Buyer pays on the gateway's checkout page, and lands back on `/order?id=…&k=…`, which refreshes every 6 seconds.
4. The gateway calls `POST /api/gateway-webhook`. We verify `X-Gateway-Signature-V2` (HMAC-SHA256 of `"<timestamp>.<raw body>"`, within 2 hours) or, if absent, `X-Gateway-Signature` (HMAC of the raw body).
5. Only `RECONCILED` with `method: UPI`, `settlementState: RECONCILED`, the exact order amount (`amountPaise`) and a UTR not used by another order **approves** the order. Everything else is held for `/admin`:

| Gateway event | Order becomes |
|---|---|
| `RECONCILED` (UPI, settled, amount matches) | `approved`: downloads unlock |
| `OBSERVED_SUCCESS` (alert seen, not settled) | `pending`: buyer sees "confirming with the bank" |
| `MANUAL_REVIEW`, amount mismatch, UTR already used | `pending` with a note: shows in **To check** on `/admin` |
| `FAILED`, `EXPIRED`, `CANCELLED` | `failed` (an approved order is never undone by a late event) |
| `SUCCESS` (cash/counter) | ignored |

Duplicate deliveries are ignored (`X-Gateway-Delivery-Id`). Orders created by the gateway flow are marked `via: gateway` in `/admin`.

## What you need to switch it on

1. **Host the gateway** (needs Node 22.13+, runs 24/7): a small VPS, or a home PC behind a tunnel such as Cloudflare Tunnel. See its README (`npm install`, copy `.env.example` to `.env`, `npm start`). It must be reachable over **https** from Vercel.
2. **Give it eyes on your receiving account**: its Android observer app on a spare phone with the receiving bank's SIM, and/or Gmail alert reading. Decide which UPI ID / bank account receives the money (today the shop shows `adityadevdotcom@upi`).
3. In the gateway's merchant admin: create a merchant, copy the **merchant UUID** and **webhook secret**, and set the webhook URL to `https://curiousorbit.aditya-dev.com/api/gateway-webhook`.
4. In Vercel → Settings → Environment Variables (Production), add:

   | Variable | Value |
   |---|---|
   | `GATEWAY_URL` | `https://pay.yourdomain.com` (no trailing slash) |
   | `GATEWAY_MERCHANT_ID` | the merchant UUID |
   | `GATEWAY_WEBHOOK_SECRET` | the webhook secret |
   | `SITE_URL` (optional) | `https://curiousorbit.aditya-dev.com`, used for the return link |

   Redeploy. `GET /api/checkout` should now answer `{"gateway":true}`.
5. Place a real ₹49 order yourself (a wallpaper pack) and watch it approve. Then check `/admin`.

Remove the variables to go back to manual mode at any time; orders already saved keep working.

## Try it locally (no gateway needed)

```
npm install
PRODUCT_KEY=$(openssl rand -hex 32) ...        # same key the products were packed with
node tools/mock-gateway.mjs 6100 &
PRODUCT_KEY=… ADMIN_KEY=test GATEWAY_URL=http://localhost:6100 GATEWAY_MERCHANT_ID=mock-merchant GATEWAY_WEBHOOK_SECRET=mock-secret node tools/dev-server.mjs 3000
PRODUCT_KEY=… node tools/test-shop.mjs         # 17 checks: catalogue decrypts, signatures, amounts, duplicates, bundles
```
Orders made locally are saved in `./.data` (git-ignored), not in Vercel Blob. The mock gateway's checkout page has buttons for Pay / Observed only / Manual review / Fail.
