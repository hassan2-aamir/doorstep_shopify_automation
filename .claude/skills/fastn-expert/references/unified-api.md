# Unified API: catalog, runtime, widgets

Contents: model, who can do what, runtime REST and code, widget attach, config forms, errors and debugging, conflicts.

From the `unified_api` skill v2 plus the docs' Build, Unified APIs pages. Use it when several providers do the same job for different customers (for example a customer on HubSpot and another on Pipedrive), or when the ecommerce or CRM entity you move is covered by the catalog.

## Model

```
unified_category (crm, ...)                    curated by platform_admin
  -> unified_entity (contact, customer, ...)   canonical labelled field schema
       -> unified_connector_mapping (per provider)   action bindings + field maps
Execution: the caller's org's ACTIVE connections decide which providers serve a call
```

The catalog is **platform-global** (owned by the `org_platform` sentinel org). Two orgs calling the same endpoint get data from their own connected accounts. Every role reads and executes (GET needs `unified.read`, create needs `unified.execute`, viewer is read-only). Catalog **writes** (`save_*`, `delete_*`) require a platform_admin session in the Platform account: API-key sessions resolve to developer or admin and get 403, so curation is via the admin UI (`/admin/unified-catalog`). Category names differ between sources: the docs list CRM, Documents, Knowledge Base, Messaging and Project Management; the skill's examples mention `crm`, `ecommerce` and `communication`. Run `list_unified_categories` to see what your workspace actually has, and check whether an ecommerce category with order or customer entities exists before choosing per-provider connectors for Track 02.

## Runtime

REST with `Bearer fsk_...`:

- `GET /api/v1/unified/categories` discovery.
- `GET /api/v1/unified/:category/:entity/providers` which providers the caller has connected (drive "Connect X" buttons from this).
- `GET /api/v1/unified/:category/:entity?page_size=50`: with no `provider` and no `cursor` it **fans out over all connected providers in parallel** and returns `{data: {<slug>: {records, nextCursor, error?}}, providers: [...]}` with per-provider error isolation. With `?provider=` or a `cursor` (cursors are pinned to the provider that minted them): `{records, nextCursor, provider, warnings?}`.
- `GET .../:id` and `POST ...` (canonical body; unknown fields rejected) resolve exactly one provider: `409 UNIFIED_MULTIPLE_PROVIDERS` means pass `?provider=`.
- Records are canonical: `{id, provider, data: {...}, remoteData?}`.
- Configuration values from a widget merge into the provider action input only when the call carries an `x-installation-id` header or `?widget_id=`. A bare call gets none (deliberate).

In workflow code (**unified-first rule**: when a unified entity covers the data use `fastn.unified.*`, not per-provider `fastn.connector.*`, so mappings stay editable without code changes and one workflow serves every provider):

```js
const page = await fastn.unified.crm.contact.list({ provider: "hubspot", pageSize: 100, cursor: ctx.input.cursor });
const byProvider = await fastn.unified.crm.customer.list({ pageSize: 5 });     // fan-out: slug-keyed map
const one = await fastn.unified.crm.contact.get("93763152725", { provider: "hubspot" });
const created = await fastn.unified.crm.contact.create({ email: "a@x.com", first_name: "Ada" }, { provider: "hubspot" });
// pass { widgetId: "wgt_..." } to use a widget's template defaults explicitly
```
Failures throw with the `UNIFIED_*` code in the message: branch on `err.message.includes("UNIFIED_MULTIPLE_PROVIDERS")`. Category and entity names in the calls come from the catalog (the examples in the skill use `crm` and `communication`), so confirm yours.

## Widgets

