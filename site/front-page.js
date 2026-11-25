import { buildIndex, factorDefinitions } from './index-model.js';
import { dailyReading } from './reading-brief.js';
import { measureMilestoneProgress } from './milestone-progress.js';
import { installGlossary } from './glossary.js';
import { renderScoreGuide } from './front-score-guide.js';

const byId = (id) => document.getElementById(id);
const numbers = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const fullDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });
const chartDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const checkTime = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
const feedUrl = new URL('./data/signals.json', import.meta.url);
const sourceIds = new Set(factorDefinitions.map(({ id }) => id));
const chart = byId('front-history');
const svgNS = 'http://www.w3.org/2000/svg';
const paper = { ink: 'var(--front-chart-ink, #393831)', grid: 'var(--front-chart-grid, #c6c2b5)', line: 'var(--front-chart-line, #963728)' };
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

function dated(value) {
  if (typeof value !== 'string') return null;
  const day = value.slice(0, 10);
  const time = Date.parse(day);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(time) && new Date(time).toISOString().startsWith(day) ? day : null;
}

function hasReading(payload) {
  if (!Array.isArray(payload?.metrics) || !Array.isArray(payload.events) || !Array.isArray(payload.sources) ||
      !dated(payload.checkedAt) || !Number.isFinite(Date.parse(payload.checkedAt))) return false;
  const asOf = dated(payload.checkedAt);
  const measured = (date, value) => Number.isFinite(value) && dated(date) && dated(date) <= asOf;
  return payload.metrics.some((metric) => sourceIds.has(metric?.id) && (
    measured(metric.asOf, metric.value) || [metric.observations, metric.history].some((series) =>
      Array.isArray(series) && series.some((point) => point && measured(point.publishedAt ?? point.date, point.value)))
  )) || (Array.isArray(payload.releaseEvents) && dated(payload.releaseStart) && dated(payload.releaseStart) <= asOf);
}

function dailyDriver(index) {
  const prior = index.history.at(-2);
  if (!Number.isFinite(index.delta) || !index.delta || !prior) return null;
  const previous = new Map(prior.factors.map((factor) => [factor.id, factor.contribution]));
  if (index.factors.some((factor) => Number.isFinite(factor.contribution) !== Number.isFinite(previous.get(factor.id)))) return null;
  const changed = index.factors.filter((factor) => Number.isFinite(factor.contributionDelta) && factor.contributionDelta !== 0)
    .sort((a, b) => Math.abs(b.contributionDelta) - Math.abs(a.contributionDelta));
  if (!changed.length || (changed[1] && Math.abs(Math.abs(changed[0].contributionDelta) - Math.abs(changed[1].contributionDelta)) < .005)) return null;
  return { factor: changed[0], only: changed.length === 1 };
}

function headline(index, driver) {
  if (!Number.isFinite(index.delta)) return 'What the evidence shows about an AI singularity';
  if (driver?.only && driver.factor.id === 'forecast') {
    return index.delta > 0 ? 'A market forecast lifted the AI singularity index' : 'A market forecast lowered the AI singularity index';
  }
  if (index.delta === 0) return 'The AI singularity index held steady';
  return index.delta > 0 ? 'The AI singularity index rose' : 'The AI singularity index fell';
}

