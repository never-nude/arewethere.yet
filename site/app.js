import { buildIndex, projectThreshold } from './index-model.js';
import { getCountdown } from './countdown.js';
import { historyPlot, scenarioPlot, factorPlot } from './plots.js';
import { renderTerrain } from './terrain.js';
import { renderRelationshipMap } from './relationship-map.js';
import { renderAgiTrajectory } from './agi-trajectory.js';
import { renderEvidenceLibrary } from './evidence-library.js';
import { getMilestoneVerdicts, measureMilestoneProgress, renderMilestoneProgress } from './milestone-progress.js';
import { renderOrganizationSignals } from './organization-signals.js';
import { renderOrganizationForecast } from './organization-forecast.js';
import { renderDependencyTimeline } from './dependency-timeline.js';
import { scoreRoutes, getLiveRouteInputs, routeConfidenceMethod } from './route-confidence.js';
import { renderOrigins } from './origins.js';
import { renderWatchtower } from './watchtower.js';
import { renderLabs } from './labs.js';

const byId = (id) => document.getElementById(id);
const formatter = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
const longDate = new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const shortDate = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const checkTime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
const shortTime = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' });
const checkUrl = new URL('./data/signals.json', import.meta.url);
const dayMs = 86_400_000;
const pageSize = 5;

let dataset;
let index;
let milestoneVerdicts;
let selectedDate;
let rangeDays = 90;
let filter = 'All';
let newsLimit = pageSize;
let refreshing = false;
let forecast;
let liveMarketChecked = false;
let lastAttempt = 0;

function element(tag, className = '', text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text != null) item.textContent = text;
  return item;
}

function externalLink(url, label, className = '') {
  try {
    const address = new URL(url);
    if (address.protocol === 'https:') {
      const anchor = element('a', className, label);
      anchor.href = address.href;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      return anchor;
    }
  } catch {}
  return element('span', className, label);
}

function date(value, short = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  return (short ? shortDate : longDate).format(new Date(value));
}

function num(value) {
  return Number.isFinite(value) ? formatter.format(value) : '—';
}

function rawValue(value, unit) {
  if (!Number.isFinite(value)) return '—';
  if (unit === 'FLOP') return value.toExponential(1).replace('e+', 'e') + ' FLOP';
  if (unit === 'releases') return value + (value === 1 ? ' launch' : ' launches');
  return num(value) + (['%', '×'].includes(unit) ? '' : ' ') + unit;
}

function changeText(value, suffix = ' pts') {
  if (!Number.isFinite(value)) return '—';
  return (value > 0 ? '+' : value < 0 ? '−' : '') + num(Math.abs(value)) + suffix;
}

function setChange(target, value, suffix) {
  target.classList.add('change');
  target.dataset.direction = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  target.textContent = changeText(value, suffix);
}

function setPressed(group, property, value) {
  for (const button of byId(group).querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset[property] === String(value)));
  }
}

function renderReading() {
  const { score, delta, coverage, threshold } = index;
  byId('current-score').textContent = num(score);
  setChange(byId('current-delta'), delta);
  byId('current-delta').title = 'Change from the prior day';
  byId('index-fill').style.width = (score ?? 0) + '%';
  byId('watch-tick').style.left = threshold.target + '%';
  byId('score-coverage').textContent = coverage + '% source coverage';
  byId('watch-line-label').textContent = threshold.target + '-point watch line';
  byId('index-gap').textContent = score == null ? '' : score < threshold.target
    ? 'The current score is ' + num(threshold.target - score) + ' points below it.'
    : 'The current score has reached it.';
  if (score != null) byId('index-meter').setAttribute('aria-valuenow', score);
  else byId('index-meter').removeAttribute('aria-valuenow');
  byId('observed').textContent = threshold.observed
    ? 'Evidence gates met · ' + date(threshold.crossingDate)
    : 'Singularity threshold unobserved';
  const lanes = [
    ['Capability', 'Capability'],
    ['AI research', 'Research'],
    ['Compute', 'Inputs'],
    ['Market and releases', 'Expectations'],
  ];
  byId('index-breakdown').replaceChildren(...lanes.map(([label, lane]) => {
    const factors = index.factors.filter((factor) => factor.lane === lane);
    const weight = factors.reduce((sum, factor) => sum + factor.weight, 0);
    const covered = factors.filter((factor) => Number.isFinite(factor.contribution));
    const points = covered.length ? num(covered.reduce((sum, factor) => sum + factor.contribution, 0)) : '—';
    const item = element('li');
    item.append(element('span', '', label), element('strong', '', points + ' / ' + weight));
    return item;
  }));
}

