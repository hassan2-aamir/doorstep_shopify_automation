import { CheckCircle, Clock, Warning, MinusCircle, PauseCircle } from '@phosphor-icons/react';

const VARIANTS = {
  shipped:   { icon: CheckCircle, cls: 'bg-shipped-bg text-shipped-fg border-shipped-border',       dot: 'bg-shipped-solid' },
  waiting:   { icon: Clock,       cls: 'bg-waiting-bg text-waiting-fg border-waiting-border',       dot: 'bg-waiting-solid' },
  attention: { icon: Warning,     cls: 'bg-attention-bg text-attention-fg border-attention-border', dot: 'bg-attention-solid' },
  skipped:   { icon: MinusCircle, cls: 'bg-skipped-bg text-skipped-fg border-skipped-border',       dot: 'bg-skipped-solid' },
  paused:    { icon: PauseCircle, cls: 'bg-paused-bg text-paused-fg border-paused-border',          dot: 'bg-paused-solid' },
};

// Status is never colour alone: dot + icon + word, always. The label is required.
export function StatusPill({ variant, children, icon, className = '' }) {
  const v = VARIANTS[variant];
  const Icon = icon ?? v.icon;
  return (
    <span
      className={`inline-flex min-h-[var(--pill-min-height)] items-center gap-2 whitespace-nowrap rounded-pill border-hairline px-3 py-1 text-xs font-bold uppercase tracking-label ${v.cls} ${className}`}
    >
      <span aria-hidden className={`h-2 w-2 flex-none rounded-pill ${v.dot}`} />
      <Icon aria-hidden size={16} weight="bold" className="flex-none" />
      <span>{children}</span>
    </span>
  );
}

export const STAGE_PILL = {
  waiting: { variant: 'waiting', label: 'Waiting on supplier' },
  shipped: { variant: 'shipped', label: 'Shipped' },
  needs_attention: { variant: 'attention', label: 'Needs attention' },
};

// Sync health result column. A failure a later run already fixed no longer needs Sara: it's shown
// quietly as Resolved, not red.
export function outcomePill(event) {
  if (event.outcome === 'success') return { variant: 'shipped', label: 'Done' };
  if (event.outcome === 'skipped') return { variant: 'skipped', label: 'Skipped' };
  return event.open
    ? { variant: 'attention', label: 'Needs attention' }
    : { variant: 'skipped', label: 'Resolved' };
}
