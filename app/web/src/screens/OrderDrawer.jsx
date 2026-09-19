import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowSquareOut, X } from '@phosphor-icons/react';
import { api } from '../lib/api.js';
import { usePoll } from '../lib/usePoll.js';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { STAGE_PILL, StatusPill, outcomePill } from '../components/StatusPill.jsx';
import { FixAction } from '../components/EventRow.jsx';
import { Button, Skeleton } from '../components/ui.jsx';
import { formatWhen, orderLabel } from '../lib/format.js';

const FOCUSABLE = 'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export function OrderDrawer() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: ws } = useWorkspace();
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const validId = /^\d{1,20}$/.test(orderId);

  const { data, error, loading } = usePoll(
    (signal) => api(`/api/orders/${orderId}`, { signal }),
    5000,
    `order:${orderId}`,
  );

  const close = () => navigate(`/orders${location.search}`);

  useEffect(() => { closeRef.current?.focus(); }, []);

  // Focus stays inside the drawer; Escape closes it.
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const nodes = [...panelRef.current.querySelectorAll(FOCUSABLE)];
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const notFound = !validId || error?.status === 404 || error?.status === 400;
  const openIssue = data?.timeline?.filter((e) => e.open).at(-1);
  const pill = data?.stage ? STAGE_PILL[data.stage] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end" onKeyDown={onKeyDown}>
      <button type="button" aria-label="Close order details" tabIndex={-1} onClick={close} className="absolute inset-0 cursor-default bg-overlay" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className="relative flex max-h-[90vh] w-full flex-col overflow-y-auto rounded-t-lg border-t-heavy border-drawer-border bg-drawer p-6 motion-safe:animate-pop-in md:max-h-none md:w-drawer md:rounded-none md:border-l-heavy md:border-t-0"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h2 id="drawer-title" className="font-mono text-2xl font-extrabold">
              {data ? orderLabel(data) : validId ? `Order ${orderId}` : 'Order'}
            </h2>
            {pill && <StatusPill variant={pill.variant}>{pill.label}</StatusPill>}
          </div>
          <Button ref={closeRef} variant="ghost" onClick={close} aria-label="Close" className="px-3">
            <X aria-hidden size={22} weight="bold" />
          </Button>
        </div>

        {notFound && <p className="mt-8 font-semibold">We have no record of this order.</p>}
        {loading && !data && !notFound && <div aria-busy="true" className="mt-6 space-y-3"><Skeleton className="h-10" /><Skeleton className="h-24" /></div>}

        {data && (
          <>
            <div className="mt-6 flex flex-wrap gap-3">
              {openIssue && <FixAction event={openIssue} shopDomain={ws?.shopDomain} returnTo={`/orders/${orderId}`} />}
              {ws?.shopDomain && (
                <Button as="a" variant="secondary" href={`https://${ws.shopDomain}/admin/orders/${data.orderId}`} target="_blank" rel="noopener noreferrer">
                  Open in Shopify <ArrowSquareOut aria-hidden size={18} weight="bold" /><span className="sr-only">(opens in a new tab)</span>
                </Button>
              )}
              {ws?.sheetUrl && (
                <Button as="a" variant="secondary" href={ws.sheetUrl} target="_blank" rel="noopener noreferrer">
                  Open in sheet <ArrowSquareOut aria-hidden size={18} weight="bold" /><span className="sr-only">(opens in a new tab)</span>
                </Button>
              )}
            </div>

            <h3 className="mt-8 text-sm font-bold uppercase tracking-label text-row-header-fg">Timeline</h3>
            <ol className="mt-3 space-y-0">
              {data.timeline.map((e) => {
                const p = outcomePill(e);
                return (
                  <li key={e.eventId} className="relative border-l-thick border-block-border pb-6 pl-6 last:pb-0">
                    <span aria-hidden className="absolute -left-[7px] top-1 h-3 w-3 rounded-pill bg-block-feature-accent" />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{e.label}</span>
                      <StatusPill variant={p.variant}>{p.label}</StatusPill>
                    </div>
                    <p className="mt-1 text-sm">{e.outcome === 'failed' && e.open ? e.reason : e.stepLabel}</p>
                    <p className="mt-1 text-sm text-foreground-muted"><time dateTime={e.at}>{formatWhen(e.at, ws?.timezone)}</time></p>
                    {e.error && (
                      <details className="mt-2 text-sm">
                        <summary className="min-h-touch cursor-pointer py-2 font-semibold">Technical details</summary>
                        <pre className="whitespace-pre-wrap break-words font-mono text-xs">{e.error}</pre>
                      </details>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
