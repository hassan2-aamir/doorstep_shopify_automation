import { forwardRef } from 'react';
import { Warning, WifiSlash, ListChecks } from '@phosphor-icons/react';

const BUTTON_BASE =
  'inline-flex h-control min-w-touch select-none items-center justify-center gap-2 whitespace-nowrap rounded-md border-thick px-6 text-sm font-bold ' +
  'motion-safe:transition-[background-color,transform] motion-safe:duration-fast motion-safe:ease-out-1 motion-safe:active:scale-press ' +
  'disabled:cursor-not-allowed';

const BUTTON_VARIANTS = {
  primary:
    'border-primary bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active ' +
    'disabled:border-transparent disabled:bg-[var(--button-primary-disabled-bg)] disabled:text-[var(--button-primary-disabled-fg)]',
  secondary:
    'border-[var(--button-secondary-border)] bg-[var(--button-secondary-bg)] text-[var(--button-secondary-fg)] hover:bg-[var(--button-secondary-hover-bg)] ' +
    'disabled:border-border disabled:text-foreground-muted',
  ghost:
    'border-transparent bg-transparent text-[var(--button-ghost-fg)] hover:bg-[var(--button-ghost-hover-bg)] disabled:text-foreground-muted',
};

export function buttonClass(variant = 'primary', extra = '') {
  return `${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${extra}`;
}

export const Button = forwardRef(function Button({ as: Comp = 'button', variant = 'primary', className = '', ...props }, ref) {
  const extra = Comp === 'button' && !props.type ? { type: 'button' } : {};
  return <Comp ref={ref} className={buttonClass(variant, className)} {...extra} {...props} />;
});

const BANNERS = {
  danger:  { icon: Warning,    cls: 'bg-banner-danger-bg border-banner-danger-border',   box: 'bg-banner-danger-icon-bg text-banner-danger-icon-fg',   role: 'alert' },
  warning: { icon: WifiSlash,  cls: 'bg-banner-warning-bg border-banner-warning-border', box: 'bg-banner-warning-icon-bg text-banner-warning-icon-fg', role: 'status' },
  info:    { icon: ListChecks, cls: 'bg-banner-info-bg border-banner-info-border',       box: 'bg-banner-info-icon-bg text-banner-info-icon-fg',       role: 'status' },
};

export function Banner({ variant = 'danger', title, children, action, icon }) {
  const b = BANNERS[variant];
  const Icon = icon ?? b.icon;
  return (
    <div role={b.role} className={`flex flex-col gap-3 rounded-md border-heavy p-4 text-banner-fg sm:flex-row sm:items-center ${b.cls}`}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className={`grid h-icon-block w-icon-block flex-none place-items-center rounded-md ${b.box}`}>
          <Icon aria-hidden size={22} weight="bold" />
        </span>
        <div className="min-w-0">
          <p className="font-bold leading-snug">{title}</p>
          {children && <div className="mt-1 text-sm">{children}</div>}
        </div>
      </div>
      {action && <div className="flex-none sm:self-center">{action}</div>}
    </div>
  );
}

export function Block({ feature = false, as: Comp = 'section', className = '', ...props }) {
  const skin = feature
    ? 'border-block-feature-border bg-block-feature-bg text-block-feature-fg'
    : 'border-block-border bg-block';
  return <Comp className={`rounded-md border-thick p-6 ${skin} ${className}`} {...props} />;
}

export function Stat({ label, value }) {
  return (
    <Block as="div">
      <p className="text-xs font-bold uppercase tracking-label text-stat-label">{label}</p>
      <p className="mt-3 text-stat tabular-nums text-stat-value">{value}</p>
    </Block>
  );
}

export function Skeleton({ className = '' }) {
  return <div aria-hidden className={`skeleton motion-safe:animate-sheen ${className}`} />;
}

export function ScreenHeading({ headingRef, title, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold tracking-heading outline-none md:text-3xl">
        {title}
      </h1>
      {children}
    </div>
  );
}

// Segmented filter control; the choice lives in the URL.
export function Segmented({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-md border-thick border-block-border bg-block p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`min-h-touch rounded-sm px-4 text-sm font-semibold motion-safe:transition-colors motion-safe:duration-fast ${
              active
                ? 'bg-[var(--nav-item-active-bg)] text-[var(--nav-item-active-fg)]'
                : 'text-[var(--nav-item-fg)] hover:bg-[var(--nav-item-hover-bg)]'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
