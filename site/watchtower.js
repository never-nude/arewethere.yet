import { modelReleaseUrl, organizationSites } from './model-links.js';

const dayMs = 86_400_000;
const readings = [
  { id: 'reliability', label: 'Autonomous task horizon', family: 'Capability', publisher: 'METR', threshold: 1.5 },
  { id: 'breadth', label: 'Broad model capability', family: 'Capability', publisher: 'Epoch AI', threshold: 5 },
  { id: 'research-acceleration', label: 'AI research pace', family: 'Research', publisher: 'METR', threshold: 1.5 },
];
const integer = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
const shortDate = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const rendered = new WeakMap();

function day(value) {
  const date = typeof value === 'string' ? value.slice(0, 10) : '';
  const time = /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(date) : NaN;
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date ? time : NaN;
}

function observations(metric, source) {
  if (!Array.isArray(source)) return [];
  return source.filter((point) => Number.isFinite(point?.value)).map((point) => ({
    ...point,
    time: day(point.publishedAt ?? point.date),
    url: point.sourceUrl ?? metric.sourceUrl,
  })).filter((point) => Number.isFinite(point.time)).sort((a, b) => a.time - b.time);
}

function strongest(points) {
  return points.reduce((best, point) => !best || point.value >= best.value ? point : best, null);
}

function assessBenchmark(metric, definition, asOf, days) {
  const span = days * dayMs;
  const raw = observations(metric, metric?.observations ?? metric?.history);
  const frontier = observations(metric, metric?.history ?? metric?.observations);
  const recent = raw.filter((point) => point.time > asOf - span && point.time <= asOf);
  if (!recent.length) return { ...definition, status: 'missing', note: 'No dated model results in this window.' };

  const strongestRecent = strongest(recent);
  const baseline = strongest(frontier.filter((point) => point.time <= asOf - span))
    ?? recent.find((point) => point.time < strongestRecent.time);
  if (!baseline) return { ...definition, status: 'missing', note: 'A comparable earlier result is needed.', point: strongestRecent };

  const ratio = definition.id === 'reliability';
  const amount = ratio ? (baseline.value > 0 ? strongestRecent.value / baseline.value : 0) : strongestRecent.value - baseline.value;
  const readable = Number.isFinite(strongestRecent.low) && Number.isFinite(baseline.high);
  const separate = readable && strongestRecent.low > baseline.high;
  const dated = strongestRecent.time - baseline.time <= span;
  const meetsSize = amount >= definition.threshold;
  const found = meetsSize && separate && dated;
  const change = ratio ? integer.format(amount) + '× the prior result' : (amount > 0 ? '+' : '') + integer.format(amount) + ' ECI points';
  let note = change + '.';
  if (found) note += ' The reported intervals are separated.';
  else if (!meetsSize) note += ' Below the watch cutoff.';
  else if (!dated) note += ' The two observations are too far apart to establish the speed of change.';
  else if (!readable) note += ' Reported intervals are unavailable.';
  else note += ' The reported intervals overlap.';
  return { ...definition, status: found ? 'gain' : meetsSize && (!dated || !readable) ? 'missing' : 'observed', note, point: strongestRecent };
}

function assessResearch(metric, definition, asOf, days) {
  const start = asOf - days * dayMs;
  const points = observations(metric, metric?.history).filter((point) => point.time > start && point.time <= asOf);
  const point = points.at(-1);
  if (!point) return { ...definition, status: 'missing', note: 'No independently assessed rate in this window.' };

  const readable = Number.isFinite(point.low);
  const qualifies = readable && point.low >= definition.threshold;
  const interval = readable && Number.isFinite(point.high) ? ' (reported interval ' + integer.format(point.low) + '–' + integer.format(point.high) + '×)' : '';
  const change = integer.format(point.value) + '× the earlier rate' + interval + '.';
  const note = change + (qualifies ? ' The lower bound reaches the watch cutoff.' : readable ? ' The lower bound is below the watch cutoff.' : ' A reported lower bound is needed.');
  return { ...definition, status: qualifies ? 'gain' : readable ? 'observed' : 'missing', note, point };
}

function assessWindow(metrics, asOf, days) {
  const signals = readings.map((definition) => definition.family === 'Research'
    ? assessResearch(metrics.get(definition.id), definition, asOf, days)
    : assessBenchmark(metrics.get(definition.id), definition, asOf, days));
  const gains = signals.filter((signal) => signal.status === 'gain');
  const comparable = signals.filter((signal) => signal.status !== 'missing');
  const corroborated = gains.some((signal) => signal.family === 'Capability')
    && gains.some((signal) => signal.family === 'Research') && new Set(gains.map((signal) => signal.publisher)).size >= 2;
  const covered = comparable.some((signal) => signal.family === 'Capability')
    && comparable.some((signal) => signal.family === 'Research') && new Set(comparable.map((signal) => signal.publisher)).size >= 2;
  const state = corroborated ? 'surge' : gains.length ? 'watch' : covered ? 'quiet' : 'limited';
  return { days, state, signals, gains, comparable: comparable.length };
}

