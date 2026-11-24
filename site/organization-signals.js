import { assessAcceleration } from './watchtower.js';

const DAY = 86_400_000;
const PERIODS = [30, 120, 365];
const LIMIT = 10;
const lanes = {
  agi: { tab: 'AGI', label: 'Breadth across benchmark domains', metric: 'breadth', publisher: 'Epoch AI', unit: 'ECI points',
    detail: 'One best observed model per developer on the Epoch Capabilities Index. A broader benchmark score gives one view of progress toward general capability.' },
  asi: { tab: 'ASI', label: 'Reliable work on difficult tasks', metric: 'reliability', publisher: 'METR', unit: 'hours',
    detail: 'One best observed model per developer on METR’s 80% task horizon. Hours are the time an expert would need for tasks the model is estimated to complete 80% of the time. This suite covers selected, verifiable work. Superintelligence would require much broader evidence.' },
  rsi: { tab: 'RSI', label: 'AI contributions to AI research' },
  singularity: { tab: 'Singularity', label: 'Evidence across successor generations' },
};
const watchStates = { surge: 'Corroborated', watch: 'On watch', quiet: 'Below criteria', limited: 'Limited evidence' };
const number = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const states = new WeakMap();

function day(value) {
  return typeof value === 'string' ? Date.parse(value.slice(0, 10)) : NaN;
}

function iso(time) {
  return new Date(time).toISOString().slice(0, 10);
}

