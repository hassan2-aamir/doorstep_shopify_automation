import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { CheckCircle } from '@phosphor-icons/react';
import { api } from '../lib/api.js';
import { usePoll } from '../lib/usePoll.js';
import { useScreen } from '../lib/useScreen.js';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { EventRow } from '../components/EventRow.jsx';
import { Banner, ScreenHeading, Segmented, Skeleton, Stat } from '../components/ui.jsx';
import { plural } from '../lib/format.js';

export function SyncHealth() {
  const headingRef = useScreen('Sync health');
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const filter = params.get('filter') === 'issues' ? 'issues' : 'all';
  const focusEvent = params.get('event');
  const { data: ws } = useWorkspace();

  const query = new URLSearchParams({ limit: '50' });
  if (filter === 'issues') query.set('filter', 'issues');
  if (focusEvent) query.set('event', focusEvent);
  const { data, error, loading, paused } = usePoll(
    (signal) => api(`/api/sync-events?${query}`, { signal }),
    5000,
    `sync:${filter}:${focusEvent ?? ''}`,
  );

  // Expanded rows are keyed by eventId so a 5-second poll never collapses what Sara opened.
  const [expanded, setExpanded] = useState(() => new Set(focusEvent ? [focusEvent] : []));
  useEffect(() => {
    if (focusEvent) setExpanded((s) => new Set(s).add(focusEvent));
  }, [focusEvent]);

  // N2: a cold deep link from the alert email scrolls the event into view once it has loaded.
  const scrolledFor = useRef(null);
  useEffect(() => {
    if (!focusEvent || !data || scrolledFor.current === focusEvent) return;
    const el = document.querySelector(`[data-event-id="${CSS.escape(focusEvent)}"]`);
    if (el) {
      scrolledFor.current = focusEvent;
      el.scrollIntoView({ block: 'center' });
      el.querySelector('button')?.focus({ preventScroll: true });
    }
  }, [focusEvent, data]);

  // Rows that appear on a later poll get a one-off pop-in.
  const seen = useRef(null);
  const newIds = new Set();
  if (data) {
    if (seen.current) data.events.forEach((e) => { if (!seen.current.has(e.eventId)) newIds.add(e.eventId); });
    seen.current = new Set([...(seen.current ?? []), ...data.events.map((e) => e.eventId)]);
  }

  const toggle = (id) => setExpanded((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const setFilter = (value) => {
    const next = new URLSearchParams(params);
    if (value === 'issues') next.set('filter', 'issues'); else next.delete('filter');
    setParams(next);
  };

  const returnTo = `${location.pathname}${location.search}`;
  const counts = data?.counts;

  return (
    <div className="space-y-block-tight md:space-y-block">
      <ScreenHeading headingRef={headingRef} title="Sync health">
        <Segmented
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All activity' },
            { value: 'issues', label: `Issues${data ? ` (${data.openIssueCount})` : ''}` },
          ]}
        />
      </ScreenHeading>

      {error && !paused && <Banner variant="danger" title="We couldn't load activity">{error.message}</Banner>}
      {paused && data && <Banner variant="warning" title="Live updates paused">Showing the last data we had.</Banner>}

      <div aria-busy={loading} className="grid gap-block-tight sm:grid-cols-3">
        {counts ? (
          <>
            <Stat label="Synced" value={counts.synced} />
            <Stat label="Skipped (already done)" value={counts.skipped} />
            <Stat label="Failed" value={counts.failed} />
          </>
        ) : (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-[8.5rem]" />)
        )}
      </div>
      {counts && (
        <p role="status" aria-atomic="true" className="sr-only">
          Last {counts.sinceHours} hours: {counts.synced} synced, {counts.skipped} skipped, {counts.failed} failed.
        </p>
      )}

      <section aria-labelledby="events-heading" className="overflow-hidden rounded-md border-thick border-block-border bg-block">
        <div className="flex items-center justify-between gap-3 border-b-thick border-block-border px-4 py-3">
          <h2 id="events-heading" className="text-sm font-bold uppercase tracking-label text-row-header-fg">
            {filter === 'issues' ? 'Open issues' : 'Latest 50 events, issues first'}
          </h2>
          {data && <span className="text-sm text-foreground-muted">{plural(data.events.length, 'event', 'events')}</span>}
        </div>

        <div aria-hidden className="hidden grid-cols-[6.5rem_7.5rem_minmax(0,1fr)_auto] gap-x-4 border-b-hairline border-row-border px-4 py-2 text-xs font-bold uppercase tracking-label text-row-header-fg md:grid">
          <span>Time</span><span>Order</span><span>What ran</span><span className="pr-8">Result</span>
        </div>

        {loading && !data && (
          <div aria-busy="true" className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
          </div>
        )}

        {data && data.events.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <CheckCircle aria-hidden size={40} weight="duotone" className="text-success-solid" />
            <p className="font-bold">{filter === 'issues' ? 'No open issues. Everything is moving.' : 'No activity yet'}</p>
            <p className="max-w-sm text-sm text-foreground-muted">
              {filter === 'issues'
                ? 'Anything that fails shows up here with the reason and the fix.'
                : 'When a paid order arrives, you’ll see it land in your sheet here within a minute.'}
            </p>
          </div>
        )}

        {data && data.events.length > 0 && (
          <ul>
            {data.events.map((event) => (
              <EventRow
                key={event.eventId}
                event={event}
                expanded={expanded.has(event.eventId)}
                onToggle={() => toggle(event.eventId)}
                timeZone={ws?.timezone}
                shopDomain={ws?.shopDomain}
                returnTo={returnTo}
                isNew={newIds.has(event.eventId)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
