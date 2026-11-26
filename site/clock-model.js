// A plain-language reading of the published assessment for the visual front page.
// Everything here is a pure function of the feed and a clock value, so the same
// code runs in the browser and under node --test. The trend and its tested lead
// time come from the pace model. This file only translates them into rungs,
// sentences and chart coordinates.
import {selectOutlook} from './observatory-acceleration.js';
import {fitPace, taskPace} from './observatory-pace-fit.js';
import {chronologicalMilestones} from './observatory-display.js';

const dayMs = 86400000;
const yearMs = 365.25 * dayMs;
const monthDays = 30.4375;

// Task lengths a reader already knows. A work month is a twelfth of a work year.
export const rungs = Object.freeze([
  {hours: 0.1, name: 'A few minutes'},
  {hours: 1, name: 'An hour'},
  {hours: 8, name: 'A work day'},
  {hours: 40, name: 'A work week'},
  {hours: 167, name: 'A work month'},
  {hours: 2000, name: 'A work year'},
  {hours: 20000, name: 'A decade of work'},
  {hours: 80000, name: 'A whole career'},
]);

const whole = new Intl.NumberFormat('en-US', {maximumFractionDigits: 0});
const tenth = new Intl.NumberFormat('en-US', {maximumFractionDigits: 1});
const halves = value => tenth.format(Math.round(value * 2) / 2);
const counts = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const count = value => counts[value] ?? String(value);

// The length of a task as it would be said aloud in a sentence.
export function spanPhrase(hours) {
  if (!(hours > 0)) return 'an unknown length';
  if (hours < 50 / 60) return whole.format(Math.max(1, Math.round(hours * 60))) + ' minutes';
  if (hours < 1.5) return 'about an hour';
  if (hours < 7) return whole.format(hours) + ' hours';
  if (hours < 10) return 'a full work day';
  if (hours < 34) return halves(hours / 8) + ' work days';
  if (hours < 48) return 'a full work week';
  if (hours < 140) return halves(hours / 40) + ' work weeks';
  if (hours < 200) return 'a full work month';
  if (hours < 1700) return whole.format(hours / 167) + ' work months';
  if (hours < 2400) return 'a full work year';
  return halves(hours / 2000) + ' work years';
}

// The same length as a headline names it. A length that fills a familiar unit
// can carry the unit's name, as in "a 40-hour work week".
export function taskPhrase(hours, named = false) {
  if (!(hours > 0)) return 'tasks of unknown length';
  if (hours < 50 / 60) return whole.format(Math.max(1, Math.round(hours * 60))) + '-minute tasks';
  if (hours < 1.5) return 'one-hour tasks';
  const size = whole.format(hours);
  const unit = hours >= 7 && hours < 10 ? 'day' : hours >= 34 && hours < 48 ? 'week'
    : hours >= 140 && hours < 200 ? 'month' : hours >= 1700 && hours < 2400 ? 'year' : null;
  return named && unit ? (size === '8' ? 'an ' : 'a ') + size + '-hour work ' + unit : size + '-hour tasks';
}

// The same length as a chart label.
export function plainHours(hours) {
  if (!(hours > 0)) return 'unknown';
  if (hours < 0.95) return whole.format(Math.max(1, Math.round(hours * 60))) + ' minutes';
  if (hours < 1.05) return '1 hour';
  if (hours < 9.95) return tenth.format(hours) + ' hours';
  return whole.format(hours) + ' hours';
}

const utc = {timeZone: 'UTC'};
const monthShort = new Intl.DateTimeFormat('en-US', {...utc, month: 'short', year: 'numeric'});
const monthLong = new Intl.DateTimeFormat('en-US', {...utc, month: 'long', year: 'numeric'});
const monthOnly = new Intl.DateTimeFormat('en-US', {...utc, month: 'short'});
const dayShort = new Intl.DateTimeFormat('en-US', {...utc, month: 'short', day: 'numeric', year: 'numeric'});

export const monthYear = time => monthShort.format(time);
export const longMonthYear = time => monthLong.format(time);
export const dayMonthYear = time => dayShort.format(time);

