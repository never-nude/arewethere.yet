import {outlookAnchors as anchors} from './observatory-outlook-sources.js';

const ids = ['agi', 'rsi', 'asi', 'singularity'];
const names = {
  agi: 'Artificial general intelligence',
  rsi: 'Recursive self-improvement',
  asi: 'Artificial superintelligence',
  singularity: 'Singularity',
};

function lagAtHalf({years1, years2, p1, p2}) {
  const share = (0.5 - p1) / (p2 - p1);
  return Number((years1 + share * (years2 - years1)).toFixed(1));
}

function lagExplanation({years1, years2, p1, p2}, years) {
  return `Survey respondents put the chance at ${Math.round(p1 * 100)}% within ${years1} years of human-level AI and ${Math.round(p2 * 100)}% within ${years2}. Drawing a straight line between the two answers puts 50% at ${years} years. The shape of that line is a modeling choice.`;
}

function verifiedFirstLink(assessment, asOf) {
  const rsi = assessment?.milestones?.find(m => m.id === 'rsi');
  const link = rsi?.criteria?.find(c => c.id === 'rsi-contribution' && c.status === 'met');
  return link?.reviews?.map(r => r.reviewedAt?.slice(0, 10)).filter(d => d && d <= asOf.slice(0, 10)).sort()[0];
}

// The bulletin records rounded years. Show arithmetic only when it reproduces the
// issued result. Other versions, overrides and missing inputs keep the issued basis.
export function calculationGuide(assessment, outlook) {
  const records = new Map((outlook?.milestones ?? []).map(m => [m.id, m]));
  const rows = ids.filter(id => records.has(id)).map(id => {
    const m = records.get(id);
    return {id, year: m.centralYear, status: m.status, equation: '', explanation: m.basis, assumption: ''};
  });
  const guide = {rows, conditions: []};
  if (outlook?.version === '2.0.0' && outlook.pace?.milestones) {
    const inputs = outlook.pace.referenceInputs;
    const previous = calculationGuide(assessment, {...outlook,version:'1.0.0'});
    for (const row of rows) {
      const change = outlook.pace.milestones.find(m=>m.id===row.id);
      const original = previous.rows.find(m=>m.id===row.id);
      if (change && change.baselineYear === row.year && change.referenceYear === row.year && original) {
        row.equation = original.equation;
        row.assumption = original.assumption;
      }
      if (row.id === 'rsi' && !row.equation && row.status==='Scenario estimate' && Number.isInteger(inputs?.rsiFloor) && inputs.rsiFloor===row.year) {
        row.equation='Research and successor-cycle forecast · '+row.year;
      }
      if (change?.reason && change.reason !== row.explanation) row.assumption = [row.assumption,change.reason].filter(Boolean).join(' ');
    }
    const singularity = rows.find(m=>m.id==='singularity');
    const gates = inputs?.referenceGates;
    if (singularity?.status === 'Scenario estimate' && gates?.length && gates.every(g=>Number.isInteger(g.year)) &&
      Math.max(...gates.map(g=>g.year))===singularity.year) {
      guide.conditions = gates.map(g=>({label:g.label,math:g.math ?? '',year:g.year}));
      singularity.equation = 'Latest of '+gates.map(g=>g.year).join(', ')+' = '+singularity.year;
    }
    return guide;
  }
  if (outlook?.version !== '1.0.0') return guide;
  const byId = Object.fromEntries(rows.map(row => [row.id, row]));
  const {agi, rsi, asi, singularity} = byId;
  const scenario = row => row?.status === 'Scenario estimate' && Number.isFinite(row.year);
  const {hlmi, leapAgi, mlPaper, asiLag, speedupLag, leapRapid} = anchors;

  if (scenario(agi) && Math.round((hlmi.q50 + leapAgi.q50) / 2) === agi.year &&
      !['Observed', 'Criterion-based estimate'].includes(asi?.status)) {
    agi.equation = `(${hlmi.q50} + ${leapAgi.q50}) ÷ 2 = ${agi.year}`;
    agi.explanation = `Researchers put machines doing every task better and more cheaply than humans at ${hlmi.q50}. LEAP forecasters put AI outperforming nine in ten professionals on most tasks in each nonphysical occupation at ${leapAgi.q50}, conditional on recognition by 2100. The Watch gives the two dates equal weight.`;
    agi.assumption = 'The model also checks when AI could reliably finish tasks that take an expert eight hours. Slower progress on this test can delay the date.';
  }

  if (scenario(rsi)) {
    const review = outlook.asOf && verifiedFirstLink(assessment, outlook.asOf);
    // The frozen v1 bulletin includes the rounded research-panel year in its basis.
    // Panelists can revise it independently of the bundled catalog.
    const panelYear = Number(records.get('rsi').basis?.match(/research-automation date \(about (\d{4})\)/)?.[1]);
    if (review) {
      const year = Number(review.slice(0, 4));
      if (year + 1 === rsi.year) {
        rsi.equation = `${year} + 1 year = ${rsi.year}`;
        rsi.explanation = 'The first independently verified improvement supplies the start year. The model allows another year for the next generation to make a further improvement.';
      } else {
        rsi.explanation = `The first independent review of a successor improvement was dated ${review}. This edition allows one more development cycle.`;
      }
    } else if (Number.isFinite(panelYear) && Math.round((panelYear + mlPaper.q50) / 2 + 2) === rsi.year) {
      rsi.equation = `(${panelYear} + ${mlPaper.q50}) ÷ 2 + 2 years ≈ ${rsi.year}`;
      rsi.explanation = `The model averages the AI Futures panel’s date for automating AI research (about ${panelYear}) with researchers’ date for an AI conducting and writing a publishable study (${mlPaper.q50}). It allows one year for each of two successive improvements.`;
    }
    if (!review) rsi.assumption = 'The model also checks when AI could reliably finish tasks that take an expert 40 hours. An independently verified first improvement would replace the assumed starting point.';
  }

  if (scenario(asi) && Number.isFinite(agi?.year)) {
    const lag = lagAtHalf(asiLag);
    if (Math.round(agi.year + lag) === asi.year) {
      asi.equation = `${agi.year} + ${lag} years ≈ ${asi.year}`;
      asi.explanation = 'The model starts at general intelligence and adds the surveyed wait for AI to surpass leading experts across professions.';
      asi.assumption = lagExplanation(asiLag, lag);
    }
  }

  if (scenario(singularity) && Number.isFinite(rsi?.year) && Number.isFinite(agi?.year)) {
    const lag = lagAtHalf(speedupLag);
    const conditions = [
      {label: 'One more AI research cycle', input: 'recursive self-improvement', math: `${rsi.year} + 1 year`, year: rsi.year + 1},
      {label: 'Widespread rapid progress', input: 'the LEAP forecast', math: 'LEAP forecast', year: leapRapid.q50},
      {label: 'Faster technological change after general AI', input: 'general intelligence', math: `${agi.year} + ${lag} years`, year: agi.year + lag},
    ];
    if (Math.max(...conditions.map(c => c.year)) === singularity.year) {
      guide.conditions = conditions;
      singularity.equation = `Latest of ${conditions.map(c => c.year).join(', ')} = ${singularity.year}`;
      singularity.explanation = 'The reference scenario waits for repeated AI-led improvements and a faster pace of technological change across the wider world. Superintelligence has its own forecast and supplies no separate deadline in this calculation.';
      singularity.assumption = lagExplanation(speedupLag, lag);
    }
  }
  return guide;
}

