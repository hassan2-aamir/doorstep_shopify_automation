# Widgets, embedding, tokens, tenancy

Contents: what the widget is, builder, integration scope, embed methods, token API, tenancy, deployment of the host app, troubleshooting, where the docs disagree.

## The widget

The widget is the only part of Fastn customers touch: they browse the integrations you offer, authorise their own accounts, and configure what syncs, inside your product under your branding. **Widgets** in the sidebar opens the builder directly (no list page). The **INTEGRATIONS** panel inside the builder is the list of what your widget offers. A **Live** badge shows once saved.

Builder tabs: **Layout** (Title, Subtitle, Use Templates, Widget Sections), **Style** (Colors, Typography, Shape, Json export/import of CSS variables), **Features**, **Embed**. Live preview at Mobile, Tablet (default) and Desktop widths. The tenant selector (default "View as admin") renders the widget as any one customer, with their real connection states. **Save and publish** pushes to the live widget; footer **Reset** discards unsaved changes, while Widget actions, **Reset to defaults** wipes the whole configuration (do not confuse them).

Customer-facing tabs (per the hands-on tutorial): **Apps** (connect, Configure, Disconnect; AI Assistant prompt "Can't find what you need?"), **Workflows** (active workflows, templates, interactive flow visualizer), **Insights** (metrics with 7/30/90 day range). Layout sections can be toggled and reordered: Header & Branding, AI Assistant, Search Bar, Apps, Workflows, Insights.

Features tab today: **Catalog connectors** (widens the offer to everything public in your catalogue, usually too broad) and **Workflow Diagram** (shows the generated flow diagram inside the widget), both off by default. Widget filter and role-based access are "coming soon".

## Adding integrations and the scope decision

**Add** opens Add Integrations with two tabs: **Apps** (individual connectors) and **Unified** (unified API categories). **Scope** decides whose credentials the integration uses:

| Scope | Meaning |
| --- | --- |
| **Org level** | Default. Connections are shared across the customer organisation |
| **User level** | Each customer or user connects their own account |

Org level is the default and the wrong one for most embedded products. If each customer must authorise their own account (a merchant connecting their own store), choose **User level**. Sanity check in the preview by switching the tenant selector.

**Edit Integration** fields: Name (what the customer sees), Configuration template (defaults: field mappings and sync rules), **Widget enabled**, **Activation mode** (Single activation default, or Multi-connection), **Customer visibility** (All customers or Specific customers), Connectors, Unified APIs, Workflows (bound automatically on Save and publish), Triggers (gear for template defaults and whether the end user may edit), Trigger categories.

**Callbacks** (six) HTTP-call your backend when a customer activates, deactivates, changes settings, or creates, updates or deletes a trigger. Use them to keep your own product informed (billing, onboarding, support).

**Configuring an integration** (customer side): first Configure runs the Integration Agent to set up mappings and filters; afterwards a dialog shows bidirectional mappings with real value previews and filters (operators: is empty, is not empty, equals, does not equal, contains, greater than, is one of, is not one of). Footer: "Changes apply on the next workflow run".

**SaaS Connectors** (Settings): register your own product's API as a connector plus **connection scopes** (for example `inventory`, `product`). A tenant holds at most one connection per scope; a widget tags its SaaS connector with a scope and activation pins the matching connection. Name scopes after capability boundaries in your API, not per customer.

## Embed methods (Widgets, Embed)

Pick a **USER** first: the widget is always scoped to one customer, and the selector scopes the generated snippet.

| Method | Requirement | Status |
| --- | --- | --- |
| **Iframe** | Anywhere you control HTML | Available |
| **SDK** | You can run JavaScript | Available |
| **A2A** | Agent-to-agent | Coming soon |