**When a unified entity covers the data, the widget is the unified entity**, not separate app connectors, and never one widget per provider. `create_widget` and `update_widget` accept `unifiedRefs` (`{entityId, connectorSlugs?, configForm?}`) or the simple `unifiedEntityIds` (`ue_*` from `list_unified_entities`), one not both. **Attach exactly one entity per widget** (config values are stored per provider; two entities sharing a provider would collide). Attaching makes `widget.type = "UNIFIED"` (else `APP`), merges the selected mapped connectors into the manifest (so the embed's connect flow prompts for them), and snapshots the catalog mappings as the widget's config template. Do not also pass `configId` when relying on the snapshot. Per-customer edits to snapshotted mappings do not change unified runtime behaviour (runtime always runs the platform catalog mappings); configuration **values** do feed runtime.

**Config forms** (`configForm`, per provider): fields `{key, label, type: text|select|multiSelect, required, optionsCode?}` where `key` is the connector action input field the value feeds. Select types require `optionsCode`, workflow-sandbox JS ending in `return [{value, label}]` (max 500 options, 30 s), executed against the caller's connections. Verify a snippet before saving: `POST /api/v1/unified-config/options-preview {code, params?}`. Values live at `config.unifiedValues[connectorSlug][fieldKey]` (flat; the legacy nesting under an entity id is still read). Defaults are edited by the partner in the dashboard's Integration Configuration modal (unified widgets render only this form, no mapping tabs) or `PUT /api/v1/configs/:id`; end users write `PUT /api/v1/installations/:id/unified-values {unifiedValues}`. On `update_widget`, an omitted `configForm` preserves the stored form and `{}` clears it.

## Catalog curation (platform_admin only): order

category, then entity, then one mapping per connector, then test. **Probe before mapping**: execute the connector action once and read the real output, because `recordsPath`, `cursorPath`, `remoteIdPath` and every `connectorField` dot-path must match reality (HubSpot `results` with `paging.next.after` and fields under `properties.*`; Cin7 `CustomerList` with no cursor path because it is page-numbered; BigCommerce v2 a bare array with `recordsPath: ""`). Mappings: `operations` (`list`, `get`, `create` with `actionSlug`, `paramMap`, `recordsPath`, `cursorPath`, `remoteIdPath`, `staticInput`), `fieldMappings` (`direction: "toCanonical"` for read-only nested paths), `valueMappings`, and stored-metadata `enrichActions` and `conditions` (not executed at runtime). Verify with `test_unified_entity` (with remoteData), then `query_unified` as the real caller.

## Errors and debugging

`UNIFIED_UNSUPPORTED_ENTITY` and `UNIFIED_NO_CONNECTED_PROVIDER` 404, `UNIFIED_UNSUPPORTED_OPERATION` 404, `UNIFIED_MULTIPLE_PROVIDERS` 409, `UNIFIED_CURSOR_INVALID` 400, `UNIFIED_VALIDATION_FAILED` 400, `UNIFIED_PROVIDER_AUTH_FAILED` 401, `UNIFIED_PROVIDER_RATE_LIMITED` 429, `UNIFIED_PROVIDER_ERROR` 502 (the docs print these as `API-UNIFIED-*`; same codes).

| Symptom | Check |
| --- | --- |
| Empty `records` but the provider has data | `recordsPath` wrong: `test_unified_entity` with remoteData and re-probe the raw output |
| Canonical fields null | `connectorField` dot-paths do not match the raw record (case matters) |
| `nextCursor` always null | Provider has no cursor token (page-number APIs) or `cursorPath` wrong |
| 409 multiple providers | Several connected: pass `provider` (list fan-out never 409s) |
| 404 no connected provider | No ACTIVE connection for any mapped connector: `list_unified_providers` |
| 403 on save/delete | Not a platform_admin session (expected for API keys) |
| Create 400 validation | Unknown or mistyped canonical fields, or required ones missing |
| 502 `UNIFIED_OPTIONS_FAILED` | Options snippet threw, timed out, or did not return an array: reproduce with options-preview |
| Configured value not reaching the provider | The call carries no widget identity: pin an installation (`x-installation-id`) or pass `widget_id` / `widgetId`; check the field `key` matches the action's input name and the value is saved flat under `unifiedValues[slug]` |
| Widget shows mapping tabs, not the config form | `widget.type` is APP (no unified refs attached) |
