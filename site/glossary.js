const entries = [
  ['ECI|Epoch Capabilities Index', 'Epoch Capabilities Index', 'Epoch AI combines results from many tests into a shared scale for comparing models. ECI is measured in points.'],
  ['AGI|artificial general intelligence', 'Artificial general intelligence', 'Here, AI that can perform at least as well as skilled people across many kinds of unfamiliar work.'],
  ['ASI|artificial superintelligence', 'Artificial superintelligence', 'Here, AI that consistently beats leading human experts across many kinds of unfamiliar work. It also meets the AGI bar.'],
  ['RSI|recursive self-improvement', 'Recursive self-improvement', 'AI helps make a better successor, which in turn helps improve the next generation.'],
  ['technological singularity', 'Technological Singularity', 'Here, sustained acceleration in AI development caused by successive AI systems improving the process of building better AI.'],
  ['AI R&D|R&D|research and development', 'Research and development', 'The work of discovering, testing, and applying improvements. AI research and development includes experiments to build and evaluate AI systems.'],
  ['FLOP|FLOPs', 'Floating-point operation', 'One arithmetic operation on numbers that can have a fractional part. Here it is used to count the computation needed to train a model.'],
  ['METR', 'Model Evaluation and Threat Research', 'An independent nonprofit that develops tests of AI capabilities and evaluates risks.'],
  ['TH2', 'METR Time Horizon 2', 'A newer set of tasks METR uses to estimate how often AI succeeds at work of different difficulty levels.'],
  ['TH1.1', 'METR Time Horizon 1.1', 'An earlier set of tasks METR uses to estimate how often AI succeeds at work of different difficulty levels.'],
  ['task horizon|task horizons|task-completion time horizon', 'Task horizon', 'How long a human expert would take on tasks that an AI is estimated to complete at a stated success rate. The time refers to the human expert.'],
  ['open weight|open weights|open-weight|open-weights|downloadable weights', 'Open weights', 'You can download the numbers the model learned during training. The license sets the rules for using, changing, or sharing them. The training code and data may still be private.'],
  ['closed weight|closed weights|closed-weight|closed-weights', 'Closed weights', 'The developer keeps the model’s learned numbers out of public downloads. You may still be able to use the model through a website or an app, sometimes for free.'],
  ['benchmark|benchmarks', 'Benchmark', 'A standard test used to compare different systems under the same conditions.'],
  ['rubric|rubrics', 'Scoring rubric', 'A set of rules that explains what counts as evidence and how many points each finding can earn.'],
  ['evidence credit', 'Evidence credit', 'The points a measured result earns under the watch’s published scoring rules.'],
  ['log scale|logarithmic scale', 'Logarithmic scale', 'Equal steps mean multiplying by the same amount. For example, the jumps from 10 to 100 and from 100 to 1,000 take up the same space.'],
  ['capability frontier|benchmark frontier|measured frontier', 'Measured frontier', 'The strongest results recorded so far on the tests being tracked.'],
  ['autonomy|autonomous', 'Autonomy', 'How much work a system can complete with limited human assistance.'],
  ['appropriate reliance|calibrated trust', 'Knowing when to rely on AI', 'Using AI advice when it is correct and setting it aside when it is wrong. Researchers can measure both decisions.'],
  ['calibration', 'Calibration', 'How closely stated confidence matches results. A system that says it is 90% confident should be right about nine times out of ten on similar cases.'],
  ['confidence interval|confidence intervals|uncertainty interval|uncertainty intervals', 'Uncertainty interval', 'A range around an estimate that shows how precisely it was measured. The source explains how the range was calculated.'],
  ['compounding gains|compounding capability gains|compounding', 'Compounding gains', 'Improvements that make the next round of improvement more effective, so gains build on one another.'],
  ['replication|independent replication|independent replications', 'Independent replication', 'Researchers outside the original team repeat a study or test to see whether its result holds.'],
  ['evidence coverage|source coverage', 'Evidence coverage', 'The share of the scoring rules with published evidence available. Missing readings can lower coverage.'],
  ['watch line|watch-line', 'Watch line', 'The index score of 75 points prompts a closer look at the evidence. Confirming the Singularity requires separate independent evidence.'],
  ['sycophancy|sycophantic', 'Excessive agreement', 'When an AI sides with the user even if their claim is incorrect or needs to be challenged.'],
  ['API', 'Application programming interface', 'A way for software to request a service, such as asking a model for an answer.'],
  ['UTC', 'Coordinated Universal Time', 'The common time standard used to compare dates and times across time zones.'],
  ['latency', 'Response time', 'How long a service takes to respond after receiving a request.'],
  ['model weights', 'Model weights', 'The numbers a model learns from examples during training. They help determine how the model responds to new input.'],
  ['weight access|weight availability|open- and closed-weight|open- and closed-weights|open and closed weights|open or closed weights', 'Model weight access', 'This tells you whether people can download the numbers a model learned. A model’s price, the license for using it, and whether its training code or data are public are separate questions.'],
];

