// Terminate the Elastic Beanstalk environment (stops the instance and the bill). Destructive: the public
// URL stops working, so Fastn's callbacks fail until a new environment is created and appBaseUrl updated.
//
//   node teardown.mjs --confirm doorstep-prod
//
// Kept on purpose: the application, its uploaded versions, and the deploy bucket (pennies), so a later
// `node provision.mjs` can recreate the environment. MongoDB (Atlas) is not touched.
import { aws, cfg, describeEnv, die, log, parseArgs } from './lib/common.mjs';

const { values } = parseArgs(process.argv.slice(2));
const env = describeEnv();
if (!env) die(`Environment ${cfg.env} not found in ${cfg.region}: nothing to tear down.`);
if (values.confirm !== cfg.env) {
  die(`This terminates ${cfg.env} (${env.CNAME}). Re-run with --confirm ${cfg.env} to proceed.`);
}
aws(['elasticbeanstalk', 'terminate-environment', '--environment-name', cfg.env]);
log(`Terminating ${cfg.env}. It disappears from the console in a few minutes.`);
log('Remember: Fastn env config appBaseUrl still points at the old URL.');
