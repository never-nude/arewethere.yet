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
  const title = node('h3', 'Milestone sequence in this scenario');
  if (!sequence.length) {
    let detail = 'This scenario has no future crossing date. The benchmark slider remains available.';
    if (projection?.status === 'at-line') detail = 'The current index is already at the watch line. This scenario has no new crossing to schedule.';
    else if (projection?.status === 'conditional') detail = 'The crossing leaves fewer than four days for separate milestones.';
    container.replaceChildren(title, node('p', detail, 'small-note'));
    return;
  }

  const selected = Date.parse(index.date) + selectedDay * dayMs;
  const summary = node('p',
    'At ' + dateFormat.format(selected) + ', ' + sequence.filter((step) => step.day <= selectedDay).length
    + ' of 4 steps are reached in this scenario.', 'dependency-selection');
  const items = node('ol', '', 'dependency-steps');
  for (const [position, step] of sequence.entries()) {
    const row = node('li');
    const status = step.day <= selectedDay ? 'Reached in scenario'
      : position && sequence[position - 1].day > selectedDay ? 'Waits for ' + sequence[position - 1].label
        : 'Next in scenario';
    const time = node('time', dateFormat.format(new Date(step.date)));
    time.dateTime = step.date;
    row.dataset.reached = String(step.day <= selectedDay);
    row.append(node('strong', step.label), time, node('small', status));
    items.append(row);
  }
  container.replaceChildren(title, summary, items, node('p',
    'Move the slider to see what would have happened by that day in this example. Each step waits for the one before it. We give more time to steps with more evidence still missing. To say the Singularity had happened, independent researchers would need to verify that AI kept making faster improvements across generations.', 'small-note'));
}