function dated(value) {
  const time = day(value);
  return Number.isFinite(time) ? dateFormat.format(time) : 'Date unavailable';
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

function link(label, url) {
  const element = node('a', 'organization-signals__source', label);
  element.href = url;
  if (url.startsWith('https://')) {
    element.target = '_blank';
    element.rel = 'noopener noreferrer';
  }
  return element;
}

function sourceName(point) {
  return point.organization?.trim()
    || (/^Claude\b/i.test(point.label) ? 'Anthropic' : /^GPT\b/i.test(point.label) ? 'OpenAI' : '');
}

function getObservations(metric, breadth) {
  const developers = new Map((breadth?.observations ?? [])
    .filter((point) => point.organization?.trim())
    .map((point) => [point.label, point.organization.trim()]));
  return (metric?.observations ?? metric?.history ?? []).map((point) => ({
    ...point,
    time: day(point.date),
    organization: developers.get(point.label) || sourceName(point),
  })).filter((point) => point.organization && Number.isFinite(point.value) && Number.isFinite(point.time));
}

function rank(observations, end, days) {
  const start = end - days * DAY;
  const groups = new Map();
  for (const point of observations) {
    if (point.time <= start || point.time > end) continue;
    const current = groups.get(point.organization);
    if (!current || point.value > current.value || (point.value === current.value && point.time > current.time)) {
      groups.set(point.organization, point);
    }
  }
  return [...groups.values()].sort((a, b) => b.value - a.value || a.organization.localeCompare(b.organization)).slice(0, LIMIT);
}

function compare(rows) {
  const [leader, runner] = rows;
  return { leader, runner, gap: runner ? leader.value - runner.value : null };
}

function trend(observations, end, days) {
  const start = end - (days - 1) * DAY;
  const times = new Set([start, end]);
  for (const point of observations) {
    for (const time of [point.time, point.time + days * DAY]) {
      if (time > start && time < end) times.add(time);
    }
  }
  return [...times].sort((a, b) => a - b).map((time) => ({ time, ...compare(rank(observations, time, days)) }));
}

function researchRecords(payload) {
  const metrics = payload?.metrics ?? [];
  const acceleration = metrics.find((metric) => metric.id === 'research-acceleration');
  const autonomy = metrics.find((metric) => metric.id === 'research-autonomy');
  const independent = acceleration?.history?.at(-1);
  const internal = autonomy?.history?.at(-1);
  const records = [{
    name: 'Google DeepMind', date: '2025-05-14', kind: 'Company engineering report', reading: '1%',
    measure: 'reported reduction in Gemini training time',
    detail: 'AlphaEvolve contributed an optimization for a specific operation used in training.',
    url: 'https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/',
  }];
  if (independent && Number.isFinite(independent.value)) records.push({
    name: 'Anthropic', date: independent.publishedAt ?? independent.date, kind: 'Independent METR assessment',
    reading: number.format(independent.value) + '×', measure: 'the earlier rate of model capability gains',
    detail: (Number.isFinite(independent.low) && Number.isFinite(independent.high)
      ? 'Reported interval ' + number.format(independent.low) + '–' + number.format(independent.high) + '×. ' : '') + 'METR assessed how much AI assistance contributed. Redactions limit outside verification of the attribution.',
    url: acceleration.sourceUrl,
  });
  if (internal && Number.isFinite(internal.value)) records.push({
    name: 'OpenAI', date: internal.publishedAt ?? autonomy.asOf ?? internal.date, kind: 'Company research report',
    reading: number.format(internal.value) + '%', measure: 'unassisted success on selected internal 4–8 hour research tasks',
    detail: 'OpenAI reported the result for tasks selected by its researchers. Success varied by task type.',
    url: autonomy.sourceUrl,
  });
  return records;
}

function metricCard(label, value, detail) {
  const card = node('div', 'organization-signals__readout');
  card.append(node('span', '', label), node('strong', '', value), node('small', '', detail));
  return card;
}

function svgNode(name, attributes) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function renderTrend(points, unit) {
  const figure = node('figure', 'organization-signals__trend');
  figure.append(node('figcaption', '', 'Leader’s margin over second place'));
  const comparable = points.filter((point) => point.gap != null);
  if (!comparable.length) {
    figure.append(node('p', 'organization-signals__note', 'A comparable result from at least two developers is needed to draw a margin.'));
    return figure;
  }
  const first = points[0].time;
  const last = points.at(-1).time;
  const peak = Math.max(0.01, ...comparable.map((point) => point.gap));
  const width = 640;
  const x = (time) => 3 + (width - 6) * (time - first) / Math.max(DAY, last - first);
  const y = (gap) => 79 - 73 * gap / peak;
  const svg = svgNode('svg', { viewBox: '0 0 640 84', 'aria-hidden': 'true', preserveAspectRatio: 'none' });
  svg.append(svgNode('path', { d: 'M3 6H637 M3 42H637 M3 79H637', class: 'organization-signals__grid' }));
  let line = '';
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const prior = points[i - 1];
    if (prior?.gap != null) line += 'H' + x(current.time);
    if (current.gap == null) continue;
    line += (prior?.gap != null ? 'V' : 'M' + x(current.time) + ' ') + y(current.gap);
    svg.append(svgNode('circle', { cx: x(current.time), cy: y(current.gap), r: 2.5, class: 'organization-signals__mark' }));
  }
  svg.prepend(svgNode('path', { d: line, class: 'organization-signals__trace' }));
  const plot = node('div', 'organization-signals__plot');
  const scale = node('div', 'organization-signals__y-axis');
  scale.append(node('span', '', number.format(peak)), node('span', '', '0'));
  const dates = node('div', 'organization-signals__x-axis');
  dates.append(node('span', '', dated(iso(first))), node('span', '', 'Date'), node('span', '', dated(iso(last))));
  plot.append(scale, svg, dates);
  const history = node('details', 'organization-signals__history');
  history.append(node('summary', '', 'View dated leaders and margins'));
  const items = node('ol', '');
  const datedChanges = points.filter((point, i) => i === 0 || i === points.length - 1
    || point.gap !== points[i - 1].gap || point.leader?.organization !== points[i - 1].leader?.organization
    || point.runner?.organization !== points[i - 1].runner?.organization);
  for (const point of datedChanges.reverse()) {
    const row = node('li', '');
    row.append(node('time', '', dated(iso(point.time))),
      node('span', '', !point.leader ? 'No comparable results' : point.leader.organization
        + (!point.runner ? ' · only developer with a result' : ' · ' + number.format(point.gap) + ' ' + unit + ' ahead of ' + point.runner.organization)));
    items.append(row);
  }
  history.append(items);
  figure.append(node('p', 'organization-signals__note', 'Height shows the leader’s margin in ' + unit + '. Each date uses the selected release window.'),
    plot, history);
  return figure;
}

