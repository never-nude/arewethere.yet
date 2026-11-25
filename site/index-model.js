const dayMs = 86_400_000;
const releaseWindow = 45;

export const singularityDefinition = 'A sustained feedback loop in which AI systems drive substantial, accelerating gains in their successors’ capabilities across multiple generations.';

export const indexMethodology = [
  'The score totals weighted evidence points on a 0–100 scale. Weights and reference targets are editorial choices. The score tracks proxy indicators alongside evidence of AI research automation.',
  'Inputs use dated observations or announcements. Missing factors leave their evidence points unfilled and lower the coverage readout. The coverage range shows how many points missing inputs could add.',
  'Model measurements are placed on the model release date for retrospective comparison. Research results enter the index on the report publication date. Values carry forward between observations, except for the stated rolling windows.',
  'A scenario projects from a score and monthly pace chosen by the reader. Confirmation of self-accelerating AI requires independent evidence for all three criteria below.',
];

const sources = {
  metr: { source: 'METR', sourceUrl: 'https://metr.org/blog/2026-11-20-q4-2026-capability-update/' },
  breadth: { source: 'Epoch AI', sourceUrl: 'https://epoch.ai/data/eci-documentation/methodology' },
  autonomy: { source: 'OpenAI', sourceUrl: 'https://openai.com/index/research-acceleration-jagged-frontier/' },
  acceleration: { source: 'METR', sourceUrl: 'https://metr.org/blog/2026-11-05-anthropic-ai-rd-acceleration-assessment/' },
  compute: { source: 'Epoch AI', sourceUrl: 'https://epoch.ai/data/ai-models' },
  forecast: { source: 'Manifold', sourceUrl: 'https://manifold.markets/RemNi/will-we-get-agi-before-2030' },
};

const clamp = (value) => Math.min(100, Math.max(0, value));
const between = (value, floor, ceiling) => clamp(100 * (value - floor) / (ceiling - floor));
const logarithmic = (value, floor, ceiling) =>
  value > 0 ? between(Math.log(value), Math.log(floor), Math.log(ceiling)) : 0;
const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

export const factorDefinitions = [
  {
    id: 'reliability', label: 'Reliable autonomy', lane: 'Capability', weight: 22, unit: 'h',
    detail: 'Estimated expert human task duration at 80% success on verifiable METR TH2 tasks.',
    scoring: 'Log scale from 15 minutes to 24 hours.',
    normalize: (value) => logarithmic(value, 0.25, 24),
    ...sources.metr,
  },
  {
    id: 'horizon', label: 'Difficult task reach', lane: 'Capability', weight: 11, unit: 'h',
    detail: 'Estimated expert human task duration at 50% success on METR’s combined TH1.1 and TH2 suite.',
    scoring: 'Log scale from 15 minutes to 168 hours.',
    normalize: (value) => logarithmic(value, 0.25, 168),
    ...sources.metr,
  },
  {
    id: 'breadth', label: 'Capability breadth', lane: 'Capability', weight: 17, unit: 'ECI',
    detail: 'Best Epoch Capabilities Index score among model releases in the trailing 90 days. Scores synthesize multiple benchmarks, and the leading model can change as a cohort ages out.',
    scoring: 'Linear scale from ECI 130 to the dashboard reference of 200. ECI has no fixed maximum.',
    normalize: (value) => between(value, 130, 200),
    ...sources.breadth,
  },
  {
    id: 'research-autonomy', label: 'Unassisted research tasks', lane: 'Research', weight: 18, unit: '%',
    detail: 'Successful completion without human intervention on OpenAI’s internal research tasks estimated to take experts 4–8 hours. This is a first-party task-level indicator.',
    scoring: 'Linear scale from 0% to the dashboard reference of 80%.',
    normalize: (value) => between(value, 0, 80),
    ...sources.autonomy,
  },
  {
    id: 'research-acceleration', label: 'AI-assisted research pace', lane: 'Research', weight: 17, unit: '×',
    detail: 'METR’s estimate for the rate of Anthropic model capability gains relative to its earlier rate. The causal contribution from AI assistance remains uncertain.',
    scoring: 'Linear scale from 1× the prior rate to the dashboard reference of 3×.',
    normalize: (value) => between(value, 1, 3),
    ...sources.acceleration,
  },
  {
    id: 'compute', label: 'Frontier training compute', lane: 'Inputs', weight: 7, unit: 'FLOP',
    detail: 'Record reported or estimated training compute in Epoch AI’s frontier dataset. Compute is an input, and some training runs lack public estimates.',
    scoring: 'Log scale from 10²⁴ to 10²⁸ FLOP.',
    normalize: (value) => logarithmic(value, 1e24, 1e28),
    ...sources.compute,
  },
  {
    id: 'forecast', label: 'AGI market sentiment', lane: 'Expectations', weight: 5, unit: '%',
    detail: 'YES price in a Manifold play-money market for AGI before 2030, using the market’s own resolution rules.',
    scoring: 'One index scale point per percentage point of YES price, before weighting.',
    normalize: clamp,
    ...sources.forecast,
  },
  {
    id: 'releases', label: 'Frontier release activity', lane: 'Expectations', weight: 3, unit: 'releases',
    detail: 'Count of tracked first-party frontier release announcements in the trailing 45 days. Joint launches count once. The count reflects coverage from tracked publishers and measures activity.',
    scoring: 'Linear scale from zero to six releases. A release ages out after 45 days.',
    normalize: (value) => between(value, 0, 6),
    source: 'Publisher announcements',
  },
];

