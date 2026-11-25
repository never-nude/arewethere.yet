import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {ladderRows} from '../site/clock-charts.js';
import {
  approxWhen, buildClock, computeShare, dials, futures, namedLabs, plainHours, rangeWhen, readWhatIf, shiftPhrase, spanPhrase,
  whatIfQuestions, whatIfStart, whatIfTime, whatIfView, whatIfYear, yearsAway,
} from '../site/clock-model.js';
import {gaugeShare, gaugeTop} from '../site/clock-visuals.js';
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
  // Every published scenario is a future a reader can pick, in the same order of time.
  assert.deepEqual(futures.map(item => item.id), ['faster', 'speedup', 'reference', 'slower', 'never']);
  assert.deepEqual(view.arrival.paths, {faster: 2029, speedup: 2045, reference: 2062, slower: 2095, never: null});
  assert.deepEqual(view.stops[0].paths, {faster: 2028, speedup: 2028, reference: 2034, slower: 2056, never: null});
  for (const stop of view.stops) {
    assert.equal(stop.paths.reference, stop.reference);
    assert.ok(stop.paths.faster <= stop.paths.reference && stop.paths.reference <= stop.paths.slower, stop.id);
    assert.equal(typeof stop.sign, 'string');
  }
});

test('requirements are counted from the assessment and never assumed met', () => {
  const criteria = [
    {id: 'rsi-contribution', label: 'A material contribution to a successor', status: 'met'},
    {id: 'rsi-repeat', label: 'Repeated improvement by successors', status: 'unknown'},
    {id: 'rsi-new', label: 'A requirement added later', status: 'not met'},
  ];
  const withNeeds = {...feed, assessment: {...feed.assessment, milestones: [{id: 'rsi', criteria}]}};
  const stop = buildClock(withNeeds, now).stops.find(item => item.id === 'rsi');
  assert.deepEqual(stop.needs, [
    {id: 'rsi-contribution', text: 'An AI measurably improves its own successor', met: true},
    {id: 'rsi-repeat', text: 'That successor improves the next one too', met: false},
    {id: 'rsi-new', text: 'A requirement added later', met: false},
  ]);
  assert.deepEqual(buildClock(feed, now).stops[0].needs, []);
});

