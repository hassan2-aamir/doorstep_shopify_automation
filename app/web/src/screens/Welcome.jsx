import { createContext, useContext, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight, BellRinging, CaretDown, CaretRight, CheckCircle, EnvelopeSimple, GithubLogo, Lightning, Package, Palette,
  PencilSimpleLine, PlayCircle, Plugs, PlugsConnected, ShieldCheck, ShoppingBag, Storefront, Table, TerminalWindow, Timer,
  Warning,
} from '@phosphor-icons/react';
import { useScreen } from '../lib/useScreen.js';
import { useStory } from '../lib/useStory.js';
import { DEMO_VIDEO_URL } from '../lib/config.js';
import { StatusPill } from '../components/StatusPill.jsx';
import { Block, Segmented, Stat, buttonClass } from '../components/ui.jsx';

const REPO_URL = 'https://github.com/hassan2-aamir/doorstep_shopify_automation';

// One entry per slide, in order. The ids double as the anchors the progress rail and keyboard stepping scroll to.
const SLIDES = [
  { id: 'cover', label: 'Doorstep' },
  { id: 'problem', label: 'The problem' },
  { id: 'silence', label: 'When it breaks' },
  { id: 'insight', label: 'The insight' },
  { id: 'how', label: 'How it works' },
  { id: 'today', label: 'The one screen' },
  { id: 'proof', label: 'The proof' },
  { id: 'audience', label: "Who it's for" },
  { id: 'built', label: 'How it was built' },
  { id: 'start', label: 'Get started' },
];
const SLIDE_IDS = SLIDES.map((s) => s.id);

const StoryContext = createContext(new Set());

const h2Class = 'text-3xl font-extrabold tracking-display text-balance md:text-5xl';
const leadClass = 'mt-4 max-w-xl text-lg text-foreground-muted text-pretty';
const at = (i) => ({ '--i': i });

function Slide({ id, tone = 'base', children }) {
  const seen = useContext(StoryContext);
  const index = SLIDE_IDS.indexOf(id);
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      data-seen={seen.has(index) ? 'true' : 'false'}
      className={`slide flex min-h-[calc(100svh-4.125rem)] items-center py-12 md:py-16 ${index > 0 ? 'border-t-thick border-border' : ''} ${
        tone === 'sunken' ? 'bg-surface-sunken' : 'bg-background'
      }`}
    >
      <div className="mx-auto w-full max-w-content px-gutter md:px-8">{children}</div>
    </section>
  );
}

function Chapter({ children }) {
  return <p className="reveal text-xs font-bold uppercase tracking-label text-stat-label" style={at(0)}>{children}</p>;
}

function IconTile({ icon: Icon }) {
  return (
    <span aria-hidden className="grid h-icon-block w-icon-block flex-none place-items-center rounded-md bg-primary-subtle text-primary-text">
      <Icon size={22} weight="bold" />
    </span>
  );
}

function Kbd({ children }) {
  return (
    <kbd className="rounded-sm border-hairline border-border-strong bg-surface px-2 py-0.5 font-mono text-xs font-bold text-foreground">
      {children}
    </kbd>
  );
}

// Thin progress bar for every width, plus a dot rail from 1280px up. Both follow the slide on screen.
function StoryNav({ active, go }) {
  return (
    <>
      <div aria-hidden className="fixed inset-x-0 top-[4.125rem] z-30 h-1 bg-border">
        <div
          className="h-full origin-left bg-primary motion-safe:transition-transform motion-safe:duration-slow motion-safe:ease-out-2"
          style={{ transform: `scaleX(${(active + 1) / SLIDES.length})` }}
        />
      </div>
      <nav aria-label="Story chapters" className="fixed right-2 top-1/2 z-30 hidden -translate-y-1/2 flex-col xl:flex">
        {SLIDES.map((s, i) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={(e) => {
              e.preventDefault();
              go(i);
            }}
            aria-label={`${i + 1} of ${SLIDES.length}: ${s.label}`}
            aria-current={i === active ? 'step' : undefined}
            className="group relative grid h-touch w-6 place-items-center"
          >
            <span
              className={`block w-2 rounded-pill motion-safe:transition-[height,background-color] motion-safe:duration-fast ${
                i === active ? 'h-6 bg-primary' : 'h-2 bg-border-strong group-hover:bg-primary'
              }`}
            />
            <span className="pointer-events-none absolute right-full mr-2 hidden whitespace-nowrap rounded-md border-hairline border-border bg-surface px-2 py-1 text-xs font-semibold text-foreground group-hover:block group-focus-visible:block">
              {s.label}
            </span>
          </a>
        ))}
      </nav>
    </>
  );
}

