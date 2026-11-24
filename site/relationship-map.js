import { foundationNotes } from './foundation-notes.js';
import { measureMilestoneProgress } from './milestone-progress.js';

const capabilityFramework = ['Morris et al., ICML (2024)', 'https://proceedings.mlr.press/v235/morris24b.html'];
const attributionMethod = ['METR, assessing AI research acceleration', 'https://metr.org/blog/2026-10-14-ai-rd-acceleration-assessment-proposal/'];
const humanEvidence = ['How empathy and trust can be tested', '#human-evidence'];
const formatReading = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

const milestones = {
  agi: {
    label: 'AGI',
    title: 'Artificial general intelligence',
    role: 'Capability milestone',
    short: 'Skilled across many kinds of tasks',
    summary: 'An AI system performs at least as well as skilled people across a wide, representative range of unfamiliar tasks.',
    importance: 'Broad skills could make an AI useful across more kinds of research. A specialized tool can already improve individual steps in AI research.',
    example: 'The same assistant could tutor a student through an unfamiliar problem, help understand a lease and troubleshoot a home network.',
    sources: [capabilityFramework, ['AGI trajectory and reporting', '#agi'], humanEvidence],
  },
  asi: {
    label: 'ASI',
    title: 'Artificial superintelligence',
    role: 'Capability milestone',
    short: 'Outperforms experts across fields',
    summary: 'An AI system consistently outperforms leading human experts across a wide, representative range of unfamiliar tasks.',
    importance: 'That higher level of performance also clears the AGI bar. One evaluation could establish both. A system that exceeds human skill at a single task, such as chess, has demonstrated an exceptional skill in that domain.',
    example: 'A system might design more durable batteries than leading teams can design and also outperform experts on problems in mathematics and logistics.',
    context: 'Sentience asks whether a system has subjective experience. This map tracks demonstrated capabilities and research gains.',
    sources: [capabilityFramework, ['Butlin et al., research on AI and consciousness', 'https://arxiv.org/abs/2308.08708'], ['Capability evidence', '#evidence-capability'], humanEvidence],
  },
  autonomy: {
    label: 'Reliable autonomy',
    title: 'Reliable autonomy',
    role: 'Supporting indicator',
    short: 'Finishes complex work reliably',
    summary: 'An AI system completes a multi-step job correctly with limited hands-on help.',
    importance: 'Reliable execution makes it easier to hand off more of an experiment. To confirm the Singularity, this watch requires reliable workday-length performance on independently evaluated tasks.',
    example: 'An assistant can find the cause of a recurring report error, fix it and check that the next report is accurate.',
    sources: [['METR, November capability evaluation', 'https://metr.org/blog/2026-11-20-q4-2026-capability-update/'], ['Capability evidence', '#evidence-capability']],
  },
  'ai-research': {
    label: 'AI-assisted AI research',
    title: 'AI-assisted AI research',
    role: 'Observed precursor',
    short: 'Helps researchers build better AI',
    summary: 'AI helps people design experiments, improve training, or develop tools for building better AI models.',
    importance: 'Useful research assistance is the starting point for a possible feedback loop. The stronger claim needs evidence that a successor produced by this work can also improve the next generation.',
    example: 'A team building a new assistant uses an existing model to spot waste in its training software and tests the proposed fix.',
    sources: [['METR, independent assessment of research acceleration', 'https://metr.org/blog/2026-11-05-anthropic-ai-rd-acceleration-assessment/'], ['Google DeepMind, AlphaEvolve engineering report', 'https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/'], ['Research and independent assessments', '#evidence-acceleration']],
  },
  rsi: {
    label: 'RSI',
    title: 'Recursive self-improvement',
    role: 'Required feedback loop',
    short: 'Successors help improve successors',
    summary: 'An AI system helps make a stronger successor, and that stronger system improves the generation after it.',
    importance: 'This loop could begin with a research specialist or with an AI that already has broad skills. The Watch looks for gains that keep accelerating across generations. Computing resources and the time needed to verify results can slow the loop.',
    example: 'An assistant helps make a better version of itself. That version then makes a measurable contribution to building the next one.',
    sources: [['I. J. Good, original 1965 essay', 'https://vtechworks.lib.vt.edu/items/5085379d-b24c-424e-8861-e70a47b4b2fb'], attributionMethod, humanEvidence],
  },
  singularity: {
    label: 'Singularity',
    title: 'The Singularity',
    role: 'Watch threshold',
    short: 'AI-driven progress keeps speeding up',
    summary: 'For this watch, the Singularity means sustained acceleration in AI development driven by successive AI systems improving AI research.',
    importance: 'The watch requires independent evidence of workday-length autonomy, repeated end-to-end research, and accelerating gains across successive AI generations attributable to AI-led research. A quick burst of releases can have multiple causes.',
    example: 'Useful AI upgrades might start arriving in shorter and shorter cycles, giving schools and workplaces less time to adjust between changes.',
    sources: [['The three evidence checks', '#evidence-gates'], attributionMethod, ['The history of the Singularity idea', '#evidence-history'], humanEvidence],
  },
};

