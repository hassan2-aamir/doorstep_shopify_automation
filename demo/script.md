# Doorstep demo: 2-minute video, shot list and voice-over

Hard cap **2:00** (the brief's limit). About 165 spoken words, which leaves room for silent action on screen. Record the screen in
real time, cut the waits, and label every speed-up on screen. The story is Sara's bad day, then the same
day with Doorstep, then the one thing that goes wrong and how she fixes it in under a minute.

**Rule for the whole video: show real runs, never mock-ups.** Where a wait is cut, a corner label says
`sped up 8x` and the wall-clock stays visible. The judges' second tiebreaker is proof that Fastn MCP built
this, so scene 4 runs Flow B from Claude through the MCP, and scene 6 ends on the evidence log.

## Scenes

| # | Time | On screen | What happens | Voice-over |
|---|---|---|---|---|
| 1 | 0:00 to 0:15 | `/welcome` hero, then a split of Shopify orders and a messy sheet | Slow scroll of the hero; cut to the manual copy-paste | "Sara runs a small Shopify store. Every paid order, she copies into a sheet for her supplier. Then she copies the tracking back, and emails the buyer. Miss one, and a customer waits." |
| 2 | 0:15 to 0:35 | `/setup`: Store, Sheet, Confirm | Type the store address; the Fastn panel shows Shopify **Active**; paste the sheet link; press **Go live** | "Doorstep connects her store, her sheet and email, once. Her logins go to Fastn, our integration partner, never to us." |
| 3 | 0:35 to 1:00 | Shopify admin, the sheet, `/today` | Mark the order paid. Time-lapse (`sped up 8x`, clock visible). Row appears in the sheet; **Received** goes from 0 to 1 | "A paid order becomes one row in her sheet. Replays and edits never make a duplicate. On Fastn's standard tier it takes a few minutes; this is sped up." |
| 4 | 1:00 to 1:30 | The sheet, then the Claude terminal, then the buyer's inbox, then `/sync-health` | Supplier types tracking number and carrier. In Claude: run Flow B now (`triggerSchedulerNow`). Buyer email lands; row turns **Notified**; Sync health shows two successes | "The supplier types a tracking number. Doorstep's second flow notices, emails the buyer once, and marks the row Notified. I'm running it on demand through Fastn's MCP so we don't wait five minutes." |
| 5 | 1:30 to 1:52 | `/connections`, `/sync-health`, alert email, `/today` | Disconnect Google Sheets in the panel. Run Flow B. Sync health: **Google Sheets needs reconnecting**; open the alert email, press **Fix it**; reconnect; toast; next run; issue closes, pill reads **All syncing** | "Now the part that usually stays hidden. The sheet connection breaks. Doorstep says so in plain words, with a link to the fix. Sara reconnects, the next run succeeds, and the issue closes itself." |
| 6 | 1:52 to 2:00 | Montage of 4 to 5 evidence screenshots, then end card | Prompt log, approval page, verification report; end card with repo and workflow links | "Every step was built by prompting Fastn's MCP. The prompts and results are in our evidence folder." |

The voice-over above is 166 words. Do not add lines; cut a sentence before adding one.

## Using the landing page as the pitch

`/` is a ten-slide story you can present live or film for scene 1: press `Space` or `↓` to step, `↑` or `Shift+Space` to go
back, `Home` and `End` to jump. Suggested mapping:

| Slide | Use it for |
|---|---|
| 1 Cover, 2 Problem, 3 When it breaks | Scene 1, Sara's bad day (0:00 to 0:15). Slide 2 alone if time is tight |
| 4 Insight, 5 How it works | Between scenes 1 and 2, or in a longer pitch |
| 6 One screen | Scene 5's failure, told first: flip the "Something broke" switch to show the verdict change |
| 7 Proof | Scene 3, after the real run. The figures are measured and sourced, so say "about 7 seconds" and no more |
| 8 Audience, 9 Built on Fastn | The Q and A, and the MCP framing for scene 6 |
| 10 Get started | The end card |

The page only claims what the evidence backs (`evidence/test-results.md`). If you re-measure the latency, update slide 7.

## What has to be true before you press record

Run `node demo/preflight.mjs` (read-only) and fix everything it flags. The reference state:

| Item | Needed | Why |
|---|---|---|
| Deployed app answers, smoke test passes | yes | Nothing else matters if it is down |
| Workspace status | `connecting` for scene 2, then `live` from scene 3 | Scene 2 needs the real stepper, not the read-only walkthrough |
| Open issues at the start | 0 | A clean Today makes scene 5's failure the only red thing |
| Sync health history | Empty or only the demo order | The three live "no buyer email" issues (#1002 to #1004) would clutter scene 3 |
| One paid order, with a buyer email typed into column E | yes (see below) | Scene 4's email has to go somewhere real |
| Sheet has only the header row | yes | The new order is row 2 |
| Your own inbox open on the buyer address | yes | Scene 4 |
| Claude terminal with the Fastn MCP authenticated | yes | Scene 4 |
| Browser: light mode, 110% zoom, bookmarks hidden, notifications off | yes | Legible at 1080p |

**Capture the current Sync health history before resetting anything.** Screenshot the three live issues, and
the row for #1004 with its `upsert_row` success, into `evidence/screenshots/`. They are proof of the
unattended runs, and the reset deletes them.

### Reset for a take

The app's own scripted reset, pointed at the production database (use the Atlas string from the Elastic
Beanstalk variables; do not commit it):

```bash
cd app/server
MONGODB_URI="<atlas uri>" MONGODB_DB=doorstep DEMO_CUSTOMER_ID=<id> npm run demo-events -- --scenario reset
```

That deletes the demo customer's events and sets the workspace back to `connecting`. It does **not** clear the
sheet. Delete rows 2 and below by hand (rows 3 to 5 are #1002 to #1004, row 2 is #1001 Notified).

### The buyer details (updated 20 Sep)

Shopify now returns the buyer's name, email and phone through the store's own app token, **but only for an order that has a
customer attached.** Draft orders made without choosing a customer (#1001 to #1003, #1006, #1007) still have nothing to read.
So, for the demo order:

- In Shopify, create the order **with the customer selected** (Hassan Aamir has an email and phone) and, if you want the address
  cell to show something, a real street address; the sample orders' street fields are empty, so the cell only shows the country.
- Mark it paid. The sheet row should appear with name, email and phone filled in by Doorstep, and **nobody types the buyer email**.
- If a row still comes out blank, type the email into column E: Flow B emails whatever is there. Keep that as the fallback.
- **The email still has to arrive in an inbox.** See the Scene 4 note below and `todo.md` P2.12: Mailjet's sender domain is not
  authenticated, so the message may go to spam.
## Shot-by-shot notes

**Scene 2, connect.** The Fastn panel must show **Active** on Shopify before you press Continue: prepare the
connection off camera in a first take, or disconnect and reconnect on camera if time allows (it does not: cut
straight to Active). Type the store address slowly enough to read.

**Scene 3, the wait.** Start the clock overlay when you press **Mark as paid**. Record the whole wait. In the
edit, speed the empty part to 8x and slow to real time when the row appears. Show both the sheet and the
Today count. Measured on this store, paid to row is now **about 6 to 8 seconds** (6.2, 7.5 and 7.6 s on real orders, both flows on the
`instant` tier), so there is nothing to speed up: show the real wait, with the clock visible. On the standard tier it had been 2.7 to 5.7 minutes.

**Scene 4, before you rely on the email.** Mailjet sends from a `seecs.edu.pk` address it cannot authenticate (SPF and DKIM both fail, the domain's DMARC says quarantine), so the buyer email may land in **Spam** or the Workspace quarantine. Send one test first and look there. Do not record scene 4 until an email reaches a visible inbox (see `todo.md` P2.12). The Mailjet status only says the message was handed over, not that it was delivered to the inbox.

**Scene 4, MCP beat.** In the terminal type a plain instruction such as "run the tracking flow now" and let
Claude call `triggerSchedulerNow`. Show the tool call and its `Ready`/`success` result in one still frame. This
is the MCP proof for the rubric; do not skip it to save seconds, cut from scene 3 instead.

**Scene 5, the failure.** Disconnect Google Sheets from the Fastn panel on `/connections`. Run Flow B (same
MCP call). Open Sync health: the reason reads "Google Sheets needs reconnecting" with a **Fix it** button. Show the
alert email arriving with its **Fix it** link, press it (it opens `/sync-health?event=...` already
expanded), then **Fix it** again to `/connections?focus=sheet`, reconnect, **Done, take me back**. Run Flow B
once more. Today's pill returns to **All syncing**.

**Scene 6, close.** Four to five stills, each 1.5 s: the prompt log, the config approval page, the
verification report, the failed execution and its fix. End card: project name, repo URL, "Built with Fastn MCP".

## Recording and delivery

1. Record at 1920 by 1080 with OBS or the Windows Game Bar (Win + G). Record scene by scene, not in one take.
2. Edit in Clipchamp or DaVinci Resolve. Captions on (hard-coded), voice-over recorded after the edit so it
   fits the cuts. Do not add music that competes with the voice.
3. Export MP4, 1080p, under 2:00. Watch it once with the sound off: the on-screen text alone must tell the story.
4. Upload to Google Drive, share **Anyone with the link can view**, and **open the link in a private window
   while signed out** to prove it plays. Paste the link into `SUBMISSION.md`, into `README.md`, and into the
   build variable `VITE_DEMO_VIDEO_URL` so the landing page shows "Watch the 2-minute demo" (rebuild and
   redeploy after setting it).
5. Keep a second complete take as a backup, and a 30-second cut of scene 5 alone in case the video limit is
   stricter than 2:00.

## If something breaks on the day

| Problem | Do this |
|---|---|
| Order does not reach the sheet | Check `node deploy/smoke.mjs`, then Fastn Activity for Flow A. Fallback: post a scripted callback with `npm run demo-events -- --scenario happy` and say the order was replayed |
| `buyer_email` empty | See "The buyer-email problem" above |
| Flow B run shows failed for the wrong reason | Read its Error tab; the debug loop itself is worth a clip, it is the MCP proof |
| Widget popup opens a blank page | The COOP header is back: `node deploy/smoke.mjs` names it |
| Recording drags past 2:00 | Cut scene 1 to 10 s, then the montage to 5 s. Never cut scene 5 |
