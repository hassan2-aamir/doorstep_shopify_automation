import { Link, NavLink, Outlet } from 'react-router-dom';
import { House, Package, Pulse, PlugsConnected, Truck } from '@phosphor-icons/react';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { StatusPill } from './StatusPill.jsx';
import { Banner } from './ui.jsx';
import { SYSTEM_LABELS, plural } from '../lib/format.js';

const NAV = [
  { to: '/today', label: 'Today', icon: House },
  { to: '/orders', label: 'Orders', icon: Package },
  { to: '/sync-health', label: 'Sync health', icon: Pulse, badge: true },
  { to: '/connections', label: 'Connections', icon: PlugsConnected },
];

// Highest-priority state wins: reconnect > open issues > setup > all syncing (App flow doc).
export function pillFor(ws) {
  if (!ws) return null;
  if (ws.state === 'reconnect_needed') {
    const sys = ws.reconnectSystem ?? 'sheet';
    return { variant: 'attention', label: `Reconnect ${SYSTEM_LABELS[sys]}`, to: `/connections?focus=${sys}` };
  }
  if (ws.state === 'attention') {
    return { variant: 'attention', label: `${ws.openIssueCount} need${ws.openIssueCount === 1 ? 's' : ''} attention`, to: '/sync-health?filter=issues' };
  }
  if (ws.state === 'new' || ws.state === 'connecting') return { variant: 'paused', label: 'Finish setup', to: '/connections' };
  return { variant: 'shipped', label: 'All syncing', to: '/today' };
}

function Badge({ count }) {
  if (!count) return null;
  return (
    <span className="ml-auto grid h-6 min-w-6 place-items-center rounded-pill bg-banner-danger-icon-bg px-2 text-xs font-bold text-banner-danger-icon-fg">
      {count}
      <span className="sr-only"> open {count === 1 ? 'issue' : 'issues'}</span>
    </span>
  );
}

const railItem = ({ isActive }) =>
  `flex min-h-touch items-center gap-3 rounded-md px-3 text-sm font-semibold motion-safe:transition-colors motion-safe:duration-fast ${
    isActive
      ? 'bg-[var(--nav-item-active-bg)] text-[var(--nav-item-active-fg)]'
      : 'text-[var(--nav-item-fg)] hover:bg-[var(--nav-item-hover-bg)]'
  }`;

const tabItem = ({ isActive }) =>
  `relative flex min-h-touch flex-col items-center justify-center gap-1 text-xs font-semibold ${
    isActive
      ? 'bg-[var(--nav-item-active-bg)] text-[var(--nav-item-active-fg)]'
      : 'text-[var(--nav-item-fg)] hover:bg-[var(--nav-item-hover-bg)]'
  }`;

export function AppShell() {
  const { data: ws, paused } = useWorkspace();
  const pill = pillFor(ws);
  const issues = ws?.openIssueCount ?? 0;

  return (
    <div className="min-h-screen bg-background text-foreground md:flex">
      <a href="#main" className="sr-only z-50 rounded-md bg-surface px-4 py-3 font-semibold focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>

      <nav aria-label="Main" className="sticky top-0 hidden h-screen w-rail flex-none flex-col gap-1 border-r-thick border-border bg-surface p-4 md:flex">
        <Link to="/today" className="mb-6 flex min-h-touch items-center gap-2 px-3 text-lg font-extrabold tracking-heading">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-md bg-brand text-white"><Truck size={18} weight="fill" /></span>
          Doorstep
        </Link>
        {NAV.map(({ to, label, icon: Icon, badge }) => (
          <NavLink key={to} to={to} className={railItem}>
            <Icon aria-hidden size={20} weight="bold" />
            {label}
            {badge && <Badge count={issues} />}
          </NavLink>
        ))}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b-thick border-border bg-surface">
          <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-3 px-gutter md:px-8">
            <p className="min-w-0 truncate font-bold">
              {ws?.name ?? ' '}
            </p>
            {pill && (
              <Link to={pill.to} className="flex-none rounded-pill" aria-label={`Status: ${pill.label}. Open.`}>
                <span role="status"><StatusPill variant={pill.variant} className="min-h-touch">{pill.label}</StatusPill></span>
              </Link>
            )}
          </div>
        </header>

        {paused && (
          <div className="mx-auto w-full max-w-content px-gutter pt-4 md:px-8">
            <Banner variant="warning" title="Live updates paused">Showing the last data we had. We'll reconnect on our own.</Banner>
          </div>
        )}

        <main id="main" className="mx-auto w-full max-w-content flex-1 px-gutter pb-[calc(var(--primitive-size-tabbar)+2rem+env(safe-area-inset-bottom))] pt-6 md:px-8 md:pb-12 md:pt-10">
          <Outlet />
        </main>
      </div>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(var(--primitive-size-tabbar)+env(safe-area-inset-bottom))] grid-cols-4 border-t-thick border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map(({ to, label, icon: Icon, badge }) => (
          <NavLink key={to} to={to} className={tabItem}>
            <Icon aria-hidden size={22} weight="bold" />
            <span>{label}</span>
            {badge && issues > 0 && (
              <span className="absolute right-[calc(50%-1.75rem)] top-1 grid h-5 min-w-5 place-items-center rounded-pill bg-banner-danger-icon-bg px-1 text-[0.6875rem] font-bold text-banner-danger-icon-fg">
                {issues}
                <span className="sr-only"> {plural(issues, 'open issue', 'open issues')}</span>
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