// A projected date is only as precise as the trend behind it. Name the month
// when it is close and the part of the year when it is far.
export function approxWhen(time, now) {
  if (time - now < 18 * monthDays * dayMs) return monthShort.format(time);
  const date = new Date(time);
  return ['early ', 'mid-', 'late '][Math.floor(date.getUTCMonth() / 4)] + date.getUTCFullYear();
}

export function rangeWhen(earliest, latest) {
  const sameYear = new Date(earliest).getUTCFullYear() === new Date(latest).getUTCFullYear();
  return (sameYear ? monthOnly : monthShort).format(earliest) + ' to ' + monthShort.format(latest);
}

// The distance to a forecast year, the way it would be said from the back seat.
export function yearsAway(year, nowYear) {
  if (!Number.isInteger(year) || !Number.isInteger(nowYear)) return null;
  const gap = year - nowYear;
  if (gap <= 0) return 'this year';
  return gap === 1 ? 'next year' : 'about ' + gap + ' years away';
}

function readSeries(assessment, outlook) {
  const published = outlook?.pace?.series?.find(row => row.id === 'horizon50');
  if (published?.points?.length) return published;
  try { return taskPace(assessment).series.find(row => row.id === 'horizon50') ?? null; }
  catch { return null; }
}

function highest(points) {
  return points.reduce((top, point) => point.hours >= top.hours ? point : top);
}

function buildLadder(series, now) {
  const source = (series?.points ?? []).filter(point =>
    Number.isFinite(Date.parse(point?.date)) && Number.isFinite(point.value) && point.value > 0);
  if (source.length < 2) return null;
  const points = source.map(point => ({time: Date.parse(point.date), hours: point.value, system: point.system || 'Unnamed system'}));
  let best = 0;
  for (const point of points) {
    point.record = point.hours > best;
    if (point.record) best = point.hours;
  }
  const first = points[0], last = points.at(-1), record = points.findLast(point => point.record);

  // Reuse the pace model's own fit so this page can never disagree with it.
  const models = fitPace(source);
  const model = models.selectedModel ?? models.illustrativeModel;
  const trend = model && model.slope > 0 ? {
    family: model.family,
    supported: Boolean(models.selectedModel),
    origin: Date.parse(model.lastDate),
    level: model.atLast,
    slope: model.slope,
    doublingDays: model.family === 'exponential' ? Math.LN2 / model.slope : null,
    testedUntil: models.selectedModel && Number.isFinite(models.fit.maxLeadDays)
      ? Date.parse(model.lastDate) + models.fit.maxLeadDays * dayMs : null,
  } : null;
  const hoursAt = (time, slope = trend.slope) => {
    const level = trend.level + slope * (time - trend.origin) / dayMs;
    return trend.family === 'exponential' ? Math.exp(level) : Math.max(0, level);
  };
  // Same origin, slope and intercept as the pace model's waypoint crossing.
  const crossing = (hours, slope = trend.slope) => {
    const days = ((trend.family === 'exponential' ? Math.log(hours) : hours) - trend.level) / slope;
    return days > 0 && days < 36525 ? trend.origin + Math.ceil(days) * dayMs : null;
  };
  const estimate = series.publishedEstimate;
  const band = trend?.family === 'exponential' && estimate?.lowMonths > 0 && estimate.highMonths > estimate.lowMonths ? {
    fast: Math.LN2 / (estimate.lowMonths * monthDays),
    slow: Math.LN2 / (estimate.highMonths * monthDays),
    interval: estimate.interval ?? null,
  } : null;

  const lowest = Math.min(...points.map(point => point.hours));
  const start = Math.max(0, rungs.findLastIndex(rung => rung.hours <= lowest));
  const open = rungs.findIndex(rung => rung.hours > record.hours);
  const end = open === -1 ? rungs.length : Math.min(rungs.length, open + 2);
  const stops = rungs.slice(start, end).map((rung, offset) => {
    const index = start + offset;
    if (open === -1 || index < open) {
      const reached = points.find(point => point.hours >= rung.hours);
      return {...rung, status: 'reached', reached: {time: reached.time, system: reached.system}};
    }
    const when = trend ? crossing(rung.hours) : null;
    return {
      ...rung, status: index === open ? 'next' : 'ahead', when,
      earliest: band ? crossing(rung.hours, band.fast) : null,
      latest: band ? crossing(rung.hours, band.slow) : null,
      // The trend already sits above this rung although no measurement has reached it.
      // A date that has passed is never repeated as a forecast.
      due: Boolean(trend) && hoursAt(now) >= rung.hours,
      tested: when !== null && trend.testedUntil !== null && when <= trend.testedUntil,
    };
  });

  const top = stops.at(-1);
  const reach = Math.min(Math.max(top.when ?? now + 1.5 * yearMs, now + 0.5 * yearMs), now + 6 * yearMs);
  const next = stops.find(stop => stop.status === 'next');
  let summary = 'The longest task the best AI can finish on its own grew from ' + plainHours(first.hours) + ' in ' +
    monthLong.format(first.time) + ' to ' + plainHours(record.hours) + ' in ' + monthLong.format(record.time) + '.';
  if (next?.due) summary += ' The pace says ' + next.name.toLowerCase() + ' is due, and no measurement has reached it yet.';
  else if (next?.when) summary += ' If the pace holds, it reaches ' + next.name.toLowerCase() + ' around ' + approxWhen(next.when, now) + '.';

  return {
    points, first, last, record, stops, trend, band, summary,
    today: trend ? {time: now, hours: hoursAt(now)} : null,
    hoursAt: trend ? hoursAt : null,
    domain: {from: first.time - 45 * dayMs, reach, low: Math.min(stops[0].hours, lowest) / 2.4, high: top.hours * 2.4},
  };
}

