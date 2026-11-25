import { renderCountdownSummary } from './countdown-summary.js';
import { dailyReading } from './reading-brief.js';
import { buildIndex, observationDay, hasSourceReading } from './index-model.js';
import { measureMilestoneProgress } from './milestone-progress.js';
import { installGlossary } from './glossary.js';
import { assessAcceleration } from './watchtower.js';
import { renderScoreGuide } from './front-score-guide.js';

const byId = (id) => document.getElementById(id);
const numbers = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const fullDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });
const chartDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const checkTime = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
const feedUrl = new URL('./data/signals.json', import.meta.url);
const chart = byId('front-history');
const svgNS = 'http://www.w3.org/2000/svg';
const chartColors = { ink: 'var(--dim)', grid: 'var(--front-chart-grid)', line: 'var(--teal)' };
let lastChecked = null;
let loading = false;
let history = [];
let chartWidth = 0;

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function svg(tag, attributes, text) {
  const el = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, value);
  if (text) el.textContent = text;
  return el;
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href.replace(/\/$/, '') : null;
  } catch { return null; }
}

function drawHistory() {
  if (!history.length) return;
  const width = Math.max(200, Math.round(chart.getBoundingClientRect().width) || 360);
  if (width === chartWidth) return;
  chartWidth = width;
  const height = Math.max(116, Math.min(170, Math.round(width * .32)));
  const left = 31, right = width - 8, top = 29, bottom = height - 26;
  const x = (i) => left + (right - left) * i / Math.max(1, history.length - 1);
  const y = (score) => bottom - (bottom - top) * score / 100;
  const plot = svg('svg', { viewBox: '0 0 ' + width + ' ' + height, width: '100%', role: 'img', 'aria-labelledby': 'front-chart-title', 'aria-describedby': 'front-history-caption' });
  plot.append(svg('title', { id: 'front-chart-title' }, 'Daily evidence index on a scale of 0 to 100 points'));
  const label = (atX, atY, text, anchor = 'start') => svg('text', {
    x: atX, y: atY, 'text-anchor': anchor, class: 'front-chart-label', fill: chartColors.ink, 'font-family': 'system-ui, sans-serif', 'font-size': '11',
  }, text);
  plot.append(label(0, 12, 'Index points'));
  for (const value of [0, 50, 100]) {
    plot.append(svg('line', { x1: left, x2: right, y1: y(value), y2: y(value), class: value ? 'front-chart-grid' : 'front-chart-axis', stroke: chartColors.grid }),
      label(left - 6, y(value) + 4, String(value), 'end'));
  }
  const last = history.length - 1;
  for (const i of new Set([0, Math.floor(last / 2), last])) {
    plot.append(label(x(i), height - 4, chartDate.format(Date.parse(history[i].date)), i === 0 ? 'start' : i === last ? 'end' : 'middle'));
  }
  let path = '';
  const ends = [];
  let previousMeasured = false;
  for (const [i, point] of history.entries()) {
    const measured = Number.isFinite(point.score);
    if (measured) {
      path += previousMeasured ? ' H ' + x(i) + ' V ' + y(point.score) : ' M ' + x(i) + ' ' + y(point.score);
      if (!previousMeasured || !Number.isFinite(history[i + 1]?.score)) ends.push(i);
    }
    previousMeasured = measured;
  }
  plot.append(svg('path', { d: path.trim(), fill: 'none', stroke: chartColors.line, 'stroke-width': 2.4, 'stroke-linejoin': 'round', class: 'front-chart-line' }));
  for (const i of ends) plot.append(svg('circle', { cx: x(i), cy: y(history[i].score), r: 3, fill: chartColors.line, class: 'front-chart-dot' }));
  chart.replaceChildren(plot);
}

function showHistory(index) {
  history = index.history.slice(-30);
  chartWidth = 0;
  const measured = history.filter(({ score }) => Number.isFinite(score));
  if (!measured.length) {
    history = [];
    chart.replaceChildren();
    byId('front-history-caption').textContent = 'Daily index readings are unavailable for this period.';
    return;
  }
  const first = measured[0], last = measured.at(-1);
  const start = numbers.format(first.score);
  let summary = first === last ? 'One measured day at ' + start + ' points.' :
    start + ' to ' + numbers.format(last.score) + ' points across the period.';
  const missing = history.length - measured.length;
  if (missing) summary += ' ' + missing + (missing === 1 ? ' day has' : ' days have') + ' no reading.';
  if (first.coverage !== last.coverage) {
    summary += ' Source coverage went from ' + first.coverage + ' to ' + last.coverage + ' of 100 possible points.';
  } else if (index.coverage < 100) {
    summary += ' Current readings cover ' + index.coverage + ' of 100 possible points.';
  }
  byId('front-history-caption').textContent = summary;
  drawHistory();
}

