import { forecastArticle, forecastDefinition, forecastTable, forecastWindow, publicationDate, readResearchForecast } from './research-forecast.js';

const mounted = new WeakMap();
const month = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' });
const monthYear = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const day = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', day: 'numeric', timeZone: 'UTC' });
const firstDay = value => new Date(value + '-01T00:00:00Z');

function monthSpan(first, last) {
  if (first === last) return monthYear.format(firstDay(first));
  const start = first.slice(0, 4) === last.slice(0, 4) ? month : monthYear;
  return start.format(firstDay(first)) + '–' + monthYear.format(firstDay(last));
}

function mount(container) {
  const doc = container.ownerDocument;
  const heading = doc.createElement(container.closest('.overview-index') ? 'h3' : 'h2');
  heading.className = 'countdown-summary-title';
  heading.textContent = 'Superhuman AI researcher forecast';
  const reading = doc.createElement('p');
  const value = doc.createElement('strong');
  value.className = 'countdown-summary-value';
  const dates = doc.createElement('span');
  reading.append(value, dates);
  const definition = doc.createElement('p');
  definition.textContent = 'Six AI Futures Project forecasters put their individual 50/50 dates in this span. To qualify, AI must automate a research project’s coding and choose experiments as well as its best human researchers.';
  const newer = doc.createElement('p');
  newer.hidden = true;
  const details = doc.createElement('details');
  const summary = doc.createElement('summary');
  summary.textContent = 'Forecasts and assumptions';
  const body = doc.createElement('div');
  details.append(summary, body);
  container.replaceChildren(heading, reading, definition, newer, details);
  const state = { container, doc, value, dates, body, newer, record: null, key: '', timer: null };
  mounted.set(container, state);
  doc.addEventListener('visibilitychange', () => {
    if (doc.hidden) clearTimeout(state.timer);
    else if (container.isConnected && state.record) paint(state);
  });
  return state;
}

function paint(state) {
  const { record, doc } = state;
  clearTimeout(state.timer);
  const now = new Date();
  const { first, last, remaining, passed } = forecastWindow(record, now);
  if (state.value.textContent !== remaining) state.value.textContent = remaining;
  const dates = ' · ' + monthSpan(first, last);
  if (state.dates.textContent !== dates) state.dates.textContent = dates;
  const key = JSON.stringify([record, passed]);
  if (key !== state.key) {
    state.key = key;
    const paragraph = text => {
      const p = doc.createElement('p');
      p.textContent = text;
      return p;
    };
    const link = (text, url) => {
      const a = doc.createElement('a');
      a.href = url;
      a.textContent = text;
      return a;
    };
    const issued = day.format(new Date(record.publishedOn + 'T00:00:00Z'));
    const note = paragraph('The AI Futures Project published these estimates on ' + issued +
      '. Each forecaster assigns equal odds to an earlier or later arrival than their own date. The actual milestone could fall outside this span.');
    state.newer.hidden = !record.newerPublication;
    if (record.newerPublication) {
      state.newer.replaceChildren(link('A newer outlook is available', record.newerPublication.url),
        '. The clock uses the last verified comparable table.');
    }
    const list = doc.createElement('ul');
    list.className = 'forecast-medians';
    list.setAttribute('role', 'list');
    const ordinal = value => Number(value.slice(0, 4)) * 12 + Number(value.slice(5));
    const startMonth = ordinal(first);
    const span = ordinal(last) - startMonth;
    if (!span) list.classList.add('single-month');
    const ordered = [...record.medians].sort((a, b) => a.month.localeCompare(b.month) || a.author.localeCompare(b.author));
    for (const row of ordered) {
      const item = doc.createElement('li');
      const author = doc.createElement('span');
      author.textContent = row.author;
      const rail = doc.createElement('span');
      rail.className = 'forecast-median-rail';
      rail.setAttribute('aria-hidden', 'true');
      const position = span ? 100 * (ordinal(row.month) - startMonth) / span : 50;
      rail.style.setProperty('--month-position', position + '%');
      const date = doc.createElement('time');
      date.dateTime = row.month;
      date.textContent = monthYear.format(firstDay(row.month));
      item.append(author, rail, date);
      list.append(item);
    }
    const change = paragraph(record.publishedOn === publicationDate
      ? 'The November forecast assumed no substantial deliberate slowdown. The authors moved their estimates earlier chiefly because METR found faster gains at Anthropic. Some evidence was withheld, leaving uncertainty about how much AI caused the change.'
      : 'These are revised estimates from the publisher. Its forecast update explains which assumptions changed.');
    const confirmation = paragraph((passed ? 'These forecast months have passed. ' : '') +
      'Confirming this milestone requires published evidence that AI meets both research tests within the model’s computing budget. A singularity would also require sustained acceleration across generations.');
    const sources = paragraph('');
    sources.append(link('Forecast update', record.articleUrl ?? forecastArticle), ' · ', link('Published table', forecastTable(record.version, record.chartId)), ' · ',
      link('Milestone definition', forecastDefinition));
    const checked = Date.parse(record.lastCheckedAt);
    const history = Number.isFinite(checked)
      ? (record.status === 'checked' ? 'Table last verified ' : 'Using a saved table last verified ') + day.format(checked) + ' UTC.'
      : 'Showing the saved forecast published ' + issued + '.';
    state.body.replaceChildren(note, list, change, confirmation, sources, paragraph(history));
  }
  if (!doc.hidden) {
    const nextDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    state.timer = setTimeout(() => { if (state.container.isConnected) paint(state); }, nextDay - now.getTime());
  }
}

export function renderCountdownSummary(container, _index, payload) {
  if (!container) return;
  const state = mounted.get(container) ?? mount(container);
  state.record = readResearchForecast(payload?.researchForecast ?? state.record);
  paint(state);
}
