# The fastn-ai GitHub org: what each repo is and which API generation it targets

Contents: repo map, the three API generations, the Python SDK, the MCP server repo, brand and voice, positioning language, adjacent repos.

`github.com/fastn-ai` has 7 public repos (checked Sept 2026).

| Repo | What it is | Use it for |
| --- | --- | --- |
| `docs` | The V2 documentation source (GitBook). Sections `getting-started`, `tutorials`, `build`, `embed`, `operate`, `manage`, `reference`, plus `classic` (V1). About 180 markdown files | Facts about the product. `git clone --depth 1` and read locally when a fetch tool refuses |
| `fastn-mcp-skills` | Mirror of the gateway's skill library (5 skills, MIT) with `dist/*.zip` and `dist/*.skill`, `skills.json`, `install.sh` | The official build procedures. See `gateway-and-skills.md` |
| `fastn-claude-plugins` | The Claude Code / Cowork / Copilot CLI plugin `connect` (v0.4.0, MIT): registers the gateway and loads the usage rules at session start | Installing the gateway in an agent |
| `fastn-mcp` | Fastn MCP server (Python, MIT, 23 stars): 11 tools, hosted at `https://mcp.live.fastn.ai/shttp` or self-hosted | The older tool-calling MCP. See below |
| `fastn-sdk` | Python SDK `fastn-ai` (v0.3.1) plus CLI, stub generator; Node `@fastn/sdk` planned | Calling connector tools and flows from your own agent code |
| `fastn-brand` | Brand tokens, logos, voice rules and a brand `SKILL.md` | Fastn-styled submission material |
| `.github` | Org profile README | Positioning language |

Not in the org but referenced: `fastnai/fastn-connect` (a frontend widget for capturing OAuth credentials and connector config, older), `fastnai/mcp-fastn` (UCL MCP server, PyPI), `fastnai/embedded-multitenant-ai-assistant` (a Next.js sample that embeds UCL in an AI assistant with `OPENAI_API_KEY` and `NEXT_PUBLIC_FASTN_MCP_SERVER_URL`). These belong to the older UCL generation.

## Three API generations: which one am I looking at?

| Signal | Classic / UCL and Python SDK | `fastn-mcp` repo server | V2 (current docs, gateway, skills) |
| --- | --- | --- | --- |
| Nouns | project or space id, tenant id, stage `LIVE` / `STAGING` / `DEV`, "tool", "flow" | project id, tools, flows | organisation, customer (tenant), connection, connector, workflow, trigger, widget, installation, environment |
| Credentials | `x-fastn-api-key` + `x-fastn-space-id` (`sk_live_...`), JWT via `fastn login` | OAuth 2.1 or Bearer token/API key + `x-project-id` | `fsk_live_` / `fsk_test_` keys, embed tokens `emb_`, gateway OAuth or Bearer |
| Endpoints | `/executeTool`, `/getTools`; `mcp.ucl.dev` | `mcp.live.fastn.ai/shttp` | `mcp.fastn.dev`, `app.fastn.dev` or the workspace host `/api/v1/...` |
| Status | Classic, maintenance mode | Older; the README says `create_flow`/`update_flow` are under development | Current. New features are V2 only |

If a snippet uses `project_id`, `space_id`, `tenant_id`, or `fastn.slack.send_message(...)`, it is the classic generation and will not map one-to-one onto V2 workflows. Pick one generation per project.

## Python SDK (`pip install fastn-ai`, Python 3.8+)

For agent code that calls tools directly, not for authoring workflows.

- `FastnClient()` / `AsyncFastnClient()`; config from constructor, then env (`FASTN_API_KEY`, `FASTN_PROJECT_ID`, `FASTN_AUTH_TOKEN`, `FASTN_TENANT_ID`, `FASTN_STAGE`), then `.fastn/config.json` (from `fastn login`, a device-flow login, tokens refresh with a 30 s buffer).
- `fastn.slack.send_message(channel="general", text="Hi")`: a dynamic connector proxy with 250+ bundled `.pyi` stubs for autocomplete. Renamed in 0.3.1: connector = service integration, tool = callable function.
- **`get_tools_for(prompt, limit=5, format="openai"|"anthropic"|"gemini"|"bedrock"|"raw", connector=...)`** semantically selects the top few tools (the README claims about 98% less tool context, roughly 125K to 2.5K tokens) and returns provider-formatted schemas; `fastn.execute(tool=..., params=...)` runs the model's tool call with credential injection, retries and audit. Schemas are flattened for the LLM and re-wrapped for execution.
- `fastn.flows.create(prompt=..., answers=...)`, `flows.run`, `flows.get_run`, `flows.list`, `flows.update(schedule=..., enabled=...)`, `flows.delete`.
- `fastn.auth.connect(connector=..., tenant_id=..., redirect_url=...)` returns `{connection_id, auth_url}`; `auth.status(...)` returns pending, authorized or expired; `auth.configure_custom(userinfo_url=...)`. Multi-connection: `fastn.connect("conn_id")` binds one. Multi-tenant: `tenant_id` per call > CLI `--tenant` > constructor > `FASTN_TENANT_ID` > config file.
- CLI: `fastn login|logout|whoami`, `fastn connector ls|sync|add|remove|run|schema`, `fastn flow ls|create`, `fastn agent "Send hello to #general on Slack"`.
- Use in the hackathon only for an optional in-app assistant (for example an order-status bot) and only if you commit to the classic API for that piece. The core Track 02 loop should stay on V2 workflows.

