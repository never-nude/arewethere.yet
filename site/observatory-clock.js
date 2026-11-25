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