function drawHistory() {
  if (!history.length) return;
  const width = Math.max(200, Math.round(chart.getBoundingClientRect().width) || 360);
  if (width === chartWidth) return;
  chartWidth = width;
  const height = Math.max(146, Math.min(206, Math.round(width * .43)));
  const left = 31, right = width - 8, top = 29, bottom = height - 26;
  const x = (i) => left + (right - left) * i / Math.max(1, history.length - 1);
  const y = (score) => bottom - (bottom - top) * score / 100;
  const plot = svg('svg', { viewBox: '0 0 ' + width + ' ' + height, width: '100%', role: 'img', 'aria-labelledby': 'front-chart-title', 'aria-describedby': 'front-history-caption' });
  plot.append(svg('title', { id: 'front-chart-title' }, 'Daily evidence index on a scale of 0 to 100 points'));
  const label = (atX, atY, text, anchor = 'start') => svg('text', {
    x: atX, y: atY, 'text-anchor': anchor, class: 'front-chart-label', fill: paper.ink, 'font-family': 'system-ui, sans-serif', 'font-size': '11',
  }, text);
  plot.append(label(0, 12, 'Index points'));
  for (const value of [0, 50, 100]) {
    plot.append(svg('line', { x1: left, x2: right, y1: y(value), y2: y(value), class: value ? 'front-chart-grid' : 'front-chart-axis', stroke: paper.grid }),
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
  plot.append(svg('path', { d: path.trim(), fill: 'none', stroke: paper.line, 'stroke-width': 2.4, 'stroke-linejoin': 'round', class: 'front-chart-line' }));
  for (const i of ends) plot.append(svg('circle', { cx: x(i), cy: y(history[i].score), r: 3, fill: paper.line, class: 'front-chart-dot' }));
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
  const endpoint = (frame) => fullDate.format(Date.parse(frame.date)) + ', ' + numbers.format(frame.score) + ' points';
  const count = measured.length === history.length ? 'The index covers all ' + history.length + ' days.' :
    'The index has readings for ' + measured.length + ' of ' + history.length + ' days.';
  const coverage = measured.map(({ coverage }) => coverage);
  const low = Math.min(...coverage), high = Math.max(...coverage);
  const coverageText = low === 100 ? 'All eight inputs were available on each measured day.' :
    'Available inputs carried ' + (low === high ? low : low + '–' + high) + ' of 100 possible points on measured days.';
  const endpoints = first === last ? endpoint(first) + '.' : endpoint(first) + ' to ' + endpoint(last) + '.';
  byId('front-history-caption').textContent = endpoints + ' ' + count + ' Published values carry forward between updates. ' + coverageText;
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
    const event = payload.events.filter((entry) => safeUrl(entry?.url) === url && dated(entry.date) && dated(entry.date) <= index.date)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const date = dated(factor.publishedAt) ?? dated(event?.date);
    if (!date || date > index.date) continue;
    const value = numbers.format(factor.value);
    const independent = metric.evidenceType === 'Independent study';
    const type = independent ? 'Independent study' : metric.evidenceType === 'First-party study' ? 'First-party report' : 'Research report';
    const context = id === 'research-autonomy'
      ? factor.source + ' reported that AI completed ' + value + '% of selected internal research tasks without human intervention. Experts would take four to eight hours to do those tasks.'
      : factor.source + ' estimated that capability gains at Anthropic ran at ' + value + ' times their earlier pace. How much of that change came from AI assistance remains uncertain.';
    const fallbackTitle = id === 'research-autonomy' ? 'How often AI finishes research tasks without help' : 'How the pace of AI research changed at Anthropic';
    const title = typeof event?.title === 'string' && event.title.trim() ? event.title.trim() : fallbackTitle;
    reports.push({ url, source: factor.source, independent, type, date, title, context });
  }
  return reports.sort((a, b) => b.date.localeCompare(a.date) || Number(b.independent) - Number(a.independent))[0];
}

function showReport(payload, index) {
  const mount = byId('front-report');
  const report = selectReport(payload, index);
  if (!report) {
    mount.replaceChildren(node('p', '', 'No dated research report accompanies this reading.'));
    return;
  }
  const meta = node('p', 'front-report-meta', report.source + ' · ' + report.type + ' · ');
  const time = node('time', '', fullDate.format(Date.parse(report.date)));
  time.dateTime = report.date;
  meta.append(time);
  const title = node('h3', 'front-report-title');
  const link = node('a', '', report.title);
  link.href = report.url;
  title.append(link);
  mount.replaceChildren(meta, title, node('p', 'front-report-summary', report.context));
}

function render(payload) {
  const index = buildIndex(payload, { days: 30 });
  if (!Number.isFinite(index.score)) throw new Error('No measured index');
  const milestones = measureMilestoneProgress(index);
  const driver = dailyDriver(index);
  byId('front-headline').textContent = headline(index, driver);
  const edition = byId('front-date');
  edition.textContent = fullDate.format(Date.parse(index.date)) + ' · UTC edition';
  edition.dateTime = index.date;
  byId('front-score').textContent = numbers.format(index.score);
  byId('front-change').textContent = dailyReading(index) || 'A prior daily reading is needed to measure the change.';
  byId('front-verdict').textContent = index.threshold.observed
    ? 'Independent evidence meets the Watch’s three tests for a singularity. Across successive generations, AI is helping build better AI at an accelerating pace.'
    : 'That cycle remains unconfirmed. Independent tests still need to establish how much of the improvement comes from AI doing the research itself.';
  const driverLink = byId('front-driver-link');
  driverLink.href = './dashboard.html' + (driver ? '#factor-' + driver.factor.id : '#signals');
  driverLink.textContent = driver ? 'How we measure ' + driver.factor.label.replace(/^[A-Z](?=[a-z])/, (letter) => letter.toLowerCase()) : 'See the eight index measurements';
  for (const { id, score } of milestones) {
    const row = byId('front-milestones').querySelector('[data-front-milestone="' + id + '"]');
    const measured = Number.isFinite(score);
    row.querySelector('output').textContent = measured ? numbers.format(score) + '%' : 'Awaiting data';
    row.querySelector('.front-track i').style.width = (measured ? score : 0) + '%';
  }
  showHistory(index);
  showReport(payload, index);
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
  target.textContent = message + checkTime.format(time) + '.';
}

async function refresh() {
  if (loading || document.hidden) return;
  loading = true;
  try {
    const response = await fetch(feedUrl, { cache: 'no-cache', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Feed unavailable');
    const payload = await response.json();
    if (!hasReading(payload)) throw new Error('No usable evidence');
    if (lastChecked === null || Date.parse(payload.checkedAt) > Date.parse(lastChecked)) {
      render(payload);
      lastChecked = payload.checkedAt;
    }
    checkStatus(Date.parse(payload.checkedAt) < Date.parse(lastChecked));
  } catch {
    if (!lastChecked) {
      byId('front-score').textContent = '—';
      byId('front-change').textContent = 'The daily change is unavailable.';
      byId('front-verdict').textContent = 'The Watch needs source readings to assess the evidence.';
      byId('front-history-caption').textContent = 'The chart will appear when daily readings are available.';
      byId('front-report').replaceChildren(node('p', '', 'A source report is currently unavailable.'));
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

installGlossary(byId('main'));
if (typeof ResizeObserver === 'function') new ResizeObserver(drawHistory).observe(chart);
else window.addEventListener('resize', drawHistory);
document.addEventListener('visibilitychange', refresh);
window.setInterval(refresh, 60_000);
refresh();
