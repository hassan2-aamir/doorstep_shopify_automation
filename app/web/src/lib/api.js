// The demo passes ?customer=<id> once (it stands in for a session). It's remembered for the tab so
// in-app links don't have to carry it; the server also falls back to DEMO_CUSTOMER_ID.
const KEY = 'doorstep.customer';
const OBJECT_ID = /^[0-9a-f]{24}$/i;

function readCustomer() {
  const fromUrl = new URLSearchParams(window.location.search).get('customer');
  if (fromUrl && OBJECT_ID.test(fromUrl)) {
    try { sessionStorage.setItem(KEY, fromUrl); } catch { /* private mode: URL param still works for this load */ }
    return fromUrl;
  }
  try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; }
}

const customer = readCustomer();

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// A 4xx is our request being wrong; anything else (network, 5xx) means the API is unreachable and
// polling should back off and show "Live updates paused".
export const isUnreachable = (err) => !(err instanceof ApiError) || err.status >= 500;

export async function api(path, { method = 'GET', body, signal } = {}) {
  const url = new URL(path, window.location.origin);
  if (customer) url.searchParams.set('customer', customer);
  let res;
  try {
    res = await fetch(url.pathname + url.search, {
      method,
      signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error('Network unreachable');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.code ?? 'HTTP_ERROR', data?.error?.message ?? `Request failed (${res.status})`);
  }
  return data;
}