function el(tag, text, className) {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function milestoneLink(id, compact) {
  const url = new URL(compact ? './dashboard.html' : location.pathname, location.href);
  const edition = new URL(location.href).searchParams.get('assessment');
  if (edition) url.searchParams.set('assessment', edition);
  url.hash = 'arrival-' + id;
  const link = el('a', 'Scenarios and sources');
  link.setAttribute('aria-label', 'Scenarios and sources for ' + names[id].toLowerCase());
  link.href = url.href;
  return link;
}

function drawConditions(root, conditions, outlook) {
  const last = Math.max(...conditions.map(c => c.year));
  const issueYear = Number(outlook.asOf?.slice(0, 4));
  const start = Math.min(issueYear || last, ...conditions.map(c => c.year));
  root.append(el('p', 'Three projected dates feed the singularity clock. The latest sets the reference year.', 'obs-sub'));
  const figure = el('figure', null, 'calc-chart');
  figure.setAttribute('aria-label', 'Projected years for the three conditions used by the singularity clock');
  const list = el('ol', null, 'calc-conditions');
  for (const c of conditions) {
    const item = el('li', null, c.year === last ? 'calc-condition is-latest' : 'calc-condition');
    const label = el('div', null, 'calc-constraint-label');
    label.append(el('span', c.label), el('span', c.math, 'calc-math'));
    const track = el('div', null, 'calc-track');
    track.setAttribute('aria-hidden', 'true');
    const span = el('span');
    span.style.width = (last === start ? 100 : (c.year - start) / (last - start) * 100) + '%';
    track.append(span);
    const result = el('div', null, 'calc-result');
    result.append(el('strong', String(c.year)));
    if (c.year === last) result.append(el('small', 'Sets the year'));
    item.append(label, track, result);
    list.append(item);
  }
  figure.append(list, el('figcaption', `Bars run from ${start} to ${last}. Each shows a projected calendar year.`));
  root.append(figure);
  const limiting = conditions.filter(c => c.year === last);
  if (limiting.length === 1 && limiting[0].input && last < outlook.horizonYear) {
    root.append(el('p', `If ${limiting[0].input} moved one year later and the other inputs held, the singularity estimate would move from ${last} to ${last + 1}.`, 'calc-example'));
  }
}

function detailsFor(row, compact) {
  const article = el('article', null, 'calc-recipe');
  const heading = el('h3', names[row.id]);
  const reading = Number.isFinite(row.year) ? `${row.year} · ${row.status}` : 'Beyond forecast horizon';
  article.append(heading, el('p', row.equation || reading, 'calc-equation'));
  if (row.explanation) article.append(el('p', row.explanation));
  if (row.assumption) article.append(el('p', row.assumption));
  article.append(milestoneLink(row.id, compact));
  return article;
}

const paths = [
  {key: 'fast', label: 'Faster', issued: 'Faster development'},
  {key: 'reference', label: 'Reference', issued: 'Reference scenario'},
  {key: 'acceleration', label: 'Sustained acceleration', issued: 'Sustained acceleration'},
  {key: 'slow', label: 'Slower', issued: 'Slower development'},
  {key: 'stalled', label: 'Stalled', issued: 'Stalled or never realized'},
];

// A null year is an explicitly open outcome. An absent row is unpublished.
// Observations supply a date across every path modeled in the same edition.
export function scenarioTimeline(outlook) {
  if (!outlook?.milestones?.length) return null;
  const records = new Map(outlook.milestones.map(m => [m.id, m]));
  const known = ['singularity', 'asi', 'rsi', 'agi'].map(id => records.get(id)).filter(Boolean);
  const options = paths.filter(p => known.some(m => m.scenarios?.some(s => s.label === p.issued)));
  const onlyObserved = known.length && known.every(m => m.status === 'Observed');
  if (!options.length && onlyObserved) options.push({key: 'observed', label: 'Observed'});
  if (!options.length || !Number.isInteger(outlook.horizonYear)) return null;
  const milestones = known.map(m => {
    const observed = m.scenarios?.find(s => s.label === 'First independently verified')?.year;
    const fixed = m.status === 'Observed' && Number.isInteger(observed);
    const values = Object.fromEntries(options.map(p => {
      const year = fixed ? observed : m.scenarios?.find(s => s.label === p.issued)?.year;
      return [p.key, year === null || Number.isInteger(year) ? year : undefined];
    }));
    return {id: m.id, fixed, values};
  });
  const datedYears = milestones.flatMap(m => Object.values(m.values).filter(Number.isInteger));
  const editionYear = Number(outlook.asOf?.slice(0, 4));
  const start = Math.min(...datedYears, editionYear || outlook.horizonYear - 1, outlook.horizonYear - 1);
  const end = Math.max(outlook.horizonYear, ...datedYears);
  return {options, milestones, start, end, horizon: outlook.horizonYear,
    selected: options.some(p => p.key === 'reference') ? 'reference' : options[0].key};
}

function timelineExplorer(root, timeline) {
  const {options, milestones, start, end, horizon} = timeline;
  const plot = el('div', null, 'calc-explorer');
  const selectedInputs = el('fieldset', null, 'calc-tabs');
  selectedInputs.append(el('legend', 'Development scenario'));
  const controls = el('div', null, 'calc-tab-options');
  if (options.length > 4) controls.classList.add('calc-five-paths');
  selectedInputs.append(controls);
  const chart = el('figure', null, 'calc-timeline');
  chart.setAttribute('aria-label', 'Milestone years on a shared calendar scale');
  const header = el('div', null, 'calc-timeline-header');
  const scale = el('div', null, 'calc-axis');
  const ticks = el('div', null, 'calc-ticks');
  const percent = year => 100 * (year - start) / (end - start);
  const middleDecade = Math.round((start + end) / 20) * 10;
  const tickYears = [start, middleDecade, end].filter((y, i) => i !== 1 || (y > start && y < end));
  for (const year of tickYears) {
    const label = el('span', String(year), 'calc-tick');
    label.style.insetInlineStart = percent(year) + '%';
    ticks.append(label);
  }
  scale.append(ticks, el('span', `After ${horizon} or never`, 'calc-open-heading'));
  header.append(el('span', 'Milestone', 'calc-axis-label'), scale);
  const rows = el('ol', null, 'calc-timeline-rows');
  chart.append(header, rows);
  const positions = milestones.map(m => {
    const row = el('li', null, 'calc-time-row');
    row.dataset.milestone = m.id;
    const name = el('div', null, 'calc-time-name');
    const shift = el('span', '', 'calc-time-shift');
    name.append(el('strong', names[m.id]), shift);
    const runway = el('div', null, 'calc-runway');
    const rail = el('div', null, 'calc-rail');
    const ghost = el('span', null, 'calc-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    const marker = el('span', null, 'calc-marker');
    const yearLabel = el('span');
    marker.append(yearLabel);
    rail.append(ghost, marker);
    runway.append(rail, el('span', null, 'calc-open-lane'));
    row.append(name, runway);
    rows.append(row);
    return {m, shift, ghost, marker, yearLabel};
  });
  const caption = el('figcaption', null, 'calc-timeline-caption');
  caption.setAttribute('role', 'status');
  chart.append(caption);
  function select(key) {
    const openPosition = 'calc(100% + var(--lane-gap) + var(--lane-width) / 2 + var(--label-pad))';
    const position = value => Number.isInteger(value) ? percent(value) + '%' : openPosition;
    for (const {m, shift, ghost, marker, yearLabel} of positions) {
      const year = m.values[key];
      const ref = m.values.reference;
      const changed = key !== 'reference' && year !== ref && year !== undefined && ref !== undefined;
      ghost.hidden = !changed;
      ghost.style.insetInlineStart = position(ref);
      marker.hidden = year === undefined;
      marker.classList.toggle('is-open', year === null);
      marker.style.insetInlineStart = position(year);
      yearLabel.textContent = year === null ? 'Open' : String(year ?? '');
      yearLabel.setAttribute('aria-label', year === null ? `After ${horizon} or never` : yearLabel.textContent);
      if (m.fixed) shift.textContent = 'Independently observed';
      else if (year === undefined) shift.textContent = 'No published date';
      else if (changed && Number.isInteger(year) && Number.isInteger(ref)) {
        const delta = Math.abs(year - ref);
        shift.textContent = `${delta} ${delta === 1 ? 'year' : 'years'} ${year < ref ? 'earlier' : 'later'}`;
      } else shift.textContent = '';
    }
    const mode = options.find(p => p.key === key).label;
    const event = milestones.find(m => m.id === 'singularity');
    const year = event?.values[key];
    if (key === 'reference') caption.textContent = 'The headline countdown follows this reference scenario.';
    else if (key === 'observed') caption.textContent = 'These years record the first independent verification of each milestone.';
    else if (year === null) caption.textContent = `${mode} scenario. The singularity has no projected date through ${horizon}. Hollow dots mark the reference dates.`;
    else if (Number.isInteger(year)) caption.textContent = `${mode} scenario. The singularity lands in ${year}. Hollow dots mark the reference dates.`;
    else caption.textContent = `${mode} scenario. Hollow dots mark the reference dates where the edition supplies them.`;
  }
  for (const p of options) {
    const label = el('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'milestone-scenario';
    input.value = p.key;
    input.checked = p.key === timeline.selected;
    input.addEventListener('change', () => { if (input.checked) select(p.key); });
    label.append(input, el('span', p.label));
    controls.append(label);
  }
  if (options.length > 1) plot.append(selectedInputs);
  plot.append(chart);
  root.append(plot);
  select(timeline.selected);
}

export function renderCalculations(root, assessment, outlook, {compact = false} = {}) {
  if (!root) return;
  root.replaceChildren();
  const {rows, conditions} = calculationGuide(assessment, outlook);
  if (!rows.length) {
    root.append(el('p', 'This edition predates the first published milestone outlook. Its evidence and benchmark predictions are available below.', 'obs-sub'));
    return;
  }
  const timeline = scenarioTimeline(outlook);
  if (timeline) timelineExplorer(root, timeline);
  const math = el('details', null, 'obs-detail calc-disclosure');
  const reference = rows.find(r => r.id === 'singularity');
  const title = conditions.length
    ? `Why the reference scenario lands in ${reference.year}`
    : 'How the published singularity estimate was made';
  math.append(el('summary', title));
  math.open = !compact;
  if (conditions.length) drawConditions(math, conditions, outlook);
  else if (reference) math.append(el('p', reference.explanation, 'obs-sub'));
  root.append(math);
  const recipes = el('div', null, 'calc-recipes');
  for (const row of rows) recipes.append(detailsFor(row, compact));
  const details = el('details', null, 'obs-detail calc-disclosure');
  details.append(el('summary', 'See the calculation for each milestone'), recipes);
  root.append(details);
}