const COVER_PATH = [
  { icon: ShoppingBag, source: 'Shopify', text: 'Order #1042 is paid' },
  { icon: Table, source: "Your supplier's sheet", text: 'Row added, tracking typed in' },
  { icon: EnvelopeSimple, source: "Your buyer's inbox", text: 'Your order #1042 has shipped', pill: { variant: 'shipped', label: 'Notified' } },
];

const SETUP_STEPS = [
  { title: 'Store', body: 'Connect your Shopify store.' },
  { title: 'Sheet', body: 'Connect your fulfillment sheet and an email account for buyer updates.' },
  { title: 'Go live', body: 'Confirm, and new paid orders start moving.' },
];

const CHORES = [
  { title: 'Copy the order into the sheet', body: "Name, address, items and size, so the supplier knows what to pack." },
  { title: 'Paste the tracking number back', body: 'When the supplier ships, the number has to travel the other way.' },
  { title: 'Email the buyer', body: 'One message per order, with the tracking link in it.' },
];

const SILENT_FAILURE = [
  { icon: Plugs, title: 'A login expires', body: 'The store or sheet connection quietly stops working. Nothing on screen changes.', pill: { variant: 'skipped', label: 'Silent' } },
  { icon: Package, title: 'Orders pile up', body: "New paid orders wait in Shopify. Nobody copies them and nothing says they're stuck.", pill: { variant: 'skipped', label: 'Silent' } },
  { icon: EnvelopeSimple, title: 'A buyer writes in', body: '"Where is my order?" is the first sign that anything went wrong.', pill: { variant: 'attention', label: 'Found by a customer' } },
];

const FLOW = [
  { icon: ShoppingBag, title: 'A buyer pays', body: 'Shopify tells Doorstep the moment the order is paid.' },
  { icon: Table, title: 'One row in the sheet', body: 'Name, address, items and size. A replay or an edit never adds a second row.', pill: { variant: 'waiting', label: 'Waiting on supplier' } },
  { icon: PencilSimpleLine, title: 'Supplier adds tracking', body: 'They type the number and carrier in that row. Doorstep checks every 5 minutes.' },
  { icon: EnvelopeSimple, title: 'Buyer gets one email', body: 'Order number, carrier and a tracking link.' },
  { icon: CheckCircle, title: 'Row marked Notified', body: 'So the same email never goes out twice.', pill: { variant: 'shipped', label: 'Shipped' } },
];

const PEOPLE = [
  { icon: Storefront, role: 'The merchant', name: 'Sara', body: 'Runs one Shopify store and sends orders to a supplier through a Google Sheet. Orders now move without her, and she hears about a problem when it happens.' },
  { icon: Table, role: 'The supplier', name: 'Her supplier', body: 'Reads new rows and types the tracking number and carrier into the same sheet. There is no new tool to learn.' },
  { icon: EnvelopeSimple, role: 'The buyer', name: 'Her buyer', body: 'Gets one clear email with the order number, the carrier and a tracking link. Never a second one.' },
];

const BUILT = [
  { icon: PlugsConnected, title: 'Connectors and widget', body: "Shopify, Google Sheets and email. Sara connects each once in Fastn's embedded widget, and her logins go to Fastn, never to Doorstep." },
  { icon: Lightning, title: 'Runs on payment', body: 'One workflow starts the moment Shopify reports a paid order and writes one row, keyed on the order.' },
  { icon: Timer, title: 'Checks every 5 minutes', body: 'A second workflow looks for new tracking numbers, emails the buyer once and marks the row Notified.' },
  { icon: TerminalWindow, title: 'Built by prompting', body: "Every step was built and tested through Fastn's MCP. The prompts, approvals and verification report are in the repo." },
];

