import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Storefront, Table, EnvelopeSimple } from '@phosphor-icons/react';
import { api } from '../lib/api.js';
import { useScreen } from '../lib/useScreen.js';
import { safeReturnPath } from '../lib/safePath.js';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { StatusPill } from '../components/StatusPill.jsx';
import { Banner, Block, Button, ScreenHeading, Skeleton } from '../components/ui.jsx';
import { SYSTEM_LABELS } from '../lib/format.js';

const SYSTEMS = [
  { key: 'store', icon: Storefront, hint: 'Paid orders come from here' },
  { key: 'sheet', icon: Table, hint: 'Your supplier works from this' },
  { key: 'email', icon: EnvelopeSimple, hint: 'Buyer tracking emails and alerts' },
];

// The widget does not (yet, unverified) report connection status to our page, so each card shows
// only what our own events prove: a connection failure, setup still open, or no problems reported.
function statusFor(key, ws) {
  if (ws?.reconnectSystem === key) return { variant: 'attention', label: 'Needs reconnect' };
  if (!ws || ws.status !== 'live') return { variant: 'paused', label: 'Connect below' };
  return { variant: 'shipped', label: 'No problems' };
}

function useEmbedUrl() {
  const [state, setState] = useState({ url: null, error: null, loading: true });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { url } = await api('/api/fastn-token');
      setState({ url, error: null, loading: false });
    } catch (error) {
      setState({ url: null, error, loading: false });
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

export function Connections() {
  const headingRef = useScreen('Connections');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: ws, refresh } = useWorkspace();
  const focus = SYSTEM_LABELS[params.get('focus')] ? params.get('focus') : null;
  const rawReturn = params.get('returnTo');
  const returnTo = rawReturn ? safeReturnPath(rawReturn) : null;
  const embed = useEmbedUrl();
  const frameRef = useRef(null);
  const focusRef = useRef(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (focus) focusRef.current?.scrollIntoView({ block: 'center' });
  }, [focus]);

  // N7: the widget posts fastn:session-expired when its token runs out. Mint a fresh one and reload in
  // place; only messages from the widget's own origin are trusted.
  useEffect(() => {
    if (!embed.url) return undefined;
    const widgetOrigin = new URL(embed.url).origin;
    const onMessage = (ev) => {
      if (ev.origin !== widgetOrigin) return;
      const expired = ev.data === 'fastn:session-expired' || ev.data?.type === 'fastn:session-expired';
      if (expired) embed.reload();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [embed.url, embed.reload]);

  const back = () => {
    const label = SYSTEM_LABELS[focus] ?? 'Connection';
    toast(`${label} reconnected. Retrying within 5 minutes.`);
    refresh();
    navigate(returnTo);
  };

  const goLive = async () => {
    setConfirming(true);
    try {
      await api('/api/workspace', { method: 'POST', body: { action: 'confirm_setup' } });
      refresh();
      toast("You're live. New paid orders will appear in your sheet.");
      navigate('/today');
    } catch (err) {
      toast(`Couldn't go live: ${err.message}`);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-block-tight md:space-y-block">
      <ScreenHeading headingRef={headingRef} title="Connections">
        {returnTo && (
          <Button variant="secondary" onClick={back}>
            <ArrowLeft aria-hidden size={18} weight="bold" /> Done, take me back
          </Button>
        )}
      </ScreenHeading>

      <p className="max-w-2xl text-foreground-muted">
        Connect your store, your fulfillment sheet and an email account once. Your logins go to Fastn, our
        integration partner, and never to Doorstep.
      </p>

      <ul className="grid gap-block-tight md:grid-cols-3" aria-label="Connection status">
        {SYSTEMS.map(({ key, icon: Icon, hint }) => {
          const s = statusFor(key, ws);
          const focused = key === focus;
          return (
            <li key={key} ref={focused ? focusRef : undefined}>
              <Block
                as="div"
                aria-current={focused ? 'true' : undefined}
                className={`flex h-full flex-col gap-4 ${focused ? 'outline outline-[length:var(--focus-width)] outline-offset-2 outline-[color:var(--focus-color)]' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <span aria-hidden className="grid h-icon-block w-icon-block flex-none place-items-center rounded-md bg-primary-subtle text-primary-text">
                    <Icon size={22} weight="bold" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold">{SYSTEM_LABELS[key]}</p>
                    <p className="text-sm text-foreground-muted">{hint}</p>
                  </div>
                </div>
                <StatusPill variant={s.variant} className="self-start">{s.label}</StatusPill>
                {focused && <p className="text-sm font-semibold">Reconnect it in the panel below, then come back.</p>}
              </Block>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="widget-heading" className="space-y-3">
        <h2 id="widget-heading" className="text-lg font-bold">Your accounts</h2>
        {embed.loading && <Skeleton className="h-[560px]" />}
        {embed.error && (
          <Banner
            variant="danger"
            title="Couldn't load your connections"
            action={<Button variant="secondary" onClick={embed.reload}>Retry</Button>}
          >
            {embed.error.message}. The rest of Doorstep keeps working.
          </Banner>
        )}
        {embed.url && !embed.loading && (
          <iframe
            ref={frameRef}
            title="Connect your accounts (Fastn)"
            src={embed.url}
            allow="clipboard-write"
            className="h-[560px] w-full rounded-md border-thick border-block-border bg-block"
          />
        )}
      </section>

      {ws && ws.status !== 'live' && (
        <Block className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold">Both connected?</p>
            <p className="text-sm text-foreground-muted">Once Shopify and your sheet read Active in the panel above, go live.</p>
          </div>
          <Button onClick={goLive} disabled={confirming}>{confirming ? 'Going live…' : 'Go live'}</Button>
        </Block>
      )}
    </div>
  );
}
