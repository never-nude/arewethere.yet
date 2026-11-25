import { formatCost, modelTrainingCost } from './observatory-investment.js';
import { dated } from './observatory-criteria.js';
import { indicatorObservations } from './observatory-forecast.js';
import { scoredModelObservations } from './observatory-scored-models.js';

const accessGroups = ['open', 'closed'];
const accessLabels = {open: 'Open', closed: 'Closed', other: 'Other / unspecified'};
const number = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
const monthFormat = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const monthLabel = date => monthFormat.format(new Date(date.slice(0, 10) + 'T00:00:00Z'));
const day = date => (date || '').slice(0, 10);
const compareDate = (a, b) => a.referenceOn.localeCompare(b.referenceOn);

function eligibleRows(assessment) {
  const cutoff = day(assessment.evidenceCutoff || assessment.checkpointAt);
  if (!dated(cutoff)) return [];
  return (assessment.observations || []).filter(row => row && Number.isFinite(row.value) &&
    dated(row.referenceOn) && row.referenceOn <= cutoff && (!row.publishedOn || row.publishedOn <= cutoff) &&
    !['unavailable', 'withdrawn', 'retracted', 'missing'].includes(row.sourceStatus));
}

function rankModelVersions(rows) {
  const versions = new Map();
  for (const row of [...rows].sort((a, b) => compareDate(b, a) || (b.retrievedAt || '').localeCompare(a.retrievedAt || ''))) {
    const key = row.system.trim().toLowerCase().replace(/\s+/g, ' ');
    if (key && !versions.has(key)) versions.set(key, row);
  }
  return [...versions.values()].sort((a, b) => b.value - a.value || a.system.localeCompare(b.system));
}

export function chartMeasurements(assessment) {
  const rows = eligibleRows(assessment);
  const modelRows = { open: [], closed: [], other: [] };
  for (const row of scoredModelObservations(assessment)) {
    const group = row.weightAccess === 'Open weights' ? 'open' : row.weightAccess === 'Closed weights' ? 'closed' : 'other';
    modelRows[group].push(row);
  }
  const rankings = rankingsThrough(modelRows);
  const reliable = rows.filter(row => row.topic === 'reliability' && row.unit === 'h' && row.value > 0 &&
    row.system && row.source === 'METR' && row.classification === 'Independent evaluation' &&
    row.referenceDateBasis === 'Model release date' && dated(row.publishedOn));
  const history = monthlyHorizons(reliable);
  const halfHistory = monthlyHorizons(indicatorObservations(rows, 'task-horizon').filter(row => row.value > 0 && dated(row.publishedOn)));
  const rate = rows.filter(row => row.topic === 'research-acceleration' && row.unit === '×' && row.value >= 0 &&
    row.source === 'METR' && row.organization === 'Anthropic' && row.classification === 'Independent evaluation').sort(compareDate).at(-1);
  const tasks = rows.filter(row => row.topic === 'research-autonomy' && row.unit === '%' &&
    row.source === 'OpenAI' && row.organization === 'OpenAI' && row.classification === 'First-party measurement' &&
    row.value >= 0 && row.value <= 100).sort(compareDate);
  return { rankings, modelRows, history, halfHistory, rate, tasks };
}

export function rankingsThrough(modelRows, month) {
  return Object.fromEntries(Object.keys(modelRows).map(group => [group, rankModelVersions(modelRows[group].filter(
    row => !month || row.referenceOn.slice(0, 7) <= month))]));
}

function monthlyHorizons(records) {
  const report = records.map(row => row.publishedOn).sort().at(-1);
  const bestPerMonth = new Map();
  for (const row of records.filter(row => row.publishedOn === report).sort(compareDate)) {
    const month = row.referenceOn.slice(0, 7);
    if (!bestPerMonth.has(month) || row.value > bestPerMonth.get(month).value) bestPerMonth.set(month, row);
  }
  return [...bestPerMonth.values()];
}

function interval(row) {
  return Number.isFinite(row.low) && Number.isFinite(row.high) && row.low <= row.value && row.value <= row.high;
}

