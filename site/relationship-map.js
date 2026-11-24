import { foundationNotes } from './foundation-notes.js';
import { measureMilestoneProgress } from './milestone-progress.js';

const capabilityFramework = ['Morris et al., ICML (2024)', 'https://proceedings.mlr.press/v235/morris24b.html'];
const attributionMethod = ['METR, assessing AI research acceleration', 'https://metr.org/blog/2026-10-14-ai-rd-acceleration-assessment-proposal/'];
const humanEvidence = ['How empathy and trust can be tested', '#human-evidence'];
const formatReading = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const snapshotDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

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

const edges = [
  { from: 'agi', to: 'asi', kind: 'possible', detail: 'A system that meets the ASI standard also meets the AGI standard. One evaluation could establish both.' },
  { from: 'agi', to: 'rsi', kind: 'enabling', detail: 'Broad skills can help with AI research. A research specialist could start the loop before AGI.' },
  { from: 'rsi', to: 'singularity', kind: 'required', detail: 'The Singularity requires independent evidence that successors keep improving later generations at a faster pace.' },
  { from: 'autonomy', to: 'ai-research', kind: 'enabling', detail: 'AI systems that finish longer tasks reliably can take on more steps in a research project.' },
  { from: 'ai-research', to: 'rsi', kind: 'possible', detail: 'Helping improve one model is a precursor. A successor needs to repeat that improvement for the loop to hold.' },
];

function make(tag, className, copy) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (copy) node.textContent = copy;
  return node;
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
  let activeId = 'singularity';
  let currentIndex;
  let currentVerdicts;

  function buttonFor(id, reading = false) {
    const note = foundations.get(id);
    const item = note ?? milestones[id];
    const button = make('button', note ? 'srm__foundation' : reading ? 'srm__reading' : 'srm__node');
    button.type = 'button';
    button.dataset.node = id;
    button.setAttribute('aria-pressed', 'false');
    const title = make('span', 'srm__node-label', item.label);
    if (note) {
      const year = make('time', 'srm__node-role', String(note.year));
      year.dateTime = String(note.year);
      const targets = note.related.map((id) => milestones[id]?.label).filter(Boolean);
      button.append(year, title, make('span', 'srm__foundation-link', '→ ' + targets.join(' · ')));
    } else if (reading) {
      const track = make('span', 'srm__track');
      track.setAttribute('aria-hidden', 'true');
      track.append(make('span', 'srm__fill'));
      button.append(title, make('span', 'srm__reading-score'), track);
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
  const graph = make('section', 'srm__graph');
  const heading = make('div', 'srm__graph-heading');
  const snapshotTitle = make('h3', 'srm__lane-title', 'Evidence snapshot');
  heading.append(snapshotTitle, link('View index history', '#history-chart'));
  graph.append(heading, make('p', 'srm__intro', 'Each bar shows the share of points earned on that milestone’s own evidence checklist. Select a milestone to see what counts.'));

  function evidenceGroup(title, ids, explanation) {
    const group = make('section', 'srm__group');
    const pair = make('div', 'srm__pair');
    for (const id of ids) pair.append(buttonFor(id, true));
    group.append(make('h4', 'srm__group-title', title), pair, make('p', 'srm__relationship', explanation));
    return group;
  }
  graph.append(
    evidenceGroup('What can AI do?', ['agi', 'asi'], 'AGI matches skilled people across many tasks. ASI would also clear that bar and outperform leading experts.'),
    evidenceGroup('Can AI speed up its own development?', ['rsi', 'singularity'], 'RSI can start before AGI, when a specialist AI helps build a successor that can repeat the process. The Singularity would require those gains to keep speeding up across generations.'),
  );

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
  map.append(graph, support, detail, history, announcement);
  container.replaceChildren(map);

  function updateReadings() {
    const timestamp = Date.parse(currentIndex?.date);
    snapshotTitle.textContent = Number.isFinite(timestamp)
      ? 'Evidence snapshot · ' + snapshotDate.format(timestamp)
      : 'Evidence snapshot';
    for (const { id, score } of measureMilestoneProgress(currentIndex)) {
      const button = buttons.get(id);
      const scored = Number.isFinite(score);
      const amount = scored ? formatReading.format(score) + '%' : 'Awaiting evidence';
      button.dataset.available = String(scored);
      button.style.setProperty('--srm-progress', scored ? score + '%' : '0%');
      button.querySelector('.srm__reading-score').textContent = amount;
      const { label, title } = milestones[id];
      const name = id === 'singularity' ? title : label + ' (' + title + ')';
      button.setAttribute('aria-label', name + ', ' + amount + (scored ? ' of evidence points earned' : ''));
    }
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
    updateReadings();
    renderEvidence(detail.querySelector('.srm__evidence'));
  }

  updateReadings();
  select(activeId, { notify: false });
  return { select, update };
}