function renderRanking(panel, state, lane, end, metric, observations) {
  const rows = rank(observations, end, state.days);
  const { leader, runner, gap } = compare(rows);
  panel.append(node('p', 'organization-signals__note', lane.detail));
  if (metric?.sourceUrl) {
    const source = node('p', 'organization-signals__note', 'Model dates below are release dates. Later benchmark evaluations can revise these retrospective comparisons. ');
    source.append(link(lane.publisher + ' benchmark', metric.sourceUrl));
    if (lane.metric === 'reliability' && metric.asOf) {
      source.append(node('span', '', ' · report published ' + dated(metric.asOf)));
    }
    panel.append(source);
  }
  const readouts = node('div', 'organization-signals__readouts');
  const intervalOverlaps = leader?.low != null && runner?.high != null && leader.low <= runner.high;
  readouts.append(
    metricCard('Leading developer', leader?.organization ?? '—', leader ? number.format(leader.value) + ' ' + lane.unit : 'No result in this period'),
    metricCard('Margin over second', runner ? number.format(gap) + ' ' + lane.unit : '—',
      runner ? runner.organization + (intervalOverlaps ? ' · intervals overlap' : '') : 'Two developers needed'),
    metricCard('Developers shown', rows.length + ' / ' + LIMIT, dated(iso(end - (state.days - 1) * DAY)) + ' – ' + dated(iso(end))),
  );
  panel.append(readouts, renderTrend(trend(observations, end, state.days), lane.unit));
  const list = node('ol', 'organization-signals__leaderboard');
  for (const [index, point] of rows.entries()) {
    const entry = node('li', 'organization-signals__entry');
    const details = node('div', 'organization-signals__model');
    const meta = [point.label, dated(point.date), point.access].filter(Boolean);
    if (Number.isFinite(point.low) && Number.isFinite(point.high)) {
      meta.push('interval ' + number.format(point.low) + '–' + number.format(point.high) + ' ' + lane.unit);
    }
    details.append(node('strong', '', point.organization), node('small', '', meta.join(' · ')));
    const reading = node('div', 'organization-signals__score');
    reading.append(node('strong', '', number.format(point.value) + ' ' + lane.unit),
      node('small', '', index === 0 ? 'Leader' : leader.value === point.value ? 'Tied with leader'
        : number.format(leader.value - point.value) + ' ' + lane.unit + ' behind'));
    const track = node('div', 'organization-signals__bar');
    const fill = node('span', '');
    fill.style.width = (leader.value > 0 ? 100 * point.value / leader.value : 0) + '%';
    track.setAttribute('aria-hidden', 'true');
    track.append(fill);
    entry.append(node('span', 'organization-signals__rank', index + 1), details, reading, track);
    list.append(entry);
  }
  if (rows.length) {
    panel.append(node('p', 'organization-signals__note', 'Bar length shows the measured result from 0 to '
      + number.format(leader.value) + ' ' + lane.unit + ', the highest result shown.'), list);
    if (rows.length < LIMIT) panel.append(node('p', 'organization-signals__note',
      'Additional places require comparable public measurements within this period.'));
  }
}