- **Iframe**: `<iframe src="https://YOUR_FASTN_HOST/api/v1/embed/iframe?token=YOUR_EMBED_TOKEN" style="width:100%; height:600px; border:none">`. The dashboard snippet has a live token in the URL: fine for a first run, wrong for production (URLs leak into logs, referrers and history).
- **SDK** variants: React component and Connect card (`@fastn-ai/embed/react`; confirmed exports `FastnConnectCard`, `FastnHub`, `FastnProvider`; wrap in `FastnProvider`), Script tag (hosted bundle `.../api/v1/embed/assets/fastn-embed.min.js`, then `FastnEmbed.createFastnEmbed({...}); hub.mount('#hub')` or `hub.open()` as modal, and `hub.on('connected', ...)` to refresh your app's data), and Build your own UI (`@fastn-ai/embed/headless` with hooks `useConnectors`, `useConnections`, `useConnect`). Copy exact props from the dashboard's generated snippet for the selected user. The SDK adds events, token refresh, live theming and modal mode over the raw iframe.
- **Shareable links** (per customer, Embed tab): keep working until revoked and carry no token, but the link itself is the credential. Treat as a secret.

## Token API

Mint from your backend only, with your API key:

```
POST /api/v1/embed/token
Authorization: Bearer <API key>
x-org-id: <orgId>            // or send {"endOrgId": "..."} in the body when the key is pinned to specific customers
```

Response per the current reference: `{ "token": "emb_...", "endOrgId": "...", "role": "end_user", "expiresIn": 28800 }` (8 hours). Refresh: `POST /api/v1/embed/token/refresh`, capped at **7 days per session**; at the cap the widget posts `fastn:session-expired` to the parent window and stops, so listen for it and mint a fresh token. The key used for an embed session must be pinned to specific customers.

The older hands-on tutorial pages (hidden in the docs nav) describe: body `{ endOrgId, userEmail, userName }`, token read from `json.data.token`, 15-minute expiry, host `live.gcp.fastn.ai`, and Test key header requirement. Parse defensively (`json.data?.token ?? json.token`) and confirm against the Embed tab.

Production flow: backend authenticates the user as it already does, calls the token API with the API key and customer identifier, returns only the token to the frontend, SDK mounts and refreshes until the cap.

## Tenancy: org-level versus user-level

Ask who owns the connected resource. Shared systems of record (CRM, project tool, warehouse, shared channels) are org-level; personal identity, inbox or calendar are user-level. Most customers need both. Per the tutorial: user-level embeds add `tenant-id=<endOrgId>` to the iframe URL and pass `userEmail` and `userName` when minting; org-level omit `tenant-id`. Mismatch between URL tenancy and token identity can show "Failed to fetch" in the widget. Verify against the Embed tab's generated snippet.

`endOrgId` must be the customer's internal UUID; slug and external id return 404 (tutorial). The Customers UI shows an identifier under each name (the "identifier you will see again as endOrgId"), but the older tutorial says the UUID is not displayed and must be read from page state. Test what the Customers page shows in your workspace, and create customers with your own stable account id as the identifier (Settings, Customers, Create customer; status Active or Pending admin activation, and integrations do not run until an admin activates).

## Deploying the host app

- Set `FASTN_API_KEY` and `FASTN_END_ORG_ID` on the hosting target's runtime, not only in CI. An undefined key makes token minting fail silently and the iframe renders blank.
- Use `fsk_live_` in production and drop `X-fastn-Test-Mode`. Paste secret values raw, no quotes.
- Never hard-code or cache tokens: fetch a fresh one per page load.
- Never put the API key in client code.

A runnable starter is in `assets/embed-starter/`.

## Troubleshooting embeds

| Symptom | Most likely cause and fix |
| --- | --- |
| Blank iframe | Expired or hard-coded token. Fetch a fresh one per load; check the env var is bound on the runtime |
| 404 on token request | Wrong `endOrgId` (must be the UUID) |
| Requests fail with a test key | Missing `X-fastn-Test-Mode: true` |
| "Failed to fetch" in widget | Tenancy or token mismatch (iframe URL shape vs token identity) |
| Empty token in your code | Token nested under `data` (older shape) |
| Widget stops after days | 7-day refresh cap: handle `fastn:session-expired` |
| Connect button does nothing (customer side) | Browser is blocking the auth popup |
| Customers see "fastn.ai" on the OAuth consent screen | Check the connector's Auth tab, View providers, for registering your own OAuth app; not confirmed by the docs |