// The headline over the first chart. It states what was measured and over how
// long. A record with nothing shorter behind it gets a plain statement of where
// things stand.
function buildLead(ladder) {
  const {points, record} = ladder;
  const earlier = points.filter(point => point.time <= record.time - yearMs);
  const prior = earlier.length ? highest(earlier) : points[0] === record ? null : points[0];
  if (!prior || taskPhrase(prior.hours) === taskPhrase(record.hours)) return {claim: 'The best AI can now take on ' + taskPhrase(record.hours, true) + '.'};
  const months = Math.max(1, Math.round((record.time - prior.time) / (monthDays * dayMs)));
  return {
    claim: 'AI went from ' + taskPhrase(prior.hours) + ' to ' + taskPhrase(record.hours, true) + ' in ' +
      (earlier.length ? 'a year' : count(months) + (months === 1 ? ' month' : ' months')) + '.',
  };
}

function buildPace(ladder) {
  const {points, record, trend} = ladder;
  const before = years => {
    const pool = points.filter(point => point.time <= record.time - years * yearMs);
    return pool.length ? highest(pool) : null;
  };
  const moments = [...new Set([before(2) ?? points[0], before(1), record].filter(Boolean))].map(point => ({
    system: point.system, when: monthShort.format(point.time), text: plainHours(point.hours), share: point.hours / record.hours,
  }));
  if (!Number.isFinite(trend?.doublingDays)) return {answer: null, detail: null, moments};
  const perYear = 2 ** (365.25 / trend.doublingDays);
  const held = (points.at(-1).time - points[0].time) / yearMs;
  const span = held >= 2 ? 'more than ' + count(Math.floor(held)) + ' years' : held >= 1 ? 'more than a year'
    : count(Math.max(1, Math.round(held * 12))) + ' months';
  return {
    doublingDays: Math.round(trend.doublingDays),
    answer: 'Task length doubles about every ' + whole.format(trend.doublingDays) + ' days.',
    detail: 'That is roughly ' + (perYear >= 9.5 ? whole : tenth).format(perYear) + ' times longer every year' + (trend.supported
      ? ', and the pace has held for ' + span + '.'
      : '. Later results have yet to confirm that the pace is steady.'),
    moments,
  };
}