function renderResearch(panel, state, end, records) {
  const rows = records
    .filter((record) => day(record.date) > end - state.days * DAY && day(record.date) <= end)
    .sort((a, b) => b.date.localeCompare(a.date));
  panel.append(node('p', 'organization-signals__note',
    'These reports cover particular tasks or research outcomes, in different units. A comparable ranking would need repeated, independently measured improvements to successor systems under a shared method.'));
  if (!rows.length) {
    panel.append(node('p', '', 'No tracked research reports were published in this window. Choose a longer period or an earlier ending date.'));
    return;
  }
  const coverage = node('p', 'organization-signals__note', rows.length + ' dated ' + (rows.length === 1 ? 'report' : 'reports') + ' in this period');
  const list = node('ul', 'organization-signals__records');
  for (const record of rows) {
    const entry = node('li', '');
    entry.append(node('h5', '', record.name), node('small', '', record.kind + ' · published ' + dated(record.date)),
      node('p', '', record.reading + ' ' + record.measure + '. ' + record.detail));
    if (record.url) entry.append(link('Read the report', record.url));
    list.append(entry);
  }
  panel.append(coverage, list);
}

function renderSingularity(panel, index) {
  const criteria = index?.threshold?.criteria ?? [];
  panel.append(node('p', 'organization-signals__note',
    'A company ranking would require independently documented AI-led acceleration across multiple successor generations. The latest index snapshot tracks these evidence criteria.'));
  if (!criteria.length) return;
  const confirmed = criteria.filter((criterion) => criterion.status === 'met').length;
  const readouts = node('div', 'organization-signals__readouts');
  readouts.append(metricCard('Evidence criteria met', confirmed + ' / ' + criteria.length, 'Latest index snapshot'));
  panel.append(readouts);
  const list = node('ul', 'organization-signals__records');
  for (const criterion of criteria) {
    const entry = node('li', '');
    entry.append(node('h5', '', criterion.label),
      node('small', '', criterion.status === 'met' ? 'Criterion met' : 'Awaiting qualifying evidence'),
      node('p', '', criterion.detail));
    if (criterion.sourceUrl) entry.append(link(criterion.source ?? 'Read the source', criterion.sourceUrl));
    list.append(entry);
  }
  panel.append(list);
}

function renderCorroboration(container, payload) {
  const watch = assessAcceleration(payload);
  const scans = node('div', 'organization-signals__scans');
  for (const window of watch.windows) {
    const record = window.gains.map((signal) => {
      const organization = signal.id === 'research-acceleration' ? 'Anthropic' : sourceName(signal.point ?? {});
      const subject = organization ? ' on ' + organization : '';
      return signal.publisher + subject + ' (' + signal.family.toLowerCase() + ')';
    });
    scans.append(metricCard(window.days + '-day watch', watchStates[window.state],
      record.length ? 'Qualifying: ' + record.join(' · ') : 'No qualifying finding in this window'));
  }
  const method = node('p', 'organization-signals__note',
    'Corroboration requires a capability gain and a faster research rate that each clear the watch’s cutoffs in the same window, with different assessing organizations. Multiple releases from the same developer and duplicate reports do not add independent evidence. ');
  method.append(link('See the Acceleration Watch criteria', '#watch'));
  container.replaceChildren(node('h4', '', 'How the findings add up'), scans, method);
}

