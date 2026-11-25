import { countdownParts, referenceInstant } from './observatory-clock.js';
import { renderInvestment } from './observatory-investment.js';
import { renderMetricCharts } from './observatory-charts.js';
import { renderCalculations } from './observatory-calculations.js?v=pace1';
import { selectOutlook, renderAcceleration, paceHeadline } from './observatory-acceleration.js';
import { renderTrends } from './observatory-trends.js';
import { checkpointWindow, editionLabel } from './checkpoint-schedule.js?v=20261125-visuals';
import { mountField } from './observatory-field.js?v=20261125-visuals';
import { installBriefingGlossary } from './front-glossary.js?v=20261125-terms';

const base = new URL('./', import.meta.url);
const dashboard = document.body.dataset.view === 'dashboard';
const byId = (id) => document.getElementById(id);
const number = new Intl.NumberFormat('en', { maximumSignificantDigits: 3 });
const predictionNumber = new Intl.NumberFormat('en', { maximumFractionDigits: 6 });
const eastern = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/New_York',
  timeZoneName: 'short',
});
const briefTime = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short',
});
const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const month = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const date = (v) => (v && Number.isFinite(Date.parse(v)) ? day.format(Date.parse(v)) : 'undisclosed');
const time = (v) => eastern.format(new Date(v));
const period = (v) =>
  v && Number.isFinite(Date.parse(v)) ? month.format(Date.parse(v)) : 'Not reliably estimable';
const labels = { agi: 'AGI', rsi: 'RSI', asi: 'ASI', singularity: 'Singularity' };
const summaries = {
  agi: 'Skilled-human performance on unfamiliar work',
  rsi: 'AI repeatedly helps build a better successor',
  asi: 'Broad performance above leading experts',
  singularity: 'Sustained acceleration driven by AI research',
};
const editorialOrder = ['singularity', 'rsi', 'asi', 'agi'];
const main = byId('main');
let manifest,
  assessment,
  arrivalOutlook,
  outlookSupplement,
  requestInFlight = false,
  targetInstant,
  fieldInstance,
  disposeTrends,
  selectedArchive = false;
const records = new Map();

function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}
function link(label, address) {
  const a = el('a', label);
  const url = new URL(address, location.href);
  if (url.protocol === 'https:' || url.origin === location.origin) a.href = url.href;
  return a;
}
function details(label, ...children) {
  const d = el('details', null, 'obs-detail');
  d.append(el('summary', label), ...children);
  return d;
}
function list(texts) {
  const ul = el('ul');
  for (const t of texts) ul.append(el('li', t));
  return ul;
}
function small(t) {
  return el('p', t, 'obs-small');
}
function displayValue(o) {
  if (!Number.isFinite(o.value)) return '';
  return number.format(o.value) + (o.unit ? ' ' + o.unit : '');
}
function obsSource(o) {
  return link(o.source, o.sourceUrl);
}
function observationBody(o) {
  const box = el('div');
  if (o.summary) box.append(el('p', o.summary));
  if (Number.isFinite(o.low) && Number.isFinite(o.high))
    box.append(
      el(
        'p',
        (o.intervalLabel || 'Reported range') +
          ' · ' +
          number.format(o.low) +
          '–' +
          number.format(o.high) +
          ' ' +
          (o.unit || ''),
      ),
    );
  box.append(
    el('p', o.limitations),
    small([o.classification, o.system, o.organization, o.weightAccess].filter(Boolean).join(' · ')),
  );
  const timing = [
    'Measurement ' +
      date(o.measuredOn) +
      (o.measuredOn && o.measurementDateBasis ? ' (' + o.measurementDateBasis + ')' : ''),
    'Publication ' + date(o.publishedOn),
  ];
  if (o.referenceOn && o.referenceOn !== o.measuredOn && o.referenceOn !== o.publishedOn)
    timing.push((o.referenceDateBasis || 'Source reference date') + ' ' + date(o.referenceOn));
  box.append(small(timing.join(' · ')));
  const p = el('p', null, 'obs-evidence-link');
  p.append(obsSource(o));
  if (o.datasetUrl && o.datasetUrl !== o.sourceUrl) p.append(' · ', link('Dataset', o.datasetUrl));
  box.append(p);
  return box;
}
function rowTitle(o) {
  return [o.system || o.label, o.system ? o.label : null, displayValue(o)].filter(Boolean).join(' · ');
}
function register(a) {
  const root = byId('register'),
    controls = el('div', null, 'obs-filter'),
    q = el('input'),
    pick = el('select');
  q.type = 'search';
  q.placeholder = 'System, organization or source';
  const qLabel = el('label', 'Search observations'),
    catLabel = el('label', 'Topic');
  qLabel.append(q);
  catLabel.append(pick);
  controls.append(qLabel, catLabel);
  pick.add(new Option('All topics', ''));
  for (const x of a.topicCoverage) pick.add(new Option(x.label, x.id));
  const count = el('p', null, 'obs-small'),
    body = el('div'),
    prev = el('button', 'Previous', 'obs-action'),
    next = el('button', 'Next', 'obs-action');
  prev.type = next.type = 'button';
  const catalog = details(
    'Coverage by topic',
    list(a.topicCoverage.map((x) => x.label + ' · ' + x.status + ' (' + x.observationIds.length + ' records)')),
  );
  // The commissioning edition filed this IEA report under energy. Preserve its original entry.
  const priorCategory = a.observations.find(o => o.id === 'iea-global-data-centres-2025' && o.topic === 'energy');
  const crossReference = () => {
    const note = el('p', 'This edition filed the IEA’s data-centre electricity estimate under energy. ');
    note.append(obsSource(priorCategory));
    return note;
  };
  if (priorCategory) catalog.append(crossReference());
  root.replaceChildren(controls, count, body, prev, next, catalog);
  let page = 0;
  function show() {
    const query = q.value.trim().toLowerCase();
    const filtered = a.observations.filter(
      (o) =>
        (!pick.value || o.topic === pick.value) &&
        [o.system, o.organization, o.source, o.label, o.id, o.weightAccess]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query),
    );
    const start = page * 8;
    count.textContent = filtered.length
      ? 'Showing ' +
        (start + 1) +
        '–' +
        Math.min(start + 8, filtered.length) +
        ' of ' +
        filtered.length +
        ' observations'
      : 'No matching observations in this edition.';
    body.replaceChildren(...filtered.slice(start, start + 8).map((o) => details(rowTitle(o), observationBody(o))));
    if (pick.value === 'data-centers' && priorCategory && !query) body.append(crossReference());
    prev.disabled = !page;
    next.disabled = start + 8 >= filtered.length;
  }
  q.oninput = pick.onchange = () => {
    page = 0;
    show();
  };
  prev.onclick = () => {
    page--;
    show();
  };
  next.onclick = () => {
    page++;
    show();
  };
  show();
}
function spanYears(years) {
  return years === 0 ? 'This year' : 'About ' + years + (years === 1 ? ' year' : ' years');
}
function scenarioYear(year, horizon) {
  return Number.isFinite(year) ? String(year) : 'beyond ' + horizon;
}
function scenarioRange(f) {
  const {low, high} = f.range;
  if (!Number.isFinite(low)) return 'Beyond ' + f.horizonYear;
  return low === high ? String(low) : String(low) + (Number.isFinite(high) ? '–' + high : ' to beyond ' + f.horizonYear);
}
function scenarioSummary(m, f) {
  const row = el('div', null, 'obs-arrival-row');
  row.dataset.milestone = m.id;
  const name = el('div', null, 'obs-arrival-name');
  const heading = el('h3');
  heading.append(el('i', null, 'obs-dot'), m.label);
  name.append(heading, el('p', summaries[m.id]));
  const timing = el('div', null, 'obs-arrival-time');
  timing.append(
    el('span', f.status === 'Scenario estimate' ? 'Reference scenario' : f.status, 'obs-arrival-kicker'),
    el('strong', f.status === 'Observed' ? 'Confirmed ' + f.centralYear : scenarioYear(f.centralYear, f.horizonYear)),
    el('span', f.status === 'Observed' ? 'Independently demonstrated' : f.timingStatus === 'Reference year passed' ? 'Reference year passed' :
      Number.isFinite(f.yearsRemaining) ? spanYears(f.yearsRemaining) + ' from this edition' : 'Outside the model horizon'),
  );
  if (f.status !== 'Observed') timing.append(small('Scenario range · ' + scenarioRange(f)));
  const progress = el('div', null, 'obs-arrival-progress');
  progress.append(el('p', f.progress.summary));
  const score = Number.isFinite(m.score) ? ' · score ' + m.score + '/100' : '';
  progress.append(small(m.coverage.assessed === 0
    ? 'Evidence score pending · 0 of ' + m.coverage.total + ' criteria independently assessed'
    : m.coverage.met + ' of ' + m.coverage.total + ' criteria met · ' + m.coverage.assessed + ' assessed' + score));
  if (!dashboard) progress.append(link('Evidence and timing assumptions', './dashboard.html#arrival-' + m.id));
  row.append(name, timing, progress);
  return row;
}
const criterionStatus = { met: 'Verified', unmet: 'Tested and unmet', conflicting: 'Conflicting evidence', unknown: 'Unresolved' };
const shortNames = { singularity: 'Singularity', rsi: 'Recursive self-improvement', asi: 'Artificial superintelligence', agi: 'Artificial general intelligence' };
const milestoneDefinitions = {
  singularity: 'AI helps build better AI, and the cycle speeds up technological progress beyond the lab.',
  rsi: 'An AI helps build a better successor, which then helps build the next one.',
  asi: 'One AI reliably outperforms leading human experts across many fields.',
  agi: 'One AI can reliably handle unfamiliar work across many fields at the level of a skilled person.',
};