// What doubling does, one press at a time: where the pace points today, then
// twice that, and twice again. Offered only when the pace model supports the rule.
function buildDoubling(ladder, now) {
  const {trend, today} = ladder;
  if (!trend?.supported || !Number.isFinite(trend.doublingDays) || !(today?.hours > 0)) return null;
  return {
    days: Math.round(trend.doublingDays),
    steps: Array.from({length: 7}, (_, n) => {
      const time = now + n * trend.doublingDays * dayMs, hours = today.hours * 2 ** n;
      return {time, hours, text: spanPhrase(hours), squares: 2 ** n, tested: trend.testedUntil !== null && time <= trend.testedUntil};
    }),
  };
}

const plainStops = {
  rsi: {name: 'AI that improves itself', term: 'recursive self-improvement'},
  agi: {name: 'AI as able as a skilled person', term: 'artificial general intelligence'},
  singularity: {name: 'Progress speeds up everywhere', term: 'the singularity'},
  asi: {name: 'AI beyond the best experts', term: 'superintelligence'},
};

// The published scenarios, under names a reader can choose between.
export const futures = Object.freeze([
  {id: 'faster', name: 'Fastest case', match: /^faster/i},
  {id: 'speedup', name: 'Recent acceleration continues', match: /acceleration/i},
  {id: 'reference', name: 'Reference scenario', match: /^reference/i},
  {id: 'slower', name: 'Slowest case', match: /^slower/i},
  {id: 'never', name: 'It never comes', match: /never|stalled/i},
]);

// What must be shown before a moment counts as reached, in plain words.
const plainNeeds = {
  'agi-breadth': 'Matches a skilled person across many kinds of work',
  'agi-transfer': 'Handles kinds of task it has never seen',
  'agi-reliability': 'Does it again when independent testers repeat the test',
  'rsi-contribution': 'An AI measurably improves its own successor',
  'rsi-repeat': 'That successor improves the next one too',
  'asi-experts': 'Beats the best human experts in every field tested',
  'singularity-feedback': 'Each generation of AI speeds up the research behind the next',
  'singularity-acceleration': 'The pace of AI progress rises twice in a row',
  'singularity-transition': 'Technology as a whole starts advancing faster than before',
};

function buildStops(outlook, assessment) {
  const year = value => Number.isInteger(value) ? value : null;
  const paceRows = outlook?.pace?.milestones ?? [];
  return chronologicalMilestones(outlook?.milestones ?? [], outlook, assessment.forecasts ?? []).map(row => {
    const reference = year(row.centralYear);
    const speed = year(paceRows.find(item => item.id === row.id)?.accelerationYear) ??
      year(row.scenarios?.find(scenario => /acceleration/i.test(scenario.label ?? ''))?.year);
    const paths = Object.fromEntries(futures.flatMap(future => {
      const scenario = row.scenarios?.find(item => future.match.test(item.label ?? ''));
      return scenario ? [[future.id, year(scenario.year)]] : [];
    }));
    if (reference !== null) paths.reference = reference;
    const needs = (assessment.milestones?.find(item => item.id === row.id)?.criteria ?? []).map(need => ({
      id: need.id, text: plainNeeds[need.id] ?? need.label ?? need.id, met: /^(met|confirmed|observed)$/i.test(need.status ?? ''),
    }));
    return {
      id: row.id,
      name: plainStops[row.id]?.name ?? row.label ?? row.id,
      term: plainStops[row.id]?.term ?? null,
      reference,
      // A second marker earns its place only when the faster path gives another year.
      pace: speed !== null && speed !== reference ? speed : null,
      low: year(row.range?.low), high: year(row.range?.high),
      never: row.beyondHorizonPathCount > 0,
      observed: row.status === 'Observed',
      paths, needs,
      sign: typeof row.progress?.summary === 'string' ? row.progress.summary : null,
    };
  });
}