function renderCountdown() {
  if (!index) return;
  const { status, daysRemaining, date: targetDate, target, monthlyPoints, anchorDate } = getCountdown(index);
  const conditional = status === 'conditional';
  byId('countdown-evidence-date').textContent = date(index.date) || 'its latest data check';
  const labels = {
    conditional: 'Estimated watch-line date',
    elapsed: 'Scenario date reached',
    'at-line': 'Watch line reached',
    observed: 'Singularity evidence verified',
    'no-reading': 'Waiting for an evidence reading',
  };
  const notes = {
    conditional: `Starting from the ${date(anchorDate, true)} reading, the score would reach ${target} at +${num(monthlyPoints)} index point per month.`,
    elapsed: `The score is still below ${target}. This scenario assumed a steady gain of +${num(monthlyPoints)} index point per month.`,
    'at-line': 'The watch line calls for a closer look. Confirming the Singularity requires independent evidence across successive AI generations.',
    observed: 'The watch’s independent evidence criteria have been met.',
    'no-reading': 'The countdown needs a current evidence index reading.',
  };
  byId('countdown-value').hidden = !conditional;
  byId('countdown-days').value = conditional ? num(daysRemaining) : '';
  byId('countdown-state').textContent = labels[status];
  byId('countdown-note').textContent = notes[status];
  const time = byId('countdown-date');
  time.hidden = !targetDate;
  time.dateTime = targetDate ?? '';
  time.textContent = date(targetDate);
}

function tickCountdown() {
  renderCountdown();
  setTimeout(tickCountdown, dayMs - Date.now() % dayMs);
}

function renderTicker() {
  const links = index.factors.map((factor) => {
    const link = element('a', 'tape-signal');
    link.href = '#factor-' + factor.id;
    const movement = element('span');
    setChange(movement, factor.contributionDelta, ' pt');
    movement.title = 'Daily change in index contribution';
    link.append(element('span', '', factor.label), element('strong', '', rawValue(factor.value, factor.unit)), movement);
    link.addEventListener('click', () => {
      const details = byId('factor-' + factor.id);
      if (details) details.open = true;
    });
    return link;
  });
  byId('tape').replaceChildren(...links);
}

function datesInRange() {
  return index.history.slice(-rangeDays);
}

function renderReplay() {
  if (!index) return;
  const frames = datesInRange();
  const selected = frames.findIndex((frame) => frame.date === selectedDate);
  const pos = selected < 0 ? frames.length - 1 : selected;
  const frame = frames[pos];
  selectedDate = frame.date;
  const slider = byId('replay');
  slider.disabled = false;
  slider.max = frames.length - 1;
  slider.value = pos;
  slider.setAttribute('aria-valuetext', date(frame.date));
  byId('replay-back').disabled = pos === 0;
  byId('replay-forward').disabled = pos === frames.length - 1;
  byId('replay-latest').disabled = pos === frames.length - 1;
  byId('history-caption').textContent = date(frames[0].date, true) + ' – ' + date(frames.at(-1).date);
  byId('replay-date').textContent = date(frame.date) + ' · ' + frame.coverage + '% coverage';
  historyPlot(byId('history-chart'), frames, pos, index.threshold.target, selectReplay);
  const delta = element('span');
  setChange(delta, frame.delta);
  byId('replay-readout').replaceChildren(element('strong', '', num(frame.score)), delta);
  const factors = frame.factors.map((factor) => {
    const row = element('li');
    const change = element('span');
    const label = element('span', '', factor.label);
    label.append(' ', element('small', '', rawValue(factor.value, factor.unit)));
    setChange(change, factor.contributionDelta, '');
    row.append(label, change);
    return row;
  });
  byId('replay-factors').replaceChildren(...factors);
  const events = frame.events.slice(0, 4).map((event) => externalLink(event.url, event.title + ' ↗'));
  const coverageNote = frame.coverageDelta ? 'Source coverage changed by ' + changeText(frame.coverageDelta, ' points') + '. ' : '';
  const summary = events.length ? 'Events on this date' : frame.delta === 0 ? 'No change in the index on this date.' : 'Measured or rolling inputs changed.';
  byId('replay-events').replaceChildren(document.createTextNode(coverageNote + summary), ...events);
}

