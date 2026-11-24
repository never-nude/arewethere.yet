import { modelReleaseUrl, organizationSites } from './model-links.js';

const windowDays = 120;
const day = 86_400_000;
const initialLimit = 7;
const sourceUrl = 'https://epoch.ai/eci';
const ranksByContainer = new WeakMap();
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat('en-US', {
  year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
});
const accessOptions = [
  ['all', 'All models'],
  ['open', 'Open weights'],
  ['closed', 'Closed weights'],
];

const research = [
  {
    organization: 'Anthropic',
    value: '1.9×',
    title: 'Pace of model capability gains',
    date: '2026-11-05',
    kind: 'Independent assessment',
    summary: 'METR estimated that benchmark gains at Anthropic accelerated to 1.9× their earlier rate. METR judged AI-assisted research likely explained much of the change, with significant uncertainty about the size of that contribution.',
    label: 'METR assessment',
    url: 'https://metr.org/blog/2026-11-05-anthropic-ai-rd-acceleration-assessment/',
  },
  {
    organization: 'OpenAI',
    value: '35%',
    title: 'Success on internal 4–8 hour tasks',
    date: '2026-11-18',
    kind: 'Company estimate',
    summary: 'OpenAI estimated that agents completed 35% of these research tasks without human intervention by October. Researchers selected which tasks to delegate.',
    label: 'OpenAI research report',
    url: 'https://openai.com/index/research-acceleration-jagged-frontier/',
  },
  {
    organization: 'Google DeepMind',
    value: '1%',
    title: 'Reported reduction in Gemini training time',
    date: '2025-05-14',
    kind: 'Company measurement',
    summary: 'DeepMind reported that AlphaEvolve found a faster way to perform a key operation used to train Gemini, reducing the overall training time by 1%.',
    label: 'AlphaEvolve report',
    url: 'https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/',
  },
];

function element(tag, text = '', className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function externalLink(text, url) {
  const anchor = element('a', text + ' ↗', 'labs-source');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  return anchor;
}

function prettyDate(date) {
  return dateFormat.format(new Date(date));
}

function accessKind(access) {
  const value = String(access ?? '').toLowerCase();
  if (value.startsWith('open weights')) return 'open';
  if (value.startsWith('closed weights')) return 'closed';
  return 'unknown';
}

function accessLabel(point) {
  return point.access || 'Access unlisted';
}

function uncertainty(point) {
  return Number.isFinite(point.low) && Number.isFinite(point.high)
    ? number.format(point.low) + '–' + number.format(point.high) + ' · 90% interval'
    : '';
}

export function rankDevelopers(observations, through, access = 'all') {
  const start = new Date(Date.parse(through) - (windowDays - 1) * day).toISOString().slice(0, 10);
  const groups = new Map();
  for (const point of observations ?? []) {
    const organization = typeof point.organization === 'string' ? point.organization.trim() : '';
    if (!organization || !point.label || !Number.isFinite(point.value) || !point.date || point.date < start || point.date > through) continue;
    if (access !== 'all' && accessKind(point.access) !== access) continue;
    const models = groups.get(organization) ?? [];
    models.push(point);
    groups.set(organization, models);
  }
  const developers = [...groups].map(([organization, models]) => {
    models.sort((left, right) => right.value - left.value || right.date.localeCompare(left.date) || left.label.localeCompare(right.label));
    return { organization, best: models[0], models };
  });
  developers.sort((left, right) => right.best.value - left.best.value || left.organization.localeCompare(right.organization));
  return { developers, start };
}

function renderResearch() {
  return research.map((study) => {
    const card = element('article', '', 'lab-study');
    const line = element('div', '', 'lab-study-meta');
    line.append(
      element('h4', study.organization),
      element('span', study.kind),
    );
    const data = element('p', '', 'lab-study-data');
    data.append(element('strong', study.value), element('span', study.title));
    card.append(
      line,
      data,
      element('p', study.summary, 'lab-study-summary'),
      externalLink(study.label + ' · ' + prettyDate(study.date), study.url),
    );
    return card;
  });
}

function mount(container) {
  container.classList.add('labs');
  container.innerHTML = `
    <div class="labs-sentience">
      <h3>What would count as sentience?</h3>
      <p>Sentience is the capacity for subjective experience, such as feeling discomfort. Scientists have proposed indicators based on different theories of consciousness. Their reliability remains an open question. The measures below describe what AI can do and how researchers use it.</p>
      <a class="labs-source" href="https://doi.org/10.1016/j.tics.2025.10.011" target="_blank" rel="noopener noreferrer">Butlin and colleagues on indicators of consciousness ↗</a>
    </div>
    <div class="labs-grid">
      <section class="panel labs-ranking" aria-labelledby="labs-ranking-heading">
        <div class="panel-heading">
          <div>
            <h3 id="labs-ranking-heading">Model capability leaders</h3>
            <p>Each developer’s highest Epoch Capabilities Index score among models released in the past 120 days.</p>
          </div>
        </div>
        <div class="segmented labs-filters" role="group" aria-label="Model weight availability"></div>
        <p class="labs-window" aria-live="polite"></p>
        <ol class="labs-results"></ol>
        <button class="calendar-step labs-more" type="button" hidden>Show more developers</button>
        <p class="small-note">Epoch’s index combines multiple benchmarks. Nearby scores can have overlapping 90% credible intervals. Expand a developer to see its scored models from this period.</p>
        <a class="labs-source" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">Epoch Capabilities Index ↗</a>
      </section>
      <section class="panel labs-research" aria-labelledby="labs-research-heading">
        <div class="panel-heading">
          <div><h3 id="labs-research-heading">AI helping build AI</h3><p>Documented examples of how developers are using AI in research and training.</p></div>
        </div>
        <div class="labs-studies"></div>
      </section>
    </div>`;
  const state = {
    access: 'all',
    expanded: new Set(),
    observations: null,
    through: null,
    showAll: false,
    window: container.querySelector('.labs-window'),
    results: container.querySelector('.labs-results'),
    more: container.querySelector('.labs-more'),
    filters: [],
  };
  const filters = container.querySelector('.labs-filters');
  for (const [key, label] of accessOptions) {
    const button = element('button', label);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(key === state.access));
    button.addEventListener('click', () => {
      if (state.access === key) return;
      state.access = key;
      state.showAll = false;
      for (const [filter, control] of state.filters) control.setAttribute('aria-pressed', String(filter === key));
      renderRanking(state);
    });
    filters.append(button);
    state.filters.push([key, button]);
  }
  state.more.addEventListener('click', () => {
    state.showAll = !state.showAll;
    renderRanking(state);
  });
  container.querySelector('.labs-studies').append(...renderResearch());
  return state;
}

