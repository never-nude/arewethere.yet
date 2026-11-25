import { scoredModelObservations } from './observatory-scored-models.js';

const dayMs = 86_400_000;
const windowDays = 30;
const periodCount = 12;
const publishers = ['OpenAI', 'Anthropic'];
const impactSources = {
  metr: 'https://metr.org/blog/2026-11-05-anthropic-ai-rd-acceleration-assessment/',
  openai: 'https://openai.com/index/research-acceleration-jagged-frontier/',
  deepmind:
    'https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/',
};
const isoDay = (time) => new Date(time).toISOString().slice(0, 10);
const before = (date, cutoff) => Boolean(date) && Date.parse(date) <= cutoff;
const round = (n) => Number(n.toFixed(4));
const sum = (rows) => rows.reduce((a, b) => a + b, 0);

function sourceLink(event) {
  let url;
  try {
    url = new URL(event.url);
  } catch {
    return null;
  }
  const hosts =
    event.source === 'OpenAI'
      ? ['openai.com', 'www.openai.com']
      : ['anthropic.com', 'www.anthropic.com', 'platform.claude.com', 'docs.anthropic.com', 'claude.com'];
  if (url.protocol !== 'https:' || !hosts.includes(url.hostname)) return null;
  // Provider release notes publish many dated entries on a single page.
  const section = url.pathname.includes('release-notes') ? url.hash : '';
  return url.hostname.replace(/^www\./, '') + url.pathname.replace(/\/$/, '') + section;
}

function publisherActivity(signals, cutoff, lastDay) {
  const checked = Date.parse(signals?.checkedAt);
  const valid =
    checked <= cutoff &&
    Array.isArray(signals?.releaseEvents) &&
    /^\d{4}-\d{2}-\d{2}$/.test(signals.releaseStart) &&
    before(signals.releaseStart, checked) &&
    ['openai', 'anthropic'].every((id) => signals.sources?.some((s) => s.id === id && s.status === 'live'));
  if (!valid) return { start: null, through: null, events: [] };
  const through = isoDay(Math.min(lastDay, Math.floor(checked / dayMs) * dayMs - dayMs));
  const ordered = signals.releaseEvents
    .filter(
      (e) =>
        e &&
        typeof e.url === 'string' &&
        publishers.includes(e.source) &&
        e.category === 'Release' &&
        /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
        e.date <= through,
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.url.localeCompare(b.url) || 0);
  const links = new Set(),
    days = new Map();
  for (const e of ordered) {
    const url = sourceLink(e);
    if (!url || links.has(url)) continue;
    links.add(url);
    const key = e.source + '|' + e.date;
    if (e.date >= signals.releaseStart && !days.has(key)) {
      days.set(key, { publisher: e.source, date: e.date, title: e.title || 'Model release', sourceUrl: e.url });
    }
  }
  return { start: signals.releaseStart, through, events: [...days.values()] };
}

function scoreHistory(assessment, signals, lastDay) {
  const items = scoredModelObservations(assessment);
  const metric = signals?.metrics?.find((m) => m.id === 'breadth');
  // A built-in frontier sample cannot establish how many models were scored.
  const fullCapture =
    items.some((r) => r.sourceStatus === 'live') ||
    Boolean(
      before(signals?.checkedAt, Date.parse(assessment.evidenceCutoff || assessment.checkpointAt)) &&
        metric?.observations?.length,
    );
  const retrieved = items.map((r) => Date.parse(r.retrievedAt)).filter(Number.isFinite);
  if (!fullCapture || !retrieved.length) return { start: null, through: null, rows: [] };
  const through = isoDay(Math.min(lastDay, Math.floor(Math.max(...retrieved) / dayMs) * dayMs - dayMs));
  const versions = new Map();
  const sorted = [...items].sort(
    (a, b) =>
      (b.retrievedAt || '').localeCompare(a.retrievedAt || '') ||
      a.referenceOn.localeCompare(b.referenceOn) ||
      b.value - a.value,
  );
  for (const row of sorted) {
    const key = row.system.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!versions.has(key) && row.referenceOn <= through) versions.set(key, row);
  }
  const rows = [...versions.values()].sort((a, b) => a.referenceOn.localeCompare(b.referenceOn));
  return { start: rows[0]?.referenceOn ?? null, through, rows };
}

