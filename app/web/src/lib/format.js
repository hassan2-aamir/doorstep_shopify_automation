const sameDay = (a, b, timeZone) => {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return f.format(a) === f.format(b);
};

// "14:05" for today, "18 Sep, 14:05" otherwise, in the merchant's timezone.
export function formatWhen(iso, timeZone) {
  if (!iso) return '';
  const d = new Date(iso);
  const tz = timeZone || undefined;
  const time = new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(d);
  if (sameDay(d, new Date(), tz)) return time;
  const date = new Intl.DateTimeFormat(undefined, { timeZone: tz, day: 'numeric', month: 'short' }).format(d);
  return `${date}, ${time}`;
}

export const orderLabel = (e) => (e.orderNumber ? `#${e.orderNumber}` : `Order ${e.orderId}`);

export const SYSTEM_LABELS = { store: 'Shopify', sheet: 'Google Sheet', email: 'Email' };

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
