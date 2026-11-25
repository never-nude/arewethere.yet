import { renderTrends } from './observatory-trends.js';
import { checkpointWindow, editionLabel } from './checkpoint-schedule.js';
import { mountField } from './observatory-field.js';
import { installBriefingGlossary } from './front-glossary.js';

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
  requestInFlight = false,
  clockForecast,
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
function renderMilestones(a) {
  const container = byId('assessment-list');
  container.replaceChildren(
    ...editorialOrder.map((id) => {
      const m = a.milestones.find((i) => i.id === id),
        value = Number.isFinite(m.score) ? m.score + ' / 100' : 'Indeterminate';
      const line = el('div', null, 'obs-row');
      line.dataset.milestone = id;
      const title = el('strong');
      title.append(el('i', null, 'obs-dot'), labels[id]);
      line.append(
        title,
        el('span', value, 'obs-value'),
        el('p', summaries[id] + ' · ' + m.coverage.assessed + '/' + m.coverage.total + ' criteria assessed'),
      );
      if (!dashboard) {
        const ref = link(id === 'singularity' ? 'Singularity' : m.label, './dashboard.html#assessment-' + id);
        title.replaceChildren(el('i', null, 'obs-dot'), ref);
        return line;
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
      box.append(details('Definition, evidence and scoring', inside));
      return box;
    }),
  );
}
function measuredLead(a) {
  const tested = a.observations.filter(
    (x) => x.topic === 'reliability' && Number.isFinite(x.value) && x.publishedOn,
  );
  const latest = tested
    .map((o) => o.publishedOn)
    .sort()
    .at(-1);
  const r = tested.filter((o) => o.publishedOn === latest).sort((a, b) => b.value - a.value)[0];
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
  const unresolved = a.milestones.filter((m) => !Number.isFinite(m.score)).length;
  const status = unresolved === a.milestones.length
    ? 'All four milestones still have open criteria.'
    : (a.milestones.length - unresolved) + ' of four milestones have enough independent evidence for a score.';
  byId('brief-status').replaceChildren(link(status, '#milestone-progress'));
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
function updateClock() {
  if (!clockForecast) return;
  const target = byId('countdown-duration');
  if (!target) return;
  const f = clockForecast;
  if (f.status === 'Observed') target.textContent = 'First confirmed ' + date(f.centralDate);
  else if (!f.centralDate) target.textContent = 'Not reliably estimable';
  else {
    const asOf = selectedArchive ? Date.parse(assessment.checkpointAt) : Date.now();
    const remaining = Date.parse(f.centralDate) - asOf;
    const months = Math.max(0, Math.round(remaining / (86400000 * 30.4375)));
    target.textContent =
      remaining <= 0
        ? 'Forecast period reached · awaiting evidence'
        : months < 1
          ? 'Within the forecast month'
          : 'About ' + months + ' month' + (months === 1 ? '' : 's') + ' · ' + period(f.centralDate);
  }
}
function clock(a) {
  const f = a.forecasts.find((x) => x.id === 'singularity');
  clockForecast = f;
  const val = el('h3');
  val.id = 'countdown-duration';
  byId('clock-reading').replaceChildren(
    val,
    el(
      'p',
      'The destination follows verified evidence for sustained AI-led acceleration. A new checkpoint can move it earlier or later.',
    ),
    small(editionLabel(a) + ' · ' + time(a.checkpointAt)),
    forecastBody(f),
  );
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
      'The Launch test is the first official measurement, taken on demand. Regular assessments run every day at midnight, 9:30 a.m. and 4 p.m. Eastern. Delayed verification keeps the previous edition visible. Measurements, publication dates and retrieval times can differ. Archive records retain those distinctions.',
    ),
    small('Milestone method ' + a.methodologyVersion + ' · milestone forecast model ' + a.modelVersion +
      (a.indicatorForecastVersion ? ' · benchmark forecast model ' + a.indicatorForecastVersion : '')),
    link(
      'Read the complete methodology',
      repository + 'site/observatory-methodology.md',
    ),
    ' · ',
    link('Reproduce an assessment', repository + 'README.md'),
  );
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
    if (dest.startsWith('assessment-')) {
      const d = t.querySelector('details');
      if (d) d.open = true;
    }
    if (dest !== id) history.replaceState(null, '', '#' + dest);
    t.scrollIntoView({ behavior: 'instant' });
  } else if (
    !dashboard &&
    (Object.hasOwn(aliases, id) ||
      ['atlas', 'history', 'forecasts', 'leaders', 'methodology', 'oversight', 'x-factors'].includes(id) ||
      dest.startsWith('assessment-'))
  ) {
    const url = new URL('./dashboard.html', location.href);
    url.search = location.search;
    url.hash = dest;
    location.replace(url);
  }
}
function paint(a) {
  assessment = a;
  records.clear();
  for (const o of a.observations) records.set(o.id, o);
  metadata();
  renderMilestones(a);
  clock(a);
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
    byId('forecast-list').replaceChildren(
      ...a.forecasts
        .filter((f) => f.id !== 'singularity')
        .map((f) =>
          details(labels[f.id] + ' · ' + (f.centralDate ? period(f.centralDate) : f.status), forecastBody(f)),
        ),
    );
  } else renderBrief(a);
  if (selectedArchive) {
    for (const anchor of document.querySelectorAll('.view-switch a, .obs-footer a, #assessment-list a, #indicator-forecasts a, #brief-evidence a, #observatory-field a')) {
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
    if (assessment?.checkpointAt === a.checkpointAt) {
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
    updateClock();
    refresh();
  }
}, 60000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refresh();
});
window.addEventListener('hashchange', linkedSection);
