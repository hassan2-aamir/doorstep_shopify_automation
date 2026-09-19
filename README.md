# Doorstep

**Order-to-doorstep autopilot for small Shopify merchants.** Paid orders land in the supplier's Google
Sheet in seconds (measured 6.2 to 7.6 s on real orders with both flows on Fastn's instant tier; it was 162 to 343 s on the standard tier). When the supplier types a tracking number, it goes back to Shopify and to the
buyer. Every failure shows up in plain words with a one-tap fix instead of disappearing.

Built on [Fastn](https://fastn.ai) for Build with Fastn, Track 02 (Ecommerce inventory and order sync).

| Part | What it is | Where |
|---|---|---|
| Fastn flows | `orders-to-fulfillment` (event) and `tracking-to-shopify-and-buyer` (every 5 min), built through the Fastn MCP gateway | Fastn workspace; evidence in [`evidence/`](evidence/) |
| Host app | React + Tailwind control tower (Today, Orders, Sync health, Connections), a public landing page (`/welcome`), a three-step setup (`/setup`), and an Express API on MongoDB | [`app/`](app/) |
| Deployment | AWS Elastic Beanstalk (Node 22, single instance) with zero-dependency scripts to build, ship, verify and roll back | [`deploy/`](deploy/) |
| Demo | The 2-minute video script, shot list, voice-over and a preflight check | [`demo/`](demo/) |
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
- Fastn's runners must reach the callback URL: deploy to AWS (below), or use a tunnel such as ngrok while developing
- To deploy: the AWS CLI v2, signed in (`aws configure`)

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
npm run tunnel                  # optional: public URL for Fastn callbacks while developing (ngrok)
```

Open `/` for the landing page, `/setup` for the guided setup, `/today` for the control tower.

Live: **https://d3nkcj9r1qd361.cloudfront.net/** (CloudFront, HTTPS, in front of the Elastic Beanstalk environment). Open that one in a browser: the plain-HTTP Elastic Beanstalk address serves a `upgrade-insecure-requests` policy and will not load in one.

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

On the Fastn side, set `fastn.envConfig.appBaseUrl` to the deployed (or tunnel) URL and `fastn.secrets.callbackSecret`
to the same secret (prompt P3 in [`evidence/prompts.md`](evidence/prompts.md)).

## Deploying to AWS

The live environment is Elastic Beanstalk (`doorstep-prod`, `us-east-1`). From [`deploy/`](deploy/):

```bash
node deploy.mjs --dry-run   # build the bundle, check the environment, change nothing
node deploy.mjs             # build, upload, deploy, wait, smoke-test
node deploy.mjs --rollback <version>
node smoke.mjs              # nine read-only checks against the live URL
```

Everything else (first-time setup, variables and secrets, Atlas access, HTTPS, teardown) is in
[`deploy/README.md`](deploy/README.md).

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
cd app/server && npm test                   # 27 API tests against a throwaway MongoDB database
cd app/e2e && npm install && npm test       # N1–N7, plus landing and setup checks, in local Chrome/Edge (needs a web build and a LOCAL MongoDB: it deletes events, so it ignores the MONGODB_URI in .env and refuses a remote one; E1 also needs an unconfigured API on UNCONFIGURED_BASE)
cd deploy && npm test                       # zip writer, bundle contents, argument parsing
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
- `/setup` guides Store, Sheet and Go live for the one workspace the demo serves. It does not create a new merchant or Fastn customer: sign-up needs real sign-in, which is not built. On a live workspace `/setup` is a read-only walkthrough.
- The Rules tab (Tier 3) was cut.
- The deployment is plain HTTP with the demo-customer fallback; see [`deploy/README.md`](deploy/README.md#https).