function selectReport(payload, index) {
  const reports = [];
  for (const id of ['research-acceleration', 'research-autonomy']) {
    const metric = payload.metrics.find((item) => item?.id === id);
    const factor = index.factors.find((item) => item.id === id);
    if (!metric || !Number.isFinite(factor?.value)) continue;
    const url = safeUrl(factor.sourceUrl);
    if (!url || typeof factor.source !== 'string' || !factor.source.trim()) continue;
    const event = payload.events.filter((entry) => safeUrl(entry?.url) === url && observationDay(entry.date) && observationDay(entry.date) <= index.date)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const date = observationDay(factor.publishedAt) ?? observationDay(event?.date);
    if (!date || date > index.date) continue;
    const value = numbers.format(factor.value);
    const independent = metric.evidenceType === 'Independent study';
    const context = id === 'research-autonomy'
      ? factor.source + ' reports that AI finished ' + value + '% of selected internal research tasks without human help.'
      : factor.source + ' puts gains at Anthropic at ' + value + ' times the earlier pace. AI’s share of that gain remains uncertain.';
    reports.push({ url, source: factor.source, independent, date, context });
  }
  return reports.sort((a, b) => b.date.localeCompare(a.date) || Number(b.independent) - Number(a.independent))[0];
}

function showContributions(index) {
  const groups = { skills: ['Capability'], research: ['Research'], context: ['Inputs', 'Expectations'] };
  const entries = Object.entries(groups).map(([name, lanes]) => {
    const factors = index.factors.filter(factor => lanes.includes(factor.lane));
    return { name, factors, possible: factors.reduce((sum, factor) => sum + factor.weight, 0) };
  });
  const largest = Math.max(...entries.map(group => group.possible));
  for (const { name, factors, possible } of entries) {
    const row = document.querySelector('.front-contributions [data-group="' + name + '"]');
    const available = factors.filter(factor => Number.isFinite(factor.contribution));
    const earned = available.reduce((sum, factor) => sum + factor.contribution, 0);
    const covered = available.reduce((sum, factor) => sum + factor.weight, 0);
    const text = available.length ? numbers.format(earned) : '—';
    row.querySelector('.front-contribution-value').textContent = text + ' / ' + possible +
      (covered < possible ? ' · ' + (possible - covered) + ' awaiting data' : '');
    row.querySelector('.front-contribution-track').style.width = (100 * possible / largest) + '%';
    row.querySelector('i').style.width = (100 * earned / possible) + '%';
  }
}