function selectReplay(position) {
  const frames = datesInRange();
  selectedDate = frames[Math.max(0, Math.min(frames.length - 1, position))].date;
  renderReplay();
}

function renderScenario() {
  if (!index) return;
  const pace = Number(byId('scenario-pace').value);
  const result = projectThreshold(index, { monthlyPoints: pace });
  byId('scenario-rate').textContent = changeText(pace, '');
  byId('leader-scenario-rate').textContent = changeText(pace, '');
  byId('leader-scenario-pace').value = pace;
  setPressed('scenario-presets', 'pace', pace);
  scenarioPlot(byId('scenario-chart'), index, pace, result);
  let description = 'No watch-line crossing at this pace within five years.';
  if (result.status === 'at-line') description = 'The index is already at or above the watch line.';
  else if (result.status === 'no-reading') description = 'A current index reading is needed to plot this illustration.';
  else if (result.date && result.days <= 60 * 30.4375) description = 'Under this assumption, the score crosses on ' + date(result.date) + '.';
  byId('scenario-caption').textContent = description;
  const milestones = measureMilestoneProgress(index);
  renderOrganizationForecast(byId('organization-forecast'), {
    payload: dataset, index, projection: result,
    onDateChange: (day) => renderDependencyTimeline(byId('dependency-timeline'), index, result, milestones, day),
  });
}

function renderGates() {
  const labels = { met: 'MET', watching: 'WATCHING', partial: 'PARTIAL EVIDENCE', open: 'OPEN', unknown: 'UNKNOWN' };
  const everyday = {
    workday: [
      'An assistant reconciles a day’s invoices, finds mismatches, and drafts corrections across a series of steps.',
      'People could hand off longer administrative chores and spend less time checking in between steps.',
    ],
    research: [
      'A research assistant reads prior work, proposes a change, runs controlled experiments, and checks the results before a human reviews them.',
      'New features or fixes could arrive sooner as more of the development process runs in parallel.',
    ],
    compounding: [
      'One generation of tools helps produce the next. The new tools then shorten the next development cycle and improve what it can deliver.',
      'Software tools could change more often than teams have time to get used to each version.',
    ],
  };
  const opened = new Set([...byId('evidence-gates').querySelectorAll('details[open]')].map((gate) => gate.dataset.gate));
  const gates = index.threshold.criteria.map((criterion, position) => {
    const row = element('li');
    row.dataset.met = criterion.status === 'met';
    const marker = element('span', 'gate-marker', criterion.status === 'met' ? '✓' : position + 1);
    marker.setAttribute('aria-hidden', 'true');
    const detail = element('details');
    detail.dataset.gate = criterion.id;
    detail.open = opened.has(criterion.id);
    const title = element('summary', 'gate-topline');
    title.append(element('strong', '', criterion.label), element('span', '', labels[criterion.status]));
    const copy = element('p', '', criterion.detail);
    if (Number.isFinite(criterion.value)) {
      copy.append(' Current signal ', externalLink(criterion.sourceUrl, rawValue(criterion.value, criterion.unit) + ' from ' + criterion.source + ' ↗'));
    }
    const example = everyday[criterion.id];
    detail.append(title, copy, element('p', '', 'Everyday example · ' + example[0]), element('p', '', 'What you might notice · ' + example[1]));
    row.append(marker, detail);
    return row;
  });
  byId('evidence-gates').replaceChildren(...gates);
  byId('gates-note').textContent = index.threshold.observed
    ? 'The final qualifying evidence was dated ' + date(index.threshold.crossingDate) + '.'
    : 'An observed singularity date will appear when all three evidence criteria are documented.';
}

