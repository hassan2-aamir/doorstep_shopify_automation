# Deploying Doorstep to AWS

Doorstep runs as one Node process on **AWS Elastic Beanstalk** (Node.js 22 on Amazon Linux 2023, single
`t3.micro`): the Express API serves the built React app, and MongoDB Atlas holds the data. These scripts build,
ship, verify and roll back that deployment. They have **no npm dependencies**: you need Node 20.6+ and the
AWS CLI v2, signed in with `aws configure`.

| What is live today | |
|---|---|
| Region / app / environment | `us-east-1` / `doorstep` / `doorstep-prod` |
| URL | `http://doorstep-prod.eba-bf4y27m3.us-east-1.elasticbeanstalk.com` (plain HTTP, see [HTTPS](#https)) |
| Bundle bucket | `doorstep-deploy-<account id>` |

Run everything from this folder. Every script reads its target from `DOORSTEP_*` environment variables
(`DOORSTEP_REGION`, `DOORSTEP_EB_APP`, `DOORSTEP_EB_ENV`, `DOORSTEP_INSTANCE_TYPE`, `DOORSTEP_BUCKET`) and
falls back to the values above.

## Everyday: ship a change

```bash
node deploy.mjs --dry-run     # builds the bundle, checks the environment, changes nothing in AWS
node deploy.mjs               # build, upload, deploy, wait, smoke-test
node deploy.mjs --list        # versions, with the live one starred
node deploy.mjs --rollback v1 # put an earlier version back
```

`deploy.mjs` builds the web app (`app/web`), zips it with the API, uploads the zip to S3, registers an
application version, points the environment at it, waits until it is `Ready`, then runs `smoke.mjs`. The
version label is `doorstep-<git sha>[-dirty]-<timestamp>`; `-dirty` means the tree had uncommitted changes.

The environment uses the **AllAtOnce** policy, so the site is down for about a minute during a deploy.
Fastn treats a failed callback as a failed *callback*, never a failed run, so no order is lost, but pick a
quiet moment and do not deploy in the middle of the demo recording.

## What is in the bundle

```
package.json, package-lock.json      the API (Elastic Beanstalk runs npm install, then npm start)
src/  scripts/                       API code, seed and demo helpers
web/dist/                            the built React app (WEB_DIST points here)
```

`bundle.mjs` refuses to build if a `.env*` file, log, `node_modules`, `.pem` or test folder would end up in it.

## Variables and secrets

Kept in the environment, never in the bundle. See [env.example](env.example) for what each one means.

```bash
node set-env.mjs --list                          # names; values shown only for non-secret keys
node set-env.mjs --from-file .env.production
node set-env.mjs CALLBACK_SECRET=<new value>
node set-env.mjs --unset SOME_KEY
```

Values reach AWS through a temporary file and are never printed. Changing a variable restarts the app (about a
minute).

**Rotating `CALLBACK_SECRET`:** it lives in two places that must match, the Elastic Beanstalk variable and the
Fastn org secret `CALLBACK_SECRET`. Change Fastn's first (the flows read it on every run), then run
`set-env.mjs`. In between, callbacks fail with 401 and appear in Fastn's execution log, not in Sync health.

## Verify a deployment

```bash
node smoke.mjs                       # against the live environment
node smoke.mjs --url http://localhost:4000
CALLBACK_SECRET=<value> node smoke.mjs   # also proves the receiver accepts the real secret
```

Nine read-only checks: health, the app and its client-side routes, the built assets, JSON 404s, callbacks
refused without or with a wrong secret, security headers, and **no `Cross-Origin-Opener-Policy` header** (with it
the Fastn sign-in popup loses `window.opener` and lands on a blank page). Nothing writes an event.

## First time, or a new account: `provision.mjs`

```bash
cp env.example .env.production      # fill in the five required values
node provision.mjs --dry-run        # read-only: IAM roles, platform, variables file
node provision.mjs
```

It creates a private deploy bucket, the Elastic Beanstalk application, and the environment (single instance,
`t3.micro`, enhanced health, health check `/api/health`, IMDSv1 disabled), then smoke-tests it. It does nothing
if the environment already exists.

### First-time IAM roles

Elastic Beanstalk needs an EC2 instance profile and a service role. They already exist in this account
(`provision.mjs --dry-run` confirms it). In a fresh account, create them once (commands from the AWS
documentation; not exercised here because the roles already existed):

```bash
aws iam create-role --role-name aws-elasticbeanstalk-ec2-role --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
for p in AWSElasticBeanstalkWebTier AWSElasticBeanstalkWorkerTier AWSElasticBeanstalkMulticontainerDocker; do
  aws iam attach-role-policy --role-name aws-elasticbeanstalk-ec2-role --policy-arn arn:aws:iam::aws:policy/$p; done
aws iam create-instance-profile --instance-profile-name aws-elasticbeanstalk-ec2-role
aws iam add-role-to-instance-profile --instance-profile-name aws-elasticbeanstalk-ec2-role --role-name aws-elasticbeanstalk-ec2-role

aws iam create-role --role-name aws-elasticbeanstalk-service-role --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"elasticbeanstalk.amazonaws.com"},"Action":"sts:AssumeRole","Condition":{"StringEquals":{"sts:ExternalId":"elasticbeanstalk"}}}]}'
for p in AWSElasticBeanstalkEnhancedHealth AWSElasticBeanstalkManagedUpdatesCustomerRolePolicy; do
  aws iam attach-role-policy --role-name aws-elasticbeanstalk-service-role --policy-arn arn:aws:iam::aws:policy/service-role/$p; done
```

## Point Fastn at the deployment

The flows report to `${appBaseUrl}/api/sync-events` with the `x-callback-secret` header, so after a **new**
environment (new URL) update the Fastn side too, through the Fastn MCP or the dashboard:

1. Env config `appBaseUrl` (env `test`) = the new URL, no trailing slash.
2. Org secret `CALLBACK_SECRET` = the same value as the environment variable.
3. Env config `defaultCustomerId` is the Fastn customer UUID, unchanged by a redeploy.

A plain redeploy of the same environment needs none of this: the URL does not change.

## Gotchas

- **Atlas network access.** The instance reaches Atlas over the internet. The Atlas IP access list must allow
  the instance's public IP, and a single-instance environment gets a **new IP if the instance is replaced**.
  Allow `0.0.0.0/0` for the hackathon (the database user and password still protect it) or attach an Elastic IP.
- **Logs.** `aws elasticbeanstalk request-environment-info --environment-name doorstep-prod --info-type tail`, then
  `retrieve-environment-info` with the same type, or the console's Logs page.
- **Slow first deploy.** `npm install` on a `t3.micro` takes a minute or two; `deploy.mjs` waits up to 15.
- **Cost.** One `t3.micro` plus pennies of S3. Free-tier eligible for a new account; otherwise a few dollars a month.

## HTTPS

The environment is plain HTTP, which means the callback secret and the demo dashboard travel unencrypted. For
the hackathon demo that is acceptable and it is listed under limitations in `SUBMISSION.md`. Before real
customers, terminate TLS in front of it. The two routes that fit this setup:

- **CloudFront in front of the environment** (a `*.cloudfront.net` certificate, no domain needed): origin
  = the Elastic Beanstalk hostname over HTTP, caching disabled, all headers forwarded, HTTPS for viewers.
  Then set Fastn `appBaseUrl` to the CloudFront URL.
- **Your own domain** with an ACM certificate and an application load balancer (switch the environment from
  single instance to load balanced).

Neither is scripted here yet.

## Tear down

```bash
node teardown.mjs --confirm doorstep-prod
```

Terminates the environment (the URL stops working, so Fastn callbacks fail until you recreate it with
`provision.mjs` and update `appBaseUrl`). Keeps the application, its versions and the bucket. Does not touch
MongoDB Atlas.

## Tests

```bash
npm test     # zip writer round-trip, bundle contents, argument and env-file parsing
```

The scripts were exercised read-only against the live account (`--list`, `--dry-run`, `provision --dry-run`,
`smoke`), and the bundle passes `unzip -t`. The upload, version-registration and environment-update calls, and
`provision.mjs` past its dry run, have **not** been run yet: the first real `node deploy.mjs` is their test.