// Fit count = exp(intercept + slope × window) by Poisson maximum likelihood.
// Given a slope, the fitted total equals the observed total. Solve the remaining
// moment equation for the mean event time. This includes windows with zero events.
function countTrend(counts) {
  const n = counts.length,
    total = sum(counts);
  if (!total) return null;
  const observed = sum(counts.map((v, t) => v * t)) / total;
  if (observed === 0 || observed === n - 1) return null;
  let low = -12,
    high = 12;
  function weights(slope) {
    const center = slope > 0 ? n - 1 : 0;
    return counts.map((_, t) => Math.exp(slope * (t - center)));
  }
  for (let i = 0; i < 55; i++) {
    const slope = (low + high) / 2,
      w = weights(slope);
    if (sum(w.map((v, t) => v * t)) / sum(w) < observed) low = slope;
    else high = slope;
  }
  const slope = (low + high) / 2,
    w = weights(slope);
  const weightTotal = sum(w);
  const information = (total * sum(w.map((v, t) => v * (t - observed) ** 2))) / weightTotal;
  const se = 1 / Math.sqrt(information);
  return {
    slope,
    next: (total * w[n - 1] * Math.exp(slope)) / weightTotal,
    low: slope - 1.96 * se,
    high: slope + 1.96 * se,
  };
}
function linearNext(counts) {
  const mean = sum(counts) / counts.length,
    center = (counts.length - 1) / 2;
  const slope =
    sum(counts.map((y, t) => (y - mean) * (t - center))) / sum(counts.map((_, t) => (t - center) ** 2));
  return Math.max(0, mean + slope * (counts.length - center));
}

function fitActivity(periods, field) {
  // Use one uninterrupted run of covered windows. Missing exposure cannot
  // substitute for an event-free window or silently shorten the time axis.
  const counts = periods.map((p) => p[field]);
  const run = counts.slice(counts.findLastIndex((v) => v === null) + 1);
  const result = {
    status: 'Insufficient comparable windows',
    supported: false,
    windows: run.length,
    holdouts: 0,
    perWindowPercent: null,
    perWindowInterval: null,
    bestHeldout: null,
    doublingDays: null,
    halvingDays: null,
    errors: { exponential: null, linear: null, constant: null },
    errorUnit: 'Mean absolute error per 30-day window',
  };
  if (run.length < 10) return result;
  const trend = countTrend(run);
  if (!trend) return { ...result, status: 'No identifiable exponential rate' };
  result.perWindowPercent = round(Math.expm1(trend.slope) * 100);
  result.perWindowInterval = {
    low: round(Math.expm1(trend.low) * 100),
    high: round(Math.expm1(trend.high) * 100),
    label: 'Approximate 95% rate interval assuming independent Poisson counts. Clustering can widen it.',
  };
  const errors = { exponential: 0, linear: 0, constant: 0 };
  const byWindow = [];
  // Train on at least six windows. The final four each receive one forecast
  // made using only preceding windows; all three fits see exactly those rows.
  for (let i = run.length - 4; i < run.length; i++) {
    const past = run.slice(0, i),
      exp = countTrend(past);
    if (!exp) return { ...result, status: 'Too few earlier events for a comparison' };
    const loss = {
      exponential: Math.abs(exp.next - run[i]),
      linear: Math.abs(linearNext(past) - run[i]),
      constant: Math.abs(sum(past) / past.length - run[i]),
    };
    for (const key of Object.keys(errors)) errors[key] += loss[key];
    byWindow.push(loss);
  }
  result.holdouts = 4;
  for (const key of Object.keys(errors)) result.errors[key] = round(errors[key] / 4);
  result.bestHeldout = Object.keys(errors).sort((a, b) => errors[a] - errors[b])[0];
  const beatsAlternatives = errors.exponential + 1e-8 < Math.min(errors.linear, errors.constant);
  // A single unusual window must not determine the conclusion. Recompare
  // the three errors four times, omitting one held-out result each time.
  result.stabilityWins = byWindow.filter(
    (loss) =>
      errors.exponential - loss.exponential + 1e-8 <
      Math.min(errors.linear - loss.linear, errors.constant - loss.constant),
  ).length;
  result.supported =
    beatsAlternatives && result.stabilityWins === byWindow.length && (trend.low > 0 || trend.high < 0);
  if (result.supported && Math.abs(trend.slope) > 1e-6) {
    const days = round((windowDays * Math.LN2) / Math.abs(trend.slope));
    result[trend.slope > 0 ? 'doublingDays' : 'halvingDays'] = days;
  }
  if (result.supported)
    result.status =
      'Exponential fit consistently led on later windows and its rate interval excluded a flat trend';
  else if (!beatsAlternatives) result.status = 'A flat or linear fit matched or beat the exponential fit';
  else if (trend.low <= 0 && trend.high >= 0)
    result.status = 'Exponential fit led on later windows, but a flat rate is plausible';
  else result.status = 'The exponential lead depended on which later windows were included';
  return result;
}

