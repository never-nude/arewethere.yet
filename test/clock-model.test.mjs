import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {ladderRows} from '../site/clock-charts.js';
import {approxWhen, buildClock, plainHours, rangeWhen, spanPhrase, yearsAway} from '../site/clock-model.js';
import {fitPace} from '../site/observatory-pace-fit.js';

// The frozen first pace bulletin is the same material the front page drew on
// when /clock was built, so these readings never depend on the day the suite runs.
const bulletin = JSON.parse(await readFile(new URL('../site/data/first-pace-outlook.json', import.meta.url), 'utf8'));
const checkpointAt = bulletin.basedOnCheckpoint;
const now = Date.parse('2026-11-25T21:00:00Z');
const feed = {
  assessment: {checkpointAt, forecasts: [], observations: [], arrivalOutlook: null},
  currentRecord: {checkpointAt, sha256: bulletin.basedOnSha256},
  supplementalPaceOutlook: bulletin,
};
const month = time => new Date(time).toISOString().slice(0, 7);

test('job lengths read as a person would say them', () => {
  assert.equal(spanPhrase(0.1185), '7 minutes');
  assert.equal(spanPhrase(1.2), 'about an hour');
  assert.equal(spanPhrase(3.009), '3 hours');
  assert.equal(spanPhrase(8.4), 'a full work day');
  assert.equal(spanPhrase(19.9), '2.5 work days');
  assert.equal(spanPhrase(40.27), 'a full work week');
  assert.equal(spanPhrase(100), '2.5 work weeks');
  assert.equal(spanPhrase(167), 'a full work month');
  assert.equal(spanPhrase(1000), '6 work months');
  assert.equal(spanPhrase(2000), 'a full work year');
  assert.equal(spanPhrase(5000), '2.5 work years');
  assert.equal(plainHours(0.5875), '35 minutes');
  assert.equal(plainHours(1), '1 hour');
  assert.equal(plainHours(4.58955), '4.6 hours');
  assert.equal(plainHours(40.27), '40 hours');
  assert.equal(plainHours(2000), '2,000 hours');
});

test('a projected date names a month when near and a part of the year when far', () => {
  assert.equal(approxWhen(Date.parse('2027-06-23'), now), 'Jun 2027');
  assert.equal(approxWhen(Date.parse('2028-07-23'), now), 'mid-2028');
  assert.equal(approxWhen(Date.parse('2029-02-03'), now), 'early 2029');
  assert.equal(approxWhen(Date.parse('2029-11-03'), now), 'late 2029');
  assert.equal(rangeWhen(Date.parse('2027-02-18'), Date.parse('2027-10-06')), 'Feb to Oct 2027');
  assert.equal(rangeWhen(Date.parse('2027-10-03'), Date.parse('2029-03-28')), 'Oct 2027 to Mar 2029');
  assert.equal(yearsAway(2045, 2026), 'about 19 years away');
  assert.equal(yearsAway(2027, 2026), 'next year');
  assert.equal(yearsAway(2026, 2026), 'this year');
  assert.equal(yearsAway(Infinity, 2026), null);
});

test('the ladder repeats the pace model’s own trend and tested lead', () => {
  const {ladder, lead, pace} = buildClock(feed, now);
  const series = bulletin.outlook.pace.series.find(row => row.id === 'horizon50');
  const {fit, selectedModel} = fitPace(series.points);
  assert.equal(ladder.points.length, series.points.length);
  assert.equal(ladder.record.system, 'GPT-6 Astra');
  assert.equal(ladder.trend.supported, true);
  assert.equal(ladder.trend.slope, selectedModel.slope);
  assert.equal(ladder.trend.testedUntil, Date.parse(selectedModel.lastDate) + fit.maxLeadDays * 86400000);
  assert.equal(pace.doublingDays, Math.round(fit.doublingDays));

  assert.deepEqual(ladder.stops.map(stop => [stop.name, stop.status]), [
    ['A few minutes', 'reached'], ['An hour', 'reached'], ['A work day', 'reached'], ['A work week', 'reached'],
    ['A work month', 'next'], ['A work year', 'ahead'],
  ]);
  const [workMonth, workYear] = ladder.stops.slice(-2);
  assert.equal(month(workMonth.when), '2027-06');
  assert.equal(month(workYear.when), '2028-07');
  // Both crossings lie past the lead time the later releases have tested.
  assert.equal(workMonth.tested, false);
  assert.equal(workMonth.due, false);
  assert.ok(workMonth.earliest < workMonth.when && workMonth.when < workMonth.latest);
  assert.ok(ladder.domain.reach >= workYear.when && ladder.domain.high > 2000 && ladder.domain.low < 0.1185);
  assert.match(ladder.summary, /grew from 7 minutes in May 2024 to 40 hours in September 2026\. If the pace holds, it reaches a work month around Jun 2027\./);

  assert.deepEqual(lead, {now: 'a full work week', then: '3 hours', when: 'A year earlier'});
  assert.equal(pace.answer, 'Job length doubles about every 111 days.');
  assert.equal(pace.detail, 'That is roughly 10 times longer every year, and the pace has held for more than two years.');
  assert.deepEqual(pace.moments.map(moment => [moment.system, moment.when, moment.text]), [
    ['GPT-4o', 'May 2024', '7 minutes'], ['GPT-5', 'Aug 2025', '3 hours'], ['GPT-6 Astra', 'Sep 2026', '40 hours'],
  ]);
  assert.equal(pace.moments.at(-1).share, 1);

  const rows = ladderRows(ladder, now);
  assert.equal(rows.length, series.points.length + 2);
  assert.deepEqual(rows[0], ['May 2024', 'GPT-4o', '7 minutes', 'Measured', '']);
  assert.deepEqual(rows.slice(-2), [
    ['Around Jun 2027', 'A work month', '167 hours', 'If the pace holds, beyond the tested range', 'Feb to Oct 2027'],
    ['Around mid-2028', 'A work year', '2,000 hours', 'If the pace holds, beyond the tested range', 'Oct 2027 to Mar 2029'],
  ]);
});