const aliasLookup = new Map();
for (const [index, [aliases, name, description]] of entries.entries()) {
  const term = { id: `glossary-meaning-${index}`, name, description };
  for (const alias of aliases.split('|')) aliasLookup.set(alias.toLowerCase(), term);
}
const terms = [...aliasLookup.keys()]
  .sort((a, b) => b.length - a.length)
  .map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll('-', '[-‐‑]').replaceAll(' ', '\\s+'));
const glossaryPattern = new RegExp(`\\b(?:${terms.join('|')})\\b`, 'gi');
const termSelector = '.glossary-term';
const controls = 'a[href], button, summary, label, [role="button"], [role="tab"], [role="option"], [role="slider"]';
const excluded = `${termSelector}, .glossary-popup, script, style, template, noscript, canvas, svg, textarea, select, output, [contenteditable], [role="alert"], [role="status"], [role="log"], [role="timer"]`;

export function installGlossary(root) {
  const owner = root.ownerDocument;
  const view = owner.defaultView;
  const glossaryById = new Map([...aliasLookup.values()].map((term) => [term.id, term]));
  const meanings = owner.createElement('div');
  meanings.hidden = true;
  for (const { id, name, description } of glossaryById.values()) {
    const meaning = owner.createElement('span');
    meaning.id = id;
    meaning.textContent = `${name}. ${description}`;
    meanings.append(meaning);
  }

  const popup = owner.createElement('div');
  const title = owner.createElement('strong');
  const body = owner.createElement('p');
  popup.className = 'glossary-popup';
  popup.hidden = true;
  popup.setAttribute('aria-hidden', 'true');
  popup.append(title, body);
  owner.body.append(meanings, popup);

  // A filter whose entire label is a term can explain itself and keep its normal action.
  function termFor(target) {
    if (!(target instanceof Element)) return null;
    const mark = target.closest(termSelector);
    if (mark) return mark;
    const control = target.closest(controls);
    const label = control?.querySelector(termSelector);
    return label && control.textContent.trim() === label.textContent ? label : null;
  }

  const changedControls = new Set();
  let tabFrame;
  function isVisible(mark) {
    if (mark.checkVisibility) return mark.checkVisibility({ visibilityProperty: true });
    return !mark.closest('details:not([open])') && mark.getClientRects().length > 0;
  }

  // Keep one keyboard stop per meaning in each section. Repeats still work on tap or hover.
  function scheduleTabStops() {
    if (tabFrame) return;
    tabFrame = view.requestAnimationFrame(() => {
      tabFrame = null;
      const sections = new Map();
      const updates = [];
      for (const mark of root.querySelectorAll('.glossary-term[role="button"]')) {
        const section = mark.closest('section, article, details, [role="tabpanel"]') ?? root;
        if (!sections.has(section)) sections.set(section, new Set());
        const seen = sections.get(section);
        const id = mark.dataset.glossaryMeaning;
        const firstVisible = !seen.has(id) && isVisible(mark);
        const tabIndex = firstVisible ? 0 : -1;
        if (mark.tabIndex !== tabIndex) updates.push([mark, tabIndex]);
        if (firstVisible) seen.add(id);
      }
      for (const [mark, tabIndex] of updates) mark.tabIndex = tabIndex;
    });
  }

  function syncControlDescriptions() {
    for (const control of changedControls) {
      const existing = control.getAttribute('aria-describedby') ?? '';
      const ids = existing.split(/\s+/).filter(id => id && !glossaryById.has(id));
      for (const mark of control.querySelectorAll(termSelector)) ids.push(mark.dataset.glossaryMeaning);
      const description = [...new Set(ids)].join(' ');
      if (description === existing) continue;
      if (description) control.setAttribute('aria-describedby', description);
      else control.removeAttribute('aria-describedby');
    }
    changedControls.clear();
  }

  function annotateText(text) {
    const host = text.parentElement;
    if (!host || host.closest(excluded)) return;
    const matches = [...text.data.matchAll(glossaryPattern)];
    if (!matches.length) return;

    const fragment = owner.createDocumentFragment();
    const control = host.closest(controls);
    let end = 0;
    for (const match of matches) {
      const [label] = match;
      const term = aliasLookup.get(label.toLowerCase().replace(/[‐‑]/g, '-').replace(/\s+/g, ' '));
      if (match.index > end) fragment.append(text.data.slice(end, match.index));
      const mark = owner.createElement('span');
      mark.className = 'glossary-term';
      mark.dataset.glossaryMeaning = term.id;
      mark.textContent = label;
      mark.title = '';
      if (!control) {
        mark.tabIndex = 0;
        mark.setAttribute('role', 'button');
        mark.setAttribute('aria-describedby', term.id);
      }
      fragment.append(mark);
      end = match.index + label.length;
    }
    if (end < text.length) fragment.append(text.data.slice(end));
    text.replaceWith(fragment);
    if (control) changedControls.add(control);
    scheduleTabStops();
  }

  function annotate(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      annotateText(node);
    } else if (node instanceof Element && !node.closest(excluded)) {
      const walker = owner.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      const texts = [];
      while (walker.nextNode()) texts.push(walker.currentNode);
      for (const text of texts) annotateText(text);
    }
  }

  let active;
  let pinned;
  let hideTimer;

  function hide() {
    view.clearTimeout(hideTimer);
    active = null;
    pinned = null;
    popup.hidden = true;
  }

  function position() {
    if (!active) return;
    const bounds = active.getBoundingClientRect();
    const width = owner.documentElement.clientWidth;
    const height = view.innerHeight;
    if (!bounds.width || !bounds.height || bounds.bottom < 0 || bounds.top > height || bounds.right < 0 || bounds.left > width) {
      if (active === termFor(owner.activeElement)) popup.style.visibility = 'hidden';
      else hide();
      return;
    }

    popup.style.visibility = '';
    const inset = 10;
    const gap = 8;
    const centered = (bounds.left + bounds.right - popup.offsetWidth) / 2;
    const above = bounds.top - gap - popup.offsetHeight;
    const below = Math.min(bounds.bottom + gap, height - popup.offsetHeight - inset);
    popup.style.left = `${Math.max(inset, Math.min(centered, width - popup.offsetWidth - inset))}px`;
    popup.style.top = `${above >= inset ? above : Math.max(inset, below)}px`;
  }

  function show(mark) {
    view.clearTimeout(hideTimer);
    if (active === mark) return;
    const { name, description } = glossaryById.get(mark.dataset.glossaryMeaning);
    active = mark;
    pinned = null;
    title.textContent = name;
    body.textContent = description;
    popup.hidden = false;
    position();
  }

  function toggle(mark) {
    if (pinned === mark) {
      hide();
      return;
    }
    show(mark);
    if (active === mark) pinned = mark;
  }

  function dismissUnlessFocused() {
    view.clearTimeout(hideTimer);
    if (!active || pinned === active || active === termFor(owner.activeElement)) return;
    hideTimer = view.setTimeout(hide, 150);
  }

  annotate(root);
  syncControlDescriptions();
  const observer = new MutationObserver((changes) => {
    for (const change of changes) {
      if (change.type === 'attributes') {
        scheduleTabStops();
        continue;
      }
      if (change.removedNodes.length && change.target instanceof Element) {
        const control = change.target.closest(controls);
        if (control && !control.matches(termSelector)) changedControls.add(control);
        for (const node of change.removedNodes) {
          if (node instanceof Element && (node.matches(termSelector) || node.querySelector(termSelector))) scheduleTabStops();
        }
      }
      if (change.type === 'characterData' && root.contains(change.target)) annotate(change.target);
      for (const node of change.addedNodes) {
        if (root.contains(node)) annotate(node);
      }
    }
    syncControlDescriptions();
    if (active && !root.contains(active)) hide();
  });
  observer.observe(root, { childList: true, characterData: true, subtree: true, attributeFilter: ['hidden', 'open'] });

  root.addEventListener('pointerover', (event) => {
    const mark = termFor(event.target);
    if (mark && event.pointerType !== 'touch' && (!pinned || pinned === mark)) show(mark);
  });
  root.addEventListener('pointerout', (event) => {
    const mark = termFor(event.target);
    if (mark && active === mark && !mark.contains(event.relatedTarget)) dismissUnlessFocused();
  });
  root.addEventListener('focusin', (event) => {
    const mark = termFor(event.target);
    if (mark) show(mark);
  });
  root.addEventListener('focusout', (event) => {
    if (active && active === termFor(event.target)) hide();
  });
  root.addEventListener('click', (event) => {
    const mark = termFor(event.target);
    if (mark) toggle(mark);
  });
  root.addEventListener('keydown', (event) => {
    const mark = termFor(event.target);
    if (mark?.getAttribute('role') !== 'button' || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    toggle(mark);
  });
  owner.addEventListener('keydown', (event) => {
    if (active && event.key === 'Escape') hide();
  });
  owner.addEventListener('pointerdown', (event) => {
    if (active && active !== termFor(event.target) && !popup.contains(event.target)) hide();
  });
  owner.addEventListener('fullscreenchange', () => {
    hide();
    (owner.fullscreenElement ?? owner.body).append(popup);
    scheduleTabStops();
  });
  popup.addEventListener('pointerenter', () => view.clearTimeout(hideTimer));
  popup.addEventListener('pointerleave', dismissUnlessFocused);
  view.addEventListener('scroll', position, true);
  view.addEventListener('resize', scheduleTabStops);
  view.addEventListener('resize', position);
}