function rowFor(developer, rank, state) {
  const { organization, best, models } = developer;
  const item = element('li', '', 'labs-developer');
  const detail = document.createElement('details');
  detail.open = state.expanded.has(organization);
  detail.addEventListener('toggle', () => {
    if (!item.isConnected) return;
    if (detail.open) state.expanded.add(organization);
    else state.expanded.delete(organization);
  });
  const summary = document.createElement('summary');
  const rankLabel = element('span', String(rank), 'labs-placement');
  rankLabel.setAttribute('aria-label', 'Rank ' + rank);
  const lab = element('span', '', 'labs-model');
  lab.append(element('strong', organization), element('span', best.label + ' · ' + accessLabel(best)));
  const score = element('span', '', 'labs-result-score');
  score.append(element('strong', number.format(best.value) + ' ECI'));
  if (uncertainty(best)) score.append(element('small', uncertainty(best)));
  summary.append(rankLabel, lab, score);
  const modelsList = element('ul', '', 'labs-models');
  const timeline = [...models].sort((left, right) => right.date.localeCompare(left.date) || right.value - left.value);
  for (const point of timeline) {
    const model = element('li');
    const info = element('div');
    const modelUrl = modelReleaseUrl(point.label);
    info.append(modelUrl ? externalLink(point.label, modelUrl) : element('strong', point.label),
      element('p', prettyDate(point.date) + ' · ' + accessLabel(point)));
    const result = element('div', '', 'labs-model-score');
    result.append(element('strong', number.format(point.value) + ' ECI'));
    if (uncertainty(point)) result.append(element('p', uncertainty(point)));
    model.append(info, result);
    modelsList.append(model);
  }
  const sites = element('div', '', 'labs-developer-sites');
  sites.append(...organizationSites(organization).filter(({ url }) => url).map(({ label, url }) => externalLink(label, url)));
  detail.append(summary);
  if (sites.children.length) detail.append(sites);
  detail.append(modelsList);
  item.append(detail);
  return item;
}

function renderRanking(state) {
  if (!state.through) {
    state.window.textContent = 'Waiting for Epoch model scores.';
    return;
  }
  const { developers, start } = rankDevelopers(state.observations, state.through, state.access);
  const count = developers.length;
  state.window.textContent = prettyDate(start) + ' – ' + prettyDate(state.through) + ' · ' + count + (count === 1 ? ' developer' : ' developers');
  state.more.hidden = count <= initialLimit;
  state.more.textContent = state.showAll ? 'Show top ' + initialLimit : 'Show ' + (count - initialLimit) + ' more developers';

  if (!count) {
    state.results.replaceChildren(element('li', 'Epoch scores for this view are unavailable.', 'labs-empty'));
    return;
  }
  const visible = state.showAll ? developers : developers.slice(0, initialLimit);
  let rank = 1;
  state.results.replaceChildren(...visible.map((developer, position) => {
    if (position > 0 && developer.best.value !== visible[position - 1].best.value) rank = position + 1;
    return rowFor(developer, rank, state);
  }));
}

export function renderLabs(container, { payload, index } = {}) {
  const state = ranksByContainer.get(container) ?? mount(container);
  ranksByContainer.set(container, state);
  const through = index?.date ?? payload?.checkedAt?.slice(0, 10);
  const observations = payload?.metrics?.find(({ id }) => id === 'breadth')?.observations;
  if (state.through === through && state.observations === observations) return;
  state.observations = observations;
  state.through = through;
  renderRanking(state);
}
