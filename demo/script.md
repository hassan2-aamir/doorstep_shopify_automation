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

## What has to be true before you press record

Run `node demo/preflight.mjs` (read-only) and fix everything it flags. The reference state:

| Item | Needed | Why |
|---|---|---|
| Deployed app answers, smoke test passes | yes | Nothing else matters if it is down |
| Workspace status | `connecting` for scene 2, then `live` from scene 3 | Scene 2 needs the real stepper, not the read-only walkthrough |
| Open issues at the start | 0 | A clean Today makes scene 5's failure the only red thing |
| Sync health history | Empty or only the demo order | The three live "no buyer email" issues (#1002 to #1004) would clutter scene 3 |
| One order paid **with a real buyer email and address** | yes (see below) | Scene 4's email has to go somewhere real |
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

### The buyer-email problem (decide before recording)

Every order so far was a draft order without buyer details, so Flow B fails them as "no buyer email", by
design. Two possibilities, and you have to find out which before the shoot:

1. Create the order in Shopify Admin with a **customer that has an email and an address**, then mark it paid.
   Look at the new sheet row: if `buyer_email` is filled, you are done.
2. If `buyer_email` is still empty, Shopify is withholding protected customer data from the app (Shopify
   restricts customer name, email, phone and address for apps that have not been approved for it). Then, in
   scene 4, the **supplier** types the buyer's email into column E along with the tracking number. Say so in the
   voice-over: "For this dev store, the buyer's email is added by hand." Doorstep already treats a hand-typed
   email as the recovery path, so this is honest, not a hack.

Whichever it is, put the finding in `SUBMISSION.md` (limitations) afterwards.

## Shot-by-shot notes

**Scene 2, connect.** The Fastn panel must show **Active** on Shopify before you press Continue: prepare the
connection off camera in a first take, or disconnect and reconnect on camera if time allows (it does not: cut
straight to Active). Type the store address slowly enough to read.

**Scene 3, the wait.** Start the clock overlay when you press **Mark as paid**. Record the whole wait. In the
edit, speed the empty part to 8x and slow to real time when the row appears. Show both the sheet and the
Today count. Measured on this store, paid to row was 2.7 to 5.7 minutes on the standard tier. If the flows are
moved to the `instant` tier first (`todo.md`, open item 2), this shrinks to seconds and needs no speed-up.

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
