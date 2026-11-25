import { getCountdown } from './countdown.js';
import { buildIndex, hasSourceReading, observationDay } from './index-model.js';

const dayMs = 86_400_000;
const summaries = new WeakMap();
const formatDate = new Intl.DateTimeFormat('en', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
});

function countdownIndex(index, payload) {
  if (!Number.isFinite(index?.score) || !observationDay(index.date) ||
      !Array.isArray(index.history) || !index.history.some(frame => Number.isFinite(frame?.score) && observationDay(frame.date))) return null;

  // A short replay can miss an earlier score change or the first crossing of 75.
  const atReview = index.score >= index.threshold?.target;
  const showsScoreChange = index.history.some(frame => frame.score !== index.score);
  if ((atReview || !showsScoreChange) && hasSourceReading(payload)) return buildIndex(payload);
  return index;
}

function mount(container) {
  const doc = container.ownerDocument;
  function make(tag, name) {
    const element = doc.createElement(tag);
    element.className = 'countdown-summary-' + name;
    return element;
  }
  const title = make(container.parentElement?.querySelector(':scope > h1') ? 'h2' : 'h3', 'title');
  const reading = make('p', 'reading');
  const value = make('strong', 'value');
  const date = make('time', 'date');
  const note = make('p', 'note');
  const link = make('a', 'link');
  link.href = './dashboard.html#watch-clock';
  link.textContent = 'See the countdown assumptions';
  reading.append(value, ' ', date);
  container.replaceChildren(title, reading, note, link);
  const state = { container, title, value, date, note, timer: null, index: null, checkedAt: NaN };
  doc.addEventListener('visibilitychange', () => {
    if (!container.isConnected) return;
    if (doc.hidden) clearTimeout(state.timer);
    else update(state);
  });
  summaries.set(container, state);
  return state;
}

function setText(el, value) {
  if (el.textContent !== value) el.textContent = value;
}

function update(state) {
  clearTimeout(state.timer);
  const now = Date.now();
  const { container, title, value, date, note } = state;
  const { status, daysRemaining, date: targetDate, target, monthlyPoints } = getCountdown(state.index, { now });
  const labels = {
    'at-line': 'Review mark reached',
    observed: 'Evidence criteria met',
    elapsed: 'Scenario date has passed',
    'no-reading': 'Awaiting a dated score',
    'outside-window': 'Beyond the scenario window',
    'no-crossing': 'No crossing at this pace',
  };
  const conditional = status === 'conditional';
  const hasDate = Boolean(observationDay(targetDate));
  container.dataset.state = status;
  setText(title, 'Countdown to the ' + target + '-point review');
  setText(value, conditional ? daysRemaining + (daysRemaining === 1 ? ' day' : ' days') : labels[status]);
  date.hidden = !hasDate;
  if (hasDate) {
    date.dateTime = targetDate;
    const prefix = conditional ? 'until ' : '· ';
    setText(date, prefix + formatDate.format(Date.parse(targetDate)) + ' UTC');
  } else {
    date.removeAttribute('datetime');
    setText(date, '');
  }
  let explanation;
  if (conditional || status === 'elapsed') {
    explanation = 'Assumes the index gains ' + monthlyPoints + (monthlyPoints === 1 ? ' point' : ' points') + ' per month.';
    if (status === 'elapsed') explanation += ' The latest score is still below ' + target + '.';
  } else if (status === 'observed') {
    explanation = 'The Watch’s independent evidence tests have been met.';
  } else if (status === 'at-line') {
    explanation = 'Crossing the mark calls for a closer review of the evidence.';
  } else {
    explanation = 'A countdown needs a dated score and a pace that reaches the review mark.';
  }
  if (Number.isFinite(state.checkedAt) && now - state.checkedAt >= dayMs / 2) {
    explanation += ' Based on an older source check from ' + formatDate.format(state.checkedAt) + ' UTC.';
  }
  setText(note, explanation);
  if (state.index && !container.ownerDocument.hidden) {
    const untilMidnight = dayMs - now % dayMs;
    const untilStale = state.checkedAt + dayMs / 2 - now;
    const next = untilStale > 0 ? Math.min(untilMidnight, untilStale) : untilMidnight;
    state.timer = setTimeout(() => { if (container.isConnected) update(state); }, next);
  }
}

export function renderCountdownSummary(container, index, payload) {
  if (!container) return;
  const state = summaries.get(container) ?? mount(container);
  if (index !== state.input || payload !== state.payload) {
    state.index = countdownIndex(index, payload);
    state.input = index;
    state.payload = payload;
    state.checkedAt = Date.parse(payload?.checkedAt);
  }
  update(state);
}
