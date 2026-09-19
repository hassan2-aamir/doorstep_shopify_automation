// Read-only readiness check before recording the demo (demo/script.md).
//
//   node demo/preflight.mjs [--url http://host]
//
// Talks only to the deployed Doorstep API (GET requests plus the smoke test's unauthenticated probes).
// It cannot see the sheet, Shopify or Fastn: those lines are printed as a manual checklist.
import { describeEnv, envUrl, parseArgs } from '../deploy/lib/common.mjs';
import { runSmoke } from '../deploy/smoke.mjs';

const { values } = parseArgs(process.argv.slice(2));
const base = (values.url || envUrl(describeEnv()) || '').replace(/\/$/, '');
if (!base) {
  console.error('No --url given and no Elastic Beanstalk environment found.');
  process.exit(2);
}

const problems = [];
const line = (ok, text) => console.log(`  ${ok ? 'OK   ' : 'FIX  '} ${text}`);

console.log(`Demo preflight against ${base}\n`);

const smoke = await runSmoke(base);
const failed = smoke.filter((r) => !r.pass);
line(!failed.length, `Deployment smoke test: ${smoke.length - failed.length}/${smoke.length} passed`);
for (const f of failed) { console.log(`         ${f.name}: ${f.note}`); problems.push('smoke test'); }

let ws;
let counts;
try {
  ws = await (await fetch(`${base}/api/workspace`)).json();
  counts = (await (await fetch(`${base}/api/sync-events?sinceHours=24&limit=50`)).json()).counts;
} catch (err) {
  line(false, `Could not read the workspace: ${err.message}`);
  process.exit(1);
}

console.log(`\nWorkspace "${ws.name}": status ${ws.status}, state ${ws.state}`);
console.log(`  Today: received ${ws.today?.received}, waiting ${ws.today?.waiting}, shipped ${ws.today?.shipped}`);
console.log(`  Last 24 h: synced ${counts?.synced}, skipped ${counts?.skipped}, failed ${counts?.failed}\n`);

line(ws.openIssueCount === 0, `Open issues at the start: ${ws.openIssueCount} (need 0 so scene 5 is the only red thing)`);
if (ws.openIssueCount) problems.push('open issues');
const wantConnecting = ws.status === 'connecting';
if (!wantConnecting) problems.push('workspace status');
line(wantConnecting, `Workspace status "${ws.status}" (scene 2 needs "connecting" to show the real stepper; "live" shows the read-only walkthrough)`);
line(!ws.shopDomain, `Store address saved: ${ws.shopDomain ?? 'none'} (scene 2 types it on camera, so a clean take starts empty; the reset script keeps it, clear it in Atlas)`);

console.log('\nManual checklist (not visible from here):');
for (const item of [
  'Sheet has only the header row (delete rows 2 and after; screenshot them into evidence/ first)',
  'A Shopify order with a customer email and address is ready to mark as paid',
  'Your own inbox is open on the buyer address; alert email address is yours',
  'Fastn: both flows show Active, cron Active, Shopify + Google Sheets + Mailjet connections Active',
  'Claude terminal has the Fastn MCP authenticated (run /mcp)',
  'Browser: light mode, 110% zoom, bookmarks hidden, notifications off; recording at 1920x1080',
]) console.log(`  [ ] ${item}`);

console.log(problems.length ? `\n${problems.length} item(s) to fix before recording.` : '\nNothing blocking. Work through the manual list, then record.');
process.exit(0);
