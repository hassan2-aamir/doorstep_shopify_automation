# Building and debugging connectors

Contents: when you need it, action contracts, bodyTemplate cases, auth rules, platform bugs and limits, webhook patterns, path gotchas, output contracts, build order, provider quirks, definition of done.

Distilled from `connector_builder` v1 (Connector MCP, 20+ production connectors). Use it when the workflow build hits a missing connector, action, event or auth method (for example a Shopify fulfillment action that the managed connector lacks). Fix the gap first, then resume the integration where you left off. In the hackathon, prefer managed connectors and only build an action if a required one is truly missing.

## Action input contract

- **GET**: query params live in `inputContract` only; fastn auto-appends every inputContract field as a query param. Do not also set them in `httpConfig.queryParams` (empty optionals break the request). Many APIs use a query param for get-by-id (`?ID=`), not a path segment.
- **POST/PUT/PATCH**: `bodyType: "json"` with a field-by-field `bodyTemplate` literal. One typed, titled, described inputContract property per field, `enum` where documented. Quote strings and dates (`"name":"{{input.name}}"`), leave numbers, booleans, arrays and objects bare (`"count":{{input.count}}`). Every templated field must be `required` (an unfilled `{{input.x}}` renders empty and yields invalid JSON). Only required, always-sent fields go inline; document optional extras, do not template them.
- **DELETE, POST, PUT** do not auto-append query params: set `httpConfig.queryParams` explicitly.
- **Never** ship a single opaque `body` string (`bodyType: raw` with `{{input.body}}`): the programmatic `fastn.connector.<slug>.<action>()` resolver cannot pass it.
- `inputContract.required` must list **every** required parameter accurately: it drives cascading-dropdown detection (`optionsLookupParams`, then `paramDeps` in the config editor). Dashboard dropdown calls auto-paginate at 100 per page up to 20 pages, so list actions need no special pagination.
- Use **double braces** in URLs (`{{input.code}}`); single-brace `{code}` is a literal.

## bodyTemplate special cases

- Raw JSON array body: accept the array as a `type: string` input, `bodyType: "raw"`, `bodyTemplate: "{{input.items}}"` (caller passes `["id1","id2"]` as a string).
- Text with newlines or quotes (SQL, source code, HTML): `bodyType: "json"` and **omit** `bodyTemplate` so fastn JSON-serialises the inputContract (excluding fields used in the URL). To remove an existing template pass `bodyTemplate: null` explicitly.
- No-arg RPC endpoints: `bodyType: "raw"`, `body: "null"`.
- GraphQL: each action is one POST with `bodyType: "json"`; declare variables in the query and reference a `variables` object; reference only required fields; watch scalar types (`Float` vs `Int`); probe with a small introspection chunk first (responses truncate near 4000 characters).

## Auth rules

- Credential injection is by **field name**, not auth type: fields named `username` and `password` auto-inject `Authorization: Basic`; a field named `token` auto-injects `Authorization: Bearer {token}` and **overrides per-action Authorization headers** (401). Name credentials `apiKey`, `accessToken`, etc. if actions set their own header.
- `API_KEY` auth renders a single fixed field and silently drops extras; `BASIC` renders only username and password. A connector needing extra credential fields (instance URL, account id, store hash, subdomain) **must use `INPUT`** type.
- In headers `{{auth.token}}` works; in **URL paths** use `{{auth.accessToken}}` (`{{auth.token}}` renders empty). `{{auth.baseUrl}}` resolves, enabling per-connection base URLs.
- Non-interactive OAuth grants (`password`, `client_credentials`) are supported via `authConfig` (`grantType`, `tokenUrl` with `{field}` placeholders, `clientAuthMethod`, `bodyFormat`, `scopes`); `save_connection` triggers the exchange, and `expiresAt: null` does not mean failure.
- fastn strips embedded query params (`?user_scope=`, `?audience=`) from `authorizationUrl`: hand-construct the authorize link with the extra params.

## Platform bugs and limits (as of the skill's date)

- **Auth method rotation (critical)**: the auth method is silently replaced (new id, titles reset, `required: true` injected) by opening or saving the auth section in the UI builder and by **every `create_actions_batch` call**; the old connection becomes orphaned ("Connection not found"). Recover with `list_auth_methods`, `update_auth_method`, and the user reconnecting. Never store auth method ids; always `list_auth_methods`. **Run all batch builds before the user connects.** Observed on INPUT methods; some OAuth methods did not rotate.
- `update_action` with `authMethodId` returns 500 (so no per-action override, and `authMethodId: null` also fails, so no-auth endpoints are blocked). Any `update_action` touching `inputContract` or `httpConfig` resets `testStatus` to untested: re-execute last.
- Tool-layer responses over about 4 KB truncate ("Unterminated string in JSON at position 4012") **though the execution succeeded**: check `get_action(id).lastTestEvidence` before retrying, especially before re-running a destructive write.
- Blocked (classify as such): multipart or form-data binary uploads (executor sends `Content-Type: application/json`), `application/octet-stream` and 302-to-CDN download responses (502 "Body has already been read"; read a download URL from a metadata call), Microsoft Graph change-notification subscriptions (needs a synchronous `validationToken` echo; affects SharePoint, Teams, Outlook), content-host downloads with an empty-body requirement.
- Native protocols: **Redis** (46 scaffolded actions; template keys `{{key}}` etc.) and **DB** (postgres, redshift, mysql, mssql, mongodb; one Query action; `?` placeholders converted per driver; params never interpolated; 10,000-row cap; pools of 5 with 5-minute idle eviction; SSRF protection blocks private IPs). Only fastn staff can create REDIS and DB connectors.
- Provider-side `fastn.connector.*` envelope: `{id, output, success, status}`; most providers put the payload at `res.output`, BigCommerce at `res.output.data`. Use `res?.output?.data ?? res?.output ?? res` in connector code.

