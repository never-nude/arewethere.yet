import { factorDefinitions } from './index-model.js';
import { scoreRoutes } from './route-confidence.js';

const rubrics = [
  {
    id: 'agi',
    name: 'AGI',
    title: 'Artificial general intelligence',
    target: 'Matches skilled human performance across a representative range of unfamiliar tasks.',
    example: 'One assistant could explain a lease, troubleshoot a home network, and tutor a student through a new problem.',
    evidence: [
      { id: 'breadth', weight: 35 },
      { id: 'reliability', weight: 15 },
    ],
    verification: {
      ids: ['agi'],
      label: 'Independent evidence of broad transfer at skilled human level',
      weight: 50,
      context: 'Independent tests would need to establish skilled human performance on unfamiliar tasks across varied domains.',
    },
    links: [['Capability evidence', '#evidence-capability'], ['Definitions of AGI', '#evidence-agi-timing']],
  },
  {
    id: 'asi',
    name: 'ASI',
    title: 'Artificial superintelligence',
    target: 'Consistently exceeds leading human experts across many important domains.',
    example: 'A system could design longer-lasting batteries that expert teams missed and also outperform specialists in other fields.',
    evidence: [
      { id: 'breadth', weight: 25 },
      { id: 'horizon', weight: 15 },
    ],
    verification: {
      ids: ['asi'],
      label: 'Independent evidence of sustained superhuman breadth',
      weight: 60,
      context: 'Independent tests would need to show reproducible performance above the strongest human experts across many domains.',
    },
    links: [['Capability evidence', '#evidence-capability'], ['Definitions of AI capability', '#evidence-agi-timing']],
  },
  {
    id: 'rsi',
    name: 'RSI',
    title: 'Recursive self-improvement',
    target: 'AI helps make a stronger successor that improves the next generation in turn.',
    example: 'A coding assistant helps build a better assistant, which then does more of the work on the following version.',
    evidence: [
      { id: 'research-autonomy', weight: 25 },
      { id: 'research-acceleration', weight: 20 },
    ],
    verification: {
      ids: ['successor-loop', 'compounding'],
      label: 'Independent verification of a repeatable successor loop',
      weight: 55,
      context: 'Independent evidence would need to trace a successor’s gains to prior AI-led work and show the successor improving the next generation.',
    },
    links: [['AI research and attribution evidence', '#evidence-acceleration']],
  },
  {
    id: 'singularity',
    name: 'Singularity',
    title: 'Sustained AI-led acceleration',
    target: 'Successive AI systems speed up AI research enough to sustain accelerating gains.',
    example: 'Useful software upgrades could arrive faster with each generation of AI, leaving teams less time to adapt.',
    links: [['AI research and attribution evidence', '#evidence-acceleration'], ['History of the idea', '#evidence-history']],
  },
];

const factorById = new Map(factorDefinitions.map((factor) => [factor.id, factor]));
const mounted = new WeakMap();
const number = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
const fullDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const clamp = (value) => Math.min(100, Math.max(0, value));
const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

function hasSource(record) {
  try { return new URL(record.sourceUrl).protocol === 'https:'; } catch { return false; }
}

function measureFactor(factor, { id, weight }) {
  const definition = factorById.get(id);
  const score = Number.isFinite(factor?.score) ? clamp(factor.score) : null;
  return {
    id,
    label: factor?.label ?? definition.label,
    points: score === null ? null : round(score * weight / 100),
    weight,
    detail: [factor?.detail ?? definition.detail, factor?.scoring ?? definition.scoring].join(' '),
    source: factor?.source ?? definition.source,
    sourceUrl: factor?.sourceUrl ?? definition.sourceUrl,
    rawValue: factor?.value,
    unit: factor?.unit ?? definition.unit,
  };
}

function verificationReading(criteria, verification) {
  const proof = criteria.find((criterion) =>
    verification.ids.includes(criterion.id) && criterion.status === 'met' && hasSource(criterion));
  return {
    label: verification.label,
    points: proof ? verification.weight : null,
    weight: verification.weight,
    detail: verification.context,
    verification: true,
    source: proof?.source,
    sourceUrl: proof?.sourceUrl,
  };
}

function measure(contributions) {
  const available = contributions.filter(({ points }) => points !== null);
  return {
    score: available.length ? round(available.reduce((sum, item) => sum + item.points, 0)) : null,
    coverage: available.reduce((sum, item) => sum + item.weight, 0),
    contributions,
  };
}