function update(state) {
  const lane = lanes[state.lane];
  for (const [key, button] of state.tabs) button.setAttribute('aria-pressed', String(key === state.lane));
  for (const [days, button] of state.periods) button.setAttribute('aria-pressed', String(days === state.days));

  const metrics = state.payload?.metrics ?? [];
  const breadth = metrics.find((metric) => metric.id === 'breadth');
  const metric = metrics.find((item) => item.id === lane.metric);
  const observations = lane.metric ? getObservations(metric, breadth) : [];
  const records = state.lane === 'rsi' ? researchRecords(state.payload) : [];
  const firstDay = Math.min(...observations.map((point) => point.time), ...records.map((record) => day(record.date)));
  const lastDay = day(state.latest);
  const hasRange = state.lane !== 'singularity' && Number.isFinite(firstDay) && firstDay <= lastDay;
  state.controls.hidden = !hasRange;
  if (hasRange) {
    state.end = iso(Math.max(firstDay, Math.min(lastDay, day(state.end))));
    state.firstDay = firstDay;
    state.dateLabel.firstChild.textContent = lane.metric ? 'Release window ending ' : 'Publication window ending ';
    state.dateInput.min = iso(firstDay);
    state.dateInput.max = state.latest;
    state.dateInput.value = state.end;
    state.slider.max = String(Math.round((lastDay - firstDay) / DAY));
    state.slider.value = String(Math.round((day(state.end) - firstDay) / DAY));
    state.slider.setAttribute('aria-valuetext', dated(state.end));
    state.sliderDate.textContent = dated(state.end);
  }

  const panel = state.panel;
  panel.replaceChildren(node('h4', '', lane.label));
  if (!state.end) {
    panel.append(node('p', '', 'Waiting for dated source data.'));
    return;
  }
  const end = day(state.end);
  if (lane.metric) renderRanking(panel, state, lane, end, metric, observations);
  else if (state.lane === 'rsi') renderResearch(panel, state, end, records);
  else renderSingularity(panel, state.index);
}

function init(container) {
  const state = { lane: 'agi', days: 120, end: '', latest: '', tabs: new Map(), periods: new Map() };
  container.classList.add('organization-signals');
  const tabs = node('div', 'organization-signals__tabs');
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', 'Compare milestone signals');
  for (const [key, lane] of Object.entries(lanes)) {
    const button = node('button', '', lane.tab);
    button.type = 'button';
    button.addEventListener('click', () => { state.lane = key; update(state); });
    state.tabs.set(key, button);
    tabs.append(button);
  }
  const controls = node('div', 'organization-signals__toolbar');
  const periods = node('div', 'organization-signals__tabs');
  periods.setAttribute('role', 'group');
  periods.setAttribute('aria-label', 'Comparison period');
  for (const days of PERIODS) {
    const button = node('button', '', days + ' days');
    button.type = 'button';
    button.addEventListener('click', () => { state.days = days; update(state); });
    state.periods.set(days, button);
    periods.append(button);
  }
  const dateLabel = node('label', 'organization-signals__date', 'Release window ending ');
  const dateInput = node('input', '');
  dateInput.type = 'date';
  dateInput.required = true;
  dateInput.addEventListener('change', () => {
    if (!dateInput.value || !dateInput.validity.valid) {
      dateInput.value = state.end;
      return;
    }
    state.end = dateInput.value;
    update(state);
  });
  dateLabel.append(dateInput);
  const scrubber = node('label', 'organization-signals__scrubber');
  const sliderDate = node('span', '');
  const slider = node('input', '');
  slider.type = 'range';
  slider.min = '0';
  slider.step = '1';
  slider.setAttribute('aria-label', 'Slide through comparison dates');
  slider.addEventListener('input', () => {
    state.end = iso(state.firstDay + Number(slider.value) * DAY);
    update(state);
  });
  scrubber.append(node('span', '', 'Slide through dates'), sliderDate, slider);
  controls.append(periods, dateLabel, scrubber);
  state.controls = controls;
  state.dateInput = dateInput;
  state.dateLabel = dateLabel;
  state.slider = slider;
  state.sliderDate = sliderDate;
  state.panel = node('div', 'organization-signals__panel');
  state.corroboration = node('aside', 'organization-signals__corroboration');
  container.replaceChildren(node('h3', '', 'Organization leaderboards'), tabs, controls, state.panel, state.corroboration);
  states.set(container, state);
  return state;
}

export function renderOrganizationSignals(container, { payload, index } = {}) {
  if (!container) return;
  const state = states.get(container) ?? init(container);
  state.payload = payload;
  state.index = index;
  const checkedAt = day(payload?.checkedAt);
  if (Number.isFinite(checkedAt)) {
    const latest = iso(checkedAt);
    if (!state.end || state.end === state.latest) state.end = latest;
    state.latest = latest;
  }
  update(state);
  if (payload) renderCorroboration(state.corroboration, payload);
}