const connectors = {
  possible: 'Possible progression',
  enabling: 'Can help',
  required: 'Required here',
};

const plotRows = { agi: 23, asi: 43, rsi: 72, singularity: 92 };
const edges = [
  { from: 'agi', to: 'asi', kind: 'possible', detail: 'A system that meets the ASI standard also meets the AGI standard. One evaluation could establish both.' },
  { from: 'agi', to: 'rsi', kind: 'enabling', detail: 'Broad skills can help with AI research. A research specialist could start the loop before AGI.' },
  { from: 'rsi', to: 'singularity', kind: 'required', detail: 'The Singularity requires independent evidence that successors keep improving later generations at a faster pace.' },
  { from: 'autonomy', to: 'ai-research', kind: 'enabling', detail: 'AI systems that finish longer tasks reliably can take on more steps in a research project.' },
  { from: 'ai-research', to: 'rsi', kind: 'possible', detail: 'Helping improve one model is a precursor. A successor needs to repeat that improvement for the loop to hold.' },
];
const plottedEdges = edges.filter(({ from, to }) => from in plotRows && to in plotRows);

function make(tag, className, copy) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (copy) node.textContent = copy;
  return node;
}

function svgNode(tag, attributes) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

function connector(kind, copy = connectors[kind]) {
  const line = make('div', 'srm__connector srm__connector--' + kind);
  const mark = make('span', 'srm__connector-mark');
  mark.setAttribute('aria-hidden', 'true');
  line.append(mark, make('span', 'srm__connector-label', copy));
  return line;
}

function info(label, copy) {
  const section = make('div', 'srm__info');
  section.append(make('h4', '', label), make('p', '', copy));
  return section;
}

