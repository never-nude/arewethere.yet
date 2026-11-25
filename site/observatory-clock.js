// The model publishes a year. The clock uses its midpoint as a display convention.
export function referenceInstant(year) {
  return Date.UTC(year, 6, 1);
}

function moveMonths(start, count) {
  const day = start.getUTCDate();
  const anchor = new Date(start);
  anchor.setUTCDate(1);
  anchor.setUTCMonth(start.getUTCMonth() + count + 1, 0);
  anchor.setUTCDate(Math.min(day, anchor.getUTCDate()));
  return anchor;
}

export function countdownParts(from, to) {
  const start = new Date(Math.floor(from / 1000) * 1000);
  const end = new Date(to);
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || end <= start) return null;
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  if (moveMonths(start, months) > end) months--;
  const seconds = Math.floor((end - moveMonths(start, months)) / 1000);
  return [Math.floor(months / 12), months % 12, Math.floor(seconds / 86400),
    Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
}

export const countdownUnits = ['year', 'month', 'day', 'hour', 'minute', 'second'];
let currentLocale, formats;

export function formatCountdownPart(lang, index, value) {
  if (lang !== currentLocale || !formats) {
    // A translation provider can use a language tag outside this browser's ICU data.
    let locale;
    try { locale = Intl.NumberFormat.supportedLocalesOf(lang || 'en')[0]; } catch {}
    formats = countdownUnits.map((unit, i) => new Intl.NumberFormat(locale || 'en', {
      style: 'unit', unit, unitDisplay: 'long', minimumIntegerDigits: i === 0 ? 1 : 2,
      useGrouping: false,
    }));
    currentLocale = lang;
  }
  const parts = formats[index].formatToParts(value);
  // Some plural forms (such as Arabic duals) express the quantity in the unit itself.
  const digits = parts.find(part => part.type === 'integer')?.value ??
    new Intl.NumberFormat(formats[index].resolvedOptions().locale, {minimumIntegerDigits: index === 0 ? 1 : 2}).format(value);
  return { digits, label: parts.filter(part => part.type === 'unit').map(part => part.value).join(' ') };
}
