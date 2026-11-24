import { projectThreshold } from './index-model.js';

const dayMs = 86_400_000;
export const countdownMonthlyPoints = 1;

function scoreAnchor(index) {
  const history = index.history ?? [];
  for (let position = history.length - 1; position > 0; position -= 1) {
    if (history[position - 1].score !== index.score) return history[position].date;
  }

  // A flat history can predate the replay window. Use a dated source reading in that case.
  let latest;
  for (const factor of index.factors ?? []) {
    const date = factor.publishedAt ?? (factor.id === 'releases' ? null : factor.date);
    if (date && date <= index.date && (!latest || date > latest)) latest = date;
  }
  return latest ?? history[0]?.date ?? index.date;
}

export function getCountdown(index, { now = Date.now() } = {}) {
  const asOf = new Date(now).toISOString().slice(0, 10);
  const anchorDate = index?.score == null ? null : scoreAnchor(index);
  const projection = projectThreshold(index && { ...index, date: anchorDate }, { monthlyPoints: countdownMonthlyPoints });
  const reading = { ...projection, anchorDate, asOf, daysRemaining: null };

  if (index?.threshold?.observed) {
    return { ...reading, status: 'observed', date: index.threshold.crossingDate };
  }
  if (projection.status !== 'conditional') return reading;

  const daysRemaining = (Date.parse(projection.date) - Date.parse(asOf)) / dayMs;
  return { ...reading, status: daysRemaining > 0 ? 'conditional' : 'elapsed', daysRemaining: Math.max(0, daysRemaining) };
}
