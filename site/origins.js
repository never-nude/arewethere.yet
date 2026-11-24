import { mountHistoricTerrain } from './historic-terrain.js';

const milestones = [
  {
    date: '1958-05-01',
    lane: 'ideas',
    when: 'May 1958',
    label: 'Ulam',
    title: 'An early use of “singularity”',
    detail: 'Stanislaw Ulam recalled a conversation with John von Neumann about accelerating technology and a possible break in the course of human affairs.',
    significance: 'This is an early published use of the word in its technological sense.',
    example: 'Instant messaging changed what people expected from sending a letter. Ulam was describing a shift on a much larger scale.',
    effect: 'The idea gave people language to consider how fast technology could reshape communication and work.',
    source: 'Ulam’s tribute, p. 5',
    url: 'https://www.ams.org/journals/bull/1958-64-03/S0002-9904-1958-10189-5/S0002-9904-1958-10189-5.pdf#page=5',
  },
  {
    date: '1965-12-31',
    lane: 'ideas',
    when: '1965',
    label: 'Good',
    title: 'A machine could help design a better machine',
    detail: 'I. J. Good proposed that a machine capable of improving machine design could trigger an “intelligence explosion” as each generation designed the next.',
    significance: 'Good gave the idea a mechanism. Better design tools could help make even better design tools.',
    example: 'Imagine a machine shop using its most precise tool to build a more precise tool for the next job.',
    effect: 'The proposal helped people imagine why a jump in automation could lead to several faster rounds of change in their tools and routines.',
    source: 'Good’s original paper',
    url: 'https://www.sciencedirect.com/science/article/pii/S0065245808604180',
  },
  {
    date: '1993-12-01',
    lane: 'ideas',
    when: '1993',
    label: 'Vinge',
    title: 'The technological singularity takes shape',
    detail: 'Vernor Vinge argued that greater-than-human intelligence could bring about a break in technological and social history. He described several ways it might emerge.',
    significance: 'Vinge brought the term into a discussion about superhuman intelligence and its consequences.',
    example: 'Turn-by-turn navigation changed how people plan trips and find their way around. Vinge imagined changes of that kind reaching many parts of daily life at once.',
    effect: 'The paper gave readers a way to think about how schools, workplaces, and public services could adapt to rapid changes.',
    source: 'Vinge’s NASA symposium paper',
    url: 'https://ntrs.nasa.gov/citations/19940022856',
  },
  {
    date: '1997-05-11',
    lane: 'capability',
    when: 'May 1997',
    label: 'Deep Blue',
    title: 'A computer beats the reigning chess champion',
    detail: 'IBM’s Deep Blue defeated Garry Kasparov in a six-game match. The result established world-champion performance on a well-defined task.',
    significance: 'It showed how far a system could advance in a single domain.',
    example: 'Imagine a crossword app that beats the best human solvers. You would have learned something specific about how well it solves crosswords.',
    effect: 'Today, strong chess engines let players practice against expert-level opponents and review their mistakes at home.',
    source: 'IBM’s Deep Blue archive',
    url: 'https://www.ibm.com/history/deep-blue',
    marker: 'Champion-level performance on one task',
    markerId: 'narrow',
  },
  {
    date: '2020-05-28',
    lane: 'capability',
    when: 'May 2020',
    label: 'GPT-3',
    title: 'One model adapts to multiple language tasks',
    detail: 'OpenAI reported that GPT-3 could attempt translation, question answering, and other tasks from examples in its prompt, without retraining for each task.',
    significance: 'The same trained model could take on several kinds of work.',
    example: 'Think of giving one assistant a menu to translate, a recipe to summarize, and questions to answer about it.',
    effect: 'An assistant with this kind of range can help with everyday reading and writing, from translating a school notice to drafting a work email.',
    source: 'OpenAI’s GPT-3 paper',
    url: 'https://arxiv.org/abs/2005.14165',
    marker: 'One model transfers across tasks',
    markerId: 'transfer',
  },
  {
    date: '2025-05-14',
    lane: 'research',
    when: 'May 2025',
    label: 'AlphaEvolve',
    title: 'An AI agent helps improve AI training',
    detail: 'Google DeepMind reported that AlphaEvolve found a faster operation used in Gemini training. The team measured a 1% reduction in training time.',
    significance: 'This is a concrete example of AI improving part of the process used to train AI.',
    example: 'A bakery finds a faster oven setting for one step in a recipe. Every later batch benefits from that small improvement.',
    effect: 'Lower training costs could eventually help make some AI services cheaper to build and easier to provide.',
    source: 'DeepMind’s AlphaEvolve report',
    url: 'https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/',
  },
  {
    date: '2026-11-05',
    lane: 'research',
    when: 'November 2026',
    label: 'AI research',
    title: 'Independent researchers assess AI-assisted R&D',
    detail: 'METR found that Anthropic’s models improved faster on well-specified tasks. The assessors judged AI assistance likely contributed substantially, with significant uncertainty about how much.',
    significance: 'The assessment examined a real research workflow, where several changes can affect the pace of progress.',
    example: 'A design team starts using new drafting software and finishes projects faster. A reviewer checks whether additional staff or a simpler project mix also helped.',
    effect: 'If the faster pace carries through to products, workplace and classroom tools could get useful upgrades more often.',
    source: 'METR’s independent assessment',
    url: 'https://metr.org/blog/2026-11-05-anthropic-ai-rd-acceleration-assessment/',
    marker: 'AI-assisted research acceleration assessed',
    markerId: 'research',
  },
  {
    date: '2026-11-20',
    lane: 'capability',
    when: 'November 2026',
    label: 'Task horizons',
    title: 'Independent evaluations measure longer tasks',
    detail: 'METR published updated task-completion results for frontier AI. The study also found that difficult tasks with unclear feedback still challenged these systems.',
    significance: 'Longer tasks give researchers a way to test whether an AI can carry a plan through several steps.',
    example: 'Sorting a shopping list is a short task. Planning a trip with changing prices and schedules takes more steps and more chances to catch mistakes.',
    effect: 'More reliable long tasks could make an assistant more useful for chores like organizing an appointment, finding forms, and keeping track of follow-up steps.',
    source: 'METR’s November capability update',
    url: 'https://metr.org/blog/2026-11-20-q4-2026-capability-update/',
  },
];

