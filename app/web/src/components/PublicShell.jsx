import { Link, Outlet, useLocation } from 'react-router-dom';
import { Truck } from '@phosphor-icons/react';
import { buttonClass } from './ui.jsx';

// Frame for the pages that come before the control tower (landing, setup): no rail, no status pill.
export function PublicShell() {
  const { pathname } = useLocation();
  // The landing page is a story presented slide by slide, so its header stays in view.
  const story = pathname === '/' || pathname === '/welcome';
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a href="#main" className="sr-only z-50 rounded-md bg-surface px-4 py-3 font-semibold focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <header className={`border-b-thick border-border bg-surface ${story ? 'sticky top-0 z-40' : ''}`}>
        <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-3 px-gutter md:px-8">
          <Link to="/" className="flex min-h-touch items-center gap-2 text-lg font-extrabold tracking-heading">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-md bg-brand text-white"><Truck size={18} weight="fill" /></span>
            Doorstep
          </Link>
          <nav aria-label="Site" className="flex items-center gap-1">
            <Link to="/#how" className={buttonClass('ghost', 'hidden sm:inline-flex')}>How it works</Link>
            <Link to="/today" className={buttonClass('ghost')}>Open dashboard</Link>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t-thick border-border bg-surface">
        <div className="mx-auto flex max-w-content flex-col gap-2 px-gutter py-8 text-sm text-foreground-muted md:flex-row md:items-center md:justify-between md:px-8">
          <p>Doorstep, built on Fastn for the Build with Fastn hackathon (Track 02, SEECS NUST).</p>
          <a
            href="https://github.com/hassan2-aamir/doorstep_shopify_automation"
            className="inline-flex min-h-touch items-center font-semibold text-primary-text underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
