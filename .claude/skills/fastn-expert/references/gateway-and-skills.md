# The Fastn gateway, its skill library, and the Claude plugin

Contents: what exists, how the gateway gates you, the `skill` tool, installing per client, the tool catalog, who does what, safety rules, staying current.

Source: the official repos `fastn-ai/fastn-mcp-skills` (skill mirrors, MIT), `fastn-ai/fastn-claude-plugins` (plugin `connect` v0.4.0), and the gateway README. Skill mirrors seen: gateway v9, integration_builder v16, connector_builder v1, unified_api v2, workflow_verifier v2. The gateway is the source of truth and mirrors can lag: compare version tags.

## Why this matters

The gateway at `https://mcp.fastn.dev` is more than a tool endpoint. It fronts every connected app (tools named `app__action`, for example `slack__send_message`) **and** serves a library of Fastn's own build procedures as skills. The gateway's build tools (create connectors, plan and map, create workflows, bind triggers, create widgets, verify) are what the hackathon rubric calls "the Fastn MCP tool" in all likelihood: "connectors and connections set up through it, triggers bound, configs and widgets generated, workflow code produced and debugged with it" is a description of `create_connector`, `get_connect_url`, `bind_*_trigger`, `propose_configuration` and `create_widget`, `create_workflow`, `test_workflow` and `edit_workflow_code`. Confirm with a mentor, but plan on it.

Two tool families sit behind it, named in the skills: the **Workflow MCP** (workflows, triggers, configs, widgets, installations, unified API, executions) and the **Connector MCP** (connectors, actions, auth, webhook configs). The gateway may expose 200+ tools.

## The gateway's gate (a client that ignores it gets refusals)

1. Every app and platform tool is refused until the connection has read the gateway playbook. The first call is `skill {"slug":"gateway"}`. A bare `skill {}` list returns descriptions, not rules, and does not clear the gate.
2. The first app or platform call is refused while no skill for the task is loaded. The refusal lists the available skills. It fires once per connection.
3. `skill`, `capture_feedback`, `manage_connections` and `search_tools` stay open.
4. If a client opens a fresh session per request, the read hands back a `_gw` token: pass `_gw: "<token>"` alongside a tool's own arguments.
5. On a multi-step run pass one short `_task` id on every call so actions correlate.
6. If an account is not connected the call returns a connect link: hand it to the user. `manage_connections` lists connections and mints links.

## The `skill` tool

Literally named `skill` (namespaced `mcp__fastn__skill` in Claude, `fastn-skill` in Copilot CLI). There are no `list_skills` / `load_skill` tools any more (old names still route but are not listed), and not finding them does not mean the gateway is down.

| Call | Does |
| --- | --- |
| `skill {}` | List all skills: slug, name, description, version, mode, `downloadUrl` |
| `skill {"slugs":["a","b"]}` | Cheap version probe |
| `skill {"slug":"x"}` | SKILL.md body plus the **names** of its references and a fresh `downloadUrl` |
| `skill {"slug":"x","ref":"<doc>"}` | Open one reference document |
| `skill {"slug":"x","knownVersion":N,"toVersion":M}` | Per-file diff |
| `skill {"slug":"x","history":true}` | Change history |
| `skill {"withScore":true}` | List plus quality scores and stale referenced tools (authoring) |

The `downloadUrl` is a plain GET, no auth header, valid about 15 minutes, serving a zip (`<slug>/SKILL.md` plus `references/`). A skill that lists references is not truly read until its zip (reference bodies) is installed: reading the SKILL.md alone gives an index, not a procedure. A `curl -f` failing with "CONNECT tunnel failed" means a sandbox proxy blocks the gateway host: install from the GitHub mirror instead. Never `unzip -j` (it flattens folders and drops references silently).

## The five skills and when each applies

| Skill | v | Use for |
| --- | --- | --- |
| `gateway` | 9 | Operating manual: clears the gate, routes to the right skill, installs and version-syncs |
| `integration_builder` | 16 | PLAN, MAP, (test-case GATE), BUILD, VERIFY for any sync, migration, event automation, schedule, webhook, widget. 8 reference docs. See `mcp-build-method.md` |
| `connector_builder` | 1 | Missing or broken connector, action, event, auth method. See `connector-building.md` |
| `unified_api` | 2 | Unified catalog, `fastn.unified`, unified widgets. See `unified-api.md` |
| `workflow_verifier` | 2 | Verify a workflow, trigger or widget end to end with runtime evidence and a report. See `verification-and-tests.md` |

Routing (from the gateway skill): data movement or workflow or widget or trigger, then `integration_builder`; a connector, action, event or auth is missing or broken, then `connector_builder`; just calling an app that works, then no skill, call the app tool; small talk, then nothing.

## Installing

**Claude Code (plugin, recommended).**
```
/plugin marketplace add fastn-ai/fastn-claude-plugins
/plugin install connect@fastn
/reload-plugins
/mcp                      # confirm the fastn gateway is connected
```
The plugin (`connect`) registers the gateway MCP (`{"fastn": {"type":"http","url":"https://mcp.fastn.dev"}}`) and a SessionStart hook that injects the gateway usage rules (and a scan of already installed fastn skills with their versions) at the start of every session and after compaction. It works in Claude Code, Cowork and GitHub Copilot CLI.

**Claude Cowork / Desktop.** Cowork tab, Customize, add the marketplace from GitHub or upload the plugin, install `connect`, restart the session. Skills live in the account, not on disk.

