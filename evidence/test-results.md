# Acceptance test results

| # | Test | Pass condition | Result | Evidence |
|---|---|---|---|---|
| T1 | Place 1 paid test order | Exactly 1 sheet row with right buyer, address, items within 60 s | ⬜ | |
| T2 | Replay the same order event | Still 1 row; run returns skipped 1, errors 0 | ⬜ | |
| T3 | Edit the order | Same row updates; no second row | ⬜ | |
| T4 | Add a tracking number | Shopify fulfillment with that number + 1 buyer email within 5 min; row Notified | ⬜ | |
| T5 | Re-run Flow B, force a retry | No second email | ⬜ | |
| T6 | Disconnect the sheet on purpose | Failure in Sync health with step + reason; alert email arrives | ⬜ | |
| T7 | Reconnect and replay | Failed order completes, no duplicate | ⬜ | |
| T8 | Change a config rule | Next run reflects it, no code change | ⬜ | |
| T9 | Fire each trigger for real | Completed execution confirmed by its event id | ⬜ | |