// A static copy of the Today screen with example orders, in both states, so the pitch shows the product rather than a picture of it.
const TODAY_STATES = {
  ok: {
    text: 'All orders are moving',
    sub: "Paid orders go to your supplier's sheet, and tracking goes back to your buyers.",
    icon: CheckCircle,
    box: 'bg-success-solid text-white',
    stats: [3, 1, 2],
    first: { pill: { variant: 'waiting', label: 'Waiting on supplier' }, text: 'Row added to your sheet' },
  },
  broken: {
    text: '1 order needs attention',
    sub: "Google Sheets needs reconnecting. Nothing is lost, and orders retry once you fix it.",
    icon: Warning,
    box: 'bg-banner-danger-icon-bg text-banner-danger-icon-fg',
    stats: [3, 0, 2],
    first: { pill: { variant: 'attention', label: 'Needs attention' }, text: 'Google Sheets needs reconnecting' },
  },
};

function TodayMock({ state }) {
  const s = TODAY_STATES[state];
  const Icon = s.icon;
  const failed = state === 'broken';
  return (
    <figure className="space-y-4">
      <div className="rounded-md border-thick border-block-feature-border bg-block-feature-bg p-6 text-block-feature-fg md:p-8">
        <p className="text-xs font-bold uppercase tracking-label opacity-90">Today</p>
        <div className="mt-3 flex items-start gap-4 md:items-center">
          <span aria-hidden className={`grid h-icon-block w-icon-block flex-none place-items-center rounded-md md:h-14 md:w-14 ${s.box}`}>
            <Icon size={26} weight="bold" />
          </span>
          <div className="min-w-0">
            <p role="status" className="text-2xl font-extrabold leading-tight tracking-display md:text-verdict">{s.text}</p>
            <p className="mt-2 text-sm opacity-90 md:min-h-[2.6rem]">{s.sub}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Received today" value={s.stats[0]} />
        <Stat label="Waiting for supplier" value={s.stats[1]} />
        <Stat label="Shipped today" value={s.stats[2]} />
      </div>

      <ul className="divide-y-2 divide-[var(--event-row-border)] overflow-hidden rounded-md border-thick border-block-border bg-surface">
        <li className={`flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4 ${failed ? 'border-l-[3px] border-row-failed-accent bg-row-failed-bg' : ''}`}>
          <span className="font-mono text-sm font-bold">#1003</span>
          <StatusPill variant={s.first.pill.variant}>{s.first.pill.label}</StatusPill>
          <span className={`text-sm ${failed ? 'font-semibold' : ''}`}>{s.first.text}</span>
        </li>
        {['#1002', '#1001'].map((n) => (
          <li key={n} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
            <span className="font-mono text-sm font-bold">{n}</span>
            <StatusPill variant="shipped">Shipped</StatusPill>
            <span className="text-sm">Tracking sent to your buyer</span>
          </li>
        ))}
      </ul>
      <figcaption className="text-sm text-foreground-muted">An illustration with example orders.</figcaption>
    </figure>
  );
}