const criterionNames = {
  'agi-breadth': 'Breadth', 'agi-transfer': 'Transfer', 'agi-reliability': 'Reliability',
  'asi-experts': 'Expert lead', 'rsi-contribution': 'Successor gain', 'rsi-repeat': 'Repeat gain',
  'singularity-feedback': 'AI feedback', 'singularity-acceleration': 'Speedup', 'singularity-transition': 'Wider change',
};
const gateSymbol = { met: '●', unknown: '○', unmet: '×', conflicting: '◐' };
let selectedMilestone = 'singularity';

function latestReliability(a) {
  const tested = a.observations.filter(o => o.topic === 'reliability' && Number.isFinite(o.value) && o.publishedOn);
  const latest = tested.map(o => o.publishedOn).sort().at(-1);
  return tested.filter(o => o.publishedOn === latest).sort((a, b) => b.value - a.value)[0];
}

function milestoneSignal(id, a) {
  let o, value, caption;
  if (id === 'singularity') {
    o = a.observations.find(r => r.topic === 'research-acceleration' && r.organization === 'Anthropic' && r.unit === '×' && Number.isFinite(r.value));
    if (o) { value = number.format(o.value) + '×'; caption = 'Pace of AI capability gains at Anthropic compared with its earlier rate. The comparison includes changes in computing power and staffing.'; }
  } else if (id === 'agi') {
    o = latestReliability(a);
    if (o) { value = number.format(o.value) + ' h'; caption = 'Expert work time for selected tasks that ' + o.system + ' completes with an estimated 80% success rate.'; }
  } else if (id === 'rsi') {
    o = records.get('dgm-2025-swe-bench-agent');
    if (Number.isFinite(o?.value)) { value = number.format(o.value) + '%'; caption = 'Coding tasks solved by a self-editing agent after it revised its software. The authors tested agents on the same software benchmark.'; }
  } else if (id === 'asi') {
    o = a.observations.find(r => r.id.startsWith('frontiermath-open-problems-') && Number.isFinite(r.value));
    if (o) { value = number.format(o.value); caption = (o.unit || 'listed problems') + ' in Epoch’s open mathematics register were credited to AI alone.'; }
  }
  return value ? { o, value, caption } : null;
}

function signalFigure(id, o) {
  const fig = el('figure', null, 'obs-signal-figure');
  if (id === 'asi') {
    const total = Number(/^of (\d+) listed problems$/.exec(o.unit)?.[1]);
    if (!Number.isInteger(total) || total < 1 || total > 100 || o.value < 0 || o.value > total) return null;
    const marks = el('span', null, 'obs-problem-marks');
    marks.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < total; i++) marks.append(el('i', null, i < o.value ? 'obs-problem-solved' : ''));
    fig.append(marks, el('figcaption', o.value + ' of ' + total + ' problems credited to AI alone.'));
  } else if (id === 'rsi') {
    for (const [label, percent] of [['Starting agent', 20], ['Revised agent', o.value]]) {
      const bar = el('span', null, 'obs-agent-track');
      const mark = el('i');
      mark.style.width = percent + '%';
      bar.append(mark);
      const row = el('div', null, 'obs-agent-result');
      row.append(el('span', label), bar, el('span', number.format(percent) + '%'));
      fig.append(row);
    }
    fig.setAttribute('aria-label', 'Share of selected coding tasks solved');
  } else if (Number.isFinite(o.low) && Number.isFinite(o.high) && o.high > o.low && o.value >= o.low && o.value <= o.high) {
    const unit = id === 'agi' ? ' h' : '×';
    const track = el('span', null, 'obs-uncertainty-track');
    const point = el('i');
    point.style.insetInlineStart = 100 * (o.value - o.low) / (o.high - o.low) + '%';
    track.append(point);
    track.setAttribute('aria-hidden', 'true');
    const labels = el('div', null, 'obs-range-labels');
    labels.append(el('span', number.format(o.low) + unit), el('span', o.intervalLabel || 'Reported range'), el('span', number.format(o.high) + unit));
    fig.append(track, labels);
  } else return null;
  return fig;
}