// Every scored model as one dot: when it came out and how it did on Epoch's
// combined index. The three labs that have traded the lead keep a colour each.
export const namedLabs = Object.freeze(['OpenAI', 'Anthropic', 'Google']);
const labAliases = {'Google DeepMind': 'Google', 'Meta AI': 'Meta', 'Mistral AI': 'Mistral', 'Microsoft Research': 'Microsoft', 'Z.ai (Zhipu AI)': 'Zhipu AI'};
const labName = organization => {
  const first = String(organization ?? '').split(',')[0].trim();
  return labAliases[first] ?? (first || null);
};

function buildField(assessment, now) {
  const rows = (assessment.observations ?? []).filter(row =>
    row.topic === 'breadth' && Number.isFinite(row.value) && Number.isFinite(Date.parse(row.referenceOn)));
  if (rows.length < 12) return null;
  const points = rows.map(row => ({
    time: Date.parse(row.referenceOn), score: row.value, system: row.system || 'Unnamed model',
    lab: labName(row.organization), open: row.weightAccess === 'Open weights', lead: false,
  })).sort((a, b) => a.time - b.time || a.score - b.score);
  const frontier = [];
  for (const point of points) {
    if (frontier.length && point.score <= frontier.at(-1).score) continue;
    point.lead = true;
    frontier.push(point);
  }
  const tally = new Map();
  for (const point of points) if (point.lab) tally.set(point.lab, (tally.get(point.lab) ?? 0) + 1);
  const labs = [...tally].map(([name, models]) => ({name, models})).sort((a, b) => b.models - a.models || a.name.localeCompare(b.name));
  const lately = frontier.filter(point => point.time >= now - yearMs);
  const scores = points.map(point => point.score), low = Math.min(...scores), high = Math.max(...scores);
  const source = rows.find(row => typeof row.sourceUrl === 'string');
  const often = lately.length === 1 ? 'once' : lately.length === 2 ? 'twice' : count(lately.length) + ' times';
  return {
    points, frontier, labs, leader: frontier.at(-1),
    answer: labs.length + ' labs. ' + (lately.length ? 'Models set a new top score ' + often + ' in a year.' : 'No model has set a new top score in a year.'),
    records: lately.length,
    // How often the top score passed from one lab to another in the past year.
    handovers: lately.filter(point => frontier[frontier.indexOf(point) - 1]?.lab !== point.lab && frontier.indexOf(point) > 0).length,
    domain: {from: points[0].time - 40 * dayMs, to: Math.max(now, points.at(-1).time) + 40 * dayMs, low: low - (high - low) * 0.06, high: high + (high - low) * 0.1},
    source: {name: source?.source ?? 'Epoch AI', url: safeLink(source?.sourceUrl)},
  };
}

const sourceName = text => String(text ?? '').replaceAll(' · ', ', ');
const safeLink = url => { try { return new URL(url).protocol === 'https:' ? url : null; } catch { return null; } };

// Sentences for the workplace measurements already carried in the pace material.
// Each keeps the study's own number and states it per hundred.
const effects = {
  'service-issues-resolved': impact => Number.isFinite(impact.value) && impact.value > 0 && {
    say: ['Support agents with an AI helper resolved ', whole.format(impact.value) + '% more', ' customer issues an hour.'],
    unit: 'resolved in the same hours',
    rows: [{label: 'Without AI', value: 100, text: '100 issues'},
      {label: 'With AI', value: 100 + impact.value, text: whole.format(100 + impact.value) + ' issues'}],
  },
  'developer-completion-time': impact => Number.isFinite(impact.value) && impact.value > 0 && {
    say: ['Experienced programmers took ', whole.format(impact.value) + '% longer', ' to finish tasks with early-2025 AI tools.'],
    unit: 'to finish the same work',
    rows: [{label: 'Without AI', value: 100, text: '100 minutes'},
      {label: 'With AI', value: 100 + impact.value, text: whole.format(100 + impact.value) + ' minutes'}],
  },
  'openai-unassisted-tasks': impact => {
    const from = Date.parse(impact.fromDate), to = Date.parse(impact.toDate);
    if (!(impact.fromValue > 0 && impact.toValue > 0 && to > from)) return false;
    const months = Math.max(1, Math.round((to - from) / (monthDays * dayMs)));
    return {
      say: ['At one AI lab, AI now finishes ', whole.format(impact.toValue) + ' in 100', ' research tasks on its own, up from ' +
        whole.format(impact.fromValue) + ' ' + count(months) + (months === 1 ? ' month' : ' months') + ' earlier.'],
      unit: 'research tasks finished without help',
      rows: [{label: monthLong.format(from), value: impact.fromValue, text: whole.format(impact.fromValue) + ' in 100'},
        {label: monthLong.format(to), value: impact.toValue, text: whole.format(impact.toValue) + ' in 100'}],
    };
  },
};

