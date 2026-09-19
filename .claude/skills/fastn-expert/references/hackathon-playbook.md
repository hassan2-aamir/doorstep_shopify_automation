# "Build with Fastn" hackathon playbook

Contents: facts, contradictions to confirm, rules that disqualify, rubric mapped to evidence, the four tracks, Track 02 blueprint, evidence checklist, demo video script, submission document and README outlines, Day 2 timeline, risks.

Source: the organizers' "Rules and Agenda" document plus the Fastn docs. Re-read the organizers' document if the user shares a newer one; it wins over this file.

## Facts

- **Theme**: "Connect. Automate. Innovate. Two days, one working automation." Build a **customer-facing** solution on Fastn: something a real customer sees, receives, or interacts with, not an internal ops tool. Move data between systems customers already trust and a surface they use (portal, notification, chat message, followed channel). Judges want solutions "a real business could hand to a real customer on day one".
- **Day 1**: Fri 18 Sept 2026, online, 7:00 PM PKT. Welcome, register on Fastn, account upgrades (access to connectors and the Platform Agent verified), platform orientation, Q&A. Attendance plus some progress is **mandatory** for eligibility.
- **Day 2**: Sat 19 Sept 2026, on-site, SEECS NUST Islamabad. Check-in 9:00, opening 9:30, kickoff 10:00, build 10:00 to 1:30, break 1:30 to 2:15 (lunch and prayer), build 2:15 to 3:30, judging and meet-the-team 3:30 to 5:30, results 5:30 to 6:00.
- **Team**: 1 or 2 people, one team per person, no swaps after check-in, team confirmed at the registration desk.
- **Prizes**: PKR 300,000: 150,000 / 100,000 / 50,000. Every member must submit the **feedback form** or the team is not considered for any prize.
- **Judging**: no live demo; judges score what you submit against 100 points; they may call a team over with a question. Ties: higher Idea and innovation score, then higher Platform Agent score. Decision final.

## Contradictions in the organizers' document: tell the user to confirm

1. **Deadline**: rules and "at a glance" say 4:30 PM on 19 Sept, but the Day 2 agenda table says submissions close at **3:30 PM** ("the form locks; anything after is not judged") and lists the 2:15 to 3:30 slot as the time to record the demo and fill the form. Treat 3:30 PM as the deadline until a mentor confirms. Only the last submission before the deadline is judged, so submit early and resubmit.
2. **Submission contents**: the "What to submit" table lists demo video (2 min, Google Drive, anyone-with-link), document, at least 3 screenshots, team details. The rubric's Submission line also names a **working workflow link** and a **README with setup steps**. Prepare all of them.
3. Day 1 timing: header says 7 to 9 PM, agenda rows run to 9:30 (with typos). Plan to stay for the Q&A.

## Rules that end a run

- Build must run on Fastn (connectors, triggers, workflows in your own workspace), connect **at least two systems** and move **real data end to end**. Mockups and slide decks without a working workflow are not scored on implementation.
- Late submissions are not judged, whatever the reason. A Drive link nobody can open counts as a missing video.
- Taking another team's workflow or submission means disqualification. Open-source libraries, public templates, docs, AI coding assistants and the Platform Agent are allowed if the submission is your own work.
- Bring laptop, charger and a hotspot backup. Create the third-party accounts and test data in advance (allowed and encouraged).

## Rubric mapped to evidence (100 points)

