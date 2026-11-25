const points = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const day = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const inputNames = {
  reliability: 'how long AI can work reliably on tested tasks',
  horizon: 'the length of difficult tasks AI can sometimes complete',
  breadth: 'performance across a range of benchmark tests',
  'research-autonomy': 'AI’s ability to carry out research tasks without help',
  'research-acceleration': 'the measured pace of capability gains at one lab',
  compute: 'the amount of computation used to train a leading model',
  forecast: 'a play-money market’s forecast for general AI before 2030',
  releases: 'the number of model launches in the past 45 days',
};

export function scoreMovement(index) {
  const prior = index.history.at(-2);
  if (!Number.isFinite(prior?.score) || !Number.isFinite(index.delta)) return 'Daily change unavailable';
  const magnitude = Math.abs(index.delta);
  const change = magnitude ? (index.delta > 0 ? 'Up ' : 'Down ') + points.format(magnitude) +
    (magnitude === 1 ? ' point' : ' points') : 'Unchanged';
  const since = day.format(Date.parse(prior.date));
  const previous = new Map(prior.factors.map(factor => [factor.id, factor.contribution]));
  const coverageChanged = index.factors.some(factor =>
    Number.isFinite(factor.contribution) !== Number.isFinite(previous.get(factor.id)));
  return change + ' since ' + since + (coverageChanged ? '. The set of available readings changed.' : '');
}

export function dailyReading(index) {
  const previous = index.history.at(-2);
  if (!Number.isFinite(index.delta) || !Number.isFinite(previous?.score)) return '';
  const since = 'Since ' + day.format(Date.parse(previous.date)) + ', the score ';
  const movement = Math.abs(index.delta);
  let headline = 'held steady.';
  if (movement > 0) {
    const direction = index.delta > 0 ? 'rose ' : 'fell ';
    headline = direction + points.format(movement) + (movement === 1 ? ' point.' : ' points.');
  }
  const prior = new Map(previous.factors.map(factor => [factor.id, factor]));
  const changes = index.factors.filter(factor => factor.contribution !== prior.get(factor.id)?.contribution);
  if (!changes.length) return since + headline;

  const coverageChanges = changes.filter(factor =>
    Number.isFinite(factor.contribution) !== Number.isFinite(prior.get(factor.id)?.contribution));
  if (coverageChanges.length === 1) {
    const factor = coverageChanges[0];
    const change = Number.isFinite(factor.contribution) ? 'The index gained a reading for ' : 'The index lost its reading for ';
    return since + headline + ' ' + change + inputNames[factor.id] + '.';
  }
  if (coverageChanges.length > 1) return since + headline + ' The two readings include different sets of available evidence.';
  if (changes.length === 1) {
    return since + headline + ' The change came from ' + inputNames[changes[0].id] + '.';
  }
  const ranked = changes.map(factor => ({ id: factor.id, size: Math.abs(factor.contribution - prior.get(factor.id).contribution) }))
    .sort((a, b) => b.size - a.size);
  if (Math.abs(ranked[0].size - ranked[1].size) < .005) {
    return since + headline + ' Several inputs moved, including ' + inputNames[ranked[0].id] + ' and ' + inputNames[ranked[1].id] + '.';
  }
  return since + headline + ' Of the inputs that changed, ' + inputNames[ranked[0].id] + ' had the largest effect.';
}