function render(payload) {
  const index = buildIndex(payload, { days: 30 });
  if (!Number.isFinite(index.score)) throw new Error('No measured index');
  const milestones = measureMilestoneProgress(index);
  const edition = byId('front-date');
  edition.textContent = fullDate.format(Date.parse(index.date)) + ' · UTC edition';
  edition.dateTime = index.date;
  byId('front-score').textContent = numbers.format(index.score);
  byId('front-change').textContent = dailyReading(index) || 'Daily change unavailable.';
  showContributions(index);

  const reliability = index.factors.find(factor => factor.id === 'reliability');
  byId('front-reliability').textContent = Number.isFinite(reliability.value)
    ? reliability.source + ' estimates 80% success for ' + (reliability.model || 'the tested model') + ' on tasks that take an expert about ' + numbers.format(Number(reliability.value.toPrecision(2))) + ' hours.'
    : 'A reliable task-length estimate is unavailable for this reading.';
  const modelGroups = assessAcceleration(payload, { asOf: index.date }).access;
  const rankings = modelGroups.filter(group => group.models.length).map(group => {
    const leader = group.models[0];
    const category = group.label === 'Open weights' ? 'open-weight' : 'closed-weight';
    return leader.label + ' (' + category + ', ' + numbers.format(leader.value) + ')';
  });
  byId('front-breadth').textContent = rankings.length
    ? 'Top scores on the Epoch Capabilities Index come from ' + rankings.join(' and ') + '.'
    : 'Model comparison scores are currently unavailable.';
  const testsMet = index.threshold.criteria.filter(test => test.status === 'met').length;
  byId('front-verdict').textContent = index.threshold.observed
    ? 'All three tests are met, including independent evidence that AI research speeds up across generations.'
    : testsMet + ' of 3 tests met. ' + (index.threshold.criteria.find(test => test.id === 'compounding').status !== 'met'
      ? 'Independent studies have yet to trace faster gains across AI generations to AI’s own research.'
      : 'The Watch is still waiting for confirmation on the remaining tests.');
  for (const { id, score } of milestones) {
    const row = byId('front-milestones').querySelector('[data-front-milestone="' + id + '"]');
    const measured = Number.isFinite(score);
    row.querySelector('output').textContent = measured ? numbers.format(score) + '%' : 'Awaiting data';
  }
  showHistory(index);
  const report = selectReport(payload, index);
  byId('front-report').textContent = report?.context ?? 'No dated research report accompanies this reading.';
  byId('front-report-link').href = report?.url ?? './dashboard.html#factor-research-autonomy';
  renderScoreGuide(index, milestones);
}

function checkStatus(failed = false) {
  const target = byId('front-checked');
  if (!lastChecked) {
    target.textContent = 'Source check unavailable. This page will try again in a minute.';
    return;
  }
  const time = new Date(lastChecked);
  const stale = Date.now() - time.getTime() > 12 * 60 * 60 * 1000;
  const message = failed ? 'Update unavailable. Showing the last source check from ' :
    stale ? 'Awaiting a newer source check. Last checked ' : 'Last source check ';
  const status = message + checkTime.format(time) + '.';
  if (target.textContent !== status) target.textContent = status;
}

async function refresh() {
  if (loading || document.hidden) return;
  loading = true;
  try {
    const response = await fetch(feedUrl, { cache: 'no-cache', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Feed unavailable');
    const payload = await response.json();
    if (lastChecked === null || Date.parse(payload?.checkedAt) >= Date.parse(lastChecked)) {
      renderCountdownSummary(byId('front-countdown'), null, payload);
    }
    if (!hasSourceReading(payload)) throw new Error('No usable evidence');
    if (lastChecked === null || Date.parse(payload.checkedAt) > Date.parse(lastChecked)) {
      render(payload);
      lastChecked = payload.checkedAt;
    }
    checkStatus(Date.parse(payload.checkedAt) < Date.parse(lastChecked));
  } catch {
    if (!lastChecked) {
      renderCountdownSummary(byId('front-countdown'), null, null);
      byId('front-score').textContent = '—';
      byId('front-change').textContent = 'Daily change unavailable';
      byId('front-breadth').textContent = 'Model comparison data is currently unavailable.';
      byId('front-reliability').textContent = 'Task-length measurements are currently unavailable.';
      byId('front-verdict').textContent = 'The Watch needs source readings to assess the evidence.';
      byId('front-history-caption').textContent = 'The chart will appear when daily readings are available.';
      byId('front-report').textContent = 'Research readings are currently unavailable.';
      byId('front-score-guide').replaceChildren(node('p', '', 'The eight contributions are unavailable until the source feed returns.'));
      for (const row of byId('front-milestones').querySelectorAll('[data-front-milestone]')) {
        row.querySelector('output').textContent = 'Awaiting data';
        row.querySelector('[data-front-checklist]').replaceChildren(node('p', '', 'The evidence readings are currently unavailable.'));
      }
    }
    checkStatus(true);
  } finally {
    loading = false;
  }
}

function openScoreGuide() {
  if (location.hash === '#front-points') byId('front-points').open = true;
}

renderCountdownSummary(byId('front-countdown'), null, null);
openScoreGuide();
window.addEventListener('hashchange', openScoreGuide);
installGlossary(byId('main'));
if (typeof ResizeObserver === 'function') new ResizeObserver(drawHistory).observe(chart);
else window.addEventListener('resize', drawHistory);
document.addEventListener('visibilitychange', refresh);
window.setInterval(refresh, 60_000);
refresh();