## Webhook configs

- **EVENT_WEBHOOK**: the provider has a registration API; subscription code calls a connector action to register the fastn URL; unsubscription calls a delete action. **APP**: no registration API (HubSpot, Slack, Notion, Dropbox): the user pastes the fastn webhook URL into the provider's settings, no subscription code.
- In subscription code the event type arrives at **`ctx.input.event`**, not `eventId`.
- Subscription code only sees `stage: live` actions: promote webhook-management actions to live before exercising subscriptions.
- HMAC header patterns: GitHub `x-hub-signature-256` (`sha256=`), Fireflies `x-hub-signature`, Notion `X-Notion-Signature`, HubSpot `X-HubSpot-Signature-v3` (+ timestamp), Akeneo stripe-style `timestamp.body`, Mailgun body fields (use `eventsVerification.method: "NONE"`). Slack uses `CHALLENGE_RESPONSE` (`url_verification`, responseField `challenge`). Google Drive uses watch channels (`watchChanges`, `stopChannel`), not classic webhooks. Salesforce, ServiceNow and Dynamics use business-rule or Apex or service-endpoint registration created by subscription code; Remote Site Settings must authorise the exact fastn host.

## URL and output contract rules

- URL doubling: a full `url` plus a `path` that repeats segments calls `/repos/o/r/repos/o/r`. Set `url` to the base host only and `path` to the suffix; re-passing httpConfig does not drop a stale `path`.
- fastn percent-encodes `/` in every substitution; if the provider rejects `%2F`, split into per-segment inputs.
- **outputContract** is modelled from the **real 200 response**, not docs. Bare-array list responses are wrapped as `{items: [...]}` (object root required). Read `get_action(id).lastTestEvidence.responseBody` after executing. Very large batch responses are saved to a file: grep for ids and slugs.

## Build order

1. Sequence all `create_actions_batch` calls **before** the user connects.
2. Validate one simple GET first (a "list" or "me" call) to confirm auth injection and envelope before mass-building.
3. For ~30+ action batches, recover id-to-slug mappings by grepping the saved response for `"id":` and `"slug":`.
4. To hand a user a connection: `get_connect_url` (credentials entered on that page). Never collect secrets in chat.

## Provider quirks worth knowing (ecommerce, messaging, CRM relevant)

- **Shopify** (from the integration-builder's own field notes): a real-API 400 that mocks miss (`createOrderRefundsJson` rejecting a `Kind suggested_refund` transaction) is why every write action needs a **live** case with target read-back.
- **BigCommerce**: multi-field credentials (`storeHash` + `apiKey`) need `INPUT`; payload at `res.output.data`; webhook `createSubscription` needs a resolvable HTTPS destination.
- **HubSpot**: `{{auth.accessToken}}` in paths; `batchUpsert` needs a unique `idProperty`; webhooks are APP type (manual activation); some scopes (for example emails read) are not in default OAuth.
- **Slack**: HTTP is always 200, pass or fail is `ok: true` in the body (`testStatus == passed` alone means nothing); user-token-only scopes are effectively unrequestable through fastn; `admin.*` needs Enterprise Grid.
- **Notion**: pin `Notion-Version: 2022-06-28`; no hard delete (archive); webhook verification token arrives once as a POST when the URL is pasted.
- **Mailgun**: BASIC with username `api`; unset `{{input.x}}` keys are sent as literal strings on form-urlencoded (use `bodyType: raw` with an explicit content type); RFC 2822 dates for metrics; body-HMAC verification.
- **Salesforce**: unfilled optional `{{input.X}}` passes the literal string and errors on date or reference fields, so keep templates minimal.
- **Jira**: `cloudId` on every action; Atlassian strips `audience` from the authorize URL.
- **Dropbox, Microsoft Graph, Supabase edge function bodies, Miro** (webhooks discontinued 2025-12-05): several operations are permanently blocked as above.

## Definition of done (per action)

1. **built**: exists with auth headers and httpConfig.
2. **tested200**: `testStatus == passed` **and** `lastTestEvidence.responseStatus == 200` (non-200 is a fail unless a justified business-state block such as 404-no-data or 403-plan-gate).
3. **inputReconciled**: field-by-field inputContract containing every key the working request sent.
4. **outputReconciled**: modelled from the real response.

A connector is complete only when every spec resource has actions, each is done or a justified `blocked`, there are zero anti-patterns (`{{input.body}}`, raw body on writes, missing outputContract, untested actions), and webhooks are configured and exercised.