function link(label, url) {
  const anchor = make('a', '', label);
  anchor.href = url;
  if (url.startsWith('https://')) {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  return anchor;
}

export function renderRelationshipMap(container, { onSelect } = {}) {
  const foundations = new Map(foundationNotes.map((note) => [note.id, note]));
  const buttons = new Map();
  const scores = new Map();
  let activeId = 'singularity';
  let currentIndex;
  let currentVerdicts;

  function buttonFor(id) {
    const note = foundations.get(id);
    const item = note ?? milestones[id];
    const button = make('button', note ? 'srm__foundation' : id in plotRows ? 'srm__marker' : 'srm__node');
    button.type = 'button';
    button.dataset.node = id;
    button.setAttribute('aria-pressed', 'false');
    const title = make('span', 'srm__node-label', item.label);
    if (note) {
      const year = make('time', 'srm__node-role', String(note.year));
      year.dateTime = String(note.year);
      const targets = note.related.map((id) => milestones[id]?.label).filter(Boolean);
      button.append(year, title, make('span', 'srm__foundation-link', '→ ' + targets.join(' · ')));
    } else if (id in plotRows) {
      const marker = make('span', 'srm__dot');
      marker.setAttribute('aria-hidden', 'true');
      const text = make('span', 'srm__marker-label');
      text.append(title, make('span', 'srm__marker-score'));
      button.append(marker, text);
      button.style.setProperty('--srm-row', plotRows[id] + '%');
    } else {
      button.append(
        make('span', 'srm__node-role', item.role),
        title,
        make('span', 'srm__node-summary', item.short),
      );
    }
    button.addEventListener('click', () => select(id));
    buttons.set(id, button);
    return button;
  }

  const map = make('div', 'srm');
  const graph = make('div', 'srm__graph');
  const intro = make('p', 'srm__intro', 'Dots move left or right as the evidence changes. The percentage is how much of that milestone’s evidence checklist is supported. Rows group related milestones.');
  const legend = make('ul', 'srm__legend');
  legend.setAttribute('aria-label', 'Connection types');
  for (const kind of Object.keys(connectors)) {
    const item = make('li');
    item.append(connector(kind));
    legend.append(item);
  }

  const heading = make('div', 'srm__graph-heading');
  heading.append(make('p', 'srm__axis-title', 'Y · Milestone group'), link('Foundations before AI ↓', '#foundations'));
  const plot = make('div', 'srm__plot');
  const lines = svgNode('svg', { 'aria-hidden': 'true' });
  const definitions = svgNode('defs', {});
  for (const kind of Object.keys(connectors)) {
    const marker = svgNode('marker', { id: 'srm-arrow-' + kind, viewBox: '0 0 8 8',
      refX: 7, refY: 4, markerWidth: 8, markerHeight: 8, markerUnits: 'userSpaceOnUse', orient: 'auto' });
    marker.append(svgNode('path', { d: 'M1 1 L7 4 L1 7', class: 'srm__edge srm__edge--' + kind }));
    definitions.append(marker);
  }
  lines.append(definitions);
  const paths = plottedEdges.map(({ kind }) => svgNode('path', { class: 'srm__edge srm__edge--' + kind,
    'marker-end': 'url(#srm-arrow-' + kind + ')' }));
  lines.append(...paths);
  plot.append(lines, make('p', 'srm__band', 'Broad AI capability'), make('p', 'srm__band srm__band--research', 'AI improving AI'));
  const ticks = make('div', 'srm__ticks');
  ticks.setAttribute('aria-hidden', 'true');
  for (const value of [0, 25, 50, 75, 100]) {
    const tick = make('span', '', value + '%');
    tick.style.setProperty('--srm-tick', value + '%');
    ticks.append(tick);
  }
  const pending = make('div', 'srm__pending');
  pending.append(make('p', '', 'Awaiting evidence points'));
  const pendingNodes = make('div', 'srm__pending-nodes');
  pending.append(pendingNodes);
  for (const id of Object.keys(plotRows)) pendingNodes.append(buttonFor(id));
  graph.append(heading, plot, ticks, make('p', 'srm__axis-title srm__axis-x', 'X · Evidence points earned (%)'), pending, legend);

  const support = make('div', 'srm__support');
  support.append(make('h3', 'srm__lane-title', 'Evidence that can help explain progress'), buttonFor('autonomy'), buttonFor('ai-research'));

  const history = make('section', 'srm__history');
  history.id = 'foundations';
  const historyNodes = make('div', 'srm__foundations');
  for (const note of foundationNotes) historyNodes.append(buttonFor(note.id));
  const historyHeading = make('div', 'srm__history-heading');
  historyHeading.append(make('h3', 'srm__lane-title', 'Foundations before AI'), link('See the historical timeline', '#origins'));
  history.append(historyHeading, historyNodes);

  const detail = make('section', 'srm__detail');
  detail.setAttribute('aria-label', 'Selected milestone details');
  const announcement = make('span', 'srm__screen-reader');
  announcement.setAttribute('role', 'status');
  map.append(intro, graph, support, detail, history, announcement);
  container.replaceChildren(map);

  function drawConnections() {
    const { clientWidth: width, clientHeight: height } = plot;
    if (!width || !height) return;
    lines.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    for (const [i, { from, to }] of plottedEdges.entries()) {
      if (!Number.isFinite(scores.get(from)) || !Number.isFinite(scores.get(to))) {
        paths[i].removeAttribute('d');
        continue;
      }
      const x1 = width * scores.get(from) / 100;
      const x2 = width * scores.get(to) / 100;
      const y1 = height * plotRows[from] / 100 + 7;
      const y2 = height * plotRows[to] / 100 - 10;
      const bend = (y1 + y2) / 2;
      paths[i].setAttribute('d', 'M' + x1 + ' ' + y1 + ' C' + x1 + ' ' + bend + ' ' + x2 + ' ' + bend + ' ' + x2 + ' ' + y2);
    }
  }

  new ResizeObserver(drawConnections).observe(plot);

  function updatePlot() {
    for (const { id, score } of measureMilestoneProgress(currentIndex)) {
      const button = buttons.get(id);
      const scored = Number.isFinite(score);
      const place = scored ? plot : pendingNodes;
      const amount = scored ? formatReading.format(score) + '%' : '';
      scores.set(id, score);
      if (button.parentNode !== place) place.append(button);
      button.style.setProperty('--srm-position', scored ? score + '%' : '0%');
      button.dataset.left = String(score >= 50);
      button.querySelector('.srm__marker-score').textContent = amount;
      button.setAttribute('aria-label', milestones[id].title + (scored ? ', ' + amount + ' of evidence points earned' : ', awaiting evidence points'));
    }
    pending.hidden = !pendingNodes.childElementCount;
    drawConnections();
  }

  function jumpButton(id, label) {
    const jump = make('button', '', label);
    jump.type = 'button';
    jump.addEventListener('click', () => {
      select(id);
      buttons.get(id).focus();
    });
    return jump;
  }

  function renderDetail() {
    const note = foundations.get(activeId);
    const item = note ?? milestones[activeId];
    const refs = make('div', 'srm__references');
    for (const [name, url] of note ? [[item.source, item.sourceUrl]] : item.sources) {
      refs.append(link(name, url));
    }

    detail.replaceChildren(
      make('span', 'srm__selection-role', note ? item.year + ' · Historical foundation' : item.role),
      make('h3', 'srm__selection-title', item.title),
      make('p', 'srm__selection-summary', item.summary),
    );
    const explanation = make('div', 'srm__explanation');
    explanation.append(info(note ? 'How it connects' : 'Why it matters', item.importance));
    if (!note) explanation.append(info('What it could look like', item.example));
    detail.append(explanation);
    if (item.context) detail.append(make('p', 'srm__context', item.context));

    if (note) {
      const related = make('div', 'srm__related');
      for (const id of note.related) {
        if (!milestones[id]) continue;
        related.append(jumpButton(id, milestones[id].label));
      }
      detail.append(related);
    } else {
      const connections = edges.filter(({ from, to }) => from === activeId || to === activeId);
      if (connections.length) {
        const items = make('ul', 'srm__connection-list');
        for (const { from, to, kind, detail: explanation } of connections) {
          const item = make('li', '');
          const target = activeId === from ? to : from;
          const label = milestones[from].label + ' → ' + milestones[to].label;
          item.append(jumpButton(target, label), make('p', '', connectors[kind] + '. ' + explanation));
          items.append(item);
        }
        detail.append(items);
      }
      const earlier = foundationNotes.filter((foundation) => foundation.related.includes(activeId));
      if (earlier.length) {
        const related = make('div', 'srm__related');
        related.append(make('p', '', 'Earlier foundations'), ...earlier.map(({ id, label }) => jumpButton(id, label)));
        detail.append(related);
      }
    }
    const evidence = make('div', 'srm__evidence');
    detail.append(evidence, refs);
    renderEvidence(evidence);
  }

  function renderEvidence(evidence) {
    const verdict = currentVerdicts?.[activeId];
    if (verdict) {
      evidence.replaceChildren(info(verdict.headline, verdict.reason),
        make('p', 'srm__confidence', verdict.confidence),
        make('p', '', verdict.change));
      if (verdict.humanContext) evidence.append(make('p', '', verdict.humanContext));
      return;
    }
    const factorId = { autonomy: 'reliability', 'ai-research': 'research-acceleration' }[activeId];
    const factor = factorId && currentIndex?.factors?.find(({ id }) => id === factorId);
    if (Number.isFinite(factor?.value)) {
      const value = formatReading.format(factor.value);
      const reading = activeId === 'autonomy'
        ? `METR estimates an 80% success rate on selected tasks that take human experts about ${value} hours.`
        : `METR estimates that model capability gains at one lab ran at ${value} times the earlier pace. Attribution across successive generations remains open.`;
      evidence.replaceChildren(info('Current evidence', reading));
    } else {
      evidence.replaceChildren();
    }
  }

  function select(id, { notify = true } = {}) {
    if (!buttons.has(id)) return false;
    activeId = id;
    const related = foundations.get(id)?.related ?? [];
    for (const [nodeId, button] of buttons) {
      button.setAttribute('aria-pressed', String(nodeId === id));
      button.classList.toggle('srm__node--related', related.includes(nodeId));
    }
    for (const [i, { from, to }] of plottedEdges.entries()) {
      paths[i].classList.toggle('srm__edge--active', from === id || to === id);
    }
    renderDetail();
    if (notify) {
      announcement.textContent = 'Showing ' + (foundations.get(id) ?? milestones[id]).title + ' details.';
      onSelect?.(id);
    }
    return true;
  }

  function update({ index = currentIndex, verdicts = currentVerdicts } = {}) {
    currentIndex = index;
    currentVerdicts = verdicts;
    updatePlot();
    renderEvidence(detail.querySelector('.srm__evidence'));
  }

  updatePlot();
  select(activeId, { notify: false });
  return { select, update };
}