const evidenceLandmarks = [
  {
    milestone: milestones.find(({ markerId }) => markerId === 'narrow'),
    definition: 'A system performs at world-champion level in a clearly bounded task, such as chess.',
    example: 'A crossword program could win a puzzle competition. That tells you about its puzzle-solving skill.',
    effect: 'Specialized tools can take on routine work within a known task, such as checking a move or finding a typo.',
  },
  {
    milestone: milestones.find(({ markerId }) => markerId === 'transfer'),
    definition: 'The same trained model handles several distinct tasks using instructions or examples, without separate training for each task.',
    example: 'You show one assistant how to categorize receipts, translate a message, and draft a reply.',
    effect: 'People can try one familiar assistant across chores, work, and school.',
  },
  {
    milestone: milestones.find(({ markerId }) => markerId === 'research'),
    definition: 'Independent assessors examine whether using AI in AI research helped a team improve its systems faster, and consider other possible causes.',
    example: 'A reviewer assesses whether new design tools helped a team finish more jobs, and checks for staffing and workload changes too.',
    effect: 'If the gains carry into products, updates to familiar tools could arrive more frequently.',
  },
  {
    marker: 'Sustained AI-led acceleration across generations',
    definition: 'Independent evidence attributes faster capability gains across at least two successor generations to AI-led research and accounts for other drivers.',
    example: 'A workshop uses its tools to build better tools. The next generation can make its successor faster again, and reviewers can trace the speedup back to the tools.',
    effect: 'If that pace reached the wider economy, people could face faster shifts in job tasks, classroom tools, and how they access services.',
  },
];
const stateByContainer = new WeakMap();
const firstYear = 1958;
const displayDate = new Intl.DateTimeFormat('en-US', {
  month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
});
const formatScore = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

