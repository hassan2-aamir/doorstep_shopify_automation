# Fastn platform model

Contents: audiences and navigation, entities, tenancy, execution tiers, versions and environments, keys and roles, database, unified APIs, limits, deleted-by-mistake.

## Two audiences, one platform

| Who | Where they work |
| --- | --- |
| The SaaS company using Fastn (the user) | The dashboard: Build, Operate, Manage |
| That company's customers | The embedded widget inside the company's product. They never sign in to Fastn and reach it with an embed token that carries role `end_user` |

Fastn replaces the per-integration cost a SaaS team otherwise carries: OAuth app registration, token refresh, per-customer credential storage, upstream API changes, and the support queue when a sync quietly stops.

## Dashboard map

| Group | Item | Route |
| --- | --- | --- |
| (none) | Home ("What do you want to build?", Connect to Claude) | `/` |
| BUILD | Integrations: Agent (first item), Connectors, Unified APIs, Connections, Workflows, Triggers, Pending updates | `/agent`, `/integrations?tab=...`, `/integrations/updates` |
| BUILD | Widgets (this is the builder; there is no list page) | `/widgets` |
| OPERATE | Activity: Events, Traces, Alerts, Executions, Sync reports | `/activity/*` |
| OPERATE | Customers (sits under OPERATE but lives under settings) | `/settings/customers` |
| MANAGE | Settings | `/settings/*` |

Top bar: search (Cmd/Ctrl+K), **Connect to Claude**, docs link, theme, **AI credits** (resets monthly, UTC; click for per-agent breakdown).

Settings is role-scoped. Owner or Admin see People, General, API keys, Secrets, Environments, Configs, Database, SaaS Connectors, Billing, Roles, Audit log, Trash. Developer sees API keys, Secrets, Environments, Configs, Database, Trash. Two things are gated by role, not by grantable permission: using the AI assistant, and reading the audit log (owners and admins only). The account card (bottom-left) switches organisation, so "I cannot find it" is often the wrong organisation or role.

## Entities