const fallbackSeries = {
  'research-autonomy': {
    ...sources.autonomy,
    history: [{ date: '2026-10-31', publishedAt: '2026-11-18', value: 35 }],
  },
  'research-acceleration': {
    ...sources.acceleration,
    history: [{ date: '2026-11-05', value: 1.9, low: 1.5, high: 2.8 }],
  },
};

const releaseHosts = {
  'openai.com': /\b(?:GPT[-\s]?\d|o[134](?:-pro|-mini)?\b)/i,
  'anthropic.com': /\b(?:Opus|Sonnet|Fable|Mythos)\b/i,
  'claude.com': /\b(?:Opus|Sonnet|Fable|Mythos)\b/i,
  'blog.google': /\bGemini\b/i,
  'deepmind.google': /\bGemini\b/i,
};
const releaseIntent = /\b(?:introduc(?:e[sd]?|ing)|announc(?:e[sd]?|ing)|releas(?:e[sd]?|ing)|launch(?:es|ed|ing)?|now available)\b|^(?:Claude|Gemini|GPT[-\s]?\d)/i;

function day(value) {
  if (typeof value !== 'string') return null;
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const time = Date.parse(date);
  return Number.isFinite(time) && isoDay(time) === date ? date : null;
}

export { day as observationDay };

export function hasSourceReading(payload) {
  if (!Array.isArray(payload?.metrics) || !Array.isArray(payload.events) || !Array.isArray(payload.sources)) return false;
  const asOf = day(payload.checkedAt);
  if (!asOf || !Number.isFinite(Date.parse(payload.checkedAt))) return false;
  const inRange = value => {
    const date = day(value);
    return date && date <= asOf;
  };
  if (Array.isArray(payload.releaseEvents) && inRange(payload.releaseStart)) return true;
  return payload.metrics.some(metric => factorDefinitions.some(factor => factor.id === metric?.id) && (
    (Number.isFinite(metric.value) && inRange(metric.asOf)) ||
    [metric.history, metric.observations].some(series => Array.isArray(series) && series.some(point =>
      Number.isFinite(point?.value) && inRange(point.publishedAt ?? point.date)))
  ));
}

function isoDay(time) {
  return new Date(time).toISOString().slice(0, 10);
}

function offset(date, days) {
  return isoDay(Date.parse(date) + days * dayMs);
}

function cleanPoints(metric, retrospective = true) {
  const raw = retrospective ? metric?.observations ?? metric?.history : metric?.history;
  const points = (Array.isArray(raw) ? raw : [])
    .map((point, order) => {
      const date = day(point?.date);
      if (!date || !Number.isFinite(point.value)) return null;
      const publishedAt = day(point.publishedAt);
      return { ...point, date, publishedAt, effective: publishedAt ?? date, order };
    })
    .filter(Boolean);
  if (!points.length) {
    const date = day(metric?.asOf);
    if (date && Number.isFinite(metric?.value)) {
      points.push({ date, effective: date, value: metric.value, label: metric.model, low: metric.low, high: metric.high, order: 0 });
    }
  }
  return points.sort((a, b) => a.effective.localeCompare(b.effective) || a.date.localeCompare(b.date) || a.order - b.order);
}

function findPoint(points, date, trailingDays) {
  let selected = null;
  const earliest = trailingDays ? offset(date, 1 - trailingDays) : '';
  for (const point of points) {
    if (point.effective > date) break;
    if (point.effective < earliest) continue;
    if (!trailingDays || !selected || point.value >= selected.value) selected = point;
  }
  return selected;
}