| Criterion | Pts | What earns it | Evidence to produce |
| --- | --- | --- | --- |
| Idea and innovation | 30 | Originality, real problem, creativity, clarity of use case. Also tiebreaker 1 | A named persona and their bad day today; why existing tools fail; 2 to 3 lines of user evidence (real requests, a store owner quote); who it is for and not for |
| Implementation and technical execution | 20 | Runs end to end; correct data flow; error handling; **deduplication and conflict handling**; workflow code quality | Idempotent design (dedup key + state guard), retry policy, failure log and alert, sync report, a replay test that did not double-write, a deliberately broken step shown surfacing |
| Submission | 20 | Working workflow link, demo video, README with setup steps, screenshots, on time | Full package early; README that a stranger could follow; Drive link checked from a logged-out window |
| Use of the Fastn MCP tool | 20 | How well you drove the Platform Agent: connectors and connections through it, triggers bound, configs and widgets generated, workflow code produced and debugged with it. Also tiebreaker 2 | The gateway path leaves exactly this trail: `get_connect_url` connections, `propose_configuration` reviewUrl and approved `configId`, `bind_*_trigger`, `create_widget`, `create_workflow`, `test_workflow`, `edit_workflow_code`, `list_executions`, plus the **verification report**. Screenshots or a transcript export of each approval gate and one real debug loop (failed run, diagnosis, fix, full-suite re-run). If you used the dashboard agent instead, the Sessions rail, plan, BUILD PROGRESS and Error-tab diagnosis |
| Demo video and framing | 10 | 2-minute clarity, problem framing, automation **shown actually running** | Script below |

"Fastn MCP tool" and "Platform Agent" are used together in the rubric. Ask a mentor which exact tool or agent the judges mean. Best guess from the org's repos: it is the **gateway** (`https://mcp.fastn.dev`) driven from Claude Code, Claude or Cursor with Fastn's skills (`fastn-claude-plugins`, `fastn-mcp-skills`): it creates connectors and connections, plans and maps, builds and debugs workflow code, binds triggers, generates configs and widgets, which is the rubric's list nearly word for word. Hedge: do the build through the gateway and keep the dashboard Platform Agent screenshots too if you touched it.

### Two build paths and the time budget

| | Dashboard Platform Agent | Claude + gateway skills (`integration_builder`) |
| --- | --- | --- |
| Feel | Fast first draft, few gates | Thorough: PLAN questions, mapping review in the browser, test-case review in the browser, live probes, verification report |
| Rubric fit | Good | Best (every rubric phrase leaves an artifact) |
| Risk | Less evidence | More steps; test sets can balloon (large scope asks for 90 to 130 cases) |
| Rule | Do not run both on the same use case: `create_workflow` upserts by slug | |

With one day: keep scope to **one entity pair, one direction per flow, ongoing only** so the case set stays in the small band (about 15 to 25), have connections ACTIVE and test data ready before the first prompt (a missing connection is a hard stop), and keep the two browser review pages open. Install the plugin and skills before the event day ends (`gateway-and-skills.md`).

## The four tracks

Every track follows one pattern: the customer visits **your app**, connects an account through a ready-made Fastn connector embedded in your app (no code on their side), and your workflow takes it from there. Connectors named are examples; any connector in the category is fair game. You may also propose your own idea under the customer-facing theme.

| Track | Customer connects | Build | Triggers | Judged on |
| --- | --- | --- | --- | --- |
| 01 CRM sync between two CRMs (HubSpot, Salesforce, Pipedrive) | Both CRM accounts on a "Connect your CRMs" page | Copy and keep in sync contact, deal or company records; status indicator | App event, Schedule | Ease of connecting for a non-technical customer, sync accuracy, how clearly the app shows data is in sync |
| 02 Ecommerce inventory and order sync (Shopify, WooCommerce, BigCommerce, Stripe) | Their store, on "Connect your store" in onboarding or settings | Update stock or order status where needed the moment upstream changes; basic error handling so a failed update is logged not lost | Webhook, App event | Reliability of sync, simple connection flow, failures **surfaced instead of dropped** |
| 03 Subscribing to notifications (Twilio SMS/WhatsApp, Gmail, Outlook, SendGrid, Slack, Teams) | A destination on a "Notifications" tab | Preferences page plus workflow sending to the chosen destination; update or disconnect anytime | App event, Webhook, Schedule | Easy subscribe and destination pick, reliable delivery, self-service preferences |
| 04 Business intelligence export (Google Sheets, Airtable, Notion) | A BI destination on a "Reporting" page | Gather business data and export on a schedule or event; visible confirmation | Schedule, App event | Clean useful data, simple connection, reliable schedule |