function textElement(tag, text, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function fullDate(isoDate) {
  return displayDate.format(new Date(isoDate));
}

function everydayElement(label, text) {
  const example = textElement('p', '', 'origins-example');
  example.append(textElement('strong', label), ' ' + text);
  return example;
}

function buildLandmark(landmark) {
  const item = textElement('li', '');
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  const name = landmark.milestone?.marker ?? landmark.marker;
  const status = textElement('span', '', 'origins-marker-status');
  summary.append(textElement('span', name), status);
  const content = textElement('div', '', 'origins-marker-content');
  content.append(
    textElement('p', landmark.definition),
    everydayElement('Everyday analogy', landmark.example),
    everydayElement('Everyday impact', landmark.effect),
  );
  if (landmark.milestone) {
    const source = textElement('a', landmark.milestone.source + ' ↗', 'origins-source');
    source.href = landmark.milestone.url;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    content.append(source);
  }
  details.append(summary, content);
  item.append(details);
  return { item, status };
}

function mount(container) {
  container.classList.add('origins');
  container.innerHTML = `
    <div class="origins-header">
      <div>
        <h3>From 1958 to today</h3>
        <p>Move through the history of the idea and the evidence that followed.</p>
      </div>
      <output class="origins-date" for="origins-year"></output>
    </div>
    <div class="hist-plot"></div>
    <div class="origins-control">
      <div class="origins-control-label">
        <label for="origins-year">Explore by year</label>
        <button class="calendar-step" type="button" data-origins-latest>Latest date</button>
      </div>
      <input id="origins-year" class="origins-range" type="range" min="${firstYear}" step="1">
      <div class="origins-scale" aria-hidden="true"><span>1958</span><span>1980</span><span>2000</span><span>Today</span></div>
    </div>
    <div class="origins-jumps" role="group" aria-label="Jump to a historical event"></div>
    <div class="origins-readout">
      <div class="origins-event">
        <p class="origins-label"></p>
        <h4></h4>
        <p class="origins-detail"></p>
        <p class="origins-significance"></p>
        <div class="origins-example-slot"></div>
        <a class="origins-source" target="_blank" rel="noopener noreferrer"></a>
        <div class="origins-index">
          <span>Daily evidence index</span>
          <strong data-origins-score></strong>
          <p></p>
        </div>
      </div>
      <div class="origins-landmarks">
        <div class="origins-count">
          <h4>Evidence landmarks</h4>
          <span data-origins-count></span>
        </div>
        <ol></ol>
        <p class="origins-context">These are selected kinds of documented evidence. The time and difficulty between them vary.</p>
      </div>
    </div>`;

  const $ = (selector) => container.querySelector(selector);
  const state = {
    slider: $('#origins-year'),
    date: $('.origins-date'),
    latest: $('[data-origins-latest]'),
    jumps: $('.origins-jumps'),
    scale: $('.origins-scale'),
    eventDate: $('.origins-label'),
    eventTitle: $('.origins-event h4'),
    eventDetail: $('.origins-detail'),
    eventSignificance: $('.origins-significance'),
    eventExample: $('.origins-example-slot'),
    eventSource: $('.origins-source'),
    score: $('[data-origins-score]'),
    indexContext: $('.origins-index p'),
    count: $('[data-origins-count]'),
    markers: evidenceLandmarks.map(buildLandmark),
    current: null,
    selection: null,
    exact: true,
    index: null,
    buttons: [],
  };
  $('.origins-landmarks ol').append(...state.markers.map(({ item }) => item));
  state.plot = mountHistoricTerrain($('.hist-plot'), (id) => {
    state.selection = id === 'latest' ? state.current : id;
    state.selectedPoint = id;
    state.exact = true;
    update(state);
  });

  state.slider.addEventListener('input', () => {
    const year = Number(state.slider.value);
    const latest = year === Number(state.current.slice(0, 4));
    state.selection = latest ? state.current : `${year}-12-31`;
    state.selectedPoint = latest ? 'latest' : null;
    state.exact = latest;
    update(state);
  });
  state.latest.addEventListener('click', () => {
    state.selection = state.current;
    state.selectedPoint = 'latest';
    state.exact = true;
    update(state);
  });

  for (const milestone of milestones) {
    const name = milestone.date.slice(0, 4) + ' · ' + milestone.label;
    const button = textElement('button', name, 'calendar-step');
    button.type = 'button';
    button.title = milestone.title;
    button.addEventListener('click', () => {
      state.selection = milestone.date;
      state.selectedPoint = milestone.date;
      state.exact = true;
      update(state);
    });
    state.jumps.append(button);
    state.buttons.push(button);
  }
  return state;
}

function update(state) {
  const { current, selection, exact, index } = state;
  const latestYear = Number(current.slice(0, 4));
  const selectedYear = Number(selection.slice(0, 4));
  const yearPosition = (year) => `${100 * (year - firstYear) / (latestYear - firstYear || 1)}%`;
  const milestone = milestones.findLast(({ date }) => date <= selection) ?? milestones[0];
  const dateLabel = exact
    ? selection === current ? fullDate(selection) : milestone.when
    : `End of ${selectedYear}`;

  state.slider.max = String(latestYear);
  state.slider.value = String(selectedYear);
  state.slider.style.setProperty('--origins-progress', yearPosition(selectedYear));
  state.scale.style.setProperty('--origins-1980', yearPosition(1980));
  state.scale.style.setProperty('--origins-2000', yearPosition(2000));
  state.slider.setAttribute('aria-valuetext', dateLabel);
  state.date.textContent = dateLabel;
  state.latest.disabled = selection === current;

  state.eventDate.textContent = 'MOST RECENT LANDMARK · ' + milestone.when.toUpperCase();
  state.eventTitle.textContent = milestone.title;
  state.eventDetail.textContent = milestone.detail;
  state.eventSignificance.textContent = milestone.significance;
  state.eventExample.replaceChildren(
    everydayElement('Everyday analogy', milestone.example),
    everydayElement('Everyday impact', milestone.effect),
  );
  state.eventSource.href = milestone.url;
  state.eventSource.textContent = milestone.source + ' ↗';
  for (const [position, button] of state.buttons.entries()) {
    button.hidden = milestones[position].date > current;
    button.setAttribute('aria-pressed', String(milestones[position] === milestone));
  }

  const crossing = index?.threshold?.observed ? index.threshold.crossingDate : null;
  const evidenceDates = evidenceLandmarks.map((landmark) => landmark.milestone?.date ?? crossing);
  const countAt = (date) => evidenceDates.filter((evidenceDate) => evidenceDate && evidenceDate <= date).length;
  let observed = 0;
  for (const [position, landmark] of evidenceLandmarks.entries()) {
    const date = landmark.milestone?.date ?? crossing;
    const isReached = Boolean(date && date <= selection);
    const { item, status } = state.markers[position];
    if (isReached) observed++;
    item.dataset.reached = String(isReached);
    status.textContent = isReached ? date.slice(0, 4) : date ? 'Later' : 'Open';
  }
  state.count.textContent = `${observed} of ${evidenceLandmarks.length} documented`;

  const history = Array.isArray(index?.history) ? index.history : [];
  const frame = history.find(({ date }) => date === selection);
  const latestFrame = history.find(({ date }) => date === current);
  const firstScoreDate = history.find(({ score }) => Number.isFinite(score))?.date;
  state.score.textContent = Number.isFinite(frame?.score)
    ? formatScore.format(frame.score) + ' / 100'
    : '—';
  state.indexContext.textContent = Number.isFinite(frame?.score)
    ? `${frame.coverage}% source coverage. The daily score uses weighted recent signals.`
    : firstScoreDate ? `Daily score coverage starts ${fullDate(firstScoreDate)}.` : 'Waiting for daily score data.';

  const points = milestones.filter(({ date }) => date <= current).map((event) => ({
    id: event.date,
    date: event.date,
    label: event.label,
    title: event.title,
    when: event.when,
    lane: event.lane,
    count: countAt(event.date),
  }));
  if (Number.isFinite(latestFrame?.score)) {
    points.push({
      id: 'latest',
      date: current,
      label: 'Latest reading',
      title: 'Latest evidence index',
      when: fullDate(current),
      lane: 'latest',
      count: countAt(current),
    });
  }
  const selectedPoint = points.find(({ id, date }) => id === state.selectedPoint && date === selection)
    ?? points.findLast(({ date }) => date === selection);
  state.plot.update({
    points,
    firstDate: milestones[0].date,
    lastDate: current,
    selectedDate: selection,
    selectedId: selectedPoint?.id,
    dateLabel,
    count: observed,
    total: evidenceLandmarks.length,
  });
}

export function renderOrigins(container, { index } = {}) {
  const state = stateByContainer.get(container) ?? mount(container);
  stateByContainer.set(container, state);
  const current = index?.date ?? new Date().toISOString().slice(0, 10);
  if (!state.selection || state.selection === state.current || state.selection > current) {
    state.selection = current;
    state.selectedPoint = 'latest';
    state.exact = true;
  }
  state.current = current;
  state.index = index;
  update(state);
}