function renderPathConfidence() {
  if (!index) return;
  const openBreadth = dataset.metrics.find(({ id }) => id === 'open-breadth');
  const closedBreadth = dataset.metrics.find(({ id }) => id === 'closed-breadth');
  const savedForecast = dataset.metrics.find(({ id }) => id === 'forecast');
  const liveIsNewer = forecast && (!forecast.observedAt || forecast.observedAt >= (savedForecast?.asOf ?? ''));
  const selectedForecast = liveIsNewer ? forecast : undefined;
  renderAgiTrajectory(byId('agi'), dataset, selectedForecast);
  const score = scoreRoutes(index, { forecast: selectedForecast, openBreadth, closedBreadth });
  const lastTrade = selectedForecast?.observedAt ?? savedForecast?.asOf;
  const updates = liveMarketChecked ? 'Checked ' + shortTime.format(forecast.checkedAt ? new Date(forecast.checkedAt) : lastAttempt) : 'Market check unavailable · showing saved evidence';
  const trade = lastTrade ? ' · Market reading ' + checkTime.format(new Date(lastTrade)) : '';
  terrain.updateConfidence(score, {
    status: updates + trade,
    method: routeConfidenceMethod + ' The market is checked every minute while this page is open. Benchmark and research readings change when results are published. Scores show evidence support in points.',
    verdicts: milestoneVerdicts,
  });
}

function renderFactors() {
  const previous = new Set([...byId('factors').querySelectorAll('details[open]')].map((row) => row.id));
  const rows = index.factors.map((factor) => {
    const details = element('details', 'factor-row');
    details.id = 'factor-' + factor.id;
    details.open = previous.has(details.id);
    const summary = element('summary', 'factor-summary');
    const reading = element('span', 'factor-reading', rawValue(factor.value, factor.unit));
    if (factor.contributionDelta) {
      const delta = element('span');
      setChange(delta, factor.contributionDelta, '');
      reading.append(delta);
    }
    summary.append(element('span', 'factor-title', factor.label), reading, element('span', 'factor-weight', factor.weight + '%'));
    const copy = element('div', 'factor-detail');
    const scoring = element('p', '', factor.scoring + ' ');
    scoring.append(element('strong', '', num(factor.contribution) + ' / ' + factor.weight + ' index points.'));
    copy.append(element('p', '', factor.detail), scoring);
    if (factor.date) {
      const observation = [factor.model, date(factor.publishedAt ?? factor.date), factor.status === 'snapshot' ? 'saved snapshot' : null].filter(Boolean).join(' · ');
      copy.append(element('p', '', observation));
    }
    if (Number.isFinite(factor.low) && Number.isFinite(factor.high)) {
      copy.append(element('p', '', 'Reported interval ' + num(factor.low) + '–' + rawValue(factor.high, factor.unit)));
    }
    if (factor.sourceUrl) copy.append(externalLink(factor.sourceUrl, factor.source + ' ↗'));
    const history = element('div', 'factor-mini');
    copy.append(history);
    factorPlot(history, index.history.slice(-90).map((day) => day.factors.find(({ id }) => id === factor.id)?.contribution), factor.label);
    const observed = dataset.metrics.find(({ id }) => id === factor.id)?.observations;
    if (observed?.length) {
      const recent = [...observed].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 5);
      const list = element('ul', 'observation-list');
      for (const observation of recent) {
        const row = element('li');
        row.append(element('span', '', [observation.label, date(observation.date, true)].filter(Boolean).join(' · ')),
          element('strong', '', rawValue(observation.value, factor.unit)));
        list.append(row);
      }
      copy.append(element('p', 'observations-label', 'Recent evaluated models'), list);
    }
    details.append(summary, copy);
    return details;
  });
  byId('factors').replaceChildren(...rows);
  if (location.hash.startsWith('#factor-')) {
    const row = byId(location.hash.slice(1));
    if (row) row.open = true;
  }
}