function impact(row, id, label, scope) {
  return {
    id,
    label,
    value: row.value,
    unit: row.unit,
    fromValue: null,
    toValue: row.value,
    fromDate: null,
    toDate: row.referenceOn,
    publishedOn: row.publishedOn,
    low: row.low ?? null,
    high: row.high ?? null,
    intervalLabel: row.intervalLabel ?? null,
    source: row.source,
    sourceUrl: row.sourceUrl,
    scope,
    observationIds: [row.id],
  };
}
// Reviewed literature belongs to this analysis version. Its public release
// dates are distinct from observation dates in the original checkpoint.
function publishedImpacts(cutoff) {
  const studies = [
    {
      id: 'service-issues-resolved',
      label: 'Customer issues resolved each hour',
      value: 15,
      unit: '% more issues per hour',
      publishedOn: '2025-02-04',
      source: 'Brynjolfsson, Li and Raymond · Quarterly Journal of Economics',
      sourceUrl: 'https://academic.oup.com/qje/article/140/2/889/7990658',
      scope:
        'A staggered rollout among 5,172 customer-support agents at one company raised average issues resolved per hour by 15%. Gains varied by experience.',
    },
    {
      id: 'developer-completion-time',
      label: 'Time spent on software changes',
      value: 19,
      unit: '% longer per task',
      publishedOn: '2025-07-10',
      low: 2,
      high: 39,
      intervalLabel: '95% confidence interval',
      source: 'METR',
      sourceUrl: 'https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/',
      scope:
        'Sixteen experienced developers were randomly allowed to use early-2025 AI tools on 246 tasks in their own repositories. Completion took 19% longer on average.',
    },
  ];
  if (before('2026-02-24', cutoff)) {
    studies[1].followupUrl = 'https://metr.org/blog/2026-02-24-uplift-update/';
    studies[1].scope +=
      ' A later study found that selection of participants and tasks made an updated estimate unreliable.';
  }
  return studies
    .filter((s) => before(s.publishedOn, cutoff))
    .map((s) => ({
      fromValue: null,
      toValue: s.value,
      fromDate: null,
      toDate: s.publishedOn,
      low: null,
      high: null,
      intervalLabel: null,
      observationIds: [],
      basis: 'Published study reviewed for this analysis',
      ...s,
    }));
}

function documentedImpacts(assessment, cutoff) {
  const rows = (assessment.observations || []).filter(
    (row) =>
      row &&
      Number.isFinite(row.value) &&
      before(row.referenceOn, cutoff) &&
      before(row.publishedOn, cutoff) &&
      (!row.retrievedAt || before(row.retrievedAt, cutoff)) &&
      !['unavailable', 'withdrawn', 'retracted', 'missing'].includes(row.sourceStatus),
  );
  const result = [];
  const lab = rows.find(
    (r) =>
      r.topic === 'research-acceleration' &&
      r.sourceUrl === impactSources.metr &&
      r.source === 'METR' &&
      r.organization === 'Anthropic' &&
      r.classification === 'Independent evaluation' &&
      r.unit === '×',
  );
  if (lab)
    result.push(
      impact(
        lab,
        'anthropic-benchmark-pace',
        'Anthropic benchmark pace',
        'METR compared gains on Anthropic’s internal capability index since October 2025 with the previous pace. The study found substantial uncertainty about how much AI caused the change.',
      ),
    );
  const work = rows
    .filter(
      (r) =>
        r.topic === 'research-autonomy' &&
        r.sourceUrl === impactSources.openai &&
        r.source === 'OpenAI' &&
        r.label === 'Unassisted research tasks' &&
        r.classification === 'First-party measurement' &&
        r.unit === '%' &&
        r.value >= 0 &&
        r.value <= 100,
    )
    .sort((a, b) => a.referenceOn.localeCompare(b.referenceOn));
  if (work.length > 1 && work[0].referenceOn !== work.at(-1).referenceOn) {
    const a = work[0],
      b = work.at(-1);
    result.push({
      ...impact(
        b,
        'openai-unassisted-tasks',
        'Research tasks finished without human help',
        'OpenAI estimated completion on selected internal tasks requiring four to eight hours of human work. Both readings come from one company study. Task mix can change.',
      ),
      value: round(b.value - a.value),
      unit: 'percentage points',
      fromValue: a.value,
      toValue: b.value,
      fromDate: a.referenceOn,
      low: null,
      high: null,
      intervalLabel: null,
      observationIds: [a.id, b.id],
    });
  }
  const kernel = rows.find(
    (r) =>
      r.topic === 'successor-development' &&
      r.sourceUrl === impactSources.deepmind &&
      r.system === 'AlphaEvolve' &&
      r.unit === '% reduction in Gemini training time' &&
      r.classification === 'First-party measurement',
  );
  if (kernel)
    result.push({
      ...impact(
        kernel,
        'gemini-training-time',
        'Gemini training time saved',
        'Google DeepMind reported that AlphaEvolve sped up a matrix-multiplication kernel by 23%, saving about 1% of total training time in this application.',
      ),
      unit: '% of training time',
    });
  return [...result, ...publishedImpacts(cutoff)];
}