- **Organisation**: you. Holds connectors, workflows, widgets, people, settings.
- **Customer** (= **tenant**): one of your customers, fully isolated. "Customer" is the dashboard word, "tenant" is the plumbing word (Triggers table column, last segment of connection id). Both are current.
- **Connector**: definition of a system. **Managed** (maintained by Fastn, patched via Pending updates when the vendor changes) or **Custom** (yours). Protocols when creating: REST (default), MCP, FTP, Database, REDIS. Auth types: No Auth, Basic, Digest, Bearer, API Key, OAuth 2.0 (default), Custom (`INPUT`). Description matters: the agent reads it to decide what a connector is for. New connectors start Private; publishing publicly is a platform-admin action. A version set in code beats a version pin.
- **Connection**: a customer's authorised link. Statuses: Active, Inactive (Reconnect/Disconnect, there is no re-enable), Expired (credential ran out and could not refresh), Failed (revoked access, changed password, rotated key). Expired or Failed: the customer re-authorises through your widget; you cannot re-enter their credential. Id format `ucl:org_<org>:<env>:<connectorId>:<authId>:<tenant>` ("Pass this to the API to act as this customer"). OAuth connections are refreshed by Fastn; custom/INPUT keys do not expire but break when rotated upstream.
- **Connection scope inside a workflow**: **Per customer** (the running customer's credential; use for anything touching customer data) or **account level** (one connection your org owns, shared; use for your own Slack, warehouse). The Connectors tab shows a "Per customer" badge only on the first.
- **Workflow**: JavaScript module. Slug is fixed after creation. Contract tab holds input and output schemas.
- **Trigger**: webhook, schedule, app event (see `triggers-and-operate.md`).
- **Widget**: builder tabs Layout, Style, Features, Embed (see `embedding-and-widget.md`).
- **Connector manifest, installation, config template** (gateway builds): each workflow carries a manifest recording per connector `scope` (`SAAS` = your pooled connection; `MULTI_TENANT` = each customer's own) and connection; an **installation** (`inst_*`) is the per-customer runtime row (target, connections, config); a **config** is the approved mappings and filters the workflows read (`fastn.config.get(configId)`, or `getByTemplate(templateId)` for the customer's clone). See `mcp-build-method.md`.
- **Unified API**: one canonical endpoint per business entity, routed to whichever provider the customer connected.
- **Pending updates**: Fastn watches vendor changes and files proposals with affected workflows and migration steps. Nothing auto-applies.

## Execution tiers

| Tier | Behaviour | Returns | Timeout range (V2 docs) | Default |
| --- | --- | --- | --- | --- |
| Instant | Synchronous | Result inline | 1s to 30s | 30s |
| Standard | Async (Temporal) | 202 + `exec_...` id | 5s to 15min | 2min |
| Long | Async, large volumes | 202 + `exec_...` id | 30s to 36h | 15min |

**Sources disagree.** The V2 docs (Core concepts, FAQs, editor page, ai-agents reference) give the table above. The glossary and the gateway skill's sandbox guide say Instant is good for about 60 s and Long for up to 6 h, and add that wall-clock is governed by the workflow's `timeoutMs` (default 120 s, max 6 h), not by the tier. Design for the tighter numbers and read the slider range in the workflow's Configuration panel. Choose Instant only when something is blocked waiting for the answer; any loop over records is never Instant; most syncs are Standard, backfills and big imports are Long. Escalate-on-timeout retries one tier up (instant to standard) and the escalated run returns a queued id to poll instead of an inline result; it is hidden on Long.

## Versions, environments, test and live

- **Publish** creates an immutable snapshot (v1, v2...). **Deploy** sends a version to an environment. Rollback is deploying an older version.
- Built-in environments: `test` and `live`. `test` is special: in the `x-fastn-env` header and in trigger routes it means the workflow's latest published version. Any other slug means the version deployed to that environment, and the fire fails if nothing is deployed there. Every org starts with one named environment, Live.
- An environment can be marked **Requires review**. Promoting into it then opens a pull request on a connected GitHub repository instead of deploying. The gate needs both a connected repo and the toggle.
- Live is marked Protected. Publishing and deploying are recorded in the audit log.
- **Configs** hold per-environment non-secret values (`fastn.envConfig.get("KEY")`). Blank environment editor = skipped on save, so a config can silently have no value in live. **Secrets** hold sensitive values (`fastn.secrets.get("UPPER_SNAKE")`), written once and never shown, scopable to a customer and/or environment. Connector credentials are not secrets: they live on connections. When in doubt, secret.

## API keys and roles

- Keys: `fsk_live_...` and `fsk_test_...`. Created under Settings, API keys. Shown once. There is no delete, only Revoke and Rotate. Keys belong to the workspace: removing a person does not revoke keys they made.
- **Test mode** is a separately revocable credential, refused unless the caller sends `X-fastn-Test-Mode: true`. It is not a sandbox.
- Key **presets**: Full access, Developer, Operator, Viewer (default), End user, Custom. These are not the people roles even where names match. A per-resource matrix (10 groups: Connectors, Connections, Workflows, Users, Settings, Events, Secrets, Executions, Widgets, Unified API) shows what a key can touch. `decrypt` on Connections and `read` on Secrets are the two boxes to argue about.
- Key options: customers it can reach (every customer, or only the ones you pick; required for keys used in an embed session), HMAC identity verification (`x-identity-hmac`), IP allowlist, per-minute rate limit, expiry (30 days, 90 days default, 1 year, never, or a date).
- Practice: one key per consuming system, named after the system (the name appears in the audit log), narrowest preset that works, rotate on a schedule, never in client code.
- People roles: Owner 42 permissions, Admin 42, Developer 34, Operator 21 (deploys to test only), Viewer 6, End User 35. Custom roles can only narrow a parent. A seventh, Platform Admin, is held by Fastn.
- Multi-tenant request headers (readable in `ctx.headers`): `x-end-org-id`, `x-end-org-ref`, `x-installation-id`, `x-fastn-connections`, `x-fastn-installation-config`. Exact value formats are on each workflow's Docs tab.
- Webhook trigger auth: `x-fastn-access-key` header, or "None (public)".

## Database

`fastn.db` is Postgres in a per-workspace schema `ws_<hash>`. Shared (Fastn-managed) by default, or bring your own under Settings, Database. Switching redirects new reads and writes only, rows are not copied. No table browser or SQL console in the dashboard: inspect data from a workflow. Isolation is between workspaces, not between your customers.

## Unified APIs

Five categories on the live platform: CRM (10 entities, 12 providers incl. hubspot, salesforce, zohoCrm), Documents (googleDocs, notion), Knowledge Base, Messaging (slack, microsoftTeams), Project Management. `Note` and both messaging entities are create-only. Endpoints: `GET|POST /api/v1/unified/{category}/{entity}`, `GET .../{recordId}`. Error `API-UNIFIED-MULTIPLE-PROVIDERS` (409) means name the provider. Use unified when several providers do the same job for different customers, direct connector when you need a provider-specific field. They mix in one workflow. (The Core concepts page still says three categories: stale. The gateway's unified skill also uses `ecommerce` and `communication` as example category names: run `list_unified_categories` for what your workspace really has. See `unified-api.md`.)

## Limits and billing

Free plan shows 50 AI credits per period. Limits (per customer or total) cover API keys, events and API calls per day and minute, active integrations, connectors, workflows, steps per flow, and more. Hitting a limit stops new work without charging, and nothing running is interrupted. A sync that stops because of a quota looks exactly like a broken sync, so check Billing early when things stop for no reason. Hackathon accounts are upgraded by the organizers.

## Deleted something?

Connectors, connector actions and workflows go to Settings, Trash and restore with slug and history. Widgets and their integrations are deleted immediately and cannot be restored.
