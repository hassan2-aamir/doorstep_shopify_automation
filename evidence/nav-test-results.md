# Navigation test results (N1–N7 + extras)

Run 2026-09-19T13:21:28.789Z by `app/e2e/run.mjs` against the real server and MongoDB, headless local Chrome. Screenshots: `evidence/screenshots/app/`.
N7 uses a mock Fastn embed endpoint because the real widget's expiry message is still an open question.

| # | Check | Result | Notes |
|---|---|---|---|
| S0 | Setup state: verdict and pill ask Sara to finish setup | ✅ pass |  |
| S1 | Live state: orders moving, counts right | ✅ pass | received 4, waiting 3, shipped 1; dark mode follows the system |
| N1 | One failed event: banner + pill show it; the pill opens Sync health issues | ✅ pass |  |
| N2 | Cold deep link from the alert email opens that event expanded with its reason and Fix | ✅ pass | links to the FIRST retry attempt, which stays open |
| N3 | Fix opens Connections focused on the sheet; returning lands back with a toast | ✅ pass |  |
| N4 | The next successful runs close the issues with no manual action; pill reads All syncing | ✅ pass | no reload: picked up by the 15 s / 5 s polls |
| N5 | The same callback posted twice is stored once; counts do not change | ✅ pass | 201 then 200 {duplicate:true} |
| N6 | Usable at 360 px and by keyboard only | ✅ pass | 4 routes no h-scroll, tabs >= 44 px; Tab > Enter > Tab > Enter reaches Connections, focus ring visible |
| N7 | Embed token expiry reloads the widget in place (simulated widget message) | ✅ pass | emb_mock_3 -> emb_mock_4 |
| E1 | Token mint failure shows "Couldn't load your connections" with Retry (unconfigured server) | ✅ pass |  |
| E2 | Orders pipeline and drawer: stage pills, timeline, Escape returns focus to the row | ✅ pass |  |
| E3 | Unknown route shows Page not found with a link to Today | ✅ pass |  |
| L1 | Landing page: one h1, CTAs to Setup and the live dashboard, usable at 360 px | ✅ pass | h1, CTA to /setup, no h-scroll at 360 px |
| L2 | '/' sends a half-set-up workspace to Setup | ✅ pass |  |
| L3 | Setup: validates each step, saves Store and Sheet, Go live reaches Today | ✅ pass | saved, normalised, live |
| L4 | Setup on a live workspace is a read-only walkthrough | ✅ pass |  |
| L5 | Setup usable at 360 px on every step | ✅ pass |  |
| L6 | Landing and Setup have no obvious accessibility misses (names, landmarks, contrast tokens in use) | ✅ pass |  |