export function buildEventPace(assessment, signals) {
  const asOf = assessment.evidenceCutoff || assessment.checkpointAt;
  const cutoff = Date.parse(asOf);
  if (!Number.isFinite(cutoff)) throw new TypeError('Event pace needs a dated evidence cutoff');
  const lastDay = Math.floor(cutoff / dayMs) * dayMs - dayMs;
  const release = publisherActivity(signals, cutoff, lastDay);
  const scores = scoreHistory(assessment, signals, lastDay);
  const periods = [];
  let best = null,
    cursor = 0;
  for (let i = 0; i < periodCount; i++) {
    const endTime = lastDay - (periodCount - 1 - i) * windowDays * dayMs;
    const start = isoDay(endTime - (windowDays - 1) * dayMs),
      end = isoDay(endTime);
    const releaseCovered = release.start && start >= release.start && end <= release.through;
    const releaseEvents = releaseCovered ? release.events.filter((r) => r.date >= start && r.date <= end) : [];
    const releaseDays = releaseCovered ? releaseEvents.length : null;
    while (cursor < scores.rows.length && scores.rows[cursor].referenceOn < start) {
      const value = scores.rows[cursor++].value;
      best = best === null ? value : Math.max(best, value);
    }
    const prior = best;
    const scoreChanges = [];
    let count = 0;
    while (cursor < scores.rows.length && scores.rows[cursor].referenceOn <= end) {
      const date = scores.rows[cursor].referenceOn;
      const sameDate = [];
      while (cursor < scores.rows.length && scores.rows[cursor].referenceOn === date)
        sameDate.push(scores.rows[cursor++]);
      count += sameDate.length;
      const dayHigh = Math.max(...sameDate.map((r) => r.value));
      if (best !== null && dayHigh > best) {
        scoreChanges.push({
          date,
          from: best,
          to: dayHigh,
          gain: round(dayHigh - best),
          models: sameDate
            .filter((r) => r.value === dayHigh)
            .map((r) => r.system)
            .sort(),
        });
      }
      best = best === null ? dayHigh : Math.max(best, dayHigh);
    }
    const scoreCovered = scores.start && start >= scores.start && end <= scores.through;
    periods.push({
      start,
      end,
      releaseDays,
      releaseEvents,
      scoredModels: scoreCovered ? count : null,
      scoreChanges: scoreCovered ? scoreChanges : [],
      frontierGain: scoreCovered && prior !== null ? round(best - prior) : null,
    });
  }
  return {
    version: '1.0.0',
    asOf,
    windowDays,
    periods,
    activityFit: fitActivity(periods, 'releaseDays'),
    scoredReleaseFit: fitActivity(periods, 'scoredModels'),
    coverage: {
      releaseStart: release.start,
      releaseThrough: release.through,
      publishers: [...publishers],
      publisherSourceUrls: [
        'https://openai.com/news/',
        'https://platform.claude.com/docs/en/release-notes/overview',
      ],
      scoreStart: scores.start,
      scoreThrough: scores.through,
      scoreSource: 'Epoch AI',
      scoreDatasetUrl: 'https://epoch.ai/data/eci_scores.csv',
    },
    impacts: documentedImpacts(assessment, cutoff),
    method:
      'Twelve completed 30-day UTC windows end yesterday. Each tracked publisher counts once on a day with a qualifying model release. Scored releases count distinct model versions in the edition’s Epoch dataset. Benchmark gains are changes in its highest score, reconstructed by release date. Close benchmark differences can fall within score uncertainty. Zero means the covered source recorded no change. Gaps indicate incomplete coverage. Each activity trend is compared with flat and linear predictions on four later windows. A supported exponential fit must retain its lead when any one test window is omitted and have a 95% model-based interval excluding zero growth.',
  };
}