function rankAccess(metric, breadth, label, asOf, events) {
  const groupPoints = metric?.observations ?? metric?.history ?? [];
  const allPoints = breadth?.observations ?? breadth?.history ?? [];
  const points = groupPoints.length ? groupPoints : allPoints.filter((point) => point.access === label);
  const ordered = observations(metric ?? breadth, points)
    .filter((point) => point.label && (!Number.isFinite(asOf) || point.time <= asOf))
    .sort((a, b) => b.value - a.value || b.time - a.time || a.label.localeCompare(b.label));
  const ranked = new Map();
  for (const point of ordered) {
    const key = `${point.organization ?? ''}\n${point.label}`;
    if (ranked.has(key)) continue;
    ranked.set(key, { ...point, releaseUrl: modelReleaseUrl(point.label, point.date, events) });
    if (ranked.size === 3) break;
  }
  return { label, models: [...ranked.values()], sourceUrl: metric?.sourceUrl ?? breadth?.sourceUrl };
}

export function assessAcceleration(payload = {}, { asOf = payload.checkedAt } = {}) {
  const snapshotDay = day(asOf);
  const metrics = new Map((payload.metrics ?? []).map((metric) => [metric.id, metric]));
  const windows = [7, 30].map((days) => assessWindow(metrics, snapshotDay, days));
  const state = ['surge', 'watch', 'quiet', 'limited'].find((candidate) => windows.some((window) => window.state === candidate));
  return {
    state,
    windows,
    asOf: Number.isFinite(snapshotDay) ? snapshotDay : null,
    pendingReport: payload.sources?.find((source) => source.pendingReport)?.pendingReport,
    access: [['open-breadth', 'Open weights'], ['closed-breadth', 'Closed weights']].map(([id, label]) =>
      rankAccess(metrics.get(id), metrics.get('breadth'), label, snapshotDay, payload.releaseEvents ?? [])),
  };
}

const statuses = {
  surge: { headline: 'Rapid gains corroborated', detail: 'Independent capability and research findings crossed the watch criteria.' },
  watch: { headline: 'On watch', detail: 'At least one independent finding crossed its cutoff. A separate capability and research finding can corroborate it.' },
  quiet: { headline: 'Below watch criteria', detail: 'Comparable capability and research observations are available. No finding crossed its cutoff.' },
  limited: { headline: 'Limited evidence', detail: 'Recent comparable capability and research findings are sparse. Source releases determine when the picture can change.' },
};

function element(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text != null) item.textContent = text;
  return item;
}

