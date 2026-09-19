// returnTo comes from the URL, so it's untrusted: only our own routes are allowed back through
// navigate(). Anything else (//evil.com, /\evil.com, javascript:, other paths) falls back to /today.
const ALLOWED = /^\/(today|orders|sync-health|connections)(\/[0-9]{1,20})?(\?[A-Za-z0-9=&%_.:-]*)?$/;

export function safeReturnPath(value, fallback = '/today') {
  return typeof value === 'string' && ALLOWED.test(value) ? value : fallback;
}