test('the field counts every scored model, the labs behind them and who has held the lead', () => {
  assert.equal(buildClock(feed, now).field, null);
  const model = (day, value, system, organization, weightAccess = 'Closed weights') =>
    ({topic: 'breadth', referenceOn: day, value, system, organization, weightAccess});
  const observations = [
    model('2025-01-10', 100, 'Alpha 1', 'OpenAI'), model('2025-02-01', 90, 'Open 1', 'Meta AI', 'Open weights'),
    model('2025-03-01', 104, 'Beta 1', 'Google DeepMind,Google'), model('2025-04-01', 103, 'Gamma 1', 'Anthropic'),
    model('2025-06-01', 110, 'Alpha 2', 'OpenAI'), model('2025-08-01', 96, 'Open 2', 'Meta AI', 'Open weights'),
    model('2025-12-15', 118, 'Gamma 2', 'Anthropic'), model('2026-02-01', 112, 'Beta 2', 'Google'),
    model('2026-05-01', 121, 'Alpha 3', 'OpenAI'), model('2026-06-01', 121, 'Tie', 'Mistral AI'),
    model('2026-09-01', 126, 'Alpha 4', 'OpenAI'), model('2026-10-01', 99, 'Nameless', null, 'Open weights'),
    {topic: 'breadth', referenceOn: null, value: 300, system: 'Undated'}, {topic: 'compute', referenceOn: '2026-01-01', value: 999},
  ];
  const {field} = buildClock({...feed, assessment: {...feed.assessment, observations}}, now);
  assert.equal(field.points.length, 12);
  assert.deepEqual(field.frontier.map(point => point.system), ['Alpha 1', 'Beta 1', 'Alpha 2', 'Gamma 2', 'Alpha 3', 'Alpha 4']);
  assert.equal(field.leader.system, 'Alpha 4');
  // Joint credits and renamed labs fold into one name. A model with no lab stays uncounted.
  assert.deepEqual(field.labs.map(lab => [lab.name, lab.models]), [['OpenAI', 4], ['Anthropic', 2], ['Google', 2], ['Meta', 2], ['Mistral', 1]]);
  assert.equal(field.points.filter(point => point.open).length, 3);
  // In the year to late November 2026: three new top scores, two of them a change of lab.
  assert.equal(field.records, 3);
  assert.equal(field.handovers, 2);
  assert.equal(field.answer, '5 labs. The top score fell three times in a year.');
  assert.ok(field.domain.low < 90 && field.domain.high > 126 && field.domain.to > now);
  assert.deepEqual([...namedLabs], ['OpenAI', 'Anthropic', 'Google']);
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

test('the what-if dials leave the published dates alone until one is turned', () => {
  const view = buildClock(feed, now), still = whatIfView(view, whatIfStart(), now);
  assert.equal(still.reading.speed, 1);
  assert.equal(still.reading.changed, false);
  assert.deepEqual(still.sentences, ['This is today’s course.']);
  assert.equal(still.arrival.year, 2062);
  assert.equal(still.arrival.shift, 'no change');
  assert.equal(still.next.when, still.next.base);
  assert.equal(month(still.next.when), '2027-06');
  assert.equal(still.doublingDays, 111);
  // Any time and any year come back unchanged at today's speed.
  assert.equal(whatIfTime(now + 123456789, now, still.reading), now + 123456789);
  for (const year of [2028, 2045, 2062, 2099]) assert.equal(whatIfYear(year, now, still.reading), year);
});

test('computing power moves at the pace of its scarcest ingredient', () => {
  const turn = change => readWhatIf({...whatIfStart(), ...change});
  // One short ingredient slows everything that depends on it.
  const short = turn({chips: 1});
  assert.equal(short.compute, 0.5);
  assert.deepEqual(short.limitedBy, ['chips']);
  assert.equal(short.speed, computeShare * 0.5 + (1 - computeShare));
  // One plentiful ingredient changes nothing while the others hold it back.
  const plenty = turn({chips: 4});
  assert.equal(plenty.speed, 1);
  assert.equal(plenty.changed, true);
  assert.deepEqual(plenty.limitedBy, ['build', 'money', 'power']);
  // All four together do speed it up, and no single one is the bottleneck.
  const all = turn({build: 4, chips: 4, money: 4, power: 4});
  assert.equal(all.compute, 2);
  assert.deepEqual(all.limitedBy, []);
  assert.equal(all.speed, computeShare * 2 + (1 - computeShare));
  // Methods carry on when the building stops, and research help multiplies them.
  assert.equal(turn({build: 0}).speed, 1 - computeShare);
  assert.equal(turn({self: 2}).methods, 4);
  assert.equal(turn({ideas: 0, self: 2}).methods, 0);
  // A value outside a dial's stops falls back to its nearest end, and junk to its start.
  assert.equal(readWhatIf({...whatIfStart(), chips: 99}).compute, 1);
  assert.equal(readWhatIf({chips: 'x'}).speed, 1);
});

test('what-if dates stretch with the speed, shift with a pause and can stop altogether', () => {
  const view = buildClock(feed, now), turn = change => whatIfView(view, {...whatIfStart(), ...change}, now);
  const slow = turn({chips: 1});
  assert.equal(slow.arrival.year, 2083);
  assert.equal(slow.arrival.shift, '21 years later');
  assert.equal(month(slow.next.when), '2027-10');
  assert.equal(slow.next.shift, '4 months later');
  assert.deepEqual(slow.sentences, [
    'Computing power grows at half today’s pace, held back by chips and minerals.',
    'Overall, progress runs at 63% of today’s speed.',
  ]);
  assert.deepEqual(turn({chips: 4}).sentences, [
    'Computing power still grows at today’s pace, held back by data centres, money and electricity.',
    'Overall the speed is unchanged.',
  ]);
  const paused = turn({pause: 2});
  assert.equal(paused.arrival.year, 2064);
  assert.equal(paused.next.shift, '2 years later');
  assert.equal(paused.sentences.at(-1), 'The pause pushes every date back by two years.');
  const fast = turn({build: 4, chips: 4, money: 4, power: 4, ideas: 4, self: 2});
  assert.equal(fast.reading.speed, gaugeTop);
  assert.equal(fast.arrival.year, 2037);
  assert.equal(fast.next.shift, '5 months sooner');
  // A quarter of the speed puts arrival past the horizon. No speed at all means no arrival.
  const crawl = turn({money: 0});
  assert.equal(crawl.arrival.beyond, true);
  const halt = turn({build: 0, ideas: 0});
  assert.equal(halt.reading.speed, 0);
  assert.equal(halt.arrival.year, null);
  assert.equal(halt.next.when, null);
  assert.equal(halt.doublingDays, null);
  assert.equal(halt.sentences.at(-1), 'Progress stops. On this road there is no arrival.');
  assert.equal(shiftPhrase(now, now + 10 * 86400000), 'no change');
  assert.equal(shiftPhrase(now, now + 31 * 86400000), '1 month later');
  assert.equal(shiftPhrase(now, now - 3 * 365.25 * 86400000), '3 years sooner');
  assert.equal(shiftPhrase(now, null), 'never, on this road');
});

test('every what-if question names real dials and stops, and the gauge covers the range', () => {
  const ids = new Set(dials.map(dial => dial.id));
  assert.equal(new Set(whatIfQuestions.map(question => question.id)).size, whatIfQuestions.length);
  for (const question of whatIfQuestions) {
    assert.match(question.ask, /\?$/);
    for (const [id, index] of Object.entries(question.set)) {
      assert.ok(ids.has(id), id);
      assert.ok(Number.isInteger(index) && index >= 0 && index < dials.find(dial => dial.id === id).stops.length, question.id);
      assert.notEqual(index, dials.find(dial => dial.id === id).start, question.id + ' moves ' + id);
    }
  }
  const most = Object.fromEntries(dials.map(dial => [dial.id, dial.stops.length - 1]));
  assert.equal(readWhatIf({...most, pause: 0}).speed, gaugeTop);
  assert.equal(gaugeShare(0), 0);
  assert.equal(gaugeShare(1), 0.5);
  assert.equal(gaugeShare(gaugeTop), 1);
  assert.equal(gaugeShare(99), 1);
});
