import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight, EnvelopeSimple, PlayCircle, PlugsConnected, ShieldCheck, Table, Warning, CheckCircle,
} from '@phosphor-icons/react';
import { useScreen } from '../lib/useScreen.js';
import { DEMO_VIDEO_URL } from '../lib/config.js';
import { StatusPill } from '../components/StatusPill.jsx';
import { Block, buttonClass } from '../components/ui.jsx';

const BENEFITS = [
  {
    icon: Table,
    title: 'Orders land in a sheet',
    body: 'Every paid order becomes one row your supplier already knows how to read. A replay or an edit never makes a duplicate.',
  },
  {
    icon: EnvelopeSimple,
    title: 'Tracking reaches your buyer',
    body: 'When your supplier types a tracking number, your buyer gets one email and the row is marked Notified. Never two.',
  },
  {
    icon: Warning,
    title: 'You see what broke, and how to fix it',
    body: 'A failure shows up in plain words with a link to the fix. No digging through logs, no silent gaps.',
  },
];

const STEPS = [
  {
    title: 'Connect once',
    body: 'Link your Shopify store, your fulfillment sheet and an email account. Your logins go to Fastn, our integration partner, and never to Doorstep.',
  },
  {
    title: 'Orders move on their own',
    body: 'A paid order appears in your sheet within a few minutes. Your supplier adds the tracking number, and Doorstep checks for it every 5 minutes.',
  },
  {
    title: 'Only exceptions reach you',
    body: 'If a connection expires or an order is missing something, Today says so in one sentence and points at the fix. Otherwise you do nothing.',
  },
];

// Built from the real components with example data, so the page shows the product rather than a picture of it.
function DemoPanel() {
  return (
    <figure className="space-y-4">
      <div className="rounded-md border-thick border-block-feature-border bg-block-feature-bg p-6 text-block-feature-fg md:p-8">
        <p className="text-xs font-bold uppercase tracking-label opacity-90">Today</p>
        <div className="mt-3 flex items-center gap-4">
          <span aria-hidden className="grid h-10 w-10 flex-none place-items-center rounded-md bg-banner-danger-icon-bg text-banner-danger-icon-fg">
            <Warning size={22} weight="bold" />
          </span>
          <p className="text-verdict">1 order needs attention</p>
        </div>

        <ul className="mt-6 divide-y-2 divide-[var(--event-row-border)] overflow-hidden rounded-md bg-surface text-foreground">
          <li className="flex flex-col gap-2 border-l-[3px] border-row-failed-accent bg-row-failed-bg p-4 sm:flex-row sm:items-center sm:gap-4">
            <span className="font-mono text-sm font-bold">#1003</span>
            <StatusPill variant="attention">Needs attention</StatusPill>
            <span className="text-sm font-semibold">Google Sheets needs reconnecting</span>
          </li>
          <li className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
            <span className="font-mono text-sm font-bold">#1002</span>
            <StatusPill variant="shipped">Shipped</StatusPill>
            <span className="text-sm">Tracking sent to your buyer</span>
          </li>
        </ul>
      </div>
      <figcaption className="text-sm text-foreground-muted">
        An illustration with example orders. When a connection breaks, Doorstep names it in plain words and links to the repair.
      </figcaption>
    </figure>
  );
}

export function Welcome() {
  const headingRef = useScreen('Orders to the doorstep, on autopilot');
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <>
      <section className="mx-auto max-w-content px-gutter pb-12 pt-12 md:px-8 md:pb-20 md:pt-20">
        <p className="motion-safe:animate-pop-in">
          <StatusPill variant="shipped" icon={CheckCircle}>For small Shopify stores</StatusPill>
        </p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-6 max-w-4xl text-4xl font-extrabold tracking-display outline-none text-balance md:text-6xl motion-safe:animate-pop-in"
        >
          Paid orders reach the doorstep. You don't copy a thing.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-foreground-muted text-pretty">
          Doorstep puts every paid Shopify order in your supplier's sheet, sends the tracking to your buyer, and tells you the
          moment something needs you.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link to="/setup" className={buttonClass('primary')}>
            Set up your store <ArrowRight aria-hidden size={18} weight="bold" />
          </Link>
          <Link to="/today" className={buttonClass('secondary')}>See the live dashboard</Link>
          {DEMO_VIDEO_URL && (
            <a href={DEMO_VIDEO_URL} target="_blank" rel="noreferrer" className={buttonClass('ghost')}>
              <PlayCircle aria-hidden size={20} weight="bold" /> Watch the 2-minute demo
            </a>
          )}
        </div>
        <p className="mt-4 flex items-center gap-2 text-sm text-foreground-muted">
          <ShieldCheck aria-hidden size={18} weight="bold" className="flex-none" />
          Three connections, made once. Your logins stay with Fastn.
        </p>
      </section>

      <section aria-labelledby="benefits" className="mx-auto max-w-content px-gutter pb-12 md:px-8 md:pb-20">
        <h2 id="benefits" className="sr-only">What Doorstep does</h2>
        <ul className="grid gap-block-tight md:grid-cols-3 md:gap-6">
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <Block as="div" className="h-full">
                <span aria-hidden className="grid h-icon-block w-icon-block place-items-center rounded-md bg-primary-subtle text-primary-text">
                  <Icon size={22} weight="bold" />
                </span>
                <h3 className="mt-4 text-lg font-bold tracking-heading">{title}</h3>
                <p className="mt-2 text-foreground-muted">{body}</p>
              </Block>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="demo" className="mx-auto max-w-content px-gutter pb-12 md:px-8 md:pb-20">
        <h2 id="demo" className="mb-6 text-2xl font-bold tracking-heading md:text-3xl">The one screen you check</h2>
        <DemoPanel />
      </section>

      <section id="how" aria-labelledby="how-heading" className="mx-auto max-w-content scroll-mt-4 px-gutter pb-12 md:px-8 md:pb-20">
        <h2 id="how-heading" className="mb-6 text-2xl font-bold tracking-heading md:text-3xl">How it works</h2>
        <ol className="grid gap-block-tight md:grid-cols-3 md:gap-6">
          {STEPS.map(({ title, body }, i) => (
            <li key={title}>
              <Block as="div" className="h-full">
                <p className="text-xs font-bold uppercase tracking-label text-stat-label">Step {i + 1}</p>
                <h3 className="mt-2 text-lg font-bold tracking-heading">{title}</h3>
                <p className="mt-2 text-foreground-muted">{body}</p>
              </Block>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="cta" className="mx-auto max-w-content px-gutter pb-16 md:px-8 md:pb-24">
        <Block className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div className="max-w-xl">
            <h2 id="cta" className="text-2xl font-bold tracking-heading md:text-3xl">Connect your store, then stop copying.</h2>
            <p className="mt-2 flex items-start gap-2 text-foreground-muted">
              <PlugsConnected aria-hidden size={20} weight="bold" className="mt-0.5 flex-none" />
              Setup walks you through Store, Sheet and Go live. You can leave and come back to any step.
            </p>
          </div>
          <Link to="/setup" className={buttonClass('primary', 'self-start md:self-auto')}>
            Set up your store <ArrowRight aria-hidden size={18} weight="bold" />
          </Link>
        </Block>
      </section>
    </>
  );
}