## Track 02 blueprint: "store to doorstep" autopilot

Problem (evidence): real Shopify merchant job posts describe one loop over and over. An order is placed, someone hand-passes it to whoever ships it (a manufacturer, Shippo, a warehouse sheet), tracking comes back, the buyer must be told, inventory must be corrected on cancellations and refunds, and owners want to know when an automation silently stops. Recurring asks: error handling, retries, logging, monitoring, human approval, systems in accounts they own.

Persona (pick one and stay on it): a small merchant with a fulfillment partner reached by spreadsheet, WhatsApp or email rather than an API (dropshipper with an overseas manufacturer, small brand with a local workshop, home packer). Not for enterprise Shopify Plus with an ERP.

Three layers of audience: (1) the small merchant who connects the store; (2) the merchant's buyer who receives the confirmation and tracking message (the customer-facing surface); (3) the SaaS company that would embed this (you play that company; Fastn does the connector and auth work).

Architecture (aligned with how the gateway skills build; the dashboard agent produces a similar shape):
1. **Tenancy = Path B (multi-tenant)**: "let my customers connect their own store". Answer the tenancy question that way, expect the agent to flip Shopify and the sheet to `MULTI_TENANT`, read config with `getByTemplate`, and create **one widget** for the whole use case (named for the partner app and entity, for example "Shopify Orders"). Create at least one customer (Settings, Customers) before testing: the agent cannot create end_orgs, and a self-install uses your own org.
2. **One config for the use case**: Shopify Order to Fulfillment sheet row (mappings, plus conditions such as paid only and exclude test orders) and the tracking write-back. Values a merchant may retune (which statuses, which sheet tab) live in the config, not in code.
3. **Flows, one execution shape each**:
   - `orders-to-fulfillment` event flow: new paid order (app event if the Shopify connector exposes it, else webhook) to a sheet row; upsert by order id; returns `{created, updated, skipped, errors, errorDetails}`. Add a schedule reconcile flow for completeness (schedule plus event is the standard topology).
   - `tracking-to-shopify-and-buyer` schedule flow: rows with a tracking number and status not Notified, then a Shopify fulfillment, then the buyer message (email, or WhatsApp through Twilio: a third connector), then status Notified. State guard so a retry never notifies twice.
4. **Reliability**: retry policy, skip-on-error with `errorDetails`, a failure table, alerts, `fastn.diff.compare`, a replay test.
5. **Host app** (React and Tailwind, Node and Express, MongoDB for `customers` and `syncEvents`; decided in the TRD): **Connect your store** page with the Fastn widget (User-level scope) and a **Sync health** panel fed by workflow callbacks (`/api/sync-events`). `assets/embed-starter/` is a dependency-free Node reference to port, tested only against a mock Fastn server.
6. **Stretch**: cancellation or refund restocks (Path: another event flow, same config); a Claude order-status assistant with escalation to a human.

Gateway build checklist (what the agent will do and what you must have ready): connections ACTIVE for Shopify (a dev store with test products and orders), Google Sheets (a test sheet with the headers), and the messaging connector; run `list_unified_categories` to see whether an ecommerce entity fits (then attach it as a unified widget instead of per-provider connectors); answer the PLAN questions in business language (entities: Orders; direction: Shopify to sheet, then tracking back; ongoing only, no backfill; scope: paid, non-test; tenancy: customers); review and approve the mapping page; review and approve the test-case page (ask for the small band); let it build, test live with one record, bind triggers, create the widget; insist on the verification report.

Prompts for the agent: `agent-prompts.md`.

Scope discipline: do not add abandoned carts, AI support answers, or reporting. Depth on reliability beats breadth, and implementation carries 20 points.

## Evidence checklist (build it while you build)