## `fastn-mcp` server (older generation)

Hosted `https://mcp.live.fastn.ai/shttp` (also `/sse`, `/shttp/tools`, `/shttp/tools/{project}` and `/{skill}` for scoped subsets); auth OAuth 2.1 (RFC 9728 metadata) or `Authorization: Bearer` + `x-project-id`; self-host `pip install fastn-mcp-server` then `fastn-mcp --shttp --port 8000` (flags `--stdio`, `--sse`, `--no-auth`, `--server-url`, `--mode {agent,tools}`, `--project`, `--skill`), Docker supported, env `FASTN_MCP_PORT`/`HOST`/`SERVER_URL`/`NO_AUTH`/`TRANSPORT`. Tools: `find_tools`, `execute_tool`, `list_connectors`, `list_skills`, `list_projects`, `list_flows`, `run_flow`, `delete_flow`, `configure_custom_auth`; `create_flow` and `update_flow` flagged under development. Claude Desktop config `claude_desktop_config.json`, Cursor `.cursor/mcp.json`, Claude Code `.mcp.json`. For V2 builds use the gateway instead.

## Brand and voice (for Fastn-styled submission material)

Only for your own submission document, slides and video, not for the customer-facing app (a white-label embed should carry the customer's brand).

- Voice: direct, confident, without ceremony; an engineer briefing a teammate. Specific over sweeping ("reduces tool-call latency by 60%" beats "blazing fast"), verbs over adjectives, one idea per sentence, active voice, present tense, "you". Sentence case for headings and UI strings. **No em dashes** (use periods, commas or parentheses). Avoid "revolutionary", "game-changing", "unlock the power of", "supercharge", "leverage", "the future of AI is here". Preferred phrases: trustworthy agents for high-value workflows, decisions you can audit. Write "fastn" lowercase in logos and product UI, "Fastn" in prose.
- Colour is punctuation: one accent gradient `#6C5CE7` to `#8E76F2` for the primary CTA only, plus inline links and focus rings; everything else neutral. Dark theme (default): background `#18181B`, surface `#1F1F23`, border `#2A2A30`, heading `#FFFFFF`, body `#BDBDC4`, supporting `#8A8A92`. Light theme: background `#FFFFFF`, surface `#F4F4F6`, border `#E4E4E8`, heading `#18181B`, body `#44444A`. Semantic: success `#10B981`, warning `#F59E0B`, error `#EF4444`. Inter only (400 to 700); display 44/700, H1 32/700, H2 24/700, H3 18/600, body 16, small 14. Radius 8 (inputs, buttons), 14 (cards), pills full. Never recolour or stretch logos (`logos/fastn-logo-*.png`, `fastn-icon-rounded.jpg`); white wordmark on dark, black on light; WCAG AA, visible focus rings, 44 px touch targets. No second accent, second typeface, decorative gradients or text shadows.
- Tokens: `tokens.css` and `tokens.json` in the repo. Files: `fastn-brand-system.html`, `og.html`.

## Positioning language (org profile)

Fastn is an embedded integration platform for SaaS products and AI agents. Pitch: say yes to the integrations you are losing customers over; the bespoke one-off connectors and workflows a pre-built catalog cannot cover, configured by the customer inside your product. Claims on the profile (vendor claims, cite as such): integrated customers churn about 58% less on average, and 70-79% less in mid-market (Crossbeam, 2023); go-live in days not weeks; a monitoring agent on every production integration, AI connector, workflow and testing agents that keep integrations working when upstream APIs change, free sandboxes (test traffic never bills), white-label embed, SOC 2 Type II, 99.9% uptime SLA, multi-tenant governance and audit. The MCP gateway: one endpoint, every customer isolated by tenant identifier, RBAC, audit trails and data masking on every call. It compares itself with AI coding agents (they draft the happy path, you engineer retries, auth refresh, idempotency and observability), iPaaS (Merge, Paragon, Workato: your engineers build flows, breaks on bespoke logic) and in-house builds. Useful framing for a submission document: the customer configures the integration, not your engineering team.
