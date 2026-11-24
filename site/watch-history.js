import { getWatchdogAnomaly, watchdogContext } from './watchdog-context.js';

const periods = [7, 14, 30, 90, 180];
const kinds = {
  release: 'Release', gain: 'Benchmark gain', drop: 'Benchmark drop', measured: 'Benchmark reading',
  report: 'Research report', incident: 'Service incident', context: 'Context',
};
const markerRows = [
  ['release'], ['gain', 'drop', 'measured', 'report'], ['incident'], ['context'],
];
const monthDay = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const fullDate = new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const incidentTime = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' });
const number = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
const states = new WeakMap();

function dateOf(value) {
  const date = typeof value === 'string' ? value.slice(0, 10) : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) ? date : '';
}

function dayLabel(date, style = fullDate) {
  return style.format(new Date(date));
}

function organization(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (/^(?:Google(?: AI| DeepMind)?|Gemini)$/i.test(name)) return 'Google';
  if (/^(?:OpenAI(?: Status)?|ChatGPT)$/i.test(name)) return 'OpenAI';
  if (/^(?:Anthropic(?: Status)?|Claude)$/i.test(name)) return 'Anthropic';
  return name;
}

function item(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function sourceLink(label, url) {
  try {
    const target = new URL(url);
    if (target.protocol !== 'https:') return null;
    const link = item('a', label + ' ↗');
    link.href = target.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  } catch { return null; }
}

function change(value) {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${number.format(Math.abs(value))}`;
}

function benchmarkEvents(metric) {
  const bestByDate = new Map();
  for (const point of metric?.observations ?? metric?.history ?? []) {
    const date = dateOf(point.date);
    const provider = organization(point.organization);
    if (!date || !provider || !point.access || !point.label || !Number.isFinite(point.value)) continue;
    const group = `${provider}\n${point.access}`;
    const key = `${group}\n${date}`;
    if (!bestByDate.has(key) || point.value > bestByDate.get(key).value) bestByDate.set(key, { ...point, date, provider, group });
  }
  const previous = new Map();
  return [...bestByDate.values()].sort((a, b) => a.date.localeCompare(b.date)).map((point) => {
    const prior = previous.get(point.group);
    previous.set(point.group, point);
    const delta = prior ? Math.round((point.value - prior.value) * 100) / 100 : 0;
    const comparable = prior && [point.low, point.high, prior.low, prior.high].every(Number.isFinite);
    const overlap = comparable && Math.max(point.low, prior.low) <= Math.min(point.high, prior.high);
    const summary = prior
      ? `${number.format(point.value)} ECI, ${change(delta)} points versus ${prior.label} on ${dayLabel(prior.date, monthDay)}. ${point.access}.`
      : `${number.format(point.value)} ECI. ${point.access}. First comparable reading in this dataset.`;
    return {
      date: point.date, provider: point.provider, kind: delta > 0 ? 'gain' : delta < 0 ? 'drop' : 'measured',
      title: point.label, detail: summary + (overlap ? ' Published uncertainty ranges overlap.' : ''),
      url: metric.sourceUrl, source: metric.source || 'Epoch AI',
    };
  });
}

function indexedEvents(payload, frames) {
  const events = new Map();
  const allReports = (payload?.events ?? []).filter((event) => /^(?:Research|Evaluation)$/i.test(event.category));
  const releases = payload?.releaseEvents ?? (payload?.events ?? []).filter((event) => /^Release$/i.test(event.category));
  const coverage = payload?.incidentSources ?? [];
  const providerByName = new Map(coverage.map((source) => [organization(source.organization), source]));
  const append = (record) => {
    if (!record.date || !record.title) return;
    const list = events.get(record.date) ?? [];
    if (list.some((prior) => prior.kind === record.kind && prior.title === record.title && prior.provider === record.provider)) return;
    list.push(record);
    events.set(record.date, list);
  };

  for (const release of releases) append({
    date: dateOf(release.date), kind: 'release', provider: organization(release.organization ?? release.source),
    title: release.title, detail: release.summary, source: release.source, url: release.url,
  });
  for (const report of allReports) append({
    date: dateOf(report.date), kind: 'report', provider: organization(report.organization ?? (report.source === 'OpenAI' ? report.source : '')),
    title: report.title, detail: report.summary, source: report.source, url: report.url,
  });
  for (const reading of benchmarkEvents(payload?.metrics?.find((metric) => metric.id === 'breadth'))) append(reading);
  for (const event of watchdogContext) append({ ...event, provider: organization(event.organization), kind: 'context' });

  for (const incident of payload?.incidents ?? []) {
    const provider = organization(incident.organization);
    const start = dateOf(incident.startedAt ?? incident.date);
    if (!start) continue;
    const resolved = Date.parse(incident.resolvedAt);
    const source = providerByName.get(provider);
    const checked = dateOf(source?.lastSuccessAt ?? source?.checkedAt ?? payload.checkedAt);
    const lastDay = Number.isFinite(resolved)
      ? new Date(resolved - 1).toISOString().slice(0, 10)
      : incident.status === 'resolved' ? start : checked || start;
    const through = lastDay < start ? start : lastDay;
    const impact = { degraded: 'Degraded performance', interruption: 'Service interruption' }[incident.impact];
    const began = Date.parse(incident.startedAt);
    const duration = [Number.isFinite(began) ? `Reported ${incidentTime.format(began)} UTC` : `Reported ${dayLabel(start, monthDay)}`];
    if (Number.isFinite(resolved)) duration.push(`resolved ${incidentTime.format(resolved)} UTC`);
    else if (incident.status === 'monitoring') duration.push('monitoring at last update');
    else if (incident.status === 'resolved') duration.push('marked resolved');
    else duration.push('open at last update');
    const detail = [impact, duration.join(' · '), incident.detail || incident.services?.slice(0, 5).join(', ')].filter(Boolean).join('. ');
    for (const frame of frames) {
      if (frame.date >= start && frame.date <= through) append({
        date: frame.date, kind: 'incident', provider, title: incident.title,
        detail, source: incident.source, url: incident.url, carriedForward: frame.date !== start,
      });
    }
  }

  return events;
}

function svgItem(tag, attributes, text) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  if (text != null) element.textContent = text;
  return element;
}

function paintChart(state) {
  const { plot, frames, selected, events } = state;
  if (!frames?.length) return;
  const width = Math.max(254, plot.clientWidth);
  const height = 280;
  const start = 43;
  const end = width - 17;
  const top = 29;
  const bottom = 157;
  const eventBandTop = 167;
  const eventBandBottom = 241;
  const x = (index) => frames.length > 1 ? start + index * (end - start) / (frames.length - 1) : (start + end) / 2;
  const values = frames.map((frame) => frame.score).filter(Number.isFinite);
  const low = values.length ? Math.max(0, Math.floor(Math.min(...values) - .5)) : 0;
  const high = values.length ? Math.min(100, Math.ceil(Math.max(...values) + .5)) : 100;
  const y = (value) => bottom - (value - low) / (high - low) * (bottom - top);
  const graph = svgItem('svg', {
    viewBox: `0 0 ${width} ${height}`, role: 'img',
    'aria-label': `Evidence index points from ${number.format(low)} to ${number.format(high)} on the vertical axis. Calendar dates (UTC) on the horizontal axis. Event dots appear in a separate band below the line. Use the day slider to select a date.`,
  });
  graph.append(
    svgItem('text', { x: 8, y: 16, class: 'watch-history__axis-title' }, 'Y · Evidence index (0–100 points)'),
    svgItem('rect', { x: start, y: eventBandTop, width: end - start, height: eventBandBottom - eventBandTop, rx: 4, class: 'watch-history__event-band' }),
    svgItem('text', { x: start + 6, y: eventBandTop + 15 }, 'Events by date'),
    svgItem('text', { x: (start + end) / 2, y: height - 6, 'text-anchor': 'middle', class: 'watch-history__axis-title' }, 'X · Date (UTC)'),
  );
  for (const tick of [low, (low + high) / 2, high]) {
    const at = y(tick);
    graph.append(
      svgItem('line', { x1: start, x2: end, y1: at, y2: at, class: 'watch-history__gridline' }),
      svgItem('text', { x: start - 7, y: at + 4, 'text-anchor': 'end' }, number.format(tick)),
    );
  }
  const dateSlots = width >= 580 ? 5 : 3;
  const dates = new Set(Array.from({ length: dateSlots }, (_, i) => Math.round(i * (frames.length - 1) / (dateSlots - 1))));
  for (const tick of dates) {
    const anchor = tick === 0 ? 'start' : tick === frames.length - 1 ? 'end' : 'middle';
    graph.append(svgItem('text', { x: x(tick), y: height - 23, 'text-anchor': anchor }, dayLabel(frames[tick].date, monthDay)));
  }
  let startSegment = true;
  const trace = frames.map((frame, index) => {
    if (!Number.isFinite(frame.score)) {
      startSegment = true;
      return '';
    }
    const point = `${startSegment ? 'M' : 'L'}${x(index)},${y(frame.score)}`;
    startSegment = false;
    return point;
  }).join(' ');
  graph.append(svgItem('path', { d: trace, class: 'watch-history__trace' }));
  for (const [index, frame] of frames.entries()) {
    if (state.anomalies.has(frame.date) && Number.isFinite(frame.score)) {
      graph.append(svgItem('circle', { cx: x(index), cy: y(frame.score), r: 4, 'data-kind': 'anomaly' }));
    }
    const kindsOnDate = new Set((events.get(frame.date) ?? []).map(({ kind }) => kind));
    for (const [row, matches] of markerRows.entries()) {
      const visible = matches.filter((kind) => kindsOnDate.has(kind));
      for (const [pin, kind] of visible.entries()) {
        const offset = (pin - (visible.length - 1) / 2) * 5;
        graph.append(svgItem('circle', { cx: x(index) + offset, cy: eventBandTop + 25 + row * 13, r: 3, 'data-kind': kind }));
      }
    }
  }
  const frame = frames[selected];
  const cursorX = x(selected);
  graph.append(svgItem('line', { x1: cursorX, x2: cursorX, y1: top, y2: eventBandBottom, class: 'watch-history__cursor' }));
  if (Number.isFinite(frame?.score)) graph.append(svgItem('circle', { cx: cursorX, cy: y(frame.score), r: 4.5, class: 'watch-history__current' }));
  if (!values.length) graph.append(svgItem('text', { x: width / 2, y: 77, 'text-anchor': 'middle' }, 'No index readings in this window'));
  plot.replaceChildren(graph);
  plot.onpointerup = (event) => {
    if (event.button !== 0) return;
    const bounds = graph.getBoundingClientRect();
    const fraction = ((event.clientX - bounds.left) * width / bounds.width - start) / (end - start);
    selectDay(state, Math.max(0, Math.min(frames.length - 1, Math.round(fraction * (frames.length - 1)))));
  };
}

function describeDay(state) {
  const frame = state.frames[state.selected];
  if (!frame) return;
  const date = dayLabel(frame.date);
  state.date.textContent = date;
  state.slider.value = state.selected;
  state.slider.setAttribute('aria-valuetext', date);
  state.score.textContent = Number.isFinite(frame.score) ? `${number.format(frame.score)} / 100` : 'Index unavailable';
  state.delta.textContent = Number.isFinite(frame.delta) ? `${change(frame.delta)} points vs. prior day` : '';
  state.delta.dataset.direction = frame.delta > 0 ? 'up' : frame.delta < 0 ? 'down' : 'flat';
  state.previous.disabled = state.selected === 0;
  state.next.disabled = state.selected === state.frames.length - 1;
  for (const button of state.list.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.value === frame.date));
  const events = state.events.get(frame.date) ?? [];
  const datedEvents = events.filter((event) => !event.carriedForward);
  const ongoing = events.length - datedEvents.length;
  const anomaly = state.anomalies.get(frame.date);
  state.daySummary.textContent = `${datedEvents.length} new ${datedEvents.length === 1 ? 'record' : 'records'}` +
    (ongoing ? ` · ${ongoing} ongoing ${ongoing === 1 ? 'incident' : 'incidents'}` : '');
  const announcement = `${date}. ${state.daySummary.textContent}. ${Number.isFinite(frame.score) ? `Evidence index ${number.format(frame.score)} points out of 100.` : 'Evidence index unavailable.'}`;
  if (state.announcement.textContent !== announcement) state.announcement.textContent = announcement;
  state.anomaly.hidden = !anomaly;
  if (anomaly) {
    const factors = (anomaly.factors ?? []).map(({ label, delta, coverage }) => `${label} ${change(delta)} ${Math.abs(delta) === 1 ? 'point' : 'points'}${coverage ? ` (${coverage})` : ''}`);
    const explanation = [`The index moved ${change(anomaly.delta)} points. The flag threshold for this day was ${number.format(anomaly.threshold)} ${anomaly.threshold === 1 ? 'point' : 'points'}.`];
    if (factors.length) explanation.push(`Changes to the score came from ${factors.join(', ')}.`);
    if (anomaly.coverageDelta) explanation.push(`Source coverage changed by ${change(anomaly.coverageDelta)} percentage points.`);
    state.anomaly.replaceChildren(item('strong', 'Unusual index move'), item('p', explanation.join(' ')));
  }
  const counts = new Map();
  for (const { source } of datedEvents) counts.set(source || 'Unspecified source', (counts.get(source || 'Unspecified source') ?? 0) + 1);
  state.counts.replaceChildren(...Array.from(counts, ([source, count]) => item('li', `${source} · ${count}`)));
  state.sourceCounts.hidden = !counts.size;
  state.daily.replaceChildren(...events.map(({ kind, provider, title, detail, source, url, carriedForward }) => {
    const record = item('li');
    const type = item('span', carriedForward ? 'Ongoing service incident' : kinds[kind], 'watch-history__kind');
    type.dataset.kind = kind;
    record.append(type, item('strong', title));
    if (detail) record.append(item('p', detail));
    const link = sourceLink(`${provider && provider !== source ? `${provider} · ` : ''}${source || 'Source'}`, url);
    if (link) record.append(link);
    return record;
  }));
  state.empty.hidden = events.length > 0;
}

function selectDay(state, position) {
  state.selected = position;
  state.selectedDate = state.frames[position].date;
  describeDay(state);
  paintChart(state);
}

function reframe(state) {
  const allFrames = state.index?.history ?? [];
  if (!allFrames.length) return;
  state.content.hidden = false;
  state.loading.hidden = true;
  const latest = allFrames.at(-1).date;
  const earliest = allFrames[0].date;
  const end = state.endDate && state.endDate < latest ? Math.max(0, allFrames.findLastIndex((frame) => frame.date <= state.endDate)) : allFrames.length - 1;
  state.frames = allFrames.slice(Math.max(0, end - state.days + 1), end + 1);
  const startDate = state.frames[0].date;
  const endDate = state.frames.at(-1).date;
  state.end.min = earliest;
  state.end.max = latest;
  state.end.value = endDate;
  state.window.textContent = startDate === endDate ? dayLabel(endDate) : `${dayLabel(startDate, monthDay)} – ${dayLabel(endDate)} · UTC`;
  state.slider.max = state.frames.length - 1;

  state.events = new Map(state.frames.map((frame) => [frame.date, (state.indexed.get(frame.date) ?? [])
    .filter((event) => !state.provider.value || event.provider === state.provider.value)]));
  const activeDates = state.frames.filter((frame) => state.events.get(frame.date).length || state.anomalies.has(frame.date)).reverse();
  const focused = state.list.contains(document.activeElement) ? document.activeElement.value : null;
  state.list.replaceChildren(...activeDates.map((frame) => {
    const label = dayLabel(frame.date, monthDay);
    const button = item('button', label);
    button.type = 'button';
    button.value = frame.date;
    button.setAttribute('aria-label', `${label}, ${frame.date.slice(0, 4)}, ${state.events.get(frame.date).length} daily records${state.anomalies.has(frame.date) ? ', unusual index move' : ''}`);
    button.addEventListener('click', () => selectDay(state, state.frames.indexOf(frame)));
    return button;
  }));
  if (focused) [...state.list.children].find((button) => button.value === focused)?.focus({ preventScroll: true });
  state.activity.hidden = !activeDates.length;
  const selected = state.frames.findIndex((frame) => frame.date === state.selectedDate);
  selectDay(state, selected >= 0 ? selected : state.frames.length - 1);
}

function renderSources(state, sources = []) {
  state.coverage.replaceChildren(...sources.map((source) => {
    const row = item('li');
    const status = { live: 'Feed checked', snapshot: 'Saved records', unavailable: 'Feed unavailable' }[source.status] ?? 'Status unknown';
    const link = sourceLink(source.organization ?? source.source ?? 'Status source', source.url);
    row.append(link ?? item('strong', source.organization ?? source.source), item('span', ` · ${status}`));
    const oldest = dateOf(source.oldestDate);
    if (oldest) row.append(item('span', ` · earliest returned incident ${dayLabel(oldest, monthDay)}`));
    if (source.scope) row.append(item('p', source.scope));
    return row;
  }));
  state.noCoverage.hidden = sources.length > 0;
}

function mount(container) {
  container.classList.add('watch-history');
  container.innerHTML = `
    <p class="watch-history__loading">Waiting for dated signals…</p>
    <div class="watch-history__content" hidden>
      <p class="watch-history__note">Choose a time range, then click the chart or move the slider to read about a day.</p>
      <div class="watch-history__toolbar">
        <div class="watch-history__periods" role="group" aria-label="Chart range">
          ${periods.map((days) => `<button type="button" data-days="${days}" aria-pressed="${days === 14}">${days} days</button>`).join('')}
        </div>
        <label>End date <input type="date" data-field="end"></label>
        <button type="button" data-field="latest">Go to latest day</button>
        <label>Show activity from <select data-field="provider"><option value="">All providers</option></select></label>
      </div>
      <div class="watch-history__chart-heading"><h3>Daily evidence index</h3><p data-field="window"></p></div>
      <div class="watch-history__plot"></div>
      <p class="watch-history__note">The vertical scale zooms in on the scores for the dates you selected. The dots in the lower band mark events by date.</p>
      <ul class="watch-history__legend" aria-label="Activity markers">
        <li data-kind="release">Model release</li><li data-kind="gain">Benchmark gain</li><li data-kind="drop">Benchmark drop</li>
        <li data-kind="measured">Benchmark reading or research</li><li data-kind="incident">Service incident</li>
        <li data-kind="context">Context</li><li data-kind="anomaly">Unusual index move</li>
      </ul>
      <div class="watch-history__scrub">
        <button type="button" data-field="previous" aria-label="Previous day">‹</button>
        <input type="range" data-field="slider" min="0" max="0" value="0" aria-label="Select a day">
        <button type="button" data-field="next" aria-label="Next day">›</button>
      </div>
      <div class="watch-history__activity" hidden><p>Dates with activity</p><div data-field="list"></div></div>
      <div class="watch-history__day">
        <div class="watch-history__day-heading"><h3 data-field="date"></h3><p><strong data-field="score"></strong> <span class="change" data-field="delta"></span></p></div>
        <p class="watch-history__note" data-field="daySummary"></p>
        <span class="watch-history__announcement" data-field="announcement" role="status"></span>
        <div class="watch-history__anomaly" data-field="anomaly" hidden></div>
        <div class="watch-history__source-counts" data-field="sourceCounts" hidden><p>New records by source</p><ul class="watch-history__counts" data-field="counts"></ul></div>
        <ul class="watch-history__records" data-field="daily"></ul>
        <p class="watch-history__note" data-field="empty" hidden>No matching reports in the available data for this day.</p>
      </div>
      <details class="watch-history__sources">
        <summary>What the chart tracks</summary>
        <p>The line is the overall evidence index. The provider filter changes the activity markers and daily records. A daily move is flagged when it reaches one point and three times the typical absolute move in the prior 30 days, with at least seven comparisons. Reports and index changes on the same day can have different causes.</p>
        <p>Epoch’s best-scoring model for each developer and weight-access category on a release day is compared with that group’s previous scored release. Evaluations can be published later. A lower score on this benchmark can reflect a different model tier or uncertainty.</p>
        <ul data-field="coverage"></ul>
        <p data-field="noCoverage">Service incident history is unavailable in this dataset.</p>
        <p>Status feeds cover the products and dates the providers report. An empty day may have unreported or out-of-scope incidents.</p>
        <p>Daily counts tally entries dated that day. Incidents that continue on later days remain visible as ongoing.</p>
      </details>
    </div>`;
  const fields = Object.fromEntries([...container.querySelectorAll('[data-field]')].map((element) => [element.dataset.field, element]));
  const state = {
    ...fields, days: 14,
    plot: container.querySelector('.watch-history__plot'),
    loading: container.querySelector('.watch-history__loading'),
    content: container.querySelector('.watch-history__content'),
    activity: container.querySelector('.watch-history__activity'),
  };
  for (const button of container.querySelectorAll('[data-days]')) button.addEventListener('click', () => {
    state.days = Number(button.dataset.days);
    for (const control of container.querySelectorAll('[data-days]')) control.setAttribute('aria-pressed', String(control === button));
    reframe(state);
  });
  state.end.addEventListener('change', () => {
    state.endDate = state.end.value || null;
    state.selectedDate = null;
    reframe(state);
  });
  state.latest.addEventListener('click', () => showLatestWatchDay(container));
  state.provider.addEventListener('change', () => reframe(state));
  state.slider.addEventListener('input', () => selectDay(state, Number(state.slider.value)));
  state.previous.addEventListener('click', () => selectDay(state, state.selected - 1));
  state.next.addEventListener('click', () => selectDay(state, state.selected + 1));
  new ResizeObserver(() => paintChart(state)).observe(state.plot);
  return state;
}

export function showLatestWatchDay(container) {
  const state = states.get(container);
  if (!state?.index) return;
  state.endDate = null;
  state.selectedDate = state.index.history.at(-1).date;
  reframe(state);
}

export function renderWatchHistory(container, { index, payload } = {}) {
  if (!states.has(container)) states.set(container, mount(container));
  const state = states.get(container);
  const frames = index?.history ?? [];
  if (!frames.length || (state.index === index && state.payload === payload)) return;
  state.index = index;
  state.payload = payload;
  state.indexed = indexedEvents(payload, frames);
  state.anomalies = new Map();
  for (const { date } of frames) {
    const anomaly = getWatchdogAnomaly(frames, date);
    if (anomaly) state.anomalies.set(date, anomaly);
  }
  const selectedProvider = state.provider.value;
  const firstDate = frames[0].date;
  const lastDate = frames.at(-1).date;
  const providers = new Set((payload?.incidentSources ?? []).map((source) => organization(source.organization)));
  for (const [date, events] of state.indexed) {
    if (date >= firstDate && date <= lastDate) for (const { provider } of events) providers.add(provider);
  }
  const options = ['', ...[...providers].filter(Boolean).sort()].map((name) => {
    const option = item('option', name || 'All providers');
    option.value = name;
    return option;
  });
  state.provider.replaceChildren(...options);
  state.provider.value = providers.has(selectedProvider) ? selectedProvider : '';
  renderSources(state, payload?.incidentSources);
  reframe(state);
}