export function Welcome() {
  const headingRef = useScreen('Orders to the doorstep, on autopilot');
  const { hash } = useLocation();
  const { active, seen, go } = useStory(SLIDE_IDS);
  const [day, setDay] = useState('ok');

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <StoryContext.Provider value={seen}>
      <StoryNav active={active} go={go} />

      <Slide id="cover">
        <div className="grid items-center gap-12 lg:grid-cols-[7fr_5fr] lg:gap-16">
          <div>
            <p className="reveal text-xs font-bold uppercase tracking-label text-stat-label" style={at(0)}>Build with Fastn · Track 02</p>
            <h1
              id="cover-heading"
              ref={headingRef}
              tabIndex={-1}
              style={at(1)}
              className="reveal mt-5 max-w-4xl text-4xl font-extrabold tracking-display outline-none text-balance md:text-6xl"
            >
              Paid orders reach the doorstep. You don't copy a thing.
            </h1>
            <p className="reveal mt-6 max-w-2xl text-lg text-foreground-muted text-pretty md:text-xl" style={at(2)}>
              Doorstep puts every paid Shopify order in your supplier's sheet, sends the tracking to your buyer, and tells you the
              moment something needs you.
            </p>
            <div className="reveal mt-8 flex flex-wrap items-center gap-3" style={at(3)}>
              <Link to="/setup" className={buttonClass('primary')}>
                Set up your store <ArrowRight aria-hidden size={18} weight="bold" />
              </Link>
              <Link to="/today" className={buttonClass('secondary')}>See the live dashboard</Link>
              {DEMO_VIDEO_URL && (
                <a href={DEMO_VIDEO_URL} target="_blank" rel="noreferrer" className={buttonClass('ghost')}>
                  <PlayCircle aria-hidden size={20} weight="bold" /> Watch the 2-minute demo
                </a>
              )}
              <button type="button" onClick={() => go(1)} className={buttonClass('ghost')}>
                Start the story <CaretDown aria-hidden size={18} weight="bold" />
              </button>
            </div>

            <ul aria-label="The path of an order" className="reveal mt-10 flex flex-wrap items-center gap-2 text-sm font-semibold lg:hidden" style={at(4)}>
              <li className="inline-flex min-h-10 items-center gap-2 rounded-md border-thick border-block-border bg-block px-3"><ShoppingBag aria-hidden size={18} weight="bold" />Shopify</li>
              <li aria-hidden className="text-foreground-muted"><CaretRight size={16} weight="bold" /></li>
              <li className="inline-flex min-h-10 items-center gap-2 rounded-md border-thick border-block-border bg-block px-3"><Table aria-hidden size={18} weight="bold" />Your sheet</li>
              <li aria-hidden className="text-foreground-muted"><CaretRight size={16} weight="bold" /></li>
              <li className="inline-flex min-h-10 items-center gap-2 rounded-md border-thick border-block-border bg-block px-3"><EnvelopeSimple aria-hidden size={18} weight="bold" />Your buyer's inbox</li>
            </ul>

            <p className="reveal mt-6 flex items-center gap-2 text-sm text-foreground-muted" style={at(5)}>
              <ShieldCheck aria-hidden size={18} weight="bold" className="flex-none" />
              Three connections, made once. Your logins stay with Fastn.
            </p>
            <p className="reveal mt-8 hidden items-center gap-2 text-sm text-foreground-muted lg:flex" style={at(6)}>
              <Kbd>Space</Kbd> or <Kbd>↓</Kbd> steps through the story
            </p>
          </div>

          <figure className="reveal hidden lg:block" style={at(3)}>
            <ol aria-label="One order, start to finish" className="space-y-2">
              {COVER_PATH.map(({ icon, source, text, pill }, i) => (
                <li key={source}>
                  <div className="flex items-center gap-4 rounded-md border-thick border-block-border bg-block p-5">
                    <IconTile icon={icon} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-label text-stat-label">{source}</p>
                      <p className="mt-1 font-bold">{text}</p>
                    </div>
                    {pill && <StatusPill variant={pill.variant}>{pill.label}</StatusPill>}
                  </div>
                  {i < COVER_PATH.length - 1 && (
                    <p aria-hidden className="grid h-6 place-items-center text-foreground-muted"><CaretDown size={18} weight="bold" /></p>
                  )}
                </li>
              ))}
            </ol>
            <figcaption className="mt-3 text-sm text-foreground-muted">An example order.</figcaption>
          </figure>
        </div>
      </Slide>

      <Slide id="problem" tone="sunken">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <Chapter>01 · The problem</Chapter>
            <h2 id="problem-heading" className={`reveal mt-4 ${h2Class}`} style={at(1)}>Meet Sara. She copies every order by hand.</h2>
            <p className={`reveal ${leadClass}`} style={at(2)}>
              She runs one Shopify store and ships through a supplier who works from a Google Sheet. For every paid order she has three chores.
            </p>
            <p className="reveal mt-8 text-2xl font-extrabold tracking-heading md:text-3xl" style={at(6)}>Miss one, and a customer waits.</p>
          </div>
          <ol className="overflow-hidden rounded-md border-thick border-block-border bg-block">
            {CHORES.map(({ title, body }, i) => (
              <li key={title} className="reveal flex flex-col gap-3 border-b-hairline border-row-border p-5 last:border-b-0 sm:flex-row sm:items-center sm:gap-4" style={at(i + 3)}>
                <span aria-hidden className="grid h-icon-block w-icon-block flex-none place-items-center rounded-md bg-primary-subtle font-mono text-lg font-bold text-primary-text">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold tracking-heading">{title}</h3>
                  <p className="mt-1 text-sm text-foreground-muted">{body}</p>
                </div>
                <StatusPill variant="attention" icon={PencilSimpleLine}>By hand</StatusPill>
              </li>
            ))}
          </ol>
        </div>
      </Slide>

      <Slide id="silence" tone="sunken">
        <Chapter>01 · The problem, continued</Chapter>
        <h2 id="silence-heading" className={`reveal mt-4 max-w-3xl ${h2Class}`} style={at(1)}>Worse, when it breaks, nobody tells her.</h2>
        <p className={`reveal ${leadClass}`} style={at(2)}>A typical silent failure looks like this.</p>
        <ol className="mt-10 grid gap-6 md:grid-cols-3 md:gap-8">
          {SILENT_FAILURE.map(({ icon, title, body, pill }, i) => (
            <li key={title} className="reveal relative" style={at(i + 3)}>
              <Block as="div" className="h-full">
                <IconTile icon={icon} />
                <h3 className="mt-4 text-lg font-bold tracking-heading">{title}</h3>
                <p className="mt-2 text-foreground-muted">{body}</p>
                <p className="mt-4"><StatusPill variant={pill.variant}>{pill.label}</StatusPill></p>
              </Block>
              {i < SILENT_FAILURE.length - 1 && (
                <>
                  <span aria-hidden className="absolute -right-8 top-10 hidden h-8 w-8 place-items-center text-foreground-muted md:grid"><CaretRight size={20} weight="bold" /></span>
                  <span aria-hidden className="absolute -bottom-6 left-1/2 grid h-6 w-6 -translate-x-1/2 place-items-center text-foreground-muted md:hidden"><CaretDown size={20} weight="bold" /></span>
                </>
              )}
            </li>
          ))}
        </ol>
      </Slide>

      <Slide id="insight">
        <Chapter>02 · The insight</Chapter>
        <h2 id="insight-heading" className={`reveal mt-4 max-w-4xl ${h2Class} md:text-6xl`} style={at(1)}>Silence should mean it worked.</h2>
        <p className={`reveal ${leadClass} max-w-2xl`} style={at(2)}>
          Sara does not need another workspace to watch. She needs the orders to move, and one clear sentence on the day they can't.
        </p>
        <ul className="mt-10 grid gap-6 md:grid-cols-3 md:gap-8">
          <li className="reveal" style={at(3)}>
            <Block as="div" className="h-full">
              <IconTile icon={Table} />
              <h3 className="mt-4 text-lg font-bold tracking-heading">Data stays where people work</h3>
              <p className="mt-2 text-foreground-muted">Orders live in Shopify, the sheet and the inbox. Sara never types anything into Doorstep.</p>
            </Block>
          </li>
          <li className="reveal" style={at(4)}>
            <Block as="div" className="h-full">
              <IconTile icon={BellRinging} />
              <h3 className="mt-4 text-lg font-bold tracking-heading">Only exceptions reach her</h3>
              <p className="mt-2 text-foreground-muted">A failure names the order, the step and the reason in plain words, with a link to the fix.</p>
            </Block>
          </li>
          <li className="reveal" style={at(5)}>
            <Block as="div" className="h-full">
              <IconTile icon={Palette} />
              <h3 className="mt-4 text-lg font-bold tracking-heading">Colour says who has to act</h3>
              <ul className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
                <li className="contents"><StatusPill variant="attention">Needs attention</StatusPill><span className="text-sm">Sara acts</span></li>
                <li className="contents"><StatusPill variant="waiting">Waiting on supplier</StatusPill><span className="text-sm">Someone else</span></li>
                <li className="contents"><StatusPill variant="shipped">Shipped</StatusPill><span className="text-sm">No one</span></li>
              </ul>
            </Block>
          </li>
        </ul>
      </Slide>

      <Slide id="how">
        <div className="grid gap-10 lg:grid-cols-[4fr_7fr] lg:items-center lg:gap-14">
          <div>
            <Chapter>03 · The solution</Chapter>
            <h2 id="how-heading" className={`reveal mt-4 ${h2Class}`} style={at(1)}>Doorstep runs the loop for her.</h2>
            <p className={`reveal ${leadClass}`} style={at(2)}>
              Connect once. From then on every paid order follows the same path, and Sara is only pulled in when something breaks.
            </p>
            <p className="reveal mt-6 flex items-start gap-2 text-sm text-foreground-muted" style={at(3)}>
              <ShieldCheck aria-hidden size={18} weight="bold" className="mt-0.5 flex-none" />
              Three connections, made once: Shopify, your sheet and email. Your logins stay with Fastn.
            </p>
          </div>
          <ol className="space-y-4">
            {FLOW.map(({ icon, title, body, pill }, i) => (
              <li key={title} className="reveal relative flex items-start gap-4" style={at(i + 3)}>
                <IconTile icon={icon} />
                {i < FLOW.length - 1 && <span aria-hidden className="absolute -bottom-4 left-[1.2rem] top-11 w-0.5 bg-border-strong" />}
                <div className="min-w-0 flex-1 rounded-md border-thick border-block-border bg-block p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-label text-stat-label">Step {i + 1}</p>
                    <h3 className="mt-1 font-bold leading-snug tracking-heading">{title}</h3>
                    <p className="mt-1 text-sm text-foreground-muted">{body}</p>
                  </div>
                  {pill && <p className="mt-3 flex-none sm:mt-0"><StatusPill variant={pill.variant}>{pill.label}</StatusPill></p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Slide>

      <Slide id="today">
        <div className="grid items-center gap-10 lg:grid-cols-[5fr_7fr] lg:gap-14">
          <div>
            <Chapter>03 · The solution, continued</Chapter>
            <h2 id="today-heading" className={`reveal mt-4 ${h2Class}`} style={at(1)}>One screen, one answer.</h2>
            <p className={`reveal ${leadClass}`} style={at(2)}>
              Today opens with a single sentence: is everything moving, or does something need Sara? Switch the day to see both.
            </p>
            <div className="reveal mt-6" style={at(3)}>
              <Segmented
                label="Show a day"
                options={[{ value: 'ok', label: 'All moving' }, { value: 'broken', label: 'Something broke' }]}
                value={day}
                onChange={setDay}
              />
            </div>
            <ul className="reveal mt-6 space-y-2 text-foreground-muted" style={at(4)}>
              <li>The answer comes first, before any table.</li>
              <li>A failure names the order and the reason in plain words.</li>
              <li>The status pill in the header links straight to the fix.</li>
            </ul>
          </div>
          <div className="reveal" style={at(3)}>
            <TodayMock state={day} />
          </div>
        </div>
      </Slide>

      <Slide id="proof" tone="sunken">
        <Chapter>04 · The proof</Chapter>
        <h2 id="proof-heading" className={`reveal mt-4 max-w-3xl ${h2Class}`} style={at(1)}>It moves fast, and it never doubles up.</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3 md:gap-8">
          <div className="reveal" style={at(2)}><Stat label="Payment to sheet row" value="≈7 s" note="6.2, 7.5 and 7.6 seconds on three real orders." /></div>
          <div className="reveal" style={at(3)}><Stat label="Rows per order" value="1" note="Replaying the same order event left one row." /></div>
          <div className="reveal" style={at(4)}><Stat label="Emails per shipment" value="1" note="Re-running the tracking check sent no second email." /></div>
        </div>
        <p className="reveal mt-8 max-w-3xl text-sm text-foreground-muted" style={at(5)}>
          Measured on our Shopify dev store with both workflows on Fastn's instant tier. The test results are in{' '}
          <a href={`${REPO_URL}/tree/main/evidence`} target="_blank" rel="noreferrer" className="font-semibold text-primary-text underline underline-offset-4">
            the repo's evidence folder<span className="sr-only"> (opens in a new tab)</span>
          </a>.
        </p>
      </Slide>

      <Slide id="audience">
        <Chapter>05 · Who it's for</Chapter>
        <h2 id="audience-heading" className={`reveal mt-4 max-w-4xl ${h2Class}`} style={at(1)}>Built for small stores that ship through someone else.</h2>
        <ul className="mt-10 grid gap-6 md:grid-cols-3 md:gap-8">
          {PEOPLE.map(({ icon, role, name, body }, i) => (
            <li key={role} className="reveal" style={at(i + 2)}>
              <Block as="div" className="h-full">
                <IconTile icon={icon} />
                <p className="mt-4 text-xs font-bold uppercase tracking-label text-stat-label">{role}</p>
                <h3 className="mt-1 text-xl font-bold tracking-heading">{name}</h3>
                <p className="mt-2 text-foreground-muted">{body}</p>
              </Block>
            </li>
          ))}
        </ul>
        <div className="reveal mt-8 flex flex-col gap-2 border-t-hairline border-border pt-6 text-sm text-foreground-muted md:flex-row md:gap-10" style={at(5)}>
          <p>Not for Shopify Plus stores with ERP or warehouse APIs.</p>
          <p>Sara is a persona built from Shopify job posts that describe this loop.</p>
        </div>
      </Slide>

      <Slide id="built" tone="sunken">
        <Chapter>06 · How it was built</Chapter>
        <h2 id="built-heading" className={`reveal mt-4 max-w-3xl ${h2Class}`} style={at(1)}>Built on Fastn, through its MCP.</h2>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {BUILT.map(({ icon, title, body }, i) => (
            <li key={title} className="reveal" style={at(i + 2)}>
              <Block as="div" className="h-full">
                <IconTile icon={icon} />
                <h3 className="mt-4 text-lg font-bold tracking-heading">{title}</h3>
                <p className="mt-2 text-sm text-foreground-muted">{body}</p>
              </Block>
            </li>
          ))}
        </ul>
      </Slide>

      <Slide id="start">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <Chapter>Get started</Chapter>
            <h2 id="start-heading" className={`reveal mt-4 max-w-3xl ${h2Class} md:text-6xl`} style={at(1)}>Connect your store, then stop copying.</h2>
            <p className={`reveal ${leadClass} max-w-2xl`} style={at(2)}>
              Every paid order reaches your supplier and every tracking number reaches your buyer, without you touching either.
            </p>
            <div className="reveal mt-8 flex flex-wrap items-center gap-3" style={at(6)}>
              <Link to="/setup" className={buttonClass('primary')}>
                Set up your store <ArrowRight aria-hidden size={18} weight="bold" />
              </Link>
              <Link to="/today" className={buttonClass('secondary')}>Open the dashboard</Link>
              {DEMO_VIDEO_URL && (
                <a href={DEMO_VIDEO_URL} target="_blank" rel="noreferrer" className={buttonClass('ghost')}>
                  <PlayCircle aria-hidden size={20} weight="bold" /> Watch the 2-minute demo
                </a>
              )}
              <a href={REPO_URL} target="_blank" rel="noreferrer" className={buttonClass('ghost')}>
                <GithubLogo aria-hidden size={20} weight="bold" /> Source on GitHub<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
          </div>

          <div>
            <p className="reveal text-xs font-bold uppercase tracking-label text-stat-label" style={at(3)}>Setup takes three steps</p>
            <ol className="mt-3 overflow-hidden rounded-md border-thick border-block-border bg-block">
              {SETUP_STEPS.map(({ title, body }, i) => (
                <li key={title} className="reveal flex items-center gap-4 border-b-hairline border-row-border p-5 last:border-b-0" style={at(i + 4)}>
                  <span aria-hidden className="grid h-icon-block w-icon-block flex-none place-items-center rounded-md bg-primary-subtle font-mono text-lg font-bold text-primary-text">{i + 1}</span>
                  <div className="min-w-0">
                    <h3 className="font-bold tracking-heading">{title}</h3>
                    <p className="mt-1 text-sm text-foreground-muted">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="reveal mt-3 text-sm text-foreground-muted" style={at(7)}>You can leave and come back to any step.</p>
          </div>
        </div>
      </Slide>
    </StoryContext.Provider>
  );
}