function buildWork(outlook) {
  const impacts = outlook?.pace?.eventPace?.impacts ?? [];
  return Object.entries(effects).flatMap(([id, describe]) => {
    const impact = impacts.find(row => row.id === id);
    const view = impact && describe(impact);
    if (!view) return [];
    const peak = Math.max(...view.rows.map(row => row.value));
    return [{
      id, say: view.say, unit: view.unit, rows: view.rows.map(row => ({...row, share: row.value / peak})),
      source: sourceName(impact.source), url: safeLink(impact.sourceUrl),
      year: /^\d{4}/.test(impact.publishedOn ?? '') ? impact.publishedOn.slice(0, 4) : null,
      scope: impact.scope ?? null,
    }];
  });
}

// ---------------------------------------------------------------------------
// What if? A thought experiment, kept apart from the published forecast.
// Rule one: computing power grows only as fast as its scarcest ingredient.
// Rule two: progress blends computing power with better methods. Ho and
// colleagues attribute 60–95% of language-model gains to scale and the rest to
// methods. Three quarters is the rounded midpoint. Whitfill, Snodin and Becker
// find task length has grown in step with computing power.
export const computeShare = 0.75;
const growth = Object.freeze([
  {value: 0, label: 'Stops'}, {value: 0.5, label: 'Half pace'}, {value: 1, label: 'Today’s pace'},
  {value: 1.5, label: 'Faster'}, {value: 2, label: 'Twice as fast'},
]);
export const dials = Object.freeze([
  {id: 'build', part: 'compute', name: 'Data centres', about: 'The buildings that hold the computers. A big one takes about two years to put up.', stops: growth, start: 2},
  {id: 'chips', part: 'compute', name: 'Chips and minerals', about: 'Rare minerals such as gallium and germanium go into the chips. Copper goes into the wiring.', stops: growth, start: 2},
  {id: 'money', part: 'compute', name: 'Money', about: 'Each gigawatt-size site costs tens of billions of dollars.', stops: growth, start: 2},
  {id: 'power', part: 'compute', name: 'Electricity', about: 'A large site draws as much power as a city.', stops: growth, start: 2},
  {id: 'ideas', part: 'methods', name: 'New ideas', about: 'Smarter methods get more out of the same computers.', stops: growth, start: 2},
  {id: 'self', part: 'methods', name: 'AI doing AI research', about: 'AI helping to design its own successors.', start: 0,
    stops: Object.freeze([{value: 1, label: 'As much as now'}, {value: 2, label: 'Twice as much'}, {value: 4, label: 'Four times as much'}])},
  {id: 'pause', part: 'rules', name: 'A pause on bigger AI', about: 'Governments or labs agree to stop scaling up for a while.', start: 0,
    stops: Object.freeze([{value: 0, label: 'None'}, {value: 1, label: '1 year'}, {value: 2, label: '2 years'}, {value: 5, label: '5 years'}])},
]);