function milestonePane(pane, m, forecast, a) {
  pane.dataset.milestone = m.id;
  pane.setAttribute('aria-labelledby', 'milestone-tab-' + m.id);
  const name = el('h3', m.label);
  const definition = el('p', milestoneDefinitions[m.id], 'obs-reader-definition');
  const measurement = milestoneSignal(m.id, a);
  const signal = el('div', null, 'obs-reader-signal');
  if (measurement) {
    const { o, value, caption } = measurement;
    const number = el('strong', value);
    number.dataset.signalValue = '';
    const copy = el('div');
    copy.append(el('p', caption), link(o.source + ' · ' + date(o.publishedOn || o.referenceOn || o.measuredOn), o.sourceUrl));
    signal.append(number, copy);
    const figure = signalFigure(m.id, o);
    if (figure) signal.append(figure);
  } else signal.append(el('p', forecast?.progress?.summary || 'This edition carries no comparable measurement for this milestone.'));
  const results = el('dl', null, 'obs-reader-findings');
  for (const status of ['met', 'unmet', 'conflicting', 'unknown']) {
    const conditions = m.criteria.filter(c => c.status === status);
    if (conditions.length) results.append(el('dt', criterionStatus[status]),
      el('dd', conditions.map(c => c.label).join(' · ')));
  }
  const accounting = el('p', null, 'obs-reader-accounting');
  accounting.append(el('strong', m.coverage.met + ' of ' + m.coverage.total + ' conditions verified'),
    Number.isFinite(m.score) ? ' · Evidence score ' + m.score + '/100.' : ' · Evidence score pending.');
  const u = new URL('./dashboard.html#assessment-' + m.id, base);
  if (selectedArchive) u.searchParams.set('assessment', a.checkpointAt);
  const components = [name, definition, signal, accounting, results];
  if (forecast && forecast.status !== 'Observed') components.push(small('Scenario range · ' + scenarioRange(forecast)));
  pane.replaceChildren(...components, link('Full evidence for ' + shortNames[m.id], u));
}