function renderNews() {
  const events = dataset.events;
  const categories = ['All', ...new Set(events.map((entry) => entry.category).filter(Boolean))];
  if (!categories.includes(filter)) filter = 'All';
  if ([...byId('news-filters').children].map((button) => button.dataset.category).join(',') !== categories.join(',')) {
    byId('news-filters').replaceChildren(...categories.map((category) => {
      const button = element('button', '', category);
      button.type = 'button';
      button.dataset.category = category;
      return button;
    }));
  }
  setPressed('news-filters', 'category', filter);
  const selected = filter === 'All' ? events : events.filter((event) => event.category === filter);
  byId('news-list').replaceChildren(...selected.slice(0, newsLimit).map((event) => {
    const item = element('li');
    item.append(element('p', 'news-meta', [event.category, event.source, date(event.date, true)].filter(Boolean).join(' · ')));
    item.append(externalLink(event.url, event.title + ' ↗', 'news-title'));
    if (event.summary) item.append(element('p', 'news-description', event.summary));
    return item;
  }));
  byId('more-news').hidden = selected.length <= newsLimit;
}

function renderSources() {
  const statusLabels = { live: 'Checked', snapshot: 'Saved reading', unavailable: 'Unavailable', review: 'Review needed' };
  const sources = dataset.sources.map((source) => {
    const item = element('li');
    item.title = source.detail ?? '';
    const name = externalLink(source.url, source.label + ' ↗');
    const state = source.pendingReport
      ? externalLink(source.pendingReport.url, 'New report to review ↗', 'source-state')
      : element('span', 'source-state', statusLabels[source.status] ?? source.status);
    item.append(name, state);
    return item;
  });
  const checked = dataset.checkedAt ? checkTime.format(new Date(dataset.checkedAt)) : 'Unknown';
  const prefix = 'Last source check ' + checked + '. ';
  const cadence = dataset.delivery?.kind === 'github-pages' ? 'GitHub Actions checks sources hourly.' : 'This preview checks sources while open.';
  byId('sources-list').replaceChildren(...sources);
  byId('data-freshness').textContent = prefix + cadence;
  byId('refresh').title = prefix + 'Click to check for a newer dataset.';
  const online = dataset.sources.filter((source) => source.status === 'live').length;
  byId('source-status').dataset.state = online ? 'live' : 'saved';
  byId('source-time').textContent = online ? online + ' sources checked' : 'Saved readings';
}

async function reload() {
  if (refreshing) return;
  refreshing = true;
  lastAttempt = Date.now();
  byId('refresh').setAttribute('aria-busy', 'true');
  const liveCheck = getLiveRouteInputs().then((reading) => {
    forecast = reading.forecast;
    liveMarketChecked = true;
  }, () => {
    liveMarketChecked = false;
  });
  try {
    const response = await fetch(checkUrl, { cache: 'no-store', signal: AbortSignal.timeout(18_000) });
    if (!response.ok) throw new Error('Source response unavailable');
    const next = await response.json();
    if (!Array.isArray(next.metrics) || !Array.isArray(next.sources) || !Array.isArray(next.events)) throw new Error('Unexpected dataset');
    if (next.checkedAt !== dataset?.checkedAt || !index) {
      const atLatest = !index || selectedDate === index.date;
      dataset = next;
      index = buildIndex(dataset);
      milestoneVerdicts = getMilestoneVerdicts(index);
      relationships.update({ index, verdicts: milestoneVerdicts });
      if (atLatest) selectedDate = index.date;
      renderReading();
      renderCountdown();
      renderMilestoneProgress(byId('milestone-progress'), index);
      renderTicker();
      renderReplay();
      renderScenario();
      renderGates();
      renderFactors();
      renderNews();
      renderOrigins(byId('origins'), { index });
      renderWatchtower(byId('watchtower'), { index, payload: dataset });
      renderLabs(byId('labs-board'), { index, payload: dataset });
      renderOrganizationSignals(byId('leaders'), { index, payload: dataset });
      renderPathConfidence();
    }
    renderSources();
  } catch (error) {
    byId('source-status').dataset.state = 'saved';
    byId('source-time').textContent = dataset ? 'Update unavailable' : 'Data unavailable';
    if (!dataset) byId('observed').textContent = 'Source data unavailable';
    console.warn('Signal refresh:', error.message);
  } finally {
    await liveCheck;
    refreshing = false;
    byId('refresh').removeAttribute('aria-busy');
    renderPathConfidence();
  }
}