// Each question moves the dials it names and leaves the rest on today's course.
// The first few are shown outright: one that slows things, one that speeds them
// up and one that stops the clock for a while. The rest wait behind a disclosure.
export const whatIfShown = 3;
export const whatIfQuestions = Object.freeze([
  {id: 'fewer-minerals', ask: 'fewer rare minerals are mined?', set: {chips: 1}},
  {id: 'double-build', ask: 'data centres go up twice as fast?', set: {build: 4, chips: 4, money: 4, power: 4}},
  {id: 'pause', ask: 'governments pause it for two years?', set: {pause: 2}},
  {id: 'more-minerals', ask: 'more rare minerals are mined?', set: {chips: 4}},
  {id: 'no-build', ask: 'data centres stop going up?', set: {build: 0}},
  {id: 'factories', ask: 'the main chip factories go offline?', set: {chips: 0}},
  {id: 'grid', ask: 'the power grid can’t keep up?', set: {power: 1}},
  {id: 'clean-power', ask: 'cheap clean power arrives?', set: {power: 4}},
  {id: 'bust', ask: 'the money dries up?', set: {money: 0}},
  {id: 'boom', ask: 'investors double their bets?', set: {money: 4}},
  {id: 'self', ask: 'AI starts doing its own research?', set: {self: 2}},
  {id: 'dry', ask: 'the new ideas run out?', set: {ideas: 0}},
  {id: 'long-pause', ask: 'an accident brings a five-year halt?', set: {pause: 3}},
  {id: 'all', ask: 'everything speeds up at once?', set: {build: 4, chips: 4, money: 4, power: 4, ideas: 4, self: 2}},
]);

export const whatIfStart = () => Object.fromEntries(dials.map(dial => [dial.id, dial.start]));

export function readWhatIf(state = {}) {
  const index = dial => Number.isInteger(state[dial.id]) ? Math.min(dial.stops.length - 1, Math.max(0, state[dial.id])) : dial.start;
  const at = Object.fromEntries(dials.map(dial => [dial.id, dial.stops[index(dial)].value]));
  const parts = dials.filter(dial => dial.part === 'compute');
  const compute = Math.min(...parts.map(dial => at[dial.id]));
  const best = Math.max(...parts.map(dial => at[dial.id]));
  const methods = at.ideas * at.self;
  return {
    compute, methods, pauseYears: at.pause,
    speed: computeShare * compute + (1 - computeShare) * methods,
    // Named only when one ingredient really is holding the others back.
    limitedBy: compute < best ? parts.filter(dial => at[dial.id] === compute).map(dial => dial.id) : [],
    changed: dials.some(dial => index(dial) !== dial.start),
  };
}

// Time still to go stretches or shrinks with the speed, then the pause is added.
export function whatIfTime(time, now, reading) {
  if (!Number.isFinite(time) || !(reading.speed > 0)) return null;
  return now + (time - now) / reading.speed + reading.pauseYears * yearMs;
}

// A forecast year uses July 1 as its reference, as the watch's own clock does.
export function whatIfYear(year, now, reading) {
  if (!Number.isInteger(year)) return null;
  const time = whatIfTime(Date.UTC(year, 6, 1), now, reading);
  return time === null ? null : new Date(time).getUTCFullYear();
}

const list = names => names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names.at(-1);
const multiple = value => value === 0.5 ? 'half' : value === 1.5 ? 'one and a half times' : value === 2 ? 'twice' : tenth.format(value) + ' times';

export function whatIfSentences(reading) {
  const lines = [], held = reading.limitedBy.map(id => dials.find(dial => dial.id === id).name.toLowerCase());
  const because = held.length ? ', held back by ' + list(held) : '';
  if (reading.compute === 0) lines.push('Computing power stops growing' + because + '.');
  else if (reading.compute === 1) { if (held.length) lines.push('Computing power still grows at today’s pace' + because + '.'); }
  else lines.push('Computing power grows ' + (reading.compute === 0.5 ? 'at half today’s pace' : multiple(reading.compute) + ' as fast as today') + because + '.');
  if (reading.methods === 0) lines.push('No new methods arrive.');
  else if (reading.methods !== 1) lines.push('Better methods arrive at ' + multiple(reading.methods) + ' today’s rate.');
  if (!(reading.speed > 0)) lines.push('Progress stops. On this road there is no arrival.');
  else if (reading.speed === 1) lines.push(reading.changed && !reading.pauseYears ? 'Overall the speed is unchanged.' : reading.changed ? 'The speed is unchanged.' : 'This is today’s course.');
  else lines.push('Overall, progress runs at ' + whole.format(reading.speed * 100) + '% of today’s speed.');
  if (reading.pauseYears && reading.speed > 0) lines.push('The pause pushes every date back by ' + (reading.pauseYears === 1 ? 'a year' : count(reading.pauseYears) + ' years') + '.');
  return lines;
}