export function measureMilestoneProgress(index) {
  const factors = new Map((index?.factors ?? []).map((factor) => [factor.id, factor]));
  const criteria = index?.threshold?.criteria ?? [];
  const compounding = scoreRoutes(index).research.steps.find(({ to }) => to === 'singularity');
  return rubrics.map((rubric) => ({
    ...rubric,
    ...(rubric.id === 'singularity'
      ? {
        ...compounding,
        contributions: compounding.contributions.map((item) => ({
          ...item,
          verification: ['research', 'compounding'].includes(item.id),
        })),
      }
      : measure([
        ...rubric.evidence.map((input) => measureFactor(factors.get(input.id), input)),
        verificationReading(criteria, rubric.verification),
      ])),
  }));
}

function element(tag, className, text) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text) result.textContent = text;
  return result;
}

function link(label, href) {
  const anchor = element('a', 'milestone-progress__link', label);
  anchor.href = href;
  if (!href.startsWith('#')) {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  return anchor;
}

function contributionRow(reading) {
  const row = element('li');
  const rowHeader = element('div', 'milestone-progress__input');
  const credit = reading.points === null
    ? `${reading.weight} pts open`
    : `${number.format(reading.points)} / ${reading.weight} pts`;
  rowHeader.append(element('strong', '', reading.label), element('span', '', credit));
  row.append(rowHeader, element('p', '', reading.detail));
  if (Number.isFinite(reading.rawValue)) {
    const value = number.format(reading.rawValue);
    const unit = ['%', '×'].includes(reading.unit) ? reading.unit : reading.unit ? ' ' + reading.unit : '';
    row.append(element('p', 'milestone-progress__raw', 'Observed reading ' + value + unit));
  } else if (reading.verification) {
    row.append(element('p', 'milestone-progress__raw', reading.points === null ? 'Awaiting independent verification' : 'Independently verified'));
  }
  if (hasSource(reading)) row.append(link((reading.source ?? 'Primary evidence') + ' ↗', reading.sourceUrl));
  return row;
}

function mount(container) {
  container.classList.add('milestone-progress');
  const heading = element('div', 'milestone-progress__heading');
  const introduction = element('div');
  const header = element('h2', '', 'Progress toward each milestone');
  header.id = 'milestone-progress-heading';
  container.setAttribute('aria-labelledby', header.id);
  introduction.append(header,
    element('p', '', 'Each percentage is the share of weighted evidence points earned under this dashboard’s definition. Open verification points stay unfilled.'));
  const date = element('p', 'milestone-progress__date');
  heading.append(introduction, date);
  const cards = element('div', 'milestone-progress__grid');
  const refs = rubrics.map((rubric) => {
    const card = element('article', 'milestone-progress__card');
    card.dataset.milestone = rubric.id;
    const top = element('div', 'milestone-progress__top');
    const value = element('strong', 'milestone-progress__value');
    top.append(element('h3', '', rubric.name), value);
    const meter = element('div', 'milestone-progress__meter');
    meter.setAttribute('aria-hidden', 'true');
    const available = element('div', 'milestone-progress__available');
    const fill = element('div', 'milestone-progress__fill');
    meter.append(available, fill);
    const coverage = element('p', 'milestone-progress__coverage');
    const details = element('details', 'milestone-progress__details');
    const example = element('p', 'milestone-progress__example');
    example.append(element('strong', '', 'Everyday example '), rubric.example);
    const contributions = element('ul');
    const references = element('div', 'milestone-progress__references');
    references.append(...rubric.links.map(([label, href]) => link(label + ' ↗', href)));
    details.append(element('summary', '', 'Rubric and evidence'), element('p', 'milestone-progress__definition', rubric.title + '.'),
      example, contributions, references);
    card.append(top, element('p', 'milestone-progress__target', rubric.target), meter, coverage, details);
    cards.append(card);
    return { value, coverage, available, fill, contributions };
  });
  container.replaceChildren(heading, cards);
  const state = { date, refs };
  mounted.set(container, state);
  return state;
}

export function renderMilestoneProgress(container, index) {
  const state = mounted.get(container) ?? mount(container);
  const asOf = Date.parse(index?.date);
  state.date.textContent = Number.isFinite(asOf) ? 'Evidence through ' + fullDate.format(asOf) : 'Waiting for data';
  for (const [position, milestone] of measureMilestoneProgress(index).entries()) {
    const card = state.refs[position];
    const value = milestone.score === null ? '—' : number.format(milestone.score) + '%';
    card.value.textContent = value;
    card.value.setAttribute('aria-label', milestone.score === null ? 'Awaiting evidence' : value + ' of rubric points earned');
    card.coverage.textContent = index ? milestone.coverage + '% of rubric weight has evidence' : 'Awaiting measured inputs';
    card.available.style.width = milestone.coverage + '%';
    card.fill.style.width = (milestone.score ?? 0) + '%';
    card.contributions.replaceChildren(...milestone.contributions.map(contributionRow));
  }
}
