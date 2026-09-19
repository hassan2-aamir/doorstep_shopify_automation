# Doorstep

**Order-to-doorstep autopilot for small Shopify merchants.** Paid orders land in the supplier's Google
Sheet within a minute. When the supplier types a tracking number, it goes back to Shopify and to the
buyer. Every failure shows up in plain words with a one-tap fix instead of disappearing.

Built on [Fastn](https://fastn.ai) for Build with Fastn, Track 02 (Ecommerce inventory and order sync).

| Part | What it is | Where |
|---|---|---|
| Fastn flows | `orders-to-fulfillment` (event) and `tracking-to-shopify-and-buyer` (every 5 min), built through the Fastn MCP gateway | Fastn workspace; evidence in [`evidence/`](evidence/) |
| Host app | React + Tailwind control tower (Today, Orders, Sync health, Connections) + Express API + MongoDB | [`app/`](app/) |
| Design system | Flat, block-based tokens, contrast-audited in both themes | [`design/`](design/) |
| Specs | PRD, TRD, App flow, Backend schema | [`docs/`](docs/) |
| Plan and tracker | Step-by-step plan and what's done | [`plan.md`](plan.md), [`todo.md`](todo.md) |

## How it works

```
Shopify paid order ──▶ Fastn Flow A ──▶ Fulfillment sheet row (status New)
                                              │ supplier adds tracking
Fastn Flow B (every 5 min) ◀──────────────────┘
   ├─▶ Shopify fulfillment   ├─▶ one buyer email   └─▶ row status Notified
Both flows ──▶ POST /api/sync-events ──▶ Doorstep Sync health, status pill, alerts
```

Fastn performs every read and write against Shopify, Sheets and email, using each merchant's own
connections (multi-tenant, embedded widget). Doorstep's host app never sees merchant credentials. It
mints embed tokens on the server, receives the flows' outcome callbacks, and shows them.

## Prerequisites

- Node 20.6+ (tested on 22.14)
- MongoDB 6+ (local `mongod` or an Atlas free cluster)
- A Fastn workspace with the hackathon upgrade, one customer created (Settings → Customers), and an API key
- A Shopify dev store, a Google Sheet set up per [`sheet/README.md`](sheet/README.md), and an email connector
- ngrok (or any tunnel) so Fastn's runners can reach the callback URL

## Setup

```bash
# 1. API
cd app/server
npm install
cp .env.example .env            # then fill it in, see the table below
npm run init-db                 # collections, validators and indexes
npm run seed -- --fastn <fastn-customer-uuid> --shop <store>.myshopify.com --sheet <sheet-url>
#   → prints the customer _id: put it in .env as DEMO_CUSTOMER_ID

# 2. Web
cd ../web
npm install
npm run build                   # the API serves app/web/dist

# 3. Run
cd ../server
npm start                       # http://localhost:4000
npm run tunnel                  # public URL for Fastn callbacks (ngrok)
```

For UI development, run `npm run dev` in `app/web` (Vite on :5173, proxies `/api` to :4000).

| Variable | Purpose |
|---|---|
| `PORT` | API port (default 4000) |
| `MONGODB_URI`, `MONGODB_DB` | Database (default local, `doorstep`) |
| `CALLBACK_SECRET` | Shared with Fastn as `fastn.secrets.callbackSecret`; flows send it as `x-callback-secret` |
| `DEMO_CUSTOMER_ID` | Demo stand-in for a session (the seeded customer's `_id`) |
| `FASTN_HOST`, `FASTN_API_KEY` | Embed token minting (`https://live.gcp.fastn.ai`). The key stays on the server and must be pinned to the customer. A `fsk_test_` key is **not** a sandbox |
| `FASTN_ORG_ID` | Leave empty: the token API treats `x-org-id` as a customer org, not yours |
| `FASTN_USER_LEVEL` | `true` adds `tenant-id` to the widget URL (User-level scope) |

On the Fastn side, set `fastn.envConfig.appBaseUrl` to the tunnel URL and `fastn.secrets.callbackSecret`
to the same secret (prompt P3 in [`evidence/prompts.md`](evidence/prompts.md)).

## Callback contract

Flows `POST {appBaseUrl}/api/sync-events` with header `x-callback-secret`:

```json
{ "customerId": "<fastn end-org uuid>", "eventId": "5551234567890:tracking-to-shopify-and-buyer:1758276072",
  "orderId": "5551234567890", "orderNumber": "1042", "workflow": "tracking-to-shopify-and-buyer",
  "outcome": "failed", "step": "update_status", "errorKind": "connection",
  "error": "401 invalid_grant", "runAt": "2026-09-19T10:41:12Z" }
```

`outcome` is one of `success | skipped | failed`, and `step` comes from a closed list (see
[`app/server/src/lib/vocab.js`](app/server/src/lib/vocab.js)). A failed event must carry `errorKind` and
`error`; no other outcome may carry either. A repeated `eventId` returns `200 {"duplicate":true}` and
changes nothing. Full rules: [`docs/Backend schema…`](docs/).

## Running the demo without Fastn

To exercise the UI before the flows exist, post scripted callbacks through the real receiver:

```bash
cd app/server
npm run demo-events -- --scenario happy     # 4 orders in the sheet, 1 skipped, 1 shipped
npm run demo-events -- --scenario failure   # sheet disconnected + an order with no buyer email
npm run demo-events -- --scenario recover   # next run succeeds, issue closes itself
npm run demo-events -- --scenario reset
```

This is for walking through the screens only. It never stands in for the live acceptance tests T1–T9.

## Tests

```bash
cd app/server && npm test                   # 26 API tests against a throwaway MongoDB database
cd app/e2e && npm install && npm test       # N1–N7 in local Chrome/Edge (needs the API on :4000 + a build)
node design/check-contrast.cjs design/tokens.css   # WCAG audit of every token pair, both themes
```

Results: [`evidence/nav-test-results.md`](evidence/nav-test-results.md), screenshots in
[`evidence/screenshots/app/`](evidence/screenshots/app/).

## Security notes

- The Fastn API key, MongoDB URI and callback secret live only in server env vars.
- The callback uses a constant-time secret check, a strict schema, a 100 KB limit, a rate limit and a unique `eventId`.
- Every read filters by the resolved customer; query params are parsed to exact types (no `$` operators reach MongoDB).
- No buyer name, email, phone or address is stored by Doorstep; error text is redacted on receipt.
- Callback text is rendered as text, never HTML. `returnTo` is allow-listed to our own routes.

## Known limits

- The demo identifies the merchant with `?customer=` / `DEMO_CUSTOMER_ID`. Production needs real sign-in (Tier 3, cut).
- Connection cards only report what callbacks prove, because the widget isn't known to post connection status to the page (open question).
- `syncEvents` expire after 30 days; Fastn's execution history remains the source of truth.
- Welcome, Setup stepper and Rules tab (Tier 3) were cut for time.