// How far a what-if date has moved from the published one, in words.
export function shiftPhrase(base, moved) {
  if (moved === null) return 'never, on this road';
  const months = Math.round((moved - base) / (monthDays * dayMs)), size = Math.abs(months);
  if (size < 1) return 'no change';
  const span = size < 18 ? size + (size === 1 ? ' month' : ' months') : whole.format(size / 12) + ' years';
  return span + (months > 0 ? ' later' : ' sooner');
}

// Everything the what-if panel shows, from the published view and the dial positions.
export function whatIfView(view, state, now) {
  const reading = readWhatIf(state), ladder = view.ladder;
  const rung = ladder?.stops.find(stop => stop.status !== 'reached' && stop.when > now && !stop.due) ?? null;
  const arrival = view.arrival?.reference ?? null;
  const moved = rung ? whatIfTime(rung.when, now, reading) : null;
  const year = arrival === null ? null : whatIfYear(arrival, now, reading);
  return {
    reading, sentences: whatIfSentences(reading),
    doublingDays: view.pace?.doublingDays && reading.speed > 0 ? Math.round(view.pace.doublingDays / reading.speed) : null,
    next: rung && {name: rung.name, base: rung.when, when: moved, shift: shiftPhrase(rung.when, moved)},
    arrival: arrival !== null ? {
      base: arrival, year, beyond: year !== null && year > view.horizonYear,
      shift: year === null ? 'never, on this road' : year === arrival ? 'no change'
        : Math.abs(year - arrival) + (Math.abs(year - arrival) === 1 ? ' year ' : ' years ') + (year > arrival ? 'later' : 'sooner'),
    } : null,
  };
}

// What the page opens with: the published reference year for the singularity,
// and beneath it the year the faster path gives. The two answer different
// questions, so only the reference is the headline.
function buildForecast(arrival, arrived, horizonYear, nowYear) {
  if (!arrival || arrived || (arrival.reference === null && arrival.pace === null && arrival.low === null)) return null;
  return {
    stop: arrival.id,
    year: arrival.reference,
    text: arrival.reference !== null ? String(arrival.reference) : 'After ' + horizonYear,
    away: yearsAway(arrival.reference, nowYear),
    faster: arrival.pace !== null ? {year: arrival.pace, text: String(arrival.pace)} : null,
  };
}

export function buildClock(feed, now = Date.now()) {
  const assessment = feed?.assessment;
  if (!assessment) throw new Error('The published assessment is missing.');
  const {outlook} = selectOutlook(assessment, feed);
  const ladder = buildLadder(readSeries(assessment, outlook), now);
  const stops = buildStops(outlook, assessment);
  const arrival = stops.find(stop => stop.id === 'singularity') ?? null;
  const horizonYear = Number.isInteger(outlook?.horizonYear) ? outlook.horizonYear : 2100;
  const nowYear = new Date(now).getUTCFullYear();
  const arrived = Boolean(arrival?.observed) ||
    (assessment.forecasts ?? []).some(row => row.id === 'singularity' && row.status === 'Observed');
  return {
    arrived,
    forecast: buildForecast(arrival, arrived, horizonYear, nowYear),
    edition: Number.isFinite(Date.parse(assessment.checkpointAt)) ? assessment.checkpointAt : null,
    lead: ladder ? buildLead(ladder) : null,
    ladder,
    pace: ladder ? buildPace(ladder) : null,
    doubling: ladder ? buildDoubling(ladder, now) : null,
    arrival, stops, horizonYear, nowYear,
    work: buildWork(outlook),
    field: buildField(assessment, now),
  };
}
