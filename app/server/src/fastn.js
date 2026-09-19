// Embed-token minting, ported from .claude/skills/fastn-expert/assets/embed-starter/server.js.
// VERIFY against the workspace's Embed tab: host, request shape, response shape, and whether
// user-level embeds need `tenant-id` on the iframe URL.

export class FastnError extends Error {
  constructor(message, code) {
    super(message);
    this.status = 502;
    this.code = code;
  }
}

export async function mintEmbedToken(fastn, { endOrgId, userEmail, userName }, fetchImpl = fetch) {
  if (!fastn.host || !fastn.apiKey) {
    throw new FastnError('Fastn is not configured on the server (FASTN_HOST, FASTN_API_KEY)', 'FASTN_NOT_CONFIGURED');
  }
  const headers = { Authorization: `Bearer ${fastn.apiKey}`, 'Content-Type': 'application/json' };
  // A fsk_test_ key needs this header and still writes to live systems: it is not a sandbox.
  if (fastn.apiKey.startsWith('fsk_test_')) headers['X-fastn-Test-Mode'] = 'true';
  if (fastn.orgId) headers['x-org-id'] = fastn.orgId;

  let res;
  try {
    res = await fetchImpl(`${fastn.host.replace(/\/$/, '')}/api/v1/embed/token`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ endOrgId, userEmail, userName }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new FastnError('Could not reach the Fastn token API', 'FASTN_UNREACHABLE');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Branch on the code, never log the token or the key.
    throw new FastnError(`Fastn token request failed (${body?.error?.code || `HTTP_${res.status}`})`, 'FASTN_TOKEN_FAILED');
  }
  const token = body?.data?.token ?? body?.token; // both shapes appear in Fastn docs
  if (!token) throw new FastnError('Fastn returned no token', 'FASTN_TOKEN_MISSING');
  return token;
}

export function iframeUrl(fastn, token, endOrgId) {
  const base = `${fastn.host.replace(/\/$/, '')}/api/v1/embed/iframe?token=${encodeURIComponent(token)}`;
  return fastn.userLevel ? `${base}&tenant-id=${encodeURIComponent(endOrgId)}` : base;
}
