# Razorpay Integration — MERN E-commerce

Production-ready Razorpay Checkout integration: backend order creation,
signature-verified payment confirmation, webhook handling, and a React
checkout flow supporting UPI, cards, net banking, wallets, and every
other method enabled on your Razorpay account.

## How it works

```
[React] "Pay Now"
   │
   ├─► POST /api/payments/create-order   (backend creates Razorpay Order)
   │
   ├─► window.Razorpay(options).open()   (Razorpay-hosted Checkout UI)
   │        user pays via UPI/card/netbanking/wallet/etc.
   │
   ├─► handler(response) on success ─► POST /api/payments/verify
   │        backend recomputes HMAC-SHA256 signature, confirms with
   │        Razorpay's API, marks Order + Payment as PAID (in a
   │        DB transaction)
   │
   └─► Razorpay Webhook (server-to-server, independent of the browser)
            POST /api/payments/webhook
            backend verifies X-Razorpay-Signature against the raw
            body using the webhook secret, and is the authoritative
            backstop if the client never reaches /verify (closed tab,
            network drop, UPI app switch, etc.)
```

**Golden rule enforced throughout:** an order is marked `PAID` only when
either (a) `/verify` succeeds with a valid signature AND the payment is
confirmed via Razorpay's Payments API, or (b) a signature-verified
webhook event says so. The client's word alone is never trusted.

## Backend setup

```bash
cd backend
npm install express mongoose dotenv razorpay cors helmet \
  express-validator express-rate-limit jsonwebtoken
cp .env.example .env
# fill in MONGO_URI, JWT_SECRET, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
npm run dev   # or: node server.js
```

Get your keys from the [Razorpay Dashboard → Settings →
API Keys](https://dashboard.razorpay.com/app/keys). Start with the
`rzp_test_...` pair; switching to `rzp_live_...` later requires no code
changes — only the `.env` values change.

### File map

```
backend/
  config/razorpay.js          Razorpay SDK instance
  models/Order.js             Order schema (orderStatus, paymentStatus)
  models/Payment.js           Transaction record (Razorpay order/payment IDs)
  models/WebhookEvent.js      Idempotency ledger for webhook replays
  services/razorpayService.js Order creation, signature verification, refunds
  controllers/paymentController.js  create-order / verify / webhook / status
  routes/paymentRoutes.js     Route wiring + validation + rate limits
  middleware/auth.js          JWT guard (adjust to your existing auth)
  middleware/webhookRawBody.js  Preserves raw bytes for webhook signature check
  middleware/rateLimiter.js   Per-route rate limits
  middleware/errorHandler.js  Centralized error responses
  utils/validators.js         express-validator schemas
  server.js                   App wiring — note the middleware ORDER
```

### Webhook configuration (required for production reliability)

1. Deploy your backend so `/api/payments/webhook` is publicly reachable
   over HTTPS.
2. In the Razorpay Dashboard: **Settings → Webhooks → Add New Webhook**.
3. URL: `https://yourdomain.com/api/payments/webhook`
4. Select events: `payment.captured`, `payment.failed`, `order.paid`,
   `refund.processed` (add more as needed).
5. Set a webhook secret and put the same value in `RAZORPAY_WEBHOOK_SECRET`.
   This is **different** from your API key secret.
6. For local testing, use the Razorpay CLI or a tunnel (e.g. `ngrok http 5000`)
   and point the dashboard webhook URL at the tunnel.

## Frontend setup

```bash
cd frontend
npm install axios prop-types
cp .env.example .env
# set REACT_APP_API_BASE_URL
```

Drop the component into any checkout/order page:

```jsx
import RazorpayCheckout from './components/Checkout/RazorpayCheckout';

<RazorpayCheckout
  orderId={order._id}
  amount={order.totalPrice}
  currency="INR"
  onPaymentSuccess={(data) => navigate(`/orders/${data.orderId}`)}
  onPaymentFailure={(err) => toast.error(err.message)}
/>
```

The Razorpay Checkout script is loaded on demand — no need to add it to
`index.html`. All payment methods enabled on your Razorpay account (UPI,
Credit/Debit Card, Net Banking, Wallets, EMI, Pay Later) show up
automatically; you don't need to enumerate them in code.

## Testing with Razorpay Test Mode

With `rzp_test_...` keys active:

- **Card**: `4111 1111 1111 1111`, any future expiry, any CVV.
- **UPI**: use `success@razorpay` (success) or `failure@razorpay` (failure)
  as the VPA in the test UPI collect flow.
- **Net Banking**: any test bank in the list, then choose Success/Failure
  on Razorpay's simulated bank page.
- Full list: https://razorpay.com/docs/payments/payments/test-card-upi-details/

## Security checklist

- [x] `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` only ever live
      in backend `.env`, never sent to the client.
- [x] Order amount is always read from the DB `Order` document server-side —
      never accepted from the client.
- [x] Payment signature verified with `crypto.timingSafeEqual` (HMAC
      SHA-256), not a plain `===` string check.
- [x] Webhook signature verified against the **raw** request body.
- [x] Webhook processing is idempotent via a persisted `eventId` ledger.
- [x] Every payment route (except the webhook) requires authentication
      and checks the order belongs to `req.user`.
- [x] Rate limiting on order-creation and verification endpoints.
- [x] A double-check against Razorpay's Payments API (`payments.fetch`)
      on top of signature verification before flipping status to PAID.
- [x] Order is only ever marked `PAID` from verified server-side paths,
      never from client state alone.

## Going live

1. Complete Razorpay KYC/activation for your account.
2. Swap `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` for the `rzp_live_...`
   pair in your production environment variables.
3. Re-create the webhook in the dashboard for the live mode (test and
   live webhooks are configured separately) and update
   `RAZORPAY_WEBHOOK_SECRET` accordingly.
4. Re-run the security checklist above against your production config.
