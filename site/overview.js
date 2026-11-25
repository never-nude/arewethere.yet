import { buildIndex, hasSourceReading } from './index-model.js';
import { installGlossary } from './glossary.js';
import { dailyReading, scoreMovement } from './reading-brief.js';
import { renderCountdownSummary } from './countdown-summary.js';

const byId = (id) => document.getElementById(id);
const numbers = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const dates = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const checkTime = new Intl.DateTimeFormat(undefined, {
  year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
});
const feedUrl = new URL('./data/signals.json', import.meta.url);
let checkedAt = null;
let loading = false;

function changedInputs(now, then) {
  const previous = new Map(then.factors.map(({ id, contribution }) => [id, contribution]));
  return now.factors.filter(({ id, contribution }) => contribution !== previous.get(id));
}

function dayBrief(index) {
  const daily = dailyReading(index);
  if (!daily) return 'A prior daily reading is needed to measure a change.';
  const changed = changedInputs(index, index.history.at(-2));
  if (!changed.length) return daily + ' No indicator gained or lost points.';
  if (changed.length === 1 && changed[0].id === 'forecast') return daily + ' The research and capability indicators kept the same contributions.';
  return daily;
}

function weekBrief(index) {
  const prior = index.history.at(-8);
  if (!Number.isFinite(prior?.score)) return 'A score from seven days earlier is needed for a weekly comparison.';
  const difference = Math.round((index.score - prior.score) * 100) / 100;
  const amount = Math.abs(difference);
  const movement = amount ? (difference > 0 ? 'up ' : 'down ') + numbers.format(amount) + (amount === 1 ? ' point' : ' points') : 'unchanged';
  const first = shortDate.format(Date.parse(prior.date));
  const then = new Set(prior.factors.filter((f) => Number.isFinite(f.contribution)).map((f) => f.id));
  const now = index.factors.filter((f) => Number.isFinite(f.contribution));
  const comparable = then.size === now.length && now.every(({ id }) => then.has(id));
  const report = 'The index is ' + movement + ' from ' + numbers.format(prior.score) + ' on ' + first + '. ';
  if (!comparable) {
    const change = now.length < then.size ? 'fewer inputs' : now.length > then.size ? 'more inputs' : 'a different set of inputs';
    return report + 'The latest score includes ' + change + ' than last week (' + now.length + ' of eight now, ' + then.size + ' then). Changes in coverage can move the score even when measured performance holds steady.';
  }
  const changed = changedInputs(index, prior);
  const coverage = now.length === 8 ? 'Both dates include all eight indicators.' : 'Both dates include the same ' + now.length + ' of eight indicators.';
  if (changed.length === 1 && changed[0].id === 'forecast') {
    return report + 'Only the play-money market contributed a different number of points. ' + coverage;
  }
  return report + coverage;
}

function watchBrief(index) {
  const { criteria, observed, crossingDate } = index.threshold;
  if (observed) return 'By ' + dates.format(Date.parse(crossingDate)) + ', independent evidence met all three tests. The Watch will continue tracking whether faster gains persist across later generations.';
  const open = new Set(criteria.filter(({ status }) => status !== 'met').map(({ id }) => id));
  if (open.has('workday')) {
    const workday = criteria.find(({ id }) => id === 'workday');
    const evidence = Number.isFinite(workday.value)
      ? 'On tasks AI finishes with 80% success in METR’s tests, experts would need an estimated ' + numbers.format(workday.value) + ' hours. '
      : 'Independent trials still need to establish reliable work on tasks that would take an expert a full day. ';
    return evidence + 'The workday test requires even the low end of that estimate to reach eight hours.';
  }
  if (open.has('research')) return 'Watch for independent evidence that AI repeatedly plans, runs and checks consequential research projects from start to finish.';
  return 'Researchers still need to trace faster gains across at least two successive AI generations to the AI’s own research, accounting for other possible causes.';
}

function displayLatest(payload) {
  const index = buildIndex(payload, { days: 8 });
  if (!Number.isFinite(index.score)) throw new Error('No measured score');
  const edition = byId('home-date');
  edition.dateTime = index.date;
  edition.textContent = dates.format(Date.parse(index.date));
  byId('home-edition').hidden = false;
  byId('home-score').textContent = numbers.format(index.score);
  byId('home-fill').style.width = index.score + '%';
  byId('home-movement').textContent = scoreMovement(index);
  const answer = byId('home-answer');
  answer.hidden = false;
  answer.textContent = index.threshold.observed
    ? 'Independent evidence now meets the Watch’s three tests for a singularity.'
    : 'The Watch has yet to confirm a singularity.';
  byId('home-daily-reading').textContent = dayBrief(index);
  byId('home-week-reading').textContent = weekBrief(index);
  byId('home-watch-reading').textContent = watchBrief(index);
  renderCountdownSummary(byId('home-countdown'), index, payload);
}

function updateStatus(failed) {
  const status = byId('home-last-check');
  if (!checkedAt) {
    status.textContent = 'Readings unavailable. This page will try again in a minute.';
    return;
  }
  const old = Date.now() - checkedAt > 12 * 60 * 60 * 1000;
  const prefix = failed ? 'Update unavailable. Last source check ' : old ? 'Awaiting a newer source check. Last checked ' : 'Last source check ';
  const message = prefix + checkTime.format(checkedAt) + '.';
  if (status.textContent !== message) status.textContent = message;
}

async function refresh() {
  if (document.hidden || loading) return;
  loading = true;
  try {
    const response = await fetch(feedUrl, { cache: 'no-cache', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Source check unavailable');
    const payload = await response.json();
    if (!hasSourceReading(payload)) throw new Error('No source readings');
    const timestamp = Date.parse(payload.checkedAt);
    if (checkedAt === null || timestamp > checkedAt) {
      displayLatest(payload);
      checkedAt = timestamp;
    }
    updateStatus(timestamp < checkedAt);
  } catch {
    if (checkedAt === null) {
      renderCountdownSummary(byId('home-countdown'), null, null);
      byId('home-movement').textContent = 'Daily change unavailable.';
      byId('home-daily-reading').textContent = 'The daily change is unavailable.';
      byId('home-week-reading').textContent = 'The weekly comparison is unavailable.';
      byId('home-watch-reading').textContent = 'The Watch checks for reliable workday-length tasks, repeated independent research and accelerating gains across AI generations.';
    }
    updateStatus(true);
  } finally {
    loading = false;
  }
}

installGlossary(byId('main'));
document.addEventListener('visibilitychange', refresh);
window.setInterval(refresh, 60_000);
refresh();
