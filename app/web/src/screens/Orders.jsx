import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { CaretRight } from '@phosphor-icons/react';
import { api } from '../lib/api.js';
import { usePoll } from '../lib/usePoll.js';
import { useScreen } from '../lib/useScreen.js';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { STAGE_PILL, StatusPill } from '../components/StatusPill.jsx';
import { Banner, ScreenHeading, Segmented, Skeleton } from '../components/ui.jsx';
import { formatWhen, orderLabel } from '../lib/format.js';

const STAGES = [
  { value: 'all', label: 'All' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'needs_attention', label: 'Needs attention' },
];

const EMPTY = {
  all: 'No orders yet. Paid orders appear here as soon as they reach your sheet.',
  waiting: 'No orders waiting on a supplier.',
  shipped: 'Nothing shipped yet.',
  needs_attention: 'No orders need attention.',
};

export function Orders() {
  const headingRef = useScreen('Orders');
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const { data: ws } = useWorkspace();
  const stage = STAGES.some((s) => s.value === params.get('stage')) ? params.get('stage') : 'all';
  const openOrderId = location.pathname.match(/^\/orders\/(\d+)/)?.[1] ?? null;

  const { data, error, loading, paused } = usePoll(
    (signal) => api(`/api/orders${stage === 'all' ? '' : `?stage=${stage}`}`, { signal }),
    5000,
    `orders:${stage}`,
  );

  // The drawer returns focus to the row that opened it.
  const lastOpen = useRef(null);
  useEffect(() => {
    if (openOrderId) {
      lastOpen.current = openOrderId;
    } else if (lastOpen.current) {
      document.querySelector(`[data-order-id="${lastOpen.current}"]`)?.focus();
      lastOpen.current = null;
    }
  }, [openOrderId]);

  const setStage = (value) => {
    const next = new URLSearchParams(params);
    if (value === 'all') next.delete('stage'); else next.set('stage', value);
    setParams(next);
  };

  const search = location.search;
  // The drawer outlet sits outside the space-y stack: a margin on a fixed overlay shifts it down.
  return (
    <>
    <div className="space-y-block-tight md:space-y-block">
      <ScreenHeading headingRef={headingRef} title="Orders">
        <Segmented label="Stage" value={stage} onChange={setStage} options={STAGES} />
      </ScreenHeading>

      {error && !paused && <Banner variant="danger" title="We couldn't load orders">{error.message}</Banner>}

      <section aria-label="Orders" className="overflow-hidden rounded-md border-thick border-block-border bg-block">
        {loading && !data && <div aria-busy="true" className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>}
        {data && data.orders.length === 0 && <p className="px-4 py-12 text-center text-foreground-muted">{EMPTY[stage]}</p>}
        {data && data.orders.length > 0 && (
          <ul>
            {data.orders.map((o) => {
              const pill = STAGE_PILL[o.stage];
              return (
                <li key={o.orderId} className="border-b-hairline border-row-border last:border-b-0">
                  <Link
                    data-order-id={o.orderId}
                    to={`/orders/${o.orderId}${search}`}
                    className={`flex min-h-row flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-row-hover motion-safe:transition-colors motion-safe:duration-fast ${
                      o.stage === 'needs_attention' ? 'border-l-heavy border-l-row-failed-accent bg-row-failed-bg' : ''
                    }`}
                  >
                    <span className="font-mono font-bold">{orderLabel(o)}</span>
                    <span className="flex-1 text-sm text-foreground-muted">
                      Updated <time dateTime={o.lastEventAt}>{formatWhen(o.lastEventAt, ws?.timezone)}</time>
                    </span>
                    <StatusPill variant={pill.variant}>{pill.label}</StatusPill>
                    <CaretRight aria-hidden size={18} weight="bold" className="text-foreground-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
    <Outlet />
    </>
  );
}
