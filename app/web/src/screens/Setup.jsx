import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle, Circle, Storefront, Table } from '@phosphor-icons/react';
import { api } from '../lib/api.js';
import { useScreen } from '../lib/useScreen.js';
import { useEmbed } from '../lib/useEmbed.js';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Banner, Block, Button, buttonClass } from '../components/ui.jsx';
import { EmbedPanel } from '../components/EmbedPanel.jsx';

const STEPS = [
  { key: 'store', label: 'Store', title: 'Connect your Shopify store' },
  { key: 'sheet', label: 'Sheet', title: 'Connect your fulfillment sheet' },
  { key: 'confirm', label: 'Confirm', title: 'Check and go live' },
];

const SHOP_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const SHEET_RE = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]+/;

// "https://Shop-Name.myshopify.com/admin" and "shop-name" both become shop-name.myshopify.com.
export function normalizeShop(input) {
  const host = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/?#].*$/, '');
  return host && !host.includes('.') ? `${host}.myshopify.com` : host;
}

const SHEET_COLUMNS = [
  'order_id', 'order_number', 'created_at', 'buyer_name', 'buyer_email', 'buyer_phone',
  'ship_address', 'items', 'status', 'tracking_number', 'carrier', 'notified_at',
];

function Stepper({ current, done, onGo }) {
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Setup progress">
      {STEPS.map((s, i) => {
        const isCurrent = s.key === current;
        const isDone = done.has(s.key);
        const Icon = isDone ? CheckCircle : Circle;
        const canGo = isDone || isCurrent;
        const body = (
          <>
            <Icon aria-hidden size={20} weight={isDone ? 'fill' : 'bold'} className="flex-none" />
            <span className="min-w-0">
              <span className="block text-xs font-bold uppercase tracking-label">Step {i + 1} of 3</span>
              <span className="block truncate text-sm font-semibold">
                {s.label}<span className="sr-only">{isDone ? ', done' : isCurrent ? ', current step' : ', not started'}</span>
              </span>
            </span>
          </>
        );
        const cls = `flex min-h-touch items-center gap-2 rounded-md border-thick px-3 py-2 ${
          isCurrent
            ? 'border-[var(--nav-item-active-bg)] bg-[var(--nav-item-active-bg)] text-[var(--nav-item-active-fg)]'
            : 'border-block-border bg-block text-foreground'
        }`;
        return (
          <li key={s.key}>
            {canGo && !isCurrent ? (
              <button type="button" onClick={() => onGo(s.key)} className={`${cls} w-full text-left hover:bg-[var(--nav-item-hover-bg)]`}>{body}</button>
            ) : (
              <div aria-current={isCurrent ? 'step' : undefined} className={cls}>{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Field({ id, label, hint, error, children }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block font-bold">{label}</label>
      {children}
      <p id={`${id}-hint`} className="text-sm text-foreground-muted">{hint}</p>
      {error && <p id={`${id}-error`} role="alert" className="text-sm font-semibold text-verdict-issue">{error}</p>}
    </div>
  );
}

const inputCls =
  'h-control w-full rounded-md border-thick border-block-border bg-surface px-4 text-foreground placeholder:text-foreground-muted ' +
  'aria-[invalid=true]:border-[var(--banner-danger-border)]';

export function Setup() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: ws, refresh } = useWorkspace();
  const embed = useEmbed();

  const live = ws?.status === 'live';
  const [shop, setShop] = useState('');
  const [sheet, setSheet] = useState('');
  const [touched, setTouched] = useState({ shop: false, sheet: false });
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);

  // Fill from what we already know, once, unless the merchant has started typing.
  useEffect(() => {
    if (!ws) return;
    setShop((v) => (touched.shop ? v : ws.shopDomain ?? ''));
    setSheet((v) => (touched.sheet ? v : ws.sheetUrl ?? ''));
  }, [ws, touched.shop, touched.sheet]);

  const shopHost = normalizeShop(shop);
  const shopOk = SHOP_RE.test(shopHost);
  const sheetUrl = sheet.trim();
  const sheetOk = SHEET_RE.test(sheetUrl);

  const requested = params.get('step');
  const step = STEPS.some((s) => s.key === requested) ? requested : 'store';
  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const stepInfo = STEPS[stepIndex];
  const headingRef = useScreen(`Set up · ${stepInfo.label}`);

  const done = new Set();
  if (shopOk && stepIndex > 0) done.add('store');
  if (sheetOk && stepIndex > 1) done.add('sheet');

  const go = (key) => {
    setAttempted(false);
    setParams((p) => { const n = new URLSearchParams(p); n.set('step', key); return n; });
  };

  // A live workspace walks the same steps without writing: nobody should be able to change a running
  // store's connection details by clicking through the tour.
  const save = async (body) => {
    if (live) return true;
    setBusy(true);
    try {
      await api('/api/workspace', { method: 'POST', body });
      refresh();
      return true;
    } catch (err) {
      toast(`Couldn't save: ${err.message}`);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const next = async () => {
    setAttempted(true);
    if (step === 'store' && shopOk && await save({ shopDomain: shopHost })) go('sheet');
    if (step === 'sheet' && sheetOk && await save({ sheetUrl })) go('confirm');
  };

  const goLive = async () => {
    if (live) { navigate('/today'); return; }
    setBusy(true);
    try {
      await api('/api/workspace', { method: 'POST', body: { action: 'confirm_setup' } });
      refresh();
      toast("You're live. New paid orders will appear in your sheet.");
      navigate('/today');
    } catch (err) {
      toast(`Couldn't go live: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const shopError = attempted && !shopOk ? 'Enter your store address, like your-store.myshopify.com.' : '';
  const sheetError = attempted && !sheetOk ? 'Paste the full link to your sheet. It starts with https://docs.google.com/spreadsheets/d/' : '';

  return (
    <div className="mx-auto max-w-3xl space-y-block-tight px-gutter py-8 md:space-y-8 md:px-8 md:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold tracking-heading outline-none md:text-3xl">
          {stepInfo.title}
        </h1>
        <Link to="/today" className={buttonClass('ghost')}>Skip for now</Link>
      </div>

      <Stepper current={step} done={done} onGo={go} />

      {live && (
        <Banner variant="info" title="Your workspace is already live">
          This is a walkthrough. Nothing you enter here changes your running setup, and the accounts panel still works if you need to reconnect.
        </Banner>
      )}

      {step === 'store' && (
        <Block className="space-y-6">
          <Field
            id="shop"
            label="Store address"
            hint="Find it in Shopify under Settings, Domains. It ends in .myshopify.com."
            error={shopError}
          >
            <input
              id="shop"
              className={inputCls}
              value={shop}
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="your-store.myshopify.com"
              aria-invalid={Boolean(shopError)}
              aria-describedby={`shop-hint${shopError ? ' shop-error' : ''}`}
              onChange={(e) => { setShop(e.target.value); setTouched((t) => ({ ...t, shop: true })); }}
            />
          </Field>
          <section aria-labelledby="store-connect" className="space-y-3">
            <h2 id="store-connect" className="flex items-center gap-2 text-lg font-bold">
              <Storefront aria-hidden size={22} weight="bold" /> Connect Shopify
            </h2>
            <p className="text-sm text-foreground-muted">
              In the panel, find Shopify and connect it. When its card reads Active, continue. Your login goes to Fastn, not to Doorstep.
            </p>
            <EmbedPanel embed={embed} title="Connect Shopify (Fastn)" />
          </section>
        </Block>
      )}

      {step === 'sheet' && (
        <Block className="space-y-6">
          <Field
            id="sheet"
            label="Fulfillment sheet link"
            hint="Your supplier works from this sheet, so share it with them too."
            error={sheetError}
          >
            <input
              id="sheet"
              className={inputCls}
              value={sheet}
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              aria-invalid={Boolean(sheetError)}
              aria-describedby={`sheet-hint${sheetError ? ' sheet-error' : ''}`}
              onChange={(e) => { setSheet(e.target.value); setTouched((t) => ({ ...t, sheet: true })); }}
            />
          </Field>
          <details className="rounded-md border-thick border-block-border p-4">
            <summary className="min-h-touch cursor-pointer font-bold">The 12 column headers the sheet needs</summary>
            <p className="mt-3 text-sm text-foreground-muted">
              Put these in row 1 of a tab named Fulfillment, in this order. Your supplier fills in tracking_number and carrier.
            </p>
            <p className="mt-3 font-mono text-sm leading-relaxed">{SHEET_COLUMNS.join(', ')}</p>
          </details>
          <section aria-labelledby="sheet-connect" className="space-y-3">
            <h2 id="sheet-connect" className="flex items-center gap-2 text-lg font-bold">
              <Table aria-hidden size={22} weight="bold" /> Connect Google Sheets and email
            </h2>
            <p className="text-sm text-foreground-muted">
              Connect Google Sheets, and an email account for buyer updates. When both read Active, continue.
            </p>
            <EmbedPanel embed={embed} title="Connect Google Sheets and email (Fastn)" />
          </section>
        </Block>
      )}

      {step === 'confirm' && (
        <Block className="space-y-6">
          <p className="text-foreground-muted">
            Here is what Doorstep will watch. Going live starts moving paid orders into your sheet.
          </p>
          <dl className="divide-y-2 divide-[var(--event-row-border)] rounded-md border-thick border-block-border">
            {[
              ['Store', ws?.shopDomain ?? (shopOk ? shopHost : 'Not entered yet')],
              ['Sheet', ws?.sheetUrl ?? (sheetOk ? sheetUrl : 'Not entered yet')],
              ['Email', 'Connected through Fastn'],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col gap-1 p-4 sm:flex-row sm:gap-6">
                <dt className="w-24 flex-none text-xs font-bold uppercase tracking-label text-stat-label">{k}</dt>
                <dd className="min-w-0 break-words font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </Block>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {stepIndex > 0 ? (
          <Button variant="secondary" onClick={() => go(STEPS[stepIndex - 1].key)}>
            <ArrowLeft aria-hidden size={18} weight="bold" /> Back
          </Button>
        ) : <span />}
        {step === 'confirm' ? (
          <Button onClick={goLive} disabled={busy || (!live && (!ws?.shopDomain || !ws?.sheetUrl))}>
            {live ? 'Back to Today' : busy ? 'Going live…' : 'Go live'}
          </Button>
        ) : (
          <Button onClick={next} disabled={busy}>
            {step === 'store' ? 'Store connected, continue' : 'Sheet connected, continue'} <ArrowRight aria-hidden size={18} weight="bold" />
          </Button>
        )}
      </div>
    </div>
  );
}