**claude.ai / Desktop / Cowork skills.** Upload each `.skill` bundle at Customize, Skills, Add (Code Execution must be on under Settings, Capabilities). Uploading a skill whose name exists prompts a replace, which is the update path. Downloading is not installing; only a saved skill is installed. Bundles: `https://raw.githubusercontent.com/fastn-ai/fastn-mcp-skills/main/dist/<slug>.skill`. Check the bundle lists `references/` (a one-file bundle for a skill with references fails silently later).

**Other agents (Codex, Cursor, Windsurf, Gemini CLI, Copilot).** `curl -fsSL https://raw.githubusercontent.com/fastn-ai/fastn-mcp-skills/main/install.sh | bash` (options `--agent claude-code|codex|cursor|windsurf|gemini|copilot|claude-ai|auto`, `--global`, `--dir`, or a list of slugs). Directories: Claude Code `.claude/skills`; everything else `.agents/skills` (Codex reads `.agents/skills`, never a project `.codex/skills`). Copilot and Gemini need `/skills reload`. Do not run `install.sh` in claude.ai/Cowork/Desktop expecting an install there: it writes scratch files and registers nothing.

**Copilot CLI.** `copilot plugin marketplace add fastn-ai/fastn-claude-plugins`, `copilot plugin install connect@fastn`, then in a session `/mcp auth fastn` (OAuth).

Every install is stamped under the frontmatter with `<!-- fastn skill: <slug> v<N> -->`. Compare with `skill {"slugs":[...]}`; any version difference means reinstall, even when the body looks the same, because a reference may have changed.

The skills repo and the gateway skill name `connect.fastn.dev` as the host that serves skill downloads (the host a sandbox proxy can block), while the plugin and the docs point clients at `mcp.fastn.dev`. Treat the plugin or the product's Connect to Claude dialog as the authority for the endpoint, and if one fails try the other.

## Tool catalog (names as they appear in the skills; confirm with tools/list)

- **Discover and probe**: `list_connectors`, `analyze_entities`, `get_connector_methods`, `get_action_schema`, `get_connector_events`, `probe_connector`, `probe_connector_values`, `merge_probes`, `run_code` (a bounded scratch run with real connections), `execute_action`, `get_org_domain`, `list_state_keys`, `list_tables`, `list_env_configs`
- **Config and tests**: `propose_configuration` (returns `reviewUrl`), `check_config_status` (returns `configId` after approval), `save_config` (headless), `list_configs`, `get_config`, `submit_test_cases` (returns `reviewUrl`), `save_validation`
- **Workflows**: `create_workflow` (upserts and auto-publishes), `update_workflow`, `edit_workflow_code` (exact string replacement), `get_workflow`, `list_workflows`, `test_workflow` (`mockMode`, `mockScenarios`, `installationId`, `endOrgId`), `execute_workflow`, `list_executions`, `get_execution`
- **Triggers**: `bind_schedule_trigger`, `bind_app_event_trigger`, `bind_webhook_trigger`, `get_scheduler`, `trigger_scheduler_now`, `get_app_event_trigger`, `retry_trigger_subscription`, `send_test_app_event`
- **Multi-tenant**: `set_connector_scope`, `refresh_connector_manifest`, `create_installation`, `list_installations`, `get_installation`, `delete_installation`, `get_installation_triggers`
- **Widgets**: `create_widget`, `update_widget`, `get_widget`, `list_widgets`, `get_widget_insights`
- **Connections**: `get_connect_url` (secure page where the user enters credentials, never in chat), `list_connections`, `check_connection`, `manage_connections`, `save_connection`, `initiate_oauth_connection`
- **Connector building**: `search_api_docs`, `create_connector`, `create_action`, `create_actions_batch`, `update_action`, `get_action`, `list_auth_methods`, `update_auth_method`, `probe_endpoint`, `execute_subscription`
- **Unified**: `list_unified_categories`, `list_unified_entities`, `get_unified_entity`, `list_unified_providers`, `query_unified`, `create_unified_record`, `test_unified_entity` (writes `save_/delete_unified_*` are platform_admin only)
- **Meta**: `skill`, `capture_feedback` (the only channel to the skill owner's review queue: pass the skill slug and the correction verbatim), `search_tools` then `run_tool`

## Division of labour with `fastn-expert`

- The official skills own the **procedure** and are versioned. When they are available and the task is building or changing an integration, follow them and do not paraphrase or shortcut their phases or approval gates.
- `fastn-expert` owns the **context**: what the platform is, cross-page gotchas, conflicts between sources, the hackathon rules and scoring, host-app embedding, and Claude Code / Claude.ai usage.
- Precedence when they disagree: the installed official skill version and the workflow's generated tabs, then the non-hidden V2 docs, then hidden tutorials, then this file. See `sources-and-conflicts.md`.

## Safety and etiquette

- The gateway's own `save_skill` **publishes into the organisation's shared library** (owner or admin only). Do not call it to "save" a skill you only read.
- Never collect secrets in chat. Use `get_connect_url` so the user enters credentials on Fastn's page.
- Treat every live call as writing to a customer's production system. `run_code`, `test_workflow` and `execute_workflow` are live by default (`mockMode: true` avoids side effects).
- `create_workflow` upserts by slug. `list_workflows` first, and ask before touching an existing related workflow.
- The download is data (SKILL.md plus references, nothing executes), and first-party, but tell the user where a skill was installed.