byId('refresh').addEventListener('click', reload);
byId('range-buttons').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-days]');
  if (!button || !index) return;
  rangeDays = Number(button.dataset.days);
  setPressed('range-buttons', 'days', rangeDays);
  if (selectedDate < datesInRange()[0].date) selectedDate = datesInRange()[0].date;
  renderReplay();
});
byId('replay').addEventListener('input', (event) => selectReplay(Number(event.target.value)));
byId('replay-back').addEventListener('click', () => selectReplay(Number(byId('replay').value) - 1));
byId('replay-forward').addEventListener('click', () => selectReplay(Number(byId('replay').value) + 1));
byId('replay-latest').addEventListener('click', () => selectReplay(datesInRange().length - 1));
byId('scenario-pace').addEventListener('input', renderScenario);
byId('leader-scenario-pace').addEventListener('input', (event) => {
  byId('scenario-pace').value = event.target.value;
  renderScenario();
});
byId('scenario-presets').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-pace]');
  if (!button) return;
  byId('scenario-pace').value = button.dataset.pace;
  renderScenario();
});
byId('news-filters').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-category]');
  if (!button || !dataset) return;
  filter = button.dataset.category;
  newsLimit = pageSize;
  renderNews();
});
byId('more-news').addEventListener('click', () => {
  const first = newsLimit;
  newsLimit += pageSize;
  renderNews();
  byId('news-list').children[first]?.querySelector('a')?.focus();
});

const plots = new ResizeObserver(() => {
  if (!index) return;
  const frames = datesInRange();
  const position = frames.findIndex((frame) => frame.date === selectedDate);
  historyPlot(byId('history-chart'), frames, Math.max(0, position), index.threshold.target, selectReplay);
  renderScenario();
});
plots.observe(byId('history-chart'));
plots.observe(byId('scenario-chart'));

const terrainConcepts = new Set(['agi', 'asi', 'rsi', 'singularity']);
const mapSelection = { relationships: 'singularity', routes: 'singularity' };
let mapView = 'relationships';

function updateAgiVisibility() {
  const show = mapSelection[mapView] === 'agi';
  byId('agi').hidden = !show;
  byId('agi-jump').hidden = !show;
}

const terrain = renderTerrain(byId('terrain'), {
  onSelect(id) {
    mapSelection.routes = id;
    mapSelection.relationships = id;
    relationships.select(id, { notify: false });
    updateAgiVisibility();
  },
});
const relationships = renderRelationshipMap(byId('relationships'), {
  onSelect(id) {
    mapSelection.relationships = id;
    if (terrainConcepts.has(id)) {
      mapSelection.routes = id;
      terrain.select(id, false);
    }
    updateAgiVisibility();
  },
});
function setMapView(view) {
  mapView = view;
  setPressed('atlas-modes', 'view', mapView);
  byId('relationships').hidden = mapView !== 'relationships';
  byId('terrain').hidden = mapView !== 'routes';
  updateAgiVisibility();
}

byId('atlas-modes').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-view]');
  if (button) setMapView(button.dataset.view);
});
byId('foundations-jump').addEventListener('click', () => setMapView('relationships'));

function openLinkedMapDetail() {
  const hash = window.location.hash;
  if (hash === '#agi') {
    const activeMap = mapView === 'relationships' ? relationships : terrain;
    activeMap.select('agi');
  } else if (hash === '#foundations') {
    setMapView('relationships');
  } else {
    return;
  }
  requestAnimationFrame(() => byId(hash.slice(1)).scrollIntoView());
}
window.addEventListener('hashchange', openLinkedMapDetail);
openLinkedMapDetail();
renderEvidenceLibrary(byId('evidence'));
renderMilestoneProgress(byId('milestone-progress'));
renderOrigins(byId('origins'));
renderWatchtower(byId('watchtower'));
renderLabs(byId('labs-board'));
renderOrganizationSignals(byId('leaders'));
renderOrganizationForecast(byId('organization-forecast'));
reload();
tickCountdown();
setInterval(() => { if (!document.hidden) reload(); }, 60_000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  renderCountdown();
  if (Date.now() - lastAttempt >= 60_000) reload();
});