export function scoreDomain(rows) {
  if (!rows.length) return null;
  const lows = rows.map(row => interval(row) ? row.low : row.value);
  const highs = rows.map(row => interval(row) ? row.high : row.value);
  const min = Math.min(...lows), max = Math.max(...highs);
  const step = Math.max(1, 0.5 * 10 ** Math.floor(Math.log10(Math.max(max - min, 1))));
  return [Math.floor((min - 0.1) / step) * step, Math.ceil((max + 0.1) / step) * step];
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function detailLink(label, anchor) {
  const url = new URL('./dashboard.html', location.href);
  const edition = new URL(location.href).searchParams.get('assessment');
  if (edition) url.searchParams.set('assessment', edition);
  url.hash = anchor;
  const link = element('a', 'mc-detail-link', label);
  link.href = url.href;
  return link;
}

function intervalText(row) {
  return interval(row) ? number.format(row.low) + '–' + number.format(row.high) : 'Unreported';
}

function dataTable(summary, headers, body) {
  const details = element('details', 'mc-details');
  details.append(element('summary', '', summary));
  const wrap = element('div', 'mc-table-wrap');
  const table = element('table');
  table.append(element('caption', 'mc-sr', summary));
  const head = table.createTHead().insertRow();
  for (const text of headers) {
    const cell = element('th', '', text);
    cell.scope = 'col';
    head.append(cell);
  }
  const tbody = table.createTBody();
  details.addEventListener('toggle', function fillWhenOpened() {
    if (!details.open) return;
    for (const fields of body) {
      const row = tbody.insertRow();
      for (const value of fields) row.insertCell().textContent = value;
    }
    details.removeEventListener('toggle', fillWhenOpened);
  });
  wrap.append(table);
  details.append(wrap);
  return details;
}

function rangeTrack(row, domain) {
  const [min, max] = domain;
  const percent = value => (value - min) * 100 / (max - min) + '%';
  const track = element('div', 'mc-track');
  track.setAttribute('aria-hidden', 'true');
  if (interval(row)) {
    const line = element('i', 'mc-range');
    line.style.left = percent(row.low);
    line.style.right = (max - row.high) * 100 / (max - min) + '%';
    track.append(line);
  }
  const point = element('i', 'mc-mark');
  point.style.left = percent(row.value);
  track.append(point);
  return track;
}

function axis(labels) {
  const el = element('div', 'mc-axis');
  el.setAttribute('aria-hidden', 'true');
  for (const label of labels) el.append(element('span', '', label));
  return el;
}

function noteDisclosure(label, text) {
  const details = element('details', 'mc-details');
  details.append(element('summary', '', label), element('p', 'mc-small', text));
  return details;
}

function stepButton(label, direction) {
  const button = element('button', 'mc-step', direction === 'previous' ? '‹' : '›');
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.title = label;
  return button;
}

const monthIndex = date => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
function calendarMonth(index) {
  return Math.floor(index / 12) + '-' + String((index % 12) + 1).padStart(2, '0');
}

// Each point represents all scored model versions released by the end of that month.
function rankingTimeline(modelRows, change) {
  const records = Object.values(modelRows).flat();
  if (!records.length) return null;
  const releaseMonths = [...new Set(records.map(row => monthIndex(row.referenceOn)))].sort((a, b) => a - b);
  const first = releaseMonths[0], last = releaseMonths.at(-1);
  const dates = Array.from({ length: last - first + 1 }, (_, index) => calendarMonth(first + index));
  const leaders = dates.map(date => {
    const groups = rankingsThrough(modelRows, date);
    return accessGroups.map(group => groups[group][0]?.value);
  });
  const values = leaders.flat().filter(Number.isFinite);
  const low = values.length ? Math.floor(Math.min(...values) / 10) * 10 : 0;
  const high = Math.max(low + 10, Math.ceil(Math.max(...values) / 10) * 10);
  const svg = svgItem('svg', { viewBox: '0 0 640 76', class: 'mc-history-chart', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  const x = i => first === last ? 320 : 4 + (i - first) * 632 / (last - first);
  const y = value => 67 - (value - low) * 59 / (high - low);
  for (const h of [low, high]) svg.append(svgItem('line', { x1: 4, x2: 636, y1: y(h), y2: y(h), class: 'mc-gridline' }));
  for (const [j, group] of accessGroups.entries()) {
    let path = '';
    leaders.forEach((scores, i) => {
      if (!Number.isFinite(scores[j])) return;
      const px = x(first + i), py = y(scores[j]);
      path += path ? ' H ' + px + ' V ' + py : 'M ' + px + ' ' + py;
    });
    if (path) svg.append(svgItem('path', { d: path, class: 'mc-leader-trend mc-' + group }));
  }
  const marker = svgItem('line', { y1: 2, y2: 72, class: 'mc-history-cursor' });
  svg.append(marker);
  const dots = accessGroups.map(group => {
    const dot = svgItem('circle', { r: 3.7, class: 'mc-leader-dot mc-' + group });
    svg.append(dot);
    return dot;
  });
  const box = element('div', 'mc-explorer');
  const header = element('div', 'mc-explorer-heading');
  const date = element('output', 'mc-month');
  date.setAttribute('for', 'mc-release-month');
  const label = element('label', '', 'Models released through');
  label.htmlFor = 'mc-release-month';
  header.append(label, date);
  const sides = element('div', 'mc-history-frame');
  sides.append(svg);
  const scale = element('div', 'mc-history-scale');
  scale.append(element('span', '', high), element('span', '', low));
  sides.prepend(scale);
  const controls = element('div', 'mc-controls');
  const previous = stepButton('Previous release month', 'previous'), next = stepButton('Next release month', 'next');
  const slider = element('input', 'mc-time-range');
  slider.type = 'range';
  slider.id = 'mc-release-month';
  slider.min = first;
  slider.max = last;
  slider.step = '1';
  slider.disabled = first === last;
  const endpoints = axis([monthLabel(dates[0] + '-01'), monthLabel(dates.at(-1) + '-01')]);
  controls.append(previous, slider, next);
  const key = element('div', 'mc-history-key');
  key.append(element('span', 'mc-key-open', 'Open weights'), element('span', 'mc-key-closed', 'Closed weights'), element('span', '', 'ECI points'));
  box.append(header, key, sides, controls, endpoints);
  function select(index) {
    const value = Math.max(first, Math.min(last, index));
    const activeMonth = dates[value - first], monthText = monthLabel(activeMonth + '-01');
    slider.value = value;
    slider.setAttribute('aria-valuetext', monthText);
    date.textContent = monthText;
    previous.disabled = value <= first;
    next.disabled = value >= last;
    marker.setAttribute('x1', x(value));
    marker.setAttribute('x2', x(value));
    dots.forEach((dot, j) => {
      const score = leaders[value - first][j];
      dot.style.display = Number.isFinite(score) ? '' : 'none';
      if (Number.isFinite(score)) { dot.setAttribute('cx', x(value)); dot.setAttribute('cy', y(score)); }
    });
    change(rankingsThrough(modelRows, activeMonth));
  }
  slider.addEventListener('input', () => select(Number(slider.value)));
  previous.addEventListener('click', () => select(releaseMonths.findLast(m => m < Number(slider.value)) ?? first));
  next.addEventListener('click', () => select(releaseMonths.find(m => m > Number(slider.value)) ?? last));
  svg.addEventListener('click', event => {
    const rect = svg.getBoundingClientRect();
    select(Math.round(first + (last - first) * (event.clientX - rect.left) / rect.width));
  });
  select(last);
  return box;
}

function rankingGroup(group, rows, domain, limit) {
  const box = element('section', 'mc-ranking mc-' + group);
  box.id = 'chart-' + group + '-models';
  box.append(element('h4', '', group === 'open' ? 'Open-weight models' : 'Closed-weight models'));
  if (!rows.length) {
    box.append(element('p', 'mc-empty', 'No scored releases in this group by this date.'));
    return box;
  }
  const list = element('ol', 'mc-models');
  for (const row of rows.slice(0, limit)) {
    const item = element('li'), label = element('div', 'mc-score');
    label.append(element('span', '', row.system), element('strong', '', number.format(row.value)));
    item.append(label, rangeTrack(row, domain), element('span', 'mc-sr', 'ECI points. ' +
      (interval(row) ? (row.intervalLabel || 'Reported interval') + ' ' + intervalText(row) + '.' : 'Interval unreported.')));
    list.append(item);
  }
  box.append(list, axis([domain[0], 'ECI points', domain[1]]));
  return box;
}

export function catalogEntries(rankings) {
  const ordered = Object.entries(rankings).flatMap(([access, rows]) => rows.map(row => ({ row, access })))
    .sort((a, b) => b.row.value - a.row.value || a.row.system.localeCompare(b.row.system));
  let rank = 0;
  return ordered.map((entry, i) => {
    if (!i || entry.row.value !== ordered[i - 1].row.value) rank = i + 1;
    return { ...entry, rank };
  });
}

function labeledSelect(label, options) {
  const wrapper = element('label', '', label);
  const select = element('select');
  for (const [value, name] of options) select.add(new Option(name, value));
  wrapper.append(select);
  return { wrapper, select };
}

function modelCatalog(assessment) {
  const details = element('details', 'mc-details mc-catalog');
  const summary = element('summary');
  const queryLabel = element('label', '', 'Find a model or developer');
  const query = element('input');
  query.type = 'search';
  query.placeholder = 'Search models';
  queryLabel.append(query);
  const access = labeledSelect('Weight access', [['all', 'All groups'], ...Object.entries(accessLabels)]);
  const sort = labeledSelect('Sort by', [['score', 'Highest score'], ['cost', 'Highest training cost'], ['newest', 'Newest release'], ['name', 'Model name']]);
  const filters = element('div', 'mc-catalog-tools');
  filters.append(queryLabel, access.wrapper, sort.wrapper);
  const costFilter = element('label', 'mc-cost-filter');
  const withCost = element('input');
  withCost.type = 'checkbox';
  costFilter.append(withCost, 'Has a training cost estimate');
  const count = element('p', 'mc-small');
  count.setAttribute('role', 'status');
  const table = element('table', 'mc-catalog-table');
  table.append(element('caption', 'mc-sr', 'Scored model versions released through the selected month'));
  const headers = ['Rank', 'Model version', 'Weight access', 'ECI points', 'Released', 'Est. training cost'];
  const head = table.createTHead().insertRow();
  for (const label of headers) {
    const th = element('th', '', label);
    th.scope = 'col';
    head.append(th);
  }
  const tbody = table.createTBody();
  const wrap = element('div', 'mc-table-wrap');
  wrap.append(table);
  const previous = stepButton('Previous results', 'previous'), next = stepButton('Next results', 'next');
  const pagination = element('div', 'mc-point-picker'), pageNo = element('span');
  pagination.append(previous, pageNo, next);
  details.append(summary, filters, costFilter, count, wrap, pagination,
    element('p', 'mc-small', 'Ranks cover all scored releases through the selected month. Costs are Epoch AI estimates of training hardware and energy in 2023 US dollars. “No figure” means this edition has no matching estimate.'));
  let entries = [], page = 0;
  const size = 15;
  const archived = new URL(location.href).searchParams.has('assessment');
  function render(reset = false) {
    if (reset) page = 0;
    if (!details.open) return;
    const text = query.value.trim().toLowerCase();
    const matches = entries.filter(({ row, access: group, cost }) => (!withCost.checked || Number.isFinite(cost)) && (access.select.value === 'all' || access.select.value === group) &&
      (row.system + ' ' + (row.organization || '')).toLowerCase().includes(text));
    if (sort.select.value === 'newest') matches.sort((a, b) => compareDate(b.row, a.row) || a.rank - b.rank);
    if (sort.select.value === 'name') matches.sort((a, b) => a.row.system.localeCompare(b.row.system));
    if (sort.select.value === 'cost') matches.sort((a, b) => (b.cost ?? -1) - (a.cost ?? -1) || a.rank - b.rank);
    const pages = Math.ceil(matches.length / size);
    page = Math.max(0, Math.min(page, pages - 1));
    tbody.replaceChildren();
    for (const { row, access: group, rank, cost } of matches.slice(page * size, (page + 1) * size)) {
      const tr = tbody.insertRow();
      for (const [i, field] of [rank, row.system, accessLabels[group], number.format(row.value), row.referenceOn, formatCost(cost)].entries()) {
        const cell = i === 1 ? element('th', '', field) : element('td', '', field);
        if (i === 1) {
          cell.scope = 'row';
          if (row.organization) cell.append(element('small', '', row.organization));
        }
        if (i === 3 && interval(row)) {
          const range = element('small', '', intervalText(row));
          range.title = row.intervalLabel || 'Reported uncertainty interval';
          range.prepend(element('span', 'mc-sr', range.title + ' '));
          cell.append(range);
        }
        cell.dataset.label = headers[i];
        tr.append(cell);
      }
    }
    count.textContent = matches.length ? (page * size + 1) + '–' + Math.min((page + 1) * size, matches.length) + ' of ' + matches.length + ' matching model versions' : 'No models match these filters.';
    wrap.hidden = !matches.length;
    pagination.hidden = pages <= 1;
    previous.disabled = page === 0;
    next.disabled = page >= pages - 1;
    pageNo.textContent = 'Page ' + (page + 1) + ' of ' + pages;
  }
  query.addEventListener('input', () => render(true));
  access.select.addEventListener('change', () => render(true));
  sort.select.addEventListener('change', () => render(true));
  withCost.addEventListener('change', () => render(true));
  previous.addEventListener('click', () => { page--; render(); });
  next.addEventListener('click', () => { page++; render(); });
  details.addEventListener('toggle', () => render());
  return { details, update(rankings) {
    entries = catalogEntries(rankings).map(entry => ({ ...entry, cost: modelTrainingCost(assessment, entry.row.system, { archived }) }));
    summary.textContent = 'Search all ' + entries.length + ' scored model versions';
    render(true);
  }};
}

function rankingPanel(data, detailed, assessment) {
  const limit = detailed ? 5 : 3;
  const panel = element('article', 'mc-panel mc-rankings');
  panel.append(element('h3', '', 'Which models led when?'),
    element('p', 'mc-intro', 'Move through model releases to compare the leaders on Epoch AI’s broad tests.'));
  const groups = element('div', 'mc-rank-groups');
  const catalog = modelCatalog(assessment);
  function show(rankings) {
    catalog.update(rankings);
    const domain = scoreDomain(accessGroups.flatMap(group => rankings[group].slice(0, limit)));
    groups.replaceChildren(...accessGroups.map(group => rankingGroup(group, rankings[group], domain, limit)));
  }
  const explorer = rankingTimeline(data.modelRows, show);
  if (explorer) panel.append(explorer);
  else show(data.rankings);
  panel.append(groups, catalog.details);
  if (explorer) {
    const records = Object.values(data.rankings).flat();
    const retrieved = records.map(row => row.retrievedAt).filter(Boolean).sort().at(-1);
    const saved = records.some(row => row.sourceStatus === 'snapshot');
    const intervals = [...new Set(records.filter(interval).map(row => row.intervalLabel).filter(Boolean))];
    const rangeNote = intervals.length === 1 ? 'Each range is Epoch AI’s ' + intervals[0] + '. ' : '';
    panel.append(element('p', 'mc-source', 'Epoch AI · ' + (saved ? 'Saved scores' : 'Scores') +
      (retrieved ? ' from ' + day(retrieved) : ' in this edition') + ' applied to earlier releases. Dots show estimates. Lines show uncertainty.'),
      noteDisclosure('How to read the rankings', 'The Epoch Capabilities Index combines scores across tests. Higher values indicate stronger test performance, and the scale extends above 100. Each group ranks individual model versions. ' + rangeNote + 'Overlapping ranges make close rankings uncertain. Earlier months use the scores in this edition, including later evaluations. The monthly benchmark forecast uses the best score among models released in each month.'));
    if (!detailed) panel.append(detailLink('Explore the dashboard measurements', 'chart-open-models'));
  }
  return panel;
}

const svgNS = 'http://www.w3.org/2000/svg';
function svgItem(tag, attrs, text) {
  const el = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  if (text) el.textContent = text;
  return el;
}

// The chart is a keyboard-operable slider as well as a direct point picker.
function horizonChart(history, target, onSelect) {
  const svg = svgItem('svg', { viewBox: '0 0 360 116', class: 'mc-horizon', role: 'slider', tabindex: 0,
    'aria-label': target + '% task horizon by release month', 'aria-valuemin': 1, 'aria-valuemax': history.length });
  const start = monthIndex(history[0].referenceOn), end = monthIndex(history.at(-1).referenceOn);
  const peak = Math.max(...history.map(row => row.value));
  const power = 10 ** Math.floor(Math.log10(peak));
  const max = ([1, 2, 3, 4, 5, 6, 8, 10].find(n => n * power >= peak) || 10) * power;
  const x = row => start === end ? 191 : 34 + (monthIndex(row.referenceOn) - start) * 315 / (end - start);
  const y = hours => 86 - hours * 73 / max;
  for (const value of [0, max / 2, max]) {
    svg.append(svgItem('line', { x1: 34, x2: 349, y1: y(value), y2: y(value), class: 'mc-gridline' }),
      svgItem('text', { x: 27, y: y(value) + 4, 'text-anchor': 'end' }, number.format(value) + 'h'));
  }
  for (let i = 0; i < history.length; i++) {
    const current = history[i], previous = history[i - 1];
    if (previous && monthIndex(current.referenceOn) === monthIndex(previous.referenceOn) + 1)
      svg.append(svgItem('line', { x1: x(previous), x2: x(current), y1: y(previous.value), y2: y(current.value), class: 'mc-trend' }));
    svg.append(svgItem('circle', { cx: x(current), cy: y(current.value), r: 3.5, class: 'mc-history-dot' }));
  }
  if (start !== end) svg.append(svgItem('text', { x: 34, y: 107 }, monthLabel(history[0].referenceOn)));
  svg.append(svgItem('text', { x: 349, y: 107, 'text-anchor': 'end' }, monthLabel(history.at(-1).referenceOn)));
  const selection = svgItem('circle', { r: 7, class: 'mc-point-ring' });
  svg.append(selection);
  let index;
  function select(i) {
    index = Math.max(0, Math.min(i, history.length - 1));
    const row = history[index];
    svg.setAttribute('aria-valuenow', index + 1);
    svg.setAttribute('aria-valuetext', monthLabel(row.referenceOn) + ', ' + row.system + ', ' + number.format(row.value) + ' expert hours');
    selection.setAttribute('cx', x(row));
    selection.setAttribute('cy', y(row.value));
    onSelect(row, index);
  }
  svg.addEventListener('click', event => {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(svg.getScreenCTM().inverse()).x;
    const closest = history.reduce((best, row, i) => Math.abs(x(row) - local) < Math.abs(x(history[best]) - local) ? i : best, 0);
    select(closest);
  });
  svg.addEventListener('keydown', event => {
    const keyToIndex = { ArrowLeft: index - 1, ArrowDown: index - 1, ArrowRight: index + 1, ArrowUp: index + 1, Home: 0, End: history.length - 1 };
    if (Object.hasOwn(keyToIndex, event.key)) {
      event.preventDefault();
      select(keyToIndex[event.key]);
    }
  });
  select(history.length - 1);
  return { svg, step: amount => select(index + amount) };
}

function horizonPanel(data, detailed, outlook) {
  const panel = element('article', 'mc-panel');
  panel.id = 'chart-task-horizons';
  panel.append(element('h3', '', 'How much work can AI finish?'));
  if (!data.history.length && !data.halfHistory.length) {
    panel.append(element('p', 'mc-empty', 'This edition has no comparable task measurements.'));
    return panel;
  }
  const choices = element('div', 'mc-choices');
  choices.setAttribute('role', 'group');
  choices.setAttribute('aria-label', 'Choose success rate');
  const body = element('div');
  const buttons = new Map();
  function show(target) {
    const history = target === 80 ? data.history : data.halfHistory;
    for (const [value, button] of buttons) button.setAttribute('aria-pressed', value === target);
    const observation = element('div', 'mc-observation');
    observation.setAttribute('aria-live', 'polite');
    const stat = element('p', 'mc-number'), model = element('p', 'mc-readout'), intervalNote = element('p', 'mc-small');
    observation.append(stat, model, intervalNote);
    const previous = stepButton('Previous measured month', 'previous'), next = stepButton('Next measured month', 'next');
    const chart = horizonChart(history, target, (row, index) => {
      stat.textContent = number.format(row.value) + ' hours';
      model.textContent = row.system + ' · ' + monthLabel(row.referenceOn);
      intervalNote.textContent = interval(row) ? (row.intervalLabel || 'Reported interval') + ' of ' + intervalText(row) + ' expert hours.' : 'The source gives no uncertainty interval.';
      previous.disabled = index === 0;
      next.disabled = index === history.length - 1;
    });
    previous.addEventListener('click', () => chart.step(-1));
    next.addEventListener('click', () => chart.step(1));
    const picker = element('div', 'mc-point-picker');
    picker.append(previous, element('span', '', 'Choose a release month'), next);
    const latest = history.at(-1);
    const sourceNote = 'METR estimates the task length at which a model succeeds ' + target + '% of the time. Dots mark the best model released in each measured month. The 50% and 80% suites can differ. Report published ' + latest.publishedOn + '. ' +
      (outlook ? 'The milestone scenarios use the 80% series to estimate when eight- and 40-hour tasks become feasible. The 50% series informs the separate monthly task forecast.' : 'These are measurements from the selected edition.');
    body.replaceChildren(observation, chart.svg, picker, noteDisclosure('What do the hours measure?', sourceNote));
    if (detailed) body.append(dataTable('Every monthly result at ' + target + '% success',
      ['Model released', 'Month', 'Expert hours', 'Reported interval (h)'],
      history.map(row => [row.system, monthLabel(row.referenceOn), number.format(row.value), intervalText(row)])));
  }
  for (const target of [80, 50]) {
    const button = element('button', '', target + '% success');
    button.type = 'button';
    button.disabled = !(target === 80 ? data.history.length : data.halfHistory.length);
    button.addEventListener('click', () => show(target));
    choices.append(button);
    buttons.set(target, button);
  }
  panel.append(element('p', 'mc-intro', 'METR measures task length in human expert working hours.'), choices, body);
  show(data.history.length ? 80 : 50);
  if (!detailed) panel.append(detailLink('Explore task lengths', 'chart-task-horizons'));
  return panel;
}

function researchPanel(data, detailed) {
  const panel = element('article', 'mc-panel mc-research');
  panel.id = 'chart-research';
  panel.append(element('h3', '', 'Is AI research speeding up?'));
  const { rate, tasks } = data;
  if (rate) {
    panel.append(element('p', 'mc-number', number.format(rate.value) + '×'),
      element('p', 'mc-intro', 'The rate of improvement on selected capability tests at Anthropic, compared with the lab’s earlier pace.'));
    const domain = [0, Math.max(2, Math.ceil(interval(rate) ? rate.high : rate.value))];
    const track = rangeTrack(rate, domain);
    const baseline = element('i', 'mc-baseline');
    baseline.style.left = 100 / domain[1] + '%';
    track.append(baseline);
    const chart = element('div', 'mc-rate-chart');
    chart.append(track, axis(['0×', domain[1] + '×']));
    panel.append(chart, element('p', 'mc-small', 'The vertical tick marks the earlier pace (1×).' +
      (interval(rate) ? ' METR’s ' + (rate.intervalLabel || 'reported interval') + ' is ' + intervalText(rate) + '×.' : '')),
      element('p', 'mc-source', 'METR · Independent assessment of one lab, published ' + (rate.publishedOn || rate.referenceOn) + '.'));
  }
  if (tasks.length && (detailed || !rate)) {
    panel.append(element('h4', 'mc-second-measure', 'Research tasks finished without help'));
    const chart = element('ul', 'mc-task-bars');
    for (const row of tasks) {
      const item = element('li');
      const label = element('div', 'mc-score');
      label.append(element('span', '', monthLabel(row.referenceOn)), element('strong', '', number.format(row.value) + '%'));
      const track = element('div', 'mc-bar-bg'), fill = element('span', 'mc-bar-fill');
      track.setAttribute('aria-hidden', 'true');
      fill.style.width = row.value + '%';
      track.append(fill);
      item.append(label, track);
      chart.append(item);
    }
    panel.append(chart, element('p', 'mc-source', 'OpenAI · The lab measured unassisted completion of its own selected research tasks requiring four to eight hours of human work. Task selection can change.'));
  }
  if (!rate && !tasks.length) panel.append(element('p', 'mc-empty', 'This edition has no comparable research measurements.'));
  else {
    panel.append(element('p', 'mc-role', 'Attributing faster progress to AI requires separating its contribution from changes in staffing, computing power and other inputs.'));
    if (!detailed) panel.append(detailLink('Explore the research evidence', 'chart-research'));
  }
  return panel;
}

export function renderMetricCharts(root, assessment, { detailed = false, arrivalOutlook = assessment.arrivalOutlook } = {}) {
  if (!root) return;
  const data = chartMeasurements(assessment);
  const grid = element('div', 'mc-grid');
  grid.append(rankingPanel(data, detailed, assessment), horizonPanel(data, detailed, arrivalOutlook), researchPanel(data, detailed));
  root.replaceChildren(element('h2', 'mc-heading', 'Measured AI capabilities'), grid);
}
