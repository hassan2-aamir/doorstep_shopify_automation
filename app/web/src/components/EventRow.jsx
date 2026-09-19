import { Link } from 'react-router-dom';
import { ArrowSquareOut, CaretDown } from '@phosphor-icons/react';
import { StatusPill, outcomePill } from './StatusPill.jsx';
import { Button } from './ui.jsx';
import { SYSTEM_LABELS, formatWhen, orderLabel } from '../lib/format.js';

// The repair for an open failure, chosen by errorKind (App flow doc, "Cross-screen rules").
export function FixAction({ event, shopDomain, returnTo }) {
  if (event.outcome !== 'failed' || !event.open) return null;
  if (event.errorKind === 'connection' && event.system) {
    const to = `/connections?focus=${event.system}&returnTo=${encodeURIComponent(returnTo)}`;
    return <Button as={Link} to={to}>Reconnect {SYSTEM_LABELS[event.system]}</Button>;
  }
  if (event.errorKind === 'data') {
    return shopDomain ? (
      <Button as="a" variant="secondary" href={`https://${shopDomain}/admin/orders/${event.orderId}`} target="_blank" rel="noopener noreferrer">
        Open in Shopify <ArrowSquareOut aria-hidden size={18} weight="bold" />
        <span className="sr-only">(opens in a new tab)</span>
      </Button>
    ) : (
      <p className="text-sm">Fix the order in Shopify. The next run picks it up.</p>
    );
  }
  return <p className="text-sm">We retry automatically. Nothing for you to do yet.</p>;
}

function Explanation({ event }) {
  if (event.outcome === 'failed') {
    return (
      <p>
        <span className="font-semibold">{event.open ? 'Stuck at: ' : 'Failed earlier at: '}</span>
        {event.stepLabel}
        {!event.open && '. A later run fixed it.'}
      </p>
    );
  }
  if (event.outcome === 'skipped') return <p>Nothing to do: it was a test order or had already been handled.</p>;
  return <p>{event.stepLabel}: done.</p>;
}

export function EventRow({ event, expanded, onToggle, timeZone, shopDomain, returnTo, isNew }) {
  const pill = outcomePill(event);
  const failedOpen = event.outcome === 'failed' && event.open;
  const panelId = `event-panel-${event.eventId.replace(/[^A-Za-z0-9_-]/g, '-')}`;

  return (
    <li
      data-event-id={event.eventId}
      className={`border-b-hairline border-row-border last:border-b-0 ${
        failedOpen ? 'border-l-heavy border-l-row-failed-accent bg-row-failed-bg' : 'bg-surface'
      } ${isNew ? 'motion-safe:animate-pop-in' : ''}`}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        className={`grid min-h-row w-full items-center gap-x-4 gap-y-1 px-4 py-3 text-left motion-safe:transition-colors motion-safe:duration-fast
          grid-cols-[minmax(0,1fr)_auto] [grid-template-areas:'order_pill'_'what_what'_'time_time']
          md:grid-cols-[6.5rem_7.5rem_minmax(0,1fr)_auto] md:[grid-template-areas:'time_order_what_pill']
          ${failedOpen ? '' : 'hover:bg-row-hover'}`}
      >
        <span className="text-sm tabular-nums text-foreground-muted [grid-area:time]">
          <time dateTime={event.at}>{formatWhen(event.at, timeZone)}</time>
        </span>
        <span className="font-mono text-sm font-bold [grid-area:order]">{orderLabel(event)}</span>
        <span className="min-w-0 text-sm [grid-area:what]">
          <span className="font-semibold">{event.label}</span>
          <span className="block text-foreground-muted">{event.outcome === 'failed' && event.open ? event.reason : event.stepLabel}</span>
        </span>
        <span className="flex items-center gap-2 justify-self-end [grid-area:pill]">
          <StatusPill variant={pill.variant}>{pill.label}</StatusPill>
          <CaretDown aria-hidden size={18} weight="bold" className={`flex-none text-foreground-muted motion-safe:transition-transform ${expanded ? 'rotate-180' : ''}`} />
          <span className="sr-only">{expanded ? 'Hide details' : 'Show details'}</span>
        </span>
      </button>

      {expanded && (
        <div id={panelId} role="region" aria-label={`Details for ${orderLabel(event)}`} className="space-y-4 px-4 pb-5 pt-2 text-sm md:pl-[calc(6.5rem+2rem)]">
          <Explanation event={event} />
          <div className="flex flex-wrap items-center gap-3">
            <FixAction event={event} shopDomain={shopDomain} returnTo={returnTo} />
            {event.outcome !== 'skipped' && (
              <Link to={`/orders/${event.orderId}`} className="inline-flex min-h-touch items-center font-semibold text-primary-text underline underline-offset-4">
                View order timeline
              </Link>
            )}
          </div>
          {event.error && (
            <details className="rounded-md border-hairline border-row-border bg-surface-sunken p-3">
              <summary className="min-h-touch cursor-pointer py-2 font-semibold">Technical details</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs">{event.error}</pre>
              <p className="mt-2 text-xs text-foreground-muted">Step: {event.step} · Event: {event.eventId}</p>
            </details>
          )}
        </div>
      )}
    </li>
  );
}

// Compact, link-only variant for Today's "last 5 events".
export function EventLinkRow({ event, timeZone }) {
  const pill = outcomePill(event);
  return (
    <li className="border-b-hairline border-row-border last:border-b-0">
      <Link
        to={`/sync-health?event=${encodeURIComponent(event.eventId)}`}
        className="flex min-h-row flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-row-hover motion-safe:transition-colors motion-safe:duration-fast"
      >
        <span className="font-mono text-sm font-bold">{orderLabel(event)}</span>
        <span className="min-w-0 flex-1 text-sm">
          {event.label}
          <span className="text-foreground-muted"> · <time dateTime={event.at}>{formatWhen(event.at, timeZone)}</time></span>
        </span>
        <StatusPill variant={pill.variant}>{pill.label}</StatusPill>
      </Link>
    </li>
  );
}