test('a crossing date that has passed is reported as due and never as a forecast', () => {
  // Nothing new is measured, and the calendar moves past the date the pace gave.
  const later = Date.parse('2027-08-01T12:00:00Z');
  const {ladder} = buildClock(feed, later);
  const [workMonth, workYear] = ladder.stops.slice(-2);
  assert.equal(workMonth.status, 'next');
  assert.equal(workMonth.due, true);
  assert.equal(workYear.due, false);
  assert.ok(ladder.today.hours > 167 && ladder.today.hours < 2000);
  assert.match(ladder.summary, /The pace says a work month is due, and no measurement has reached it yet\.$/);
  assert.doesNotMatch(ladder.summary, /Jun 2027/);
  assert.deepEqual(ladderRows(ladder, later).slice(-2), [
    ['Due any day', 'A work month', '167 hours', 'The pace says so. Not measured yet', ''],
    ['Around Jul 2028', 'A work year', '2,000 hours', 'If the pace holds, beyond the tested range', 'Oct 2027 to Mar 2029'],
  ]);
});

test('the stops keep both voices and their order in time', () => {
  const view = buildClock(feed, now);
  assert.equal(view.arrived, false);
  assert.equal(view.edition, checkpointAt);
  assert.deepEqual(view.stops.map(stop => [stop.id, stop.reference, stop.pace, stop.low, stop.high, stop.never]), [
    ['rsi', 2034, 2028, 2028, 2056, true], ['agi', 2046, 2028, 2027, 2065, true],
    ['singularity', 2062, 2045, 2029, 2095, true], ['asi', 2070, 2028, 2028, 2095, true],
  ]);
  assert.equal(view.arrival.id, 'singularity');
  assert.equal(view.horizonYear, 2100);
});

test('workplace studies keep their own numbers', () => {
  const {work} = buildClock(feed, now);
  assert.deepEqual(work.map(effect => effect.id), ['service-issues-resolved', 'developer-completion-time', 'openai-unassisted-tasks']);
  assert.equal(work[0].say.join(''), 'Support agents with an AI helper resolved 15% more customer issues an hour.');
  assert.deepEqual(work[1].rows.map(row => row.text), ['100 minutes', '119 minutes']);
  assert.equal(work[2].say.join(''), 'At one AI lab, AI now finishes 35 in 100 research tasks on its own, up from 13 seven months earlier.');
  for (const effect of work) {
    assert.match(effect.url, /^https:\/\//);
    assert.ok(effect.scope.length > 40);
    assert.equal(Math.max(...effect.rows.map(row => row.share)), 1);
  }
});

test('thin or missing evidence leaves gaps and never invents a forecast', () => {
  const empty = buildClock({assessment: {checkpointAt, forecasts: [], observations: []}, currentRecord: {checkpointAt}}, now);
  assert.equal(empty.ladder, null);
  assert.equal(empty.pace, null);
  assert.deepEqual(empty.stops, []);
  assert.deepEqual(empty.work, []);
  assert.throws(() => buildClock({}, now), /assessment is missing/);

  // Five release months cannot support a growth rule. The curve is an illustration only.
  const series = bulletin.outlook.pace.series.find(row => row.id === 'horizon50');
  const early = structuredClone(bulletin);
  early.outlook.pace.series = [{...series, points: series.points.slice(0, 5), publishedEstimate: undefined}];
  const view = buildClock({...feed, supplementalPaceOutlook: early}, now);
  assert.equal(view.ladder.trend.supported, false);
  assert.equal(view.ladder.trend.testedUntil, null);
  assert.equal(view.ladder.band, null);
  assert.ok(view.ladder.stops.filter(stop => stop.status !== 'reached').every(stop => stop.tested === false));
  assert.match(view.pace.detail, /yet to confirm/);

  const confirmed = structuredClone(bulletin);
  confirmed.outlook.milestones.find(row => row.id === 'singularity').status = 'Observed';
  assert.equal(buildClock({...feed, supplementalPaceOutlook: confirmed}, now).arrived, true);
});