- Screenshot the two browser approval pages (mapping review `reviewUrl`, test-case review `reviewUrl`), the approved `configId`, the `get_widget` readback, and the **verification report** (put its text in the submission document).
- Screenshot every step of the agent session: Sessions rail, approval cards, Integration Plan, BUILD PROGRESS phases, mapping approval, Test cases, trigger with `Subscription: Subscribed`, widget builder Save and publish, alerts.
- Two or more screenshots showing the **result in the destination system** (the sheet row, the Shopify fulfillment, the buyer's message).
- One failure demonstration and its fix (Execution Error tab, AI Diagnosis).
- A replay that does not duplicate.
- Workflow link(s) and the host app URL or repo.
- Export the agent chat.

## Demo video (2 minutes, Google Drive, "anyone with the link")

Judges score the recording, not a live demo, so the automation must visibly run.

| Time | Content |
| --- | --- |
| 0:00 to 0:20 | The problem: persona, their bad day, one line of evidence |
| 0:20 to 0:40 | Connect your store page: merchant clicks Connect, logs in once |
| 0:40 to 1:20 | Place a real test order in Shopify: row appears in the sheet; add tracking; buyer message arrives and Shopify shows the fulfillment |
| 1:20 to 1:45 | Break something on purpose: the failure appears in Sync health, an alert fires, fix, retry succeeds, no duplicates |
| 1:45 to 2:00 | How it was built with the Platform Agent (quick montage), who it is for, what is next |

Rehearse once, record early, check the Drive link from a private window, and record a backup take.

## Submission document (short)

1. Problem and persona (with evidence).
2. Solution: what the customer sees and does (three lines) and what the buyer receives.
3. Architecture diagram and the workflows, triggers and connectors used (and why).
4. Reliability: dedup, retries, failure log, alerts, sync report, replay test.
5. How the Platform Agent (and Claude via MCP, if used) built each part, with what you corrected by hand.
6. Limitations and next steps.
7. Team, track, links.

README: what it is, prerequisites (Fastn account, Shopify dev store, sheet), setup steps with env vars, how to run the demo, links to workflows, known limits.

## Suggested timeline

Assumes build day is Saturday 19 Sept and the form locks at 3:30 PM (organizers' agenda table). Adjust if a mentor confirms 4:30 PM.

| When | Do |
| --- | --- |
| Before check-in | Plugin and skills installed; gateway connected; Shopify dev store with test products and orders; test sheet with headers; email connector active; one customer created; public callback URL or tunnel ready |
| 10:00 to 10:45 | Kickoff prompt; answer PLAN; approve mapping page; note `configId` |
| 10:45 to 11:30 | Approve test cases (small band); Flow 1 built and tested live with one record |
| 11:30 to 12:30 | Flow 2, triggers bound, widget created; host app (React, Tailwind, Express, MongoDB) running with the connect page |
| 12:30 to 1:30 | Verification report; failure demo; Sync health panel; alerts; screenshots as you go |
| By 1:30 | Record the 2-minute video; start the document and README |
| 2:15 to about 3:00 | Assemble and submit the full package; check the Drive link logged out |
| After submitting | Resubmit only if the deadline is confirmed as 4:30 PM |

Both members fill the feedback form before the closing ceremony. If Flow 2 stalls for 30 minutes, take the documented fallback (sheet status plus buyer email, no Shopify write-back).

## Risks

- Connector not in the upgraded catalogue or missing an action: check tonight (Connectors list, connector's action list). Twilio WhatsApp sandbox needs buyer opt-in; fall back to email or SMS.
- App-event `Subscription: Failed`: use Retry Subscription, re-check scopes; fall back to a webhook trigger or schedule poll.
- Free-plan limits and credits (Billing): confirm the upgrade applied.
- Test key is not a sandbox: use a dev store and test sheet.
- Code editing off: expect to work through the agent; ask mentors to enable if a fix needs hand-editing.
- Venue Wi-Fi: hotspot backup.
