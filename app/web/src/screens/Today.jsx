import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Warning, PauseCircle, Package, ArrowSquareOut } from '@phosphor-icons/react';
import { api } from '../lib/api.js';
import { usePoll } from '../lib/usePoll.js';
import { useScreen } from '../lib/useScreen.js';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { EventLinkRow } from '../components/EventRow.jsx';
import { Banner, Block, Button, ScreenHeading, Skeleton, Stat } from '../components/ui.jsx';
import { SYSTEM_LABELS, plural } from '../lib/format.js';

function verdictFor(ws, hasEvents) {
  if (ws.state === 'new' || ws.state === 'connecting') {
    return { text: 'Finish setup to start moving orders', icon: PauseCircle, box: 'bg-warning-solid text-[var(--banner-warning-icon-fg)]' };
  }
  if (ws.openIssueCount > 0) {
    return { text: `${plural(ws.openIssueCount, 'order needs', 'orders need')} attention`, icon: Warning, box: 'bg-banner-danger-icon-bg text-banner-danger-icon-fg' };
  }
  if (!hasEvents) return { text: 'Waiting for your first order', icon: Package, box: 'bg-block-feature-accent text-[var(--banner-info-icon-fg)]' };
  return { text: 'All orders are moving', icon: CheckCircle, box: 'bg-success-solid text-white' };
}

function SetupChecklist({ ws, onLive }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const confirm = async () => {
    setBusy(true);
    try {
      await api('/api/workspace', { method: 'POST', body: { action: 'confirm_setup' } });
      onLive();
      toast("You're live. New paid orders will appear in your sheet.");
    } catch (err) {
      toast(`Couldn't go live: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };
  const steps = [
    'Connect your Shopify store',
    'Connect your Fulfillment sheet (and an email account for buyer updates)',
    'Go live',
  ];
  return (
    <Banner
      variant="info"
      title="Finish setting up Doorstep"
      action={
        <div className="flex flex-wrap gap-3">
          <Button as={Link} to="/connections" variant="secondary">Open Connections</Button>
          <Button onClick={confirm} disabled={busy || ws.status === 'live'}>{busy ? 'Going live…' : 'Go live'}</Button>
        </div>
      }
    >
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        {steps.map((s) => <li key={s}>{s}</li>)}
      </ol>
    </Banner>
  );
}

export function Today() {
  const headingRef = useScreen('Today');
  const { data: ws, error, refresh } = useWorkspace();
  const feed = usePoll((signal) => api('/api/sync-events?limit=5', { signal }), 15000, 'today-feed');
  const events = feed.data?.events?.slice(0, 5) ?? [];

  if (!ws) {
    return (
      <div className="space-y-block-tight md:space-y-block">
        <ScreenHeading headingRef={headingRef} title="Today" />
        {error ? (
          <Banner variant="danger" title="We couldn't load your workspace">{error.message}</Banner>
        ) : (
          <div aria-busy="true" className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-32" /></div>
        )}
      </div>
    );
  }

  const verdict = verdictFor(ws, events.length > 0);
  const VerdictIcon = verdict.icon;
  const sys = SYSTEM_LABELS[ws.reconnectSystem] ?? 'A connection';

  return (
    <div className="space-y-block-tight md:space-y-block">
      <ScreenHeading headingRef={headingRef} title="Today" />

      <Block feature className="flex items-start gap-4 md:items-center md:p-8">
        <span aria-hidden className={`grid h-icon-block w-icon-block flex-none place-items-center rounded-md md:h-14 md:w-14 ${verdict.box}`}>
          <VerdictIcon size={26} weight="bold" />
        </span>
        <div className="min-w-0">
          <p role="status" className="text-2xl font-extrabold leading-tight tracking-display md:text-verdict">{verdict.text}</p>
          <p className="mt-2 text-sm opacity-90">Paid orders go to your supplier's sheet, and tracking goes back to your buyers.</p>
        </div>
      </Block>

      {ws.state === 'reconnect_needed' && (
        <Banner
          variant="danger"
          title={`${sys} needs reconnecting`}
          action={<Button as={Link} to={`/connections?focus=${ws.reconnectSystem}&returnTo=${encodeURIComponent('/today')}`}>Reconnect {sys}</Button>}
        >
          Orders can't move until it's reconnected. Nothing is lost; they'll retry after you fix it.
        </Banner>
      )}
      {ws.state === 'attention' && (
        <Banner
          variant="danger"
          title={`${plural(ws.openIssueCount, 'order needs', 'orders need')} attention`}
          action={<Button as={Link} to="/sync-health?filter=issues">Review issues</Button>}
        >
          Each one says what went wrong and how to fix it.
        </Banner>
      )}
      {(ws.status === 'new' || ws.status === 'connecting') && <SetupChecklist ws={ws} onLive={refresh} />}

      <div className="grid gap-block-tight sm:grid-cols-3">
        <Stat label="Received today" value={ws.today.received} />
        <Stat label="Waiting for supplier" value={ws.today.waiting} />
        <Stat label="Shipped today" value={ws.today.shipped} />
      </div>

      <section aria-labelledby="recent-heading" className="overflow-hidden rounded-md border-thick border-block-border bg-block">
        <div className="flex items-center justify-between gap-3 border-b-thick border-block-border px-4 py-3">
          <h2 id="recent-heading" className="text-sm font-bold uppercase tracking-label text-row-header-fg">Latest activity</h2>
          <Link to="/sync-health" className="inline-flex min-h-touch items-center text-sm font-semibold text-primary-text underline underline-offset-4">
            All activity
          </Link>
        </div>
        {feed.loading && !feed.data ? (
          <div aria-busy="true" className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : events.length ? (
          <ul>{events.map((e) => <EventLinkRow key={e.eventId} event={e} timeZone={ws.timezone} />)}</ul>
        ) : (
          <div className="flex flex-col items-start gap-3 px-4 py-8">
            <p className="font-bold">Waiting for your first order</p>
            <p className="text-sm text-foreground-muted">Place a test order in Shopify and it lands in your sheet within a minute.</p>
            {ws.shopDomain && (
              <Button as="a" variant="secondary" href={`https://${ws.shopDomain}/admin/orders`} target="_blank" rel="noopener noreferrer">
                Open in Shopify <ArrowSquareOut aria-hidden size={18} weight="bold" /><span className="sr-only">(opens in a new tab)</span>
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