function sourceLink(url, text) {
  if (typeof url !== 'string' || !url.startsWith('https://')) return element('span', '', text);
  const link = element('a', '', text + ' ↗');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function renderWindow(window) {
  const item = element('li', 'sw-watch__window');
  item.dataset.state = window.state;
  item.append(element('span', 'sw-watch__lookback', window.days + ' DAYS'),
    element('strong', '', statuses[window.state].headline),
    element('span', '', window.comparable + ' of ' + readings.length + ' comparable readings'));
  return item;
}

function renderReasons(window) {
  const block = element('div', 'sw-watch__reason-window');
  block.append(element('h4', '', 'Last ' + window.days + ' days'));
  const rows = element('ul', 'sw-watch__reason-list');
  for (const signal of window.signals) {
    const row = element('li');
    row.append(element('strong', '', signal.label + ' · ' + signal.publisher), element('p', '', signal.note));
    if (signal.point) row.append(sourceLink(signal.point.url,
      shortDate.format(new Date(signal.point.time)) + (signal.point.label ? ' · ' + signal.point.label : '')));
    rows.append(row);
  }
  block.append(rows);
  return block;
}

function renderAccess(access) {
  const block = element('section', 'sw-watch__access');
  block.id = 'model-leaders';
  block.setAttribute('aria-labelledby', 'model-leaders-title');
  const title = element('h3', '', 'Top models by weight access');
  title.id = 'model-leaders-title';
  block.append(title);
  const source = element('p', 'sw-watch__method', 'Ranked by published ECI scores in the current benchmark snapshot. ');
  source.append(sourceLink(access.find(({ sourceUrl }) => sourceUrl)?.sourceUrl ?? 'https://epoch.ai/eci', 'Epoch AI leaderboard'));
  block.append(source);
  const grid = element('ul', 'sw-watch__access-grid');
  for (const { label, models } of access) {
    const card = element('li', 'sw-watch__access-card');
    card.append(element('h4', '', `Top 3 ${label === 'Open weights' ? 'open-weight' : 'closed-weight'} models`));
    const ranking = element('ol', 'sw-watch__model-ranking');
    for (const record of models) {
      const row = element('li', 'sw-watch__model');
      const model = element('div', 'sw-watch__model-name');
      model.append(sourceLink(record.releaseUrl ?? record.url, record.label + (record.releaseUrl ? '' : ' · benchmark')),
        element('strong', '', `${integer.format(record.value)} ECI`));
      const metadata = element('p', 'sw-watch__model-meta');
      for (const [position, developer] of organizationSites(record.organization).entries()) {
        if (position) metadata.append(' · ');
        metadata.append(sourceLink(developer.url, developer.label));
      }
      if (metadata.childNodes.length) metadata.append(' · ');
      metadata.append(`Released ${shortDate.format(new Date(record.time))}`);
      row.append(model, metadata);
      ranking.append(row);
    }
    if (models.length) card.append(ranking);
    if (models.length < 3) card.append(element('p', 'sw-watch__method', models.length ? 'Fewer than three scores available.' : 'Awaiting published scores.'));
    grid.append(card);
  }
  block.append(grid);
  if (access.every(({ models }) => models.length)) {
    const margin = access[1].models[0].value - access[0].models[0].value;
    if (margin !== 0) {
      block.append(element('p', 'sw-watch__access-gap',
        (margin > 0 ? 'Closed' : 'Open') + ' group leads by ' + integer.format(Math.abs(margin)) + ' ECI points.'));
    } else {
      block.append(element('p', 'sw-watch__access-gap', 'The two group leaders have the same recorded ECI.'));
    }
  }
  block.append(element('p', 'sw-watch__method',
    'Both groups feed the broad capability benchmark. Downloadable weights can make local testing and independent replication easier, subject to the model license. Research automation has its own evidence criterion.'));
  return block;
}

export function renderWatchtower(container, { index, payload } = {}) {
  if (!payload) return;
  const result = assessAcceleration(payload, { asOf: index?.date ?? payload.checkedAt });
  const next = JSON.stringify(result);
  if (rendered.get(container) === next) return;
  rendered.set(container, next);
  const expanded = container.querySelector('details')?.open ?? false;
  container.classList.add('sw-watch');
  container.dataset.state = result.state;

  const head = element('div', 'sw-watch__heading');
  const beacon = element('span', 'sw-watch__beacon');
  beacon.setAttribute('aria-hidden', 'true');
  const lead = element('div');
  lead.append(element('p', 'sw-watch__label', 'ACCELERATION WATCH'),
    element('h2', '', statuses[result.state].headline),
    element('p', 'sw-watch__explanation', statuses[result.state].detail));
  head.append(beacon, lead);

  const windows = element('ul', 'sw-watch__windows');
  windows.append(...result.windows.map(renderWindow));

  const gains = [...new Map(result.windows.flatMap((window) => window.gains).map((signal) => [signal.id, signal])).values()];
  const findings = element('ul', 'sw-watch__findings');
  for (const gain of gains) {
    const row = element('li');
    row.append(sourceLink(gain.point.url, gain.publisher + ' · ' + gain.label), element('span', '', gain.note));
    findings.append(row);
  }

  const details = element('details', 'sw-watch__details');
  details.open = expanded;
  const rationale = element('div', 'sw-watch__rationale');
  rationale.append(...result.windows.map(renderReasons));
  details.append(element('summary', '', 'See the evidence and cutoffs'), rationale,
    element('p', 'sw-watch__method', 'The watch uses editorial cutoffs. A benchmark must improve by at least 50% on METR’s 80% task horizon or 5 points on Epoch AI’s capability index. Its reported interval must clear the prior interval, and the observations must be no more than the lookback window apart. For research, the lower bound of an independent rate estimate must reach 1.5× the earlier rate. Corroboration requires capability and research findings from different organizations.'));

  const notes = element('p', 'sw-watch__method',
    (result.asOf == null ? '' : 'Windows ending ' + shortDate.format(new Date(result.asOf)) + '. ')
    + 'Benchmarks use model dates and research uses report dates. New readings arrive on their publishers’ schedules.');
  if (result.pendingReport?.url) {
    notes.append(' ', sourceLink(result.pendingReport.url, 'New METR report needs a comparability review.'));
  }
  container.replaceChildren(head, windows, ...(gains.length ? [findings] : []), details, notes, renderAccess(result.access));
}