function releasesFrom(events, verifiedFeed) {
  const unique = new Map();
  for (const event of events) {
    if (event.category?.toLowerCase() !== 'release' || typeof event.title !== 'string') continue;
    let url;
    try { url = new URL(event.url); } catch { continue; }
    const host = url.hostname.replace(/^www\./, '');
    const domain = Object.keys(releaseHosts).find((name) => host === name || host.endsWith('.' + name));
    if (url.protocol !== 'https:' || !domain || !releaseHosts[domain].test(event.title)
      || (!verifiedFeed && !releaseIntent.test(event.title))) continue;
    const key = host + url.pathname.replace(/\/+$/, '').toLowerCase() + url.hash + event.date;
    const publisher = domain === 'claude.com' ? 'anthropic.com' : domain;
    const titleKey = event.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const duplicate = [...unique.values()].some((item) =>
      item.publisher === publisher && item.date === event.date && item.titleKey === titleKey);
    if (!unique.has(key) && !duplicate) unique.set(key, { ...event, publisher, titleKey });
  }
  return [...unique.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function releasePoint(releases, coveredSince, date) {
  const earliest = offset(date, 1 - releaseWindow);
  if (!coveredSince || coveredSince > earliest) return null;
  const matching = releases.filter((release) => release.date >= earliest && release.date <= date);
  const latest = matching.at(-1);
  return {
    date, value: matching.length, label: latest?.title, publishedAt: latest?.date,
    source: latest?.source, sourceUrl: latest?.url,
  };
}

function makeFactor(definition, point, metric, previous) {
  const { normalize, ...description } = definition;
  const score = point ? round(normalize(point.value)) : null;
  const contribution = score == null ? null : round(score * definition.weight / 100);
  return {
    ...description,
    score,
    delta: score != null && previous?.score != null ? round(score - previous.score) : null,
    contribution,
    contributionDelta: contribution != null && previous?.contribution != null
      ? round(contribution - previous.contribution) : null,
    value: point?.value ?? null,
    low: Number.isFinite(point?.low) ? point.low : null,
    high: Number.isFinite(point?.high) ? point.high : null,
    model: point?.label ?? null,
    date: point?.date ?? null,
    publishedAt: point?.publishedAt ?? null,
    source: point?.source ?? metric?.source ?? definition.source,
    sourceUrl: point?.sourceUrl ?? metric?.sourceUrl ?? definition.sourceUrl ?? null,
    status: score == null ? 'unavailable' : metric?.status ?? 'published',
  };
}

function confirmation(record, asOf) {
  const date = day(record?.date);
  if (!date || date > asOf || typeof record.source !== 'string' || !record.source.trim()) return null;
  let url;
  try { url = new URL(record.sourceUrl); } catch { return null; }
  return url.protocol === 'https:' ? { ...record, date } : null;
}

function makeThreshold(frame, evidence, benchmarkDate) {
  const reliability = frame.factors.find((factor) => factor.id === 'reliability');
  const autonomy = frame.factors.find((factor) => factor.id === 'research-autonomy');
  const acceleration = frame.factors.find((factor) => factor.id === 'research-acceleration');
  const workdayDate = benchmarkDate ?? reliability.date;
  const verifiedWorkday = reliability.low != null && reliability.low >= 8 && workdayDate <= frame.date;
  // These two qualitative gates require curated confirmations of the stated criteria.
  const verifiedResearch = confirmation(evidence?.research, frame.date);
  const verifiedCompounding = confirmation(evidence?.compounding, frame.date);
  const criteria = [
    {
      id: 'workday', label: 'Reliable workday-length autonomy',
      status: verifiedWorkday ? 'met' : reliability.score == null ? 'unknown' : 'watching',
      detail: 'The lower bound of the independent 95% interval reaches eight hours at 80% task success.',
      value: reliability.value, target: 8, unit: 'h',
      source: reliability.source, sourceUrl: reliability.sourceUrl,
      date: verifiedWorkday ? workdayDate : null,
    },
    {
      id: 'research', label: 'Repeated end-to-end AI research',
      status: verifiedResearch ? 'met' : autonomy.score == null ? 'unknown' : 'partial',
      detail: 'Independent evidence shows AI agents repeatedly plan, run and validate consequential research projects.',
      value: autonomy.value, target: null, unit: '%',
      source: verifiedResearch?.source ?? autonomy.source,
      sourceUrl: verifiedResearch?.sourceUrl ?? autonomy.sourceUrl,
      date: verifiedResearch?.date ?? null,
    },
    {
      id: 'compounding', label: 'Compounding capability gains',
      status: verifiedCompounding ? 'met' : 'open',
      detail: 'Independent evidence attributes accelerating capability gains across at least two successor generations to AI-led research, with alternative drivers accounted for.',
      value: acceleration.value, target: null, unit: '×',
      source: verifiedCompounding?.source ?? acceleration.source,
      sourceUrl: verifiedCompounding?.sourceUrl ?? acceleration.sourceUrl,
      date: verifiedCompounding?.date ?? null,
    },
  ];
  const observed = criteria.every((criterion) => criterion.status === 'met');
  return {
    observed,
    crossingDate: observed ? criteria.map((criterion) => criterion.date).sort().at(-1) : null,
    criteria,
  };
}

export function buildIndex(payload = {}, { days = 180 } = {}) {
  const calendarDays = Number.isInteger(days) ? Math.max(1, Math.min(days, 1100)) : 180;
  const cleanEvents = (items) => (Array.isArray(items) ? items : [])
    .map((event) => ({ ...event, date: day(event?.date) }))
    .filter((event) => event.date);
  const events = cleanEvents(payload.events);
  const verifiedFeed = Array.isArray(payload.releaseEvents);
  const releaseEvents = verifiedFeed ? cleanEvents(payload.releaseEvents) : events;
  const input = new Map((Array.isArray(payload.metrics) ? payload.metrics : [])
    .filter((metric) => typeof metric?.id === 'string').map((metric) => [metric.id, metric]));
  const series = new Map(factorDefinitions.map(({ id }) => {
    const metric = input.get(id) ?? fallbackSeries[id];
    return [id, { metric, points: cleanPoints(metric, id === 'breadth' || id.startsWith('research-')) }];
  }));
  const latestDate = [
    ...[...events, ...releaseEvents].map((event) => event.date),
    ...[...series.values()].flatMap(({ points }) => points.map((point) => point.effective)),
  ].sort().at(-1);
  const today = day(payload.checkedAt) ?? latestDate ?? isoDay(Date.now());
  const releases = releasesFrom(releaseEvents, verifiedFeed).filter((event) => event.date <= today);
  const coveredSince = verifiedFeed ? day(payload.releaseStart) : releases[0]?.date;
  const eventsByDay = new Map();
  for (const event of [...events, ...releases]) {
    const list = eventsByDay.get(event.date) ?? [];
    if (!list.some((item) => item.url === event.url || item.title === event.title)) list.push(event);
    eventsByDay.set(event.date, list);
  }
  const history = [];
  for (let remaining = calendarDays - 1; remaining >= 0; remaining--) {
    const date = offset(today, -remaining);
    const previous = history.at(-1);
    const factors = factorDefinitions.map((definition, index) => {
      const { id } = definition;
      const { metric, points } = series.get(id);
      const point = id === 'releases'
        ? releasePoint(releases, coveredSince, date)
        : findPoint(points, date, id === 'breadth' ? 90 : undefined);
      return makeFactor(definition, point, metric, previous?.factors[index]);
    });
    const available = factors.filter(({ score }) => score != null);
    const coverage = available.reduce((total, factor) => total + factor.weight, 0);
    const score = coverage ? round(available.reduce((total, factor) => total + factor.score * factor.weight / 100, 0)) : null;
    const delta = score != null && previous?.score != null ? round(score - previous.score) : null;
    history.push({
      date, score, coverage, delta, factors,
      coverageDelta: previous ? coverage - previous.coverage : null,
      scoreRange: score == null ? [0, 100] : [score, round(score + 100 - coverage)],
      events: eventsByDay.get(date) ?? [],
    });
  }
  const current = history.at(-1);
  return {
    definition: singularityDefinition,
    methodology: indexMethodology,
    ...current,
    history,
    threshold: makeThreshold(current, payload.thresholdEvidence, day(input.get('reliability')?.asOf)),
  };
}

export function projectThreshold(index, { monthlyPoints, target } = {}) {
  const validTarget = Number.isFinite(target) && target >= 0 && target <= 100;
  const scenario = {
    date: null, days: null, target: validTarget ? target : null,
    monthlyPoints: Number.isFinite(monthlyPoints) ? monthlyPoints : null,
  };
  if (!validTarget) return { ...scenario, status: 'no-target' };
  if (!Number.isFinite(index?.score) || !day(index.date)) return { ...scenario, status: 'no-reading' };
  const gap = target - index.score;
  if (gap === 0) return { ...scenario, date: index.date, days: 0, status: 'at-line' };
  if (scenario.monthlyPoints === null) return { ...scenario, status: 'no-pace' };
  if (Math.sign(gap) !== Math.sign(monthlyPoints)) return { ...scenario, status: 'no-crossing' };
  const days = Math.ceil(gap / monthlyPoints * 30.4375);
  if (days > 365.25 * 5) return { ...scenario, days, status: 'outside-window' };
  return { ...scenario, days, date: offset(index.date, days), status: 'conditional' };
}
