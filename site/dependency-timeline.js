const dayMs = 86_400_000;
const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
});
const order = [
  { id: 'agi', label: 'AGI' },
  { id: 'asi', label: 'ASI' },
  { id: 'rsi', label: 'Recursive self-improvement' },
  { id: 'singularity', label: 'Singularity' },
];

export function planDependencies(index, projection, milestones) {
  if (projection?.status !== 'conditional' || !Number.isInteger(projection.days) || projection.days < order.length) return [];
  const reading = Date.parse(index?.date ?? '');
  if (!Number.isFinite(reading)) return [];
  const work = order.map(({ id }) => {
    const score = milestones.find((milestone) => milestone.id === id)?.score;
    return Math.max(1, 100 - (Number.isFinite(score) ? score : 0));
  });
  const total = work.reduce((sum, points) => sum + points, 0);
  let cumulative = 0;
  let previous = 0;
  return order.map((stage, index) => {
    cumulative += work[index];
    const desired = Math.ceil(projection.days * cumulative / total);
    const lastAvailable = projection.days - (order.length - index - 1);
    const day = index === order.length - 1 ? projection.days : Math.min(lastAvailable, Math.max(previous + 1, desired));
    previous = day;
    return { ...stage, day, date: new Date(reading + day * dayMs).toISOString().slice(0, 10) };
  });
}

function node(tag, text, name) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (name) element.className = name;
  return element;
}

export function renderDependencyTimeline(container, index, projection, milestones, selectedDay = 0) {
  const sequence = planDependencies(index, projection, milestones);
  const title = node('h3', 'An example milestone order');
  const explanation = node('p',
    'This example assumes AGI, then ASI, then recursive self-improvement. The example dates are spaced by how much evidence is still missing. A research feedback loop could start before either capability milestone. ', 'small-note');
  const map = node('a', 'See other possible orders.');
  map.href = '#milestone-order';
  explanation.append(map);
  if (!sequence.length) {
    let detail = 'This scenario has no future crossing date. The benchmark slider remains available.';
    if (projection?.status === 'at-line') detail = 'The current index is already at or above your chosen score. This scenario has no new crossing to schedule.';
    else if (projection?.status === 'conditional') detail = 'The index reaches your chosen score too soon to show separate dates.';
    container.replaceChildren(title, explanation, node('p', detail, 'small-note'));
    return;
  }

  const selected = Date.parse(index.date) + selectedDay * dayMs;
  const exampleMilestones = sequence.slice(0, -1);
  const summary = node('p',
    'By ' + dateFormat.format(selected) + ', ' + exampleMilestones.filter((step) => step.day <= selectedDay).length
    + ' of ' + exampleMilestones.length + ' example milestone dates have passed.', 'dependency-selection');
  const items = node('ol', '', 'dependency-steps');
  for (const step of sequence) {
    const row = node('li');
    const passed = step.day <= selectedDay;
    const status = passed ? 'At or before selected date' : 'After selected date';
    const label = step.id === 'singularity' ? 'Chosen score reached' : step.label;
    const time = node('time', dateFormat.format(new Date(step.date)));
    time.dateTime = step.date;
    row.dataset.reached = String(passed);
    row.append(node('strong', label), time, node('small', status));
    items.append(row);
  }
  const note = node('p',
    'The final date shows when the index would reach your chosen score at the selected pace. The suggested milestone order and dates are hypothetical. Confirming the Singularity requires independent evidence of sustained AI-driven acceleration across generations.', 'small-note');
  container.replaceChildren(title, explanation, summary, items, note);
}