function milestoneInstrument(container, a) {
  const rail = el('div', null, 'obs-milestone-tabs');
  rail.id = 'milestone-tabs';
  rail.setAttribute('role', 'tablist');
  rail.setAttribute('aria-label', 'Milestones');
  rail.setAttribute('aria-orientation', 'vertical');
  const pane = el('div', null, 'obs-milestone-reader');
  pane.id = 'milestone-reader';
  pane.setAttribute('role', 'tabpanel');
  pane.tabIndex = 0;
  const controls = new Map();
  for (const id of editorialOrder) {
    const m = a.milestones.find(x => x.id === id);
    const f = arrivalOutlook?.milestones.find(x => x.id === id);
    const strict = a.forecasts.find(x => x.id === id);
    const control = el('button', null, 'obs-progress-row');
    control.id = 'milestone-tab-' + id;
    control.type = 'button';
    control.dataset.milestone = id;
    control.setAttribute('role', 'tab');
    control.setAttribute('aria-controls', 'milestone-reader');
    const title = el('strong', shortNames[id]);
    if (id !== 'singularity') title.append(el('small', labels[id]));
    const year = f ? scenarioYear(f.centralYear, f.horizonYear) : strict?.centralDate ? period(strict.centralDate) : 'Undated';
    const displayYear = el('span', year, 'obs-tab-year');
    const checks = el('span', null, 'obs-gate-track');
    for (const c of m.criteria) {
      const tag = el('span', null, 'obs-gate');
      tag.dataset.status = c.status;
      tag.append(el('i', gateSymbol[c.status]), criterionNames[c.id] || c.label);
      tag.title = c.label + ' · ' + criterionStatus[c.status];
      checks.append(tag);
    }
    const yearLabel = strict?.status === 'Observed' ? 'confirmed' : 'reference';
    control.setAttribute('aria-label', m.label + ', ' + yearLabel + ' ' + year + ', ' + m.coverage.met + ' of ' + m.coverage.total + ' conditions verified');
    control.append(title, displayYear, checks);
    rail.append(control);
    controls.set(id, { control, m, f });
  }
  function select(id, focus = false) {
    selectedMilestone = id;
    for (const [key, { control }] of controls) {
      control.setAttribute('aria-selected', String(key === id));
      control.tabIndex = key === id ? 0 : -1;
    }
    const { control, m, f } = controls.get(id);
    milestonePane(pane, m, f, a);
    if (focus) control.focus();
  }
  for (const [key, { control }] of controls) {
    control.addEventListener('click', () => {
      select(key);
      if (matchMedia('(max-width: 740px)').matches) pane.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    });
    control.addEventListener('keydown', event => {
      const i = editorialOrder.indexOf(key);
      const actions = { ArrowDown: (i + 1) % 4, ArrowUp: (i + 3) % 4, Home: 0, End: 3 };
      if (!Object.hasOwn(actions, event.key)) return;
      event.preventDefault();
      select(editorialOrder[actions[event.key]], true);
    });
  }
  const legend = el('div', null, 'obs-gate-legend');
  const states = new Set(a.milestones.flatMap(m => m.criteria.map(c => c.status)));
  states.add('met');
  for (const status of ['met', 'unknown', 'unmet', 'conflicting']) {
    if (states.has(status)) legend.append(el('span', gateSymbol[status] + ' ' + criterionStatus[status]));
  }
  const track = el('div', null, 'obs-milestone-rail');
  track.append(rail, legend);
  container.replaceChildren(track, pane);
  select(selectedMilestone);
}
function renderMilestones(a) {
  const container = byId('assessment-list');
  byId('arrival-intro').textContent = arrivalOutlook
    ? 'The reference year shows when a milestone could arrive under the model’s main assumptions. The range spans the dated scenarios. A milestone could also remain out of reach.'
    : 'This edition records which criteria were independently assessed. It predates the scenario estimates. An unresolved criterion leaves the evidence score open.';
  if (!dashboard) byId('arrival-intro').textContent = arrivalOutlook
    ? 'Select a milestone to explore its evidence. The years show the reference forecast.'
    : 'Select a milestone to explore its evidence. This edition predates the scenario forecasts.';
  const note = byId('arrival-note');
  note.replaceChildren();
  if (outlookSupplement) {
    note.append('Forecast updated ' + time(outlookSupplement.issuedAt) + ' using measurements from the ' + time(a.checkpointAt) + ' edition.');
    if (outlookSupplement.url) note.append(' ', link('Read the dated record', new URL(outlookSupplement.url, base)));
  } else if (arrivalOutlook) note.textContent = 'Estimates as of ' + time(a.checkpointAt) + '.';
  if (arrivalOutlook) {
    note.append(' · ', link('How the years and ranges are calculated', dashboard ? '#forecasts' : './dashboard.html#forecasts'));
  }
  if (!dashboard) {
    milestoneInstrument(container, a);
    return;
  }
  container.replaceChildren(
    ...editorialOrder.map((id) => {
      const m = a.milestones.find((i) => i.id === id),
        value = Number.isFinite(m.score) ? m.score + ' / 100' : 'Indeterminate';
      const estimate = arrivalOutlook?.milestones.find(f => f.id === id);
      const line = estimate ? scenarioSummary(m, estimate) : el('div', null, 'obs-row');
      if (!estimate) {
        line.dataset.milestone = id;
        const title = el('strong');
        title.append(el('i', null, 'obs-dot'), dashboard ? labels[id] : link(m.label, './dashboard.html#assessment-' + id));
        line.append(title, el('span', value, 'obs-value'),
          el('p', summaries[id] + ' · ' + m.coverage.assessed + '/' + m.coverage.total + ' criteria assessed'));
      }
      const box = el('article');
      box.id = 'assessment-' + id;
      box.append(line);
      const inside = el('div');
      inside.append(
        el('p', m.definition),
        el('p', m.coverage.met + ' criteria met. ' + m.confidence + '. ' + m.limitations),
        small(m.change + ' · Method ' + a.methodologyVersion),
      );
      if (m.system) inside.append(el('p', 'System assessed · ' + m.system));
      const ul = el('ul');
      for (const c of m.criteria) {
        const li = el('li');
        li.append(
          el(
            'strong',
            c.label +
              ' · ' +
              {
                met: 'Met',
                unmet: 'Tested and unmet',
                conflicting: 'Conflicting findings',
                unknown: 'Unresolved',
              }[c.status],
          ),
          el('p', c.rule),
        );
        for (const review of c.reviews || [])
          li.append(
            el('p', review.rationale),
            link(review.reviewer + ' · ' + date(review.reviewedAt), review.protocolUrl),
          );
        const related = c.evidenceIds.length ? c.evidenceIds : c.relatedIds || [];
        const first = related.map((k) => records.get(k)).find(Boolean);
        if (first)
          li.append(
            el('span', c.evidenceIds.length ? 'Reviewed evidence · ' : 'Related measurement · '),
            obsSource(first),
          );
        ul.append(li);
      }
      inside.append(ul);
      if (estimate) inside.append(link('Inspect the timing assumptions', '#arrival-' + id));
      box.append(details('Definition, evidence and scoring', inside));
      return box;
    }),
  );
}
function measuredLead(a) {
  const r = latestReliability(a);
  const lead = byId('measured-lead');
  lead.hidden = !r;
  if (!r) return;
  lead.replaceChildren(
      el('strong', 'Observed · reliability on complex tasks'),
      el(
        'span',
        'On METR’s selected tasks, ' +
          (r.system || 'the tested system') +
          ' has an estimated 80% success rate on work that takes an expert about ' +
          Number(r.value.toPrecision(2)) +
          ' hours.' +
          (Number.isFinite(r.low) && Number.isFinite(r.high)
            ? ' The ' + (r.intervalLabel || 'reported interval') + ' is ' + number.format(r.low) + '–' + number.format(r.high) + ' hours. '
            : ' '),
      ),
      link(r.source + ' · ' + date(r.publishedOn), r.sourceUrl),
    );
}
function renderBrief(a) {
  const examples = [];
  const gain = a.observations.find((o) => o.topic === 'research-acceleration' && Number.isFinite(o.value));
  if (gain)
    examples.push([
      gain,
      gain.source +
        ' estimated that capability gains at Anthropic were running at ' +
        number.format(gain.value) +
        ' times the prior rate. How much AI assistance contributed remains uncertain.',
    ]);
  const work = a.observations.find((x) => x.topic === 'research-autonomy' && Number.isFinite(x.value));
  if (work)
    examples.push([
      work,
      work.source +
        ' reported ' +
        number.format(work.value) +
        '% success on its selected internal research tasks without human help. Independent replication remains open.',
    ]);
  const trend = a.observations.find((x) => x.id === 'iea-global-data-centres-2025');
  if (trend)
    examples.push([
      trend,
      'The IEA estimates that global data-centre electricity use rose ' +
        number.format(trend.value) +
        '% in 2025. This tracks demand across all workloads.',
    ]);
  const box = byId('brief-evidence'),
    ul = el('ul');
  for (const [o, t] of examples) {
    const li = el('li', t + ' ');
    li.append(link(o.source, o.sourceUrl), small(o.classification + ' · ' + date(o.publishedOn || o.referenceOn)));
    ul.append(li);
  }
  box.replaceChildren(
    examples.length ? ul : el('p', 'No eligible readings for this briefing.'),
    link('Inspect the evidence register', './dashboard.html#signals'),
  );
}
function predictionValue(value, unit) {
  if (!Number.isFinite(value)) return 'Unavailable';
  const formatted = Math.abs(value) >= 1e12 ? value.toExponential(2) : predictionNumber.format(value);
  if (unit === 'h' || unit === 'hours') return formatted + (value === 1 ? ' hour' : ' hours');
  if (unit === '%') return formatted + '%';
  return formatted + (unit ? ' ' + unit : '');
}
function verificationWindow(f) {
  return f.verifyThrough ? day.formatRange(new Date(f.verifyOn), new Date(f.verifyThrough)) : date(f.verifyOn);
}
function indicatorPredictions(a) {
  const root = byId('indicator-forecasts');
  const forecasts = a.indicatorForecasts;
  root.replaceChildren();
  const outcomeList = byId('indicator-outcomes');
  outcomeList?.replaceChildren();
  if (!forecasts?.length) {
    root.append(el('p', 'This edition carries no benchmark predictions.', 'obs-sub'));
    return;
  }
  const issued = forecasts.filter((f) => f.status === 'Issued' && Number.isFinite(f.centralValue));
  if (dashboard) {
    root.append(el('h3', 'Predictions for upcoming benchmark readings'),
      el('p', 'Each prediction names a result to look for, a time window and a date to check the published evidence. A milestone date requires additional evidence about the system as a whole.', 'obs-sub'));
    for (const f of [...issued, ...forecasts.filter((f) => !issued.includes(f))]) {
      const item = el('article', null, 'obs-prediction');
      item.id = 'prediction-' + f.id;
      item.append(el('h4', f.label));
      if (issued.includes(f)) {
        item.append(el('p', period(f.targetStart) + ' estimate · ' + predictionValue(f.centralValue, f.unit), 'obs-prediction-value'));
        if (f.range)
          item.append(el('p', 'Historical error range · ' + predictionValue(f.range.low, f.unit) + ' to ' + predictionValue(f.range.high, f.unit)));
        else item.append(small('There are too few comparable errors to give a range.'));
      } else item.append(el('p', f.status, 'obs-prediction-value'));
      item.append(el('p', f.definition), el('p', f.reason));
      const criteria = el('div');
      const b = f.basis;
      if (b && Number.isFinite(b.lastValue))
        criteria.append(el('p', 'Latest input · ' + predictionValue(b.lastValue, f.unit) + ' (' + date(b.lastDate) + ').'));
      if (f.model) criteria.append(el('p', 'Model · ' + f.model));
      if (b) {
        criteria.append(el('p', b.months + ' months with measurements · ' + b.holdoutCount + ' later comparisons.'));
        if (Number.isFinite(b.holdoutMAE) && Number.isFinite(b.baselineMAE))
          criteria.append(el('p', 'Average size of past errors · ' + predictionValue(b.holdoutMAE, f.unit) + ' for this model and ' + predictionValue(b.baselineMAE, f.unit) + ' when repeating the last observation.'));
      }
      if (f.range && f.rangeNote) criteria.append(el('p', f.rangeNote));
      if (f.limitations) criteria.append(el('p', f.limitations));
      if (f.change) criteria.append(el('p', f.change));
      if (f.sourceUrl) criteria.append(link(f.source || 'Source of the measurements', f.sourceUrl));
      if (f.issuedAt) item.append(small('Issued ' + time(f.issuedAt) + ' · Target window ' + date(f.targetStart) + ' to ' + date(f.targetEnd) + ' · Verification window ' + verificationWindow(f)));
      item.append(details('Source, method and uncertainty', criteria));
      root.append(item);
    }
    if (issued.length || a.indicatorOutcomes?.length) outcomeList.append(el('h3', 'Prediction results'));
    if (issued.length && !a.indicatorOutcomes?.length)
      outcomeList.append(el('p', 'The first estimates await verification. The source review window is ' + verificationWindow(issued[0]) + '.'));
    if (a.indicatorOutcomes?.length) {
      for (const o of a.indicatorOutcomes) {
        const body = el('div');
        body.append(el('p', o.reason), small('Verification window · ' + verificationWindow(o)), el('p', 'Original prediction · ' + predictionValue(o.centralValue, o.unit)));
        if (Number.isFinite(o.observedValue)) body.append(el('p', 'Published measurement · ' + predictionValue(o.observedValue, o.unit)));
        if (Number.isFinite(o.absoluteError)) body.append(el('p', 'Size of the error · ' + predictionValue(o.absoluteError, o.unit)));
        if (o.sourceUrl) body.append(link('Published result', o.sourceUrl));
        if (o.resolvedAt) body.append(small('Reviewed ' + date(o.resolvedAt)));
        outcomeList.append(details(o.label + ' · ' + period(o.targetStart) + ' · ' + o.status, body));
      }
    }
    return;
  }
  if (!issued.length) root.append(el('p', 'No benchmark has enough comparable evidence for a new prediction.'));
  else {
    const lead = issued[0];
    root.append(el('h3', 'What to watch in ' + period(lead.targetStart)));
    const ul = el('ul');
    const highlights = issued.slice(0, 2);
    const epochPair = highlights.length === 2 && highlights.every((f) => ['breadth-open', 'breadth-closed'].includes(f.id));
    if (epochPair)
      root.append(el('p', 'If models are released that month, these are the highest combined test scores we expect Epoch AI to report for each group. Higher scores mean stronger performance across those tests.'));
    for (const f of highlights) {
      const li = el('li');
      li.append(el('strong', f.label), ' · ' + predictionValue(f.centralValue, f.unit) +
        (f.targetStart !== lead.targetStart ? ' in ' + period(f.targetStart) : ''));
      if (!epochPair) li.append('. ' + f.definition);
      if (f.range) li.append(small('Historical error range · ' + predictionNumber.format(f.range.low) + '–' + predictionValue(f.range.high, f.unit)));
      else li.append(small('Too few comparable errors for a range.'));
      ul.append(li);
    }
    root.append(ul, small('These estimates depend on a qualifying published result. Past errors give a sense of their uncertainty. Verification · ' + verificationWindow(lead) + '.'));
  }
  root.append(link('All benchmark predictions, sources and results', './dashboard.html#outlook'));
}
function forecastBody(f) {
  const div = el('div');
  const range = f.range
    ? period(f.range.low) + ' to ' + (f.range.high ? period(f.range.high) : 'beyond the modeled horizon')
    : 'No supported predictive interval';
  div.append(
    el('p', f.reason),
    small('Uncertainty · ' + range),
    small(
      'Previous · ' + (f.previousDate ? period(f.previousDate) : f.previousStatus || 'No previous assessment'),
    ),
    el('p', f.change),
  );
  if (f.drivers?.length)
    div.append(
      el('h4', 'Evidence behind this projection'),
      list(f.drivers.map((d) => (typeof d === 'string' ? d : d.label || d.criterion))),
    );
  if (f.assumptions?.length) div.append(el('h4', 'Assumptions'), list(f.assumptions));
  if (f.horizonEnd) div.append(small('Modeled horizon ends ' + date(f.horizonEnd) + '.'));
  return div;
}
function renderArrivalForecasts(a) {
  const method = byId('arrival-method'), root = byId('forecast-list');
  method.replaceChildren();
  root.replaceChildren();
  if (!arrivalOutlook) {
    method.append(el('p', 'This edition reports the projection its original evidence model supported for each milestone.', 'obs-sub'));
    for (const f of a.forecasts.filter(f => f.id !== 'singularity')) {
      root.append(details(labels[f.id] + ' · ' + (f.centralDate ? period(f.centralDate) : f.status), forecastBody(f)));
    }
    return;
  }
  const model = arrivalOutlook;
  method.append(el('p', model.method, 'obs-sub'));
  method.append(el('p', 'A specialized system could improve its successors before it matches people across unfamiliar work. Under the Watch’s definitions, superintelligence includes general intelligence. A singularity depends on self-reinforcing research changing the wider pace of progress, so its estimated year can precede broad superiority to experts.'));
  const sources = new Map(model.sources.map(s => [s.id, s]));
  for (const id of editorialOrder) {
    const f = model.milestones.find(row => row.id === id);
    if (!f) continue;
    const section = el('article', null, 'obs-arrival-detail');
    section.id = 'arrival-' + id;
    const title = el('h3', f.label);
    const summary = f.status === 'Observed' ? 'Confirmed ' + f.centralYear :
      (f.status === 'Scenario estimate' ? 'Reference scenario' : f.status) + ' · ' + scenarioYear(f.centralYear, f.horizonYear) +
      (Number.isFinite(f.yearsRemaining) ? ' · ' + spanYears(f.yearsRemaining).toLowerCase() + ' from this edition' : '');
    section.append(title, el('p', summary, 'obs-prediction-value'), el('p', f.basis));
    if (f.scenarios?.length) {
      const comparison = el('dl', null, 'obs-scenario-years');
      for (const s of f.scenarios) {
        const cell = el('div');
        cell.append(el('dt', s.label), el('dd', scenarioYear(s.year, f.horizonYear)));
        comparison.append(cell);
      }
      section.append(comparison);
    }
    const reasoning = el('div');
    if (f.assumptions?.length) reasoning.append(el('h4', 'What has to happen'), list(f.assumptions));
    if (f.progress.evidence?.length) reasoning.append(el('h4', 'Evidence available at this reading'), list(f.progress.evidence));
    const refs = (f.sourceIds ?? []).map(key => sources.get(key)).filter(Boolean);
    if (refs.length) {
      const ul = el('ul');
      for (const source of refs) {
        const li = el('li');
        li.append(link(source.title, source.url));
        if (source.publishedOn) li.append(' · ', /^\d{4}-\d{2}$/.test(source.publishedOn) ?
          period(source.publishedOn + '-01') : date(source.publishedOn));
        if (source.locator) li.append(' · ', source.locator);
        if (source.finding) li.append(el('p', source.finding));
        if (source.limitation) li.append(small(source.limitation));
        ul.append(li);
      }
      reasoning.append(el('h4', 'Original sources'), ul);
    }
    const prior = Number.isFinite(f.previousYear) ? 'Previous reference year · ' + f.previousYear + '. ' : '';
    if (prior || f.change) reasoning.append(small(prior + (f.change || '')));
    const strict = a.forecasts.find(row => row.id === id);
    reasoning.append(el('h4', 'Independent criterion-based projection'),
      el('p', strict.centralDate ? period(strict.centralDate) : strict.status), forecastBody(strict),
      link('Inspect the milestone criteria', '#assessment-' + id));
    section.append(details('Assumptions, measured progress and sources', reasoning));
    root.append(section);
  }
  if (model.limitations?.length) {
    method.append(details('What the scenarios can tell us', Array.isArray(model.limitations) ?
      list(model.limitations) : el('p', model.limitations)));
  }
}
const clockUnits = ['Years', 'Months', 'Days', 'Hours', 'Minutes', 'Seconds'];
function updateClock() {
  if (!Number.isFinite(targetInstant)) return;
  const instant = selectedArchive ? Date.parse(assessment.checkpointAt) : Date.now();
  const parts = countdownParts(instant, targetInstant);
  const timer = byId('countdown-duration');
  if (!parts) {
    timer.className = 'obs-clock-state';
    timer.replaceChildren('Forecast reference date reached. Confirmation awaits evidence.');
    targetInstant = null;
    return;
  }
  const digits = timer.querySelectorAll('.obs-digit');
  parts.forEach((value, index) => {
    const text = index === 0 ? String(value) : String(value).padStart(2, '0');
    if (digits[index].textContent !== text) digits[index].textContent = text;
  });
}
function clock(a) {
  const scenario = arrivalOutlook?.milestones.find(x => x.id === 'singularity');
  const strict = a.forecasts.find(x => x.id === 'singularity');
  const out = byId('clock-reading');
  const timer = el('div', null, 'obs-clock-state');
  timer.id = 'countdown-duration';
  targetInstant = null;
  const context = el('div', null, 'obs-clock-context');
  const confirmed = strict?.status === 'Observed' || scenario?.status === 'Observed';
  const yearBased = scenario?.status === 'Scenario estimate';
  if (confirmed) {
    timer.textContent = 'Confirmed ' + (strict?.centralDate ? date(strict.centralDate) : 'in ' + scenario.centralYear);
    context.append(el('p', 'Independent evidence satisfies the Watch’s conditions for sustained AI-driven acceleration.'));
  } else if (yearBased && !Number.isFinite(scenario.centralYear)) {
    timer.textContent = 'Beyond ' + scenario.horizonYear;
    context.append(el('p', 'The reference scenario puts this milestone outside its modeled time horizon.'));
  } else if (yearBased || Number.isFinite(Date.parse(strict?.centralDate))) {
    targetInstant = yearBased ? referenceInstant(scenario.centralYear) : Date.parse(strict.centralDate);
    timer.className = 'obs-timeboard';
    timer.setAttribute('role', 'timer');
    timer.setAttribute('aria-label', 'Time until the forecast reference date');
    timer.setAttribute('aria-live', 'off');
    for (const unit of clockUnits) {
      const part = el('span', null, 'obs-time-part');
      const value = el('b', '00', 'obs-digit');
      value.translate = false;
      part.append(value, el('span', unit, 'obs-time-unit'));
      timer.append(part);
    }
    const reference = el('div', null, 'obs-clock-reference');
    if (yearBased) {
      const rangeNote = details('Scenario range ' + scenarioRange(scenario),
        el('p', 'The endpoints are the earliest and latest dated scenarios in this edition. Their spread shows how much the timing depends on the assumptions.'));
      rangeNote.className = 'obs-clock-range';
      if (scenario.beyondHorizonPathCount) rangeNote.append(el('p', 'In the stalled scenario, the milestone remains out of reach through ' + scenario.horizonYear + '.'));
      reference.append(el('strong', String(scenario.centralYear)), ' reference year');
      context.append(reference, rangeNote, el('p', 'July 1, ' + scenario.centralYear + ' at 00:00 UTC stands in for a year-only estimate that can change.'));
    } else {
      reference.append(el('strong', period(strict.centralDate)), ' forecast month');
      context.append(reference, el('p', 'The model estimates a month. The clock uses ' + date(strict.centralDate) + ' at 00:00 UTC as its reference point.'));
    }
  } else {
    timer.textContent = 'No dated estimate';
    context.append(el('p', yearBased ? 'This forecast has no reference date.' : 'This edition has too little independently verified evidence to date the singularity.'));
  }
  if (selectedArchive) context.append(small('Archived reading · time held at ' + time(a.checkpointAt) + '.'));
  const pace = paceHeadline(arrivalOutlook);
  if (pace) context.append(pace);
  const actions = el('nav', null, 'obs-hero-actions');
  actions.setAttribute('aria-label', 'Explore the forecast');
  actions.append(link('Compare AI systems', '#metric-charts'), link('Explore the calculation', '#calculations'));
  context.append(actions);
  out.replaceChildren(timer, context);
  updateClock();
}
function validation(a) {
  const grid = el('div', null, 'obs-diagnostic');
  for (const v of a.modelValidation) {
    const b = el('div');
    b.append(
      el('h3', v.label),
      el('p', v.status),
      small(v.months + ' observed months · ' + v.holdoutCount + ' later comparisons'),
    );
    if (v.selected)
      b.append(
        el(
          'p',
          'Selected on earlier observations · ' +
            v.selected +
            '. ' +
            (v.beatsPersistence
              ? 'Improved on persistence in the later comparisons.'
              : 'No demonstrated improvement on persistence in the later comparisons.'),
        ),
      );
    if (v.models.length)
      b.append(
        list(
          v.models.map(
            (m) =>
              m.name +
              ' · selection error ' +
              number.format(m.selectionMAE) +
              ', later error ' +
              (Number.isFinite(m.holdoutMAE) ? number.format(m.holdoutMAE) + ' ' + v.unit : 'unavailable'),
          ),
        ),
      );
    b.append(el('p', v.limitations));
    grid.append(b);
  }
  byId('validation').replaceChildren(
    el(
      'p',
      'Each model is trained using past observations, then scored on later ones. The average size of its errors is in the indicator’s original units. A benchmark backtest cannot validate an arrival date for an unprecedented event.',
    ),
    grid,
  );
}
function organizations(a) {
  const select = el('select', null, 'obs-picker'),
    title = el('label', 'Choose an organization '),
    out = el('div');
  for (const o of a.organizations) select.add(new Option(o.name, o.name));
  title.append(select);
  function show() {
    const o = a.organizations.find((x) => x.name === select.value);
    if (!o) {
      out.textContent = 'No attributed measurements in this edition.';
      return;
    }
    out.replaceChildren(el('p', o.summary), el('p', o.change), el('p', o.forecastEffect));
    const measured = o.observationIds.map((id) => records.get(id)).filter(Boolean);
    if (measured.length)
      out.append(
        details(
          'Measurements for this organization (' + measured.length + ')',
          ...measured.map((r) => details(rowTitle(r), observationBody(r))),
        ),
      );
  }
  select.onchange = show;
  byId('org-list').replaceChildren(title, out);
  show();
}
function context(a) {
  const o = a.oversight;
  byId('oversight-reading').replaceChildren(
    el('h3', o.status),
    el('p', o.summary),
    el('p', o.limitations),
    ...o.observationIds
      .map((k) => records.get(k))
      .filter(Boolean)
      .map((r) => details(rowTitle(r), observationBody(r))),
  );
  const f = a.xFactors,
    events = el('div');
  for (const e of f.events) {
    const text = list(e.effects.map((x) => x.area + ' · ' + x.direction + '. ' + x.detail));
    events.append(
      details(
        e.label,
        small(date(e.measuredOn || e.publishedOn) + ' · ' + e.classification),
        text,
        el('p', 'AI attribution · ' + e.attribution),
        el('p', e.forecastImpact),
        link(e.source, e.sourceUrl),
      ),
    );
  }
  byId('risk-register').replaceChildren(
    el('p', f.limitations),
    details(
      'Documented events (' + f.events.length + ')',
      f.events.length ? events : el('p', 'No verified consequences in this edition.'),
    ),
    details('What could change the outlook?', list(f.scenarios.map((x) => x.label + '. ' + x.effect))),
  );
}
const historical = new Map();
async function loadAssessment(row) {
  if (historical.has(row.sha256)) return historical.get(row.sha256);
  const url = new URL(row.url, base);
  if (
    url.origin !== base.origin &&
    !(url.origin === 'https://raw.githubusercontent.com' && url.pathname.startsWith('/never-nude/arewethere.yet/'))
  )
    throw Error('Unexpected archive host');
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw Error('Record unavailable');
  const buffer = await response.arrayBuffer();
  const bytes = await crypto.subtle.digest('SHA-256', buffer);
  if (Array.from(new Uint8Array(bytes), (n) => n.toString(16).padStart(2, '0')).join('') !== row.sha256)
    throw Error('Archive integrity mismatch');
  const record = JSON.parse(new TextDecoder().decode(buffer));
  if (record.assessment?.checkpointAt !== row.checkpointAt) throw Error('Incorrect archival timestamp');
  historical.set(row.sha256, record.assessment);
  return record.assessment;
}
function showChanges(a) {
  const box = byId('changes');
  if (a.kind === 'commissioning') {
    box.replaceChildren(el('p', 'This launch baseline is the starting point for comparisons.'));
    return;
  }
  const prior = [manifest.commissioning, ...manifest.archive]
    .filter((row) => row && row.checkpointAt < a.checkpointAt)
    .sort((x, y) => y.checkpointAt.localeCompare(x.checkpointAt))[0];
  box.replaceChildren();
  if (prior) {
    const u = new URL('./dashboard.html', base);
    u.searchParams.set('assessment', prior.checkpointAt);
    const desc = el('p', 'Previous edition · ');
    desc.append(link(editionLabel(prior) + ' · ' + time(prior.checkpointAt), u));
    box.append(desc);
  }
  if (outlookSupplement) box.append(el('p', 'A forecast bulletin issued ' + time(outlookSupplement.issuedAt) +
    ' adds scenario estimates for the four milestones using this edition’s measurements.'));
  box.append(list(a.changes));
}
function archive(a) {
  const rows = [...(manifest.commissioning ? [manifest.commissioning] : []), ...manifest.archive].reverse(),
    root = byId('archive');
  const items = el('ul');
  for (const r of rows) {
    const u = new URL('./dashboard.html', location.href);
    u.searchParams.set('assessment', r.checkpointAt);
    u.hash = 'milestone-progress';
    const item = el('li');
    item.append(
      link(editionLabel(r) + ' · ' + time(r.checkpointAt), u),
      ' · ',
      link('Source record', new URL(r.url, base)),
    );
    items.append(item);
  }
  root.replaceChildren(
    el(
      'p',
      manifest.archive.length +
        ' official recalibration' +
        (manifest.archive.length === 1 ? '' : 's') +
        ' archived. Each record retains its inputs, method, forecasts and field.',
    ),
    items,
  );
  if (manifest.legacy)
    root.append(
      details(
        'Earlier eight-indicator index',
        el(
          'p',
          'The former 0–100 index combined tests, resources, market expectations and launches. It used different rules. Its historical readings and external researcher forecast remain available in the frozen data.',
        ),
        link('Download the last published legacy edition', new URL(manifest.legacy.url, base)),
      ),
    );
  if (manifest.supplementalOutlook?.url) {
    const bulletin = manifest.supplementalOutlook;
    const note = el('p', 'Separate forecast bulletin · ');
    note.append(link(time(bulletin.issuedAt), new URL(bulletin.url, base)),
      ' · based on the evidence from ' + time(bulletin.basedOnCheckpoint) + '.');
    root.append(note);
  } else if (manifest.firstOutlookUrl) root.append(link('Read the first published milestone outlook', new URL(manifest.firstOutlookUrl, base)));
  if (selectedArchive) root.prepend(link('Return to the current assessment', './dashboard.html'));
}
function methodology(a) {
  const row = [manifest.currentRecord, manifest.commissioning, ...manifest.archive].find(r => r?.checkpointAt === a.checkpointAt);
  const ref = /^[a-f0-9]{40}$/i.test(row?.sourceRevision) ? row.sourceRevision : 'main';
  const repository = 'https://github.com/never-nude/arewethere.yet/blob/' + ref + '/';
  byId('method').replaceChildren(
    el(
      'p',
      'These operational definitions belong to this observatory. A score of 100 requires independent findings for every criterion in the same system or lineage. When all criteria have been tested, each counts once. An untested or disputed criterion leaves the total indeterminate. A score expresses documented criteria met. It has no conversion into elapsed time or odds of arrival.',
    ),
    el(
      'p',
      'ASI satisfies the AGI capability bar, potentially in the same assessment. A specialist could start recursive improvement before AGI. A singularity requires its own evidence of a sustained change in technological progress.',
    ),
    el(
      'p',
      'The Launch test is the first official measurement, taken on demand. The schedule expanded on November 25 to four daily checks at midnight, 6 a.m., 9:30 a.m. and 4 p.m. Eastern. Delayed verification keeps the previous edition visible. Measurements, publication dates and retrieval times can differ. Archive records retain those distinctions.',
    ),
    small('Milestone method ' + a.methodologyVersion + ' · milestone forecast model ' + a.modelVersion +
      (a.indicatorForecastVersion ? ' · benchmark forecast model ' + a.indicatorForecastVersion : '') +
      (arrivalOutlook ? ' · arrival scenario model ' + arrivalOutlook.version : '')),
    link(
      outlookSupplement ? 'Read the methodology at the evidence checkpoint' : 'Read the complete methodology',
      repository + 'site/observatory-methodology.md',
    ),
    ' · ',
    link('Reproduce an assessment', repository + 'README.md'),
  );
  if (outlookSupplement) byId('method').append(' · ',
    link('Read the methodology for the new forecast', 'https://github.com/never-nude/arewethere.yet/blob/main/site/observatory-methodology.md'));
}
function metadata() {
  const window = checkpointWindow(selectedArchive ? assessment.checkpointAt : new Date());
  byId('next-check').textContent = 'Next scheduled · ' + time(window.next);
  if (!assessment) return;
  const historic = selectedArchive ? 'Archived · ' : '';
  const baseText = editionLabel(assessment) + ' · ';
  const stale = Date.parse(assessment.checkpointAt) < Date.parse(window.previous) && !selectedArchive;
  byId('edition').textContent =
    historic +
    baseText +
    time(assessment.checkpointAt) +
    (stale ? ' · Awaiting a newer validated assessment' : '');
  if (!dashboard && !selectedArchive) {
    const shortLabel = editionLabel(assessment) === 'Scheduled assessment' ? 'Updated' : editionLabel(assessment);
    byId('edition').textContent = shortLabel + ' ' + briefTime.format(new Date(assessment.checkpointAt)) +
      (stale ? ' · Awaiting a newer validated assessment' : '');
    byId('next-check').textContent = 'Four checks daily · Next ' + briefTime.format(new Date(window.next));
    return;
  }
  byId('next-check').textContent =
    (selectedArchive ? 'Schedule at publication · ' : '') +
    'Previous scheduled slot · ' + time(window.previous) + ' · Next · ' + time(window.next);
}
function linkedSection() {
  let id;
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  const aliases = {
    'front-score': 'milestone-progress',
    'front-milestones': 'milestone-progress',
    'front-scale': 'history',
    'front-points': 'methodology',
    'front-countdown': 'countdown',
    'home-week-reading': 'history',
    'evidence-gates': 'milestone-progress',
    scenario: 'forecasts',
    forecast: 'forecasts',
    terrain: 'atlas',
    'human-evidence': 'oversight',
    'model-leaders': 'leaders',
    evidence: 'signals',
    'public-sources': 'signals',
  };
  const isOld = id.startsWith('home-') || id.startsWith('front-') || id.startsWith('factor-');
  const dest = aliases[id] || (id.startsWith('factor-') ? 'signals' : isOld ? 'milestone-progress' : id);
  if (!dest) return;
  const t = byId(dest);
  if (t) {
    if (t.matches('details')) t.open = true;
    if (dest.startsWith('assessment-') || dest.startsWith('arrival-')) {
      const d = t.querySelector('details');
      if (d) d.open = true;
    }
    if (dest !== id) history.replaceState(null, '', '#' + dest);
    t.scrollIntoView({ behavior: 'instant' });
  } else if (
    !dashboard &&
    (Object.hasOwn(aliases, id) ||
      ['atlas', 'history', 'forecasts', 'leaders', 'methodology', 'oversight', 'x-factors'].includes(id) ||
      dest.startsWith('assessment-') || dest.startsWith('arrival-'))
  ) {
    const url = new URL('./dashboard.html', location.href);
    url.search = location.search;
    url.hash = dest;
    location.replace(url);
  }
}
function paint(a) {
  assessment = a;
  const selected = selectOutlook(a, manifest, selectedArchive);
  outlookSupplement = selected.bulletin;
  arrivalOutlook = selected.outlook;
  records.clear();
  for (const o of a.observations) records.set(o.id, o);
  metadata();
  renderMilestones(a);
  clock(a);
  renderInvestment(byId('model-investment'), a, { archived: selectedArchive, detailed: dashboard });
  renderMetricCharts(byId('metric-charts'), a, { detailed: dashboard, arrivalOutlook });
  renderAcceleration(byId('acceleration'), arrivalOutlook, {detailed:dashboard});
  for (const nav of document.querySelectorAll('[data-pace-nav]')) nav.hidden = !arrivalOutlook?.pace;
  renderCalculations(byId('calculation-visual'), a, arrivalOutlook, { compact: !dashboard });
  measuredLead(a);
  indicatorPredictions(a);
  showChanges(a);
  const field = byId('observatory-field');
  fieldInstance?.();
  fieldInstance = mountField(field, {
    assessment: a,
    history: [...(manifest.commissioning ? [manifest.commissioning] : []), ...manifest.archive].filter(
      (row) => row.checkpointAt <= a.checkpointAt,
    ),
    loadAssessment,
    compact: !dashboard,
  });
  if (dashboard) {
    register(a);
    disposeTrends?.();
    disposeTrends = renderTrends(byId('trend-chart'), a);
    organizations(a);
    context(a);
    archive(a);
    methodology(a);
    validation(a);
    renderArrivalForecasts(a);
  } else renderBrief(a);
  if (selectedArchive) {
    for (const anchor of document.querySelectorAll('.view-switch a, .obs-footer a, #assessment-list a, #arrival-note a, #clock-reading a, #calculation-visual a, #acceleration a, #definitions a, #metric-charts a, #indicator-forecasts a, #brief-evidence a, #observatory-field a')) {
      const u = new URL(anchor.href, base);
      if (u.origin !== base.origin || ![base.pathname, base.pathname + 'dashboard.html'].includes(u.pathname)) continue;
      u.searchParams.set('assessment', a.checkpointAt);
      anchor.href = u.href;
    }
  }
}
async function refresh() {
  if (requestInFlight || document.hidden) return;
  requestInFlight = true;
  try {
    const response = await fetch(new URL('./data/observatory.json', base), {
      cache: 'no-cache',
      signal: AbortSignal.timeout(16000),
    });
    if (!response.ok) throw Error('Missing assessment');
    const data = await response.json();
    if (data.schemaVersion !== 2 || !Array.isArray(data.archive)) throw Error('Unknown edition format');
    if (!data.assessment) {
      byId('edition').textContent = 'Awaiting the first validated assessment.';
      metadata();
      return;
    }
    if (data.commissioning) data.commissioning.kind = 'commissioning';
    const selected = new URL(location.href).searchParams.get('assessment');
    const row = selected
      ? [data.commissioning, ...data.archive].filter(Boolean).find((x) => x.checkpointAt === selected)
      : null;
    if (selected && !row) throw Error('Requested archive edition unavailable');
    const a = row ? await loadAssessment(row) : data.assessment;
    if (assessment?.checkpointAt === a.checkpointAt && (row || (manifest?.supplementalOutlook?.issuedAt === data.supplementalOutlook?.issuedAt &&
      manifest?.supplementalPaceOutlook?.issuedAt === data.supplementalPaceOutlook?.issuedAt))) {
      metadata();
      return;
    }
    const first = !assessment;
    selectedArchive = !!row;
    manifest = data;
    paint(a);
    if (first) linkedSection();
  } catch (e) {
    console.error('Observatory:', e.message);
    byId('edition').textContent = assessment
      ? 'Update unavailable · showing the edition from ' + time(assessment.checkpointAt)
      : 'Assessment unavailable. The public data link below opens the source feed.';
  } finally {
    requestInFlight = false;
  }
}
installBriefingGlossary(main);
metadata();
refresh();
window.setInterval(() => {
  if (!document.hidden) {
    metadata();
    refresh();
  }
}, 60000);
window.setInterval(() => {
  if (!selectedArchive && !document.hidden) updateClock();
}, 1000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    updateClock();
    refresh();
  }
});
window.addEventListener('hashchange', linkedSection);
