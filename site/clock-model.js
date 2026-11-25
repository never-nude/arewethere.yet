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

// Job lengths a reader already knows. A work month is a twelfth of a work year.
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

// The length of a job as it would be said aloud in a sentence.
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
  let summary = 'The longest job the best AI can finish on its own grew from ' + plainHours(first.hours) + ' in ' +
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

function buildLead(ladder) {
  const {points, record} = ladder;
  const earlier = points.filter(point => point.time <= record.time - yearMs);
  const prior = earlier.length ? highest(earlier) : points[0] === record ? null : points[0];
  return {
    now: spanPhrase(record.hours),
    then: prior ? spanPhrase(prior.hours) : null,
    when: earlier.length ? 'A year earlier' : prior ? 'In ' + monthLong.format(prior.time) : null,
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
    answer: 'Job length doubles about every ' + whole.format(trend.doublingDays) + ' days.',
    detail: 'That is roughly ' + (perYear >= 9.5 ? whole : tenth).format(perYear) + ' times longer every year' + (trend.supported
      ? ', and the pace has held for ' + span + '.'
      : '. Later results have yet to confirm that the pace is steady.'),
    moments,
  };
}

const plainStops = {
  rsi: {name: 'AI that improves itself', term: 'recursive self-improvement'},
  agi: {name: 'AI as able as a skilled person', term: 'artificial general intelligence'},
  singularity: {name: 'Progress speeds up everywhere', term: 'the singularity'},
  asi: {name: 'AI beyond the best experts', term: 'superintelligence'},
};

function buildStops(outlook, assessment) {
  const year = value => Number.isInteger(value) ? value : null;
  const paceRows = outlook?.pace?.milestones ?? [];
  return chronologicalMilestones(outlook?.milestones ?? [], outlook, assessment.forecasts ?? []).map(row => {
    const reference = year(row.centralYear);
    const speed = year(paceRows.find(item => item.id === row.id)?.accelerationYear) ??
      year(row.scenarios?.find(scenario => /acceleration/i.test(scenario.label ?? ''))?.year);
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
    };
  });
}

const sourceName = text => String(text ?? '').replaceAll(' · ', ', ');
const safeLink = url => { try { return new URL(url).protocol === 'https:' ? url : null; } catch { return null; } };

// Sentences for the workplace measurements already carried in the pace material.
// Each keeps the study's own number and states it per hundred.
const effects = {
  'service-issues-resolved': impact => Number.isFinite(impact.value) && impact.value > 0 && {
    say: ['Support agents with an AI helper resolved ', whole.format(impact.value) + '% more', ' customer issues an hour.'],
    rows: [{label: 'Without AI', value: 100, text: '100 issues'},
      {label: 'With AI', value: 100 + impact.value, text: whole.format(100 + impact.value) + ' issues'}],
  },
  'developer-completion-time': impact => Number.isFinite(impact.value) && impact.value > 0 && {
    say: ['Experienced programmers took ', whole.format(impact.value) + '% longer', ' to finish tasks with early-2025 AI tools.'],
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
      id, say: view.say, rows: view.rows.map(row => ({...row, share: row.value / peak})),
      source: sourceName(impact.source), url: safeLink(impact.sourceUrl),
      year: /^\d{4}/.test(impact.publishedOn ?? '') ? impact.publishedOn.slice(0, 4) : null,
      scope: impact.scope ?? null,
    }];
  });
}

export function buildClock(feed, now = Date.now()) {
  const assessment = feed?.assessment;
  if (!assessment) throw new Error('The published assessment is missing.');
  const {outlook} = selectOutlook(assessment, feed);
  const ladder = buildLadder(readSeries(assessment, outlook), now);
  const stops = buildStops(outlook, assessment);
  const arrival = stops.find(stop => stop.id === 'singularity') ?? null;
  const horizonYear = Number.isInteger(outlook?.horizonYear) ? outlook.horizonYear : 2100;
  return {
    arrived: Boolean(arrival?.observed) ||
      (assessment.forecasts ?? []).some(row => row.id === 'singularity' && row.status === 'Observed'),
    edition: Number.isFinite(Date.parse(assessment.checkpointAt)) ? assessment.checkpointAt : null,
    lead: ladder ? buildLead(ladder) : null,
    ladder,
    pace: ladder ? buildPace(ladder) : null,
    arrival, stops, horizonYear,
    nowYear: new Date(now).getUTCFullYear(),
    work: buildWork(outlook),
  };
}
