# Embed starter: "Connect your store" + Sync health

> Reference implementation. It is dependency-free Node with an in-memory store and was tested only against a mock Fastn server. The Doorstep TRD chooses React and Tailwind (frontend), Node and Express (API) and MongoDB (storage): port the endpoints and the token logic, keep the security choices (server-side key, constant-time secret check, `textContent` rendering), and retest against the real workspace.

A dependency-free Node host app for the Fastn hackathon (any track that needs a customer-facing page).

## Run

```bash
cp .env.example .env      # fill in FASTN_HOST, FASTN_API_KEY, FASTN_END_ORG_ID, SYNC_CALLBACK_SECRET
npm start                 # Node 20.6+  ->  http://localhost:3000
```

Open `http://localhost:3000/?customer=<customer id>` to act as a specific customer.

## What is here

| Path | Purpose |
| --- | --- |
| `GET /api/fastn-token` | Mints an embed token server-side and returns the iframe URL. Fresh token per page load. |
| `POST /api/sync-events` | Callback receiver for workflows. Header `x-callback-secret`. Body `{customerId, orderId, workflow, outcome: "success"|"skipped"|"failed", step?, error?}` |
| `GET /api/sync-events` | Counts and the last 50 events for the Sync health panel |
| `public/index.html` | Widget iframe plus Sync health panel; remints on `fastn:session-expired` |

## Make your workflow report outcomes

Ask the Platform Agent (see `references/agent-prompts.md`, prompt E): "After every run, POST to https://YOUR_PUBLIC_URL/api/sync-events with header x-callback-secret from the secret CALLBACK_SECRET and body {customerId, orderId, workflow, outcome, step, error}." Store the secret with `fastn.secrets` (Settings, Secrets), not in code. For local development expose the app with a tunnel (for example ngrok) because Fastn's runners must reach it.

## Before you rely on it

- Confirm host, request and response shape on the Embed tab (the docs disagree on token shape and lifetime). The server parses both `data.token` and `token`.
- The in-memory event store resets on restart: swap in a database for anything real.
- Derive the customer from your authenticated session instead of the query string.
- Set the widget integration scope to **User level** so each merchant connects their own accounts.
- In production, bind `FASTN_API_KEY` on the runtime (not only in CI), use a `fsk_live_` key, and keep tokens out of logs.
