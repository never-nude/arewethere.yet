const concepts = {
  agi: {
    label: 'AGI',
    title: 'Artificial general intelligence',
    color: '#59e0c9',
    description: 'An AI system that performs competently across many kinds of tasks, including unfamiliar ones. Researchers disagree on where to draw the line.',
    implication: 'Breadth and depth can grow at different rates. An AI can be useful across many fields while specialists still outperform it in each.',
    example: 'Imagine one assistant that can help with a lease, tutor a teenager, plan an accessible trip, and pick up a new kind of task from a few instructions.',
    daily: 'More people could hand off routine paperwork, planning, and basic troubleshooting to one tool. Teachers, clinicians, and other specialists would still be responsible for consequential decisions.',
    source: 'https://research.google/pubs/levels-of-agi-operationalizing-progress-on-the-path-to-agi/',
    sourceName: 'Levels of AGI',
  },
  asi: {
    label: 'ASI',
    title: 'Artificial superintelligence',
    color: '#b69bff',
    description: 'AI that substantially exceeds the strongest human performance across many important cognitive domains.',
    implication: 'ASI refers to performance. Self-awareness is a separate question. Human-led engineering could produce superintelligence, as could repeated AI-led improvements.',
    example: 'Imagine a system that consistently beats specialist teams at designing better batteries, finding errors in complex software, and reasoning through new scientific problems.',
    daily: 'Many effects would likely arrive through products and services we already use. Medicine, energy, and software could improve faster, with adoption depending on testing, cost, and access.',
    source: 'https://research.google/pubs/levels-of-agi-operationalizing-progress-on-the-path-to-agi/',
    sourceName: 'Levels of AGI',
  },
  rsi: {
    label: 'Self-improvement',
    title: 'Recursive self-improvement',
    color: '#ffcb8c',
    description: 'An AI system helps make a more capable version or successor, which can in turn make further improvements. Research teams can supervise the loop.',
    implication: 'A narrow AI research specialist could contribute to this loop before broad AGI. Each round still depends on usable ideas, compute, evaluation, and other resources.',
    example: 'A coding assistant helps developers build and test a better coding assistant. The successor then does more of the work on the next version.',
    daily: 'The earliest visible effect could be shorter gaps between useful upgrades to apps and assistants. Teams would also have to review and adapt to changes more often.',
    source: 'https://metr.org/blog/2026-10-14-ai-rd-acceleration-assessment-proposal/',
    sourceName: 'METR assessment proposal',
  },
  singularity: {
    label: 'Singularity',
    title: 'The technological singularity',
    color: '#f595ce',
    description: 'In this observatory, the singularity is the point where AI-led research makes successive AI systems better at research, driving sustained acceleration across generations.',
    implication: 'The evidence would need to connect gains in AI research ability to increasingly fast improvements over multiple generations. Progress could plateau before this happens.',
    example: 'Imagine a workshop whose tools help make better tools so reliably that each generation takes less time to design and delivers a bigger improvement.',
    daily: 'If this happened, one likely early effect would be rapid changes to software and work routines. Physical services such as health care, transport, and housing would still depend on infrastructure, testing, and institutions.',
    source: 'https://vtechworks.lib.vt.edu/items/5085379d-b24c-424e-8861-e70a47b4b2fb',
    sourceName: 'I. J. Good’s original argument',
  },
};

const compounding = {
  from: 'rsi',
  to: 'singularity',
  required: true,
  detail: 'The feedback loop has to keep accelerating AI research across generations. A loop can also hit limits and plateau.',
  example: 'A tool improves the next version, and each new version saves the team more time than the one before it.',
};

const paths = {
  breadth: {
    label: 'Broad skills first',
    intro: 'AI gets good at many kinds of work, then helps build stronger AI.',
    detail: 'Broadly superhuman performance includes broad general ability under these definitions. A single system could demonstrate both together.',
    legs: [
      { from: 'agi', to: 'asi', detail: 'Broad competence could deepen until the system outperforms top human experts across many fields.', example: 'A versatile assistant goes from helping you understand an electricity bill to consistently designing more efficient appliances than expert teams.' },
      { from: 'asi', to: 'rsi', detail: 'Teams could use a broadly superhuman system to build successors if it can do the research and has access to tools, compute, and testing.', example: 'A software team uses its strongest AI to find and test changes that make the next version of that AI more useful.' },
      compounding,
    ],
  },
  research: {
    label: 'Research specialist first',
    intro: 'AI starts building stronger AI while its other skills are still narrow.',
    detail: 'A specialized research system could start the feedback loop before broad AGI or ASI. Broader abilities could emerge later if research gains transfer to other domains.',
    legs: [compounding],
  },
};

const conceptEntries = Object.entries(concepts);
const initialCamera = { yaw: .68, pitch: .39, zoom: 1, panX: 0, panY: 0 };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const confidenceNumber = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
const axes = [
  { id: 'x', label: 'First supporting measure', color: '#82dbe5' },
  { id: 'y', label: 'Independent confirmation', color: '#d1b2ff' },
  { id: 'z', label: 'Second supporting measure', color: '#ffc78f' },
];
const plotEdge = 1.3;
const lowerCorner = axes.map(() => -plotEdge);
const upperCorner = axes.map(() => plotEdge);
const ticks = [0, 25, 50, 75, 100];

function plotValue(percent) {
  return -plotEdge + 2 * plotEdge * clamp(percent, 0, 100) / 100;
}

function node(tag, name, content) {
  const item = document.createElement(tag);
  if (name) item.className = name;
  if (content) item.textContent = content;
  return item;
}

function sceneMarkup() {
  return `
    <div class="sw-terrain__toolbar">
      <div class="sw-terrain__confidence-head"><h3>Path confidence</h3><span class="sw-terrain__confidence-status">Waiting for evidence</span></div>
      <div class="sw-terrain__path-buttons" role="group" aria-label="Choose a possible sequence">
        ${Object.entries(paths).map(([id, path]) => `<button type="button" data-path="${id}" aria-pressed="false"><span><b>${path.label}</b><span class="sw-terrain__route-intro">${path.intro}</span><small class="sw-terrain__coverage"></small></span><strong><span data-route-score="${id}">—</span><small> / 100</small></strong></button>`).join('')}
      </div>
      <p class="sw-terrain__route-note">These are two possible starting points. Either could reach the same feedback loop if gains keep accelerating. Scores summarize public evidence for each scenario.</p>
      <div class="sw-terrain__legend" id="terrain-legend">
        <ul class="sw-terrain__axes" aria-label="Graph axes, 0 to 100 percent of available evidence credit">
          ${axes.map(({ id, label, color }) => `<li style="--axis-color:${color}"><b>${id.toUpperCase()}</b> ${label}</li>`).join('')}
        </ul>
        <p>Each axis shows how many of its available points the evidence earned, from 0% to 100%. The supporting tests differ by milestone. Points on the floor still await independent confirmation.</p>
        <p>Positions and distances reflect evidence credit. Arrows show possible sequences and fill to their support scores. Select a milestone to see its calculations.</p>
        <div class="sw-terrain__arrow-keys"><span><i aria-hidden="true"></i>Possible step</span><span><i class="sw-terrain__solid" aria-hidden="true"></i>Required by our definition</span><span><i class="sw-terrain__filled" aria-hidden="true"></i>Evidence score</span></div>
      </div>
    </div>
    <div class="sw-terrain__stage" data-waiting>
      <canvas class="sw-terrain__canvas" tabindex="0" aria-describedby="terrain-legend" aria-label="Rotating 3D milestone evidence graph. Use arrow keys to rotate, Shift and arrow keys to pan, plus or minus to zoom, and Home to reset."></canvas>
      <p class="sw-terrain__scene-message">Waiting for measured evidence</p>
      <div class="sw-terrain__markers" role="group" aria-label="Explore AI concepts">
        ${conceptEntries.map(([id, concept]) => `<button type="button" class="sw-terrain__marker" data-concept="${id}" style="--node-color:${concept.color}" aria-label="${concept.title}" aria-pressed="false"><span aria-hidden="true"></span>${concept.label}</button>`).join('')}
      </div>
      <div class="sw-terrain__guide">Left-drag to rotate · Right-drag or Shift-drag to pan</div>
      <div class="sw-terrain__camera" role="group" aria-label="View controls">
        <button type="button" data-camera="far" aria-label="Zoom out" title="Zoom out">−</button>
        <button type="button" data-camera="close" aria-label="Zoom in" title="Zoom in">+</button>
        <button type="button" data-camera="reset" class="sw-terrain__reset" aria-label="Reset view" title="Reset view">Reset</button>
      </div>
    </div>
    <div class="sw-terrain__readout">
      <div class="sw-terrain__paths">
        <p class="sw-terrain__overline">Why the arrows connect</p>
        <p class="sw-terrain__path-detail"></p>
        <p class="sw-terrain__caption">The bars show how much evidence supports each step out of 100 points. Select a step to see its reasoning.</p>
        <ol class="sw-terrain__steps"></ol>
        <details class="sw-terrain__score-method">
          <summary>How confidence is scored</summary>
          <p class="sw-terrain__method-copy"></p>
          <ul class="sw-terrain__contributions"></ul>
        </details>
      </div>
      <div class="sw-terrain__concept" aria-live="polite" aria-atomic="true">
        <p class="sw-terrain__overline">Selected concept</p>
        <h3></h3>
        <div class="sw-terrain__coordinates" hidden>
          <h4>Position in the evidence graph</h4>
          <p>Each coordinate is credited points ÷ available points × 100.</p>
          <ul></ul>
        </div>
        <p class="sw-terrain__definition"></p>
        <p class="sw-terrain__implication"></p>
        <p class="sw-terrain__example"><strong>Everyday example</strong><span></span></p>
        <p class="sw-terrain__daily"><strong>What you might notice</strong><span></span></p>
        <a class="sw-terrain__concept-source" target="_blank" rel="noopener noreferrer"></a>
        <div class="sw-terrain__verdict" hidden>
          <h4>Where we stand</h4>
          <strong></strong>
          <p class="sw-terrain__verdict-reason"></p>
          <p class="sw-terrain__verdict-human"></p>
          <p class="sw-terrain__verdict-change"></p>
        </div>
      </div>
    </div>`;
}

const floor = [lowerCorner, [plotEdge, -plotEdge, -plotEdge], [plotEdge, -plotEdge, plotEdge], [-plotEdge, -plotEdge, plotEdge]];
const terrainLines = ticks.flatMap((tick) => {
  const position = plotValue(tick);
  return [
    [[-plotEdge, -plotEdge, position], [plotEdge, -plotEdge, position]],
    [[position, -plotEdge, -plotEdge], [position, -plotEdge, plotEdge]],
  ];
});

const stars = Array.from({ length: 118 }, (_, index) => ({
  x: ((index * 73 + 23) % 193) / 193,
  y: ((index * 107 + 19) % 179) / 179,
  size: index % 17 === 0 ? 1.15 : .45,
  opacity: .08 + (index % 9) * .027,
}));

function createProjector(camera, width, height) {
  const cosYaw = Math.cos(camera.yaw);
  const sinYaw = Math.sin(camera.yaw);
  const cosPitch = Math.cos(camera.pitch);
  const sinPitch = Math.sin(camera.pitch);
  const scale = Math.min(width * .185, height * .19) * camera.zoom;
  const originX = width * .51 + camera.panX;
  const originY = height * .44 + camera.panY;

  return ([x, y, z]) => {
    const horizontal = x * cosYaw - z * sinYaw;
    const depth = x * sinYaw + z * cosYaw;
    const vertical = y * cosPitch + depth * sinPitch;
    const distance = 7 + depth * cosPitch - y * sinPitch;
    const perspective = 7 / distance;
    return [originX + horizontal * scale * perspective, originY - vertical * scale * perspective, perspective];
  };
}

function paintBackground(ctx, width, height) {
  ctx.fillStyle = '#0d0b17';
  ctx.fillRect(0, 0, width, height);
  const fog = ctx.createRadialGradient(width * .59, height * .49, 8, width * .59, height * .49, width * .59);
  fog.addColorStop(0, 'rgba(87, 56, 147, .40)');
  fog.addColorStop(.5, 'rgba(53, 35, 105, .21)');
  fog.addColorStop(1, 'rgba(13, 11, 23, 0)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, width, height);
  for (const star of stars) {
    ctx.fillStyle = `rgba(217, 204, 255, ${star.opacity})`;
    ctx.beginPath();
    ctx.arc(star.x * width, star.y * height, star.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function trace(ctx, points) {
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
}

function paintGround(ctx, project, width, height) {
  trace(ctx, floor.map(project));
  ctx.closePath();
  const gradient = ctx.createLinearGradient(0, height * .3, width, height);
  gradient.addColorStop(0, 'rgba(35, 153, 165, .14)');
  gradient.addColorStop(.48, 'rgba(142, 98, 252, .18)');
  gradient.addColorStop(1, 'rgba(73, 37, 110, .09)');
  ctx.fillStyle = gradient;
  ctx.fill();

  const mesh = ctx.createLinearGradient(width * .09, 0, width * .88, height);
  mesh.addColorStop(0, 'rgba(87, 205, 193, .18)');
  mesh.addColorStop(.52, 'rgba(166, 126, 252, .25)');
  mesh.addColorStop(1, 'rgba(126, 92, 195, .10)');
  ctx.strokeStyle = mesh;
  ctx.lineWidth = .65;
  for (const line of terrainLines) {
    trace(ctx, line.map(project));
    ctx.stroke();
  }
}

function paintAxes(ctx, project, width) {
  ctx.save();
  const ceiling = floor.map(([x, , z]) => [x, plotEdge, z]);
  ctx.strokeStyle = '#c6a8ee61';
  ctx.lineWidth = .8;
  for (const corners of [floor, ceiling]) {
    trace(ctx, corners.map(project));
    ctx.closePath();
    ctx.stroke();
  }
  for (const [index, corner] of floor.entries()) {
    trace(ctx, [project(corner), project(ceiling[index])]);
    ctx.stroke();
  }

  const [originX, originY] = project(lowerCorner);
  ctx.font = '11px ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e1d3f7';
  ctx.textAlign = 'center';
  ctx.fillText('0%', originX, originY + 12);

  for (const [index, axis] of axes.entries()) {
    const at = (percent) => project(lowerCorner.map((value, dimension) => dimension === index ? plotValue(percent) : value));
    const [endX, endY] = at(100);
    const dx = endX - originX;
    const dy = endY - originY;
    const length = Math.hypot(dx, dy);
    if (length < 12) continue;
    const normal = [-dy / length * 3, dx / length * 3];
    const side = index === 1 ? -1 : Math.sign(dx);
    ctx.strokeStyle = axis.color;
    ctx.fillStyle = axis.color;
    ctx.lineWidth = 1.45;
    trace(ctx, [[originX, originY], [endX, endY]]);
    ctx.stroke();
    for (const tick of ticks.slice(1)) {
      const [x, y] = at(tick);
      trace(ctx, [[x - normal[0], y - normal[1]], [x + normal[0], y + normal[1]]]);
      ctx.stroke();
      if (tick === 50 && length > 65) {
        ctx.textAlign = 'center';
        ctx.fillText('50%', x + normal[0] * side * 4, y + normal[1] * side * 4);
      }
    }
    const name = `${axis.id.toUpperCase()} 100%`;
    const textWidth = ctx.measureText(name).width;
    ctx.textAlign = 'center';
    const labelX = endX + (index === 1 ? 0 : side * (textWidth / 2 + 7));
    const boundedX = clamp(labelX, textWidth / 2 + 4, width - textWidth / 2 - 4);
    if (endX >= 0 && endX <= width) {
      ctx.fillText(name, boundedX, endY + (index === 1 ? -11 : boundedX === labelX ? 0 : 12));
    }
  }

  const [targetX, targetY] = project(upperCorner);
  ctx.strokeStyle = '#bca8dfac';
  ctx.lineWidth = 1.1;
  trace(ctx, [[targetX, targetY - 5], [targetX + 5, targetY], [targetX, targetY + 5], [targetX - 5, targetY]]);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = '#d9c9eb';
  ctx.fillText('Full credit', targetX, targetY - 13);
  ctx.restore();
}

function paintLeg(ctx, { from: start, to: end, required }, positions, project, active, score) {
  if (!positions.has(start) || !positions.has(end)) return;
  const [a, b] = [concepts[start], concepts[end]];
  const startPoint = project(positions.get(start));
  const endPoint = project(positions.get(end));
  const [startX, startY] = startPoint;
  const [endX, endY] = endPoint;
  const length = Math.hypot(endX - startX, endY - startY);
  if (length < 3) return;
  const at = (fraction) => [startX + (endX - startX) * fraction, startY + (endY - startY) * fraction];

  ctx.save();
  ctx.strokeStyle = '#a99cba';
  ctx.globalAlpha = active ? .52 : .36;
  ctx.lineWidth = required ? 1.65 : 1.4;
  if (!required) ctx.setLineDash([4, 5]);
  trace(ctx, [startPoint, endPoint]);
  ctx.stroke();
  ctx.setLineDash([]);

  if (length > 16) {
    const [x, y] = at(.66);
    const angle = Math.atan2(endY - startY, endX - startX);
    trace(ctx, [[x - 5 * Math.cos(angle - .55), y - 5 * Math.sin(angle - .55)], [x, y],
      [x - 5 * Math.cos(angle + .55), y - 5 * Math.sin(angle + .55)]]);
    ctx.stroke();
  }

  const fraction = Number.isFinite(score) ? clamp(score / 100, 0, 1) : 0;
  if (fraction > 0) {
    const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
    gradient.addColorStop(0, a.color);
    gradient.addColorStop(1, b.color);
    ctx.strokeStyle = gradient;
    ctx.globalAlpha = active ? .19 : .1;
    ctx.lineWidth = 7;
    trace(ctx, [startPoint, at(fraction)]);
    ctx.stroke();
    ctx.globalAlpha = active ? 1 : .85;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ctx.restore();
}

function paintConcept(ctx, concept, [centerX, centerY, perspective], selected) {
  ctx.save();
  ctx.strokeStyle = concept.color;

  const radius = (selected ? 10 : 6.5) * perspective;
  const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 3.2);
  glow.addColorStop(0, concept.color + (selected ? '95' : '76'));
  glow.addColorStop(.4, concept.color + (selected ? '42' : '20'));
  glow.addColorStop(1, concept.color + '00');
  ctx.globalAlpha = 1;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = concept.color;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * .43, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = selected ? .95 : .52;
  ctx.lineWidth = selected ? 1.45 : .9;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function positionMarkers(ctx, positions, markers, width, height) {
  const spacing = 6;
  const occupied = [];
  for (const point of positions) {
    const button = markers.get(point.id);
    const buttonWidth = button.offsetWidth;
    const buttonHeight = button.offsetHeight;
    const halfWidth = buttonWidth / 2;
    const step = buttonHeight + spacing;
    const place = (dx, dy) => {
      const x = clamp(point.x + dx, halfWidth + spacing, width - halfWidth - spacing);
      const bottom = clamp(point.y + dy, buttonHeight + 10, height - 49);
      return { x, left: x - halfWidth, right: x + halfWidth, top: bottom - buttonHeight, bottom };
    };
    const candidates = [place(0, -13), place(halfWidth + 16, -3), place(-halfWidth - 16, -3), place(0, buttonHeight + 13)];
    for (let repeat = 1; repeat <= markers.size; repeat += 1) candidates.push(place(0, -13 - step * repeat), place(0, buttonHeight + 13 + step * repeat));
    const label = candidates.find((candidate) => occupied.every((other) =>
      candidate.right + spacing < other.left || candidate.left - spacing > other.right ||
      candidate.bottom + spacing <= other.top || candidate.top - spacing >= other.bottom)) ?? candidates[0];
    button.style.left = `${label.x}px`;
    button.style.top = `${label.bottom}px`;
    occupied.push(label);

    ctx.save();
    ctx.lineWidth = .9;
    ctx.strokeStyle = concepts[point.id].color + '8c';
    trace(ctx, [[point.x, point.y], [clamp(point.x, label.left, label.right), clamp(point.y, label.top, label.bottom)]]);
    ctx.stroke();
    ctx.restore();
  }
}

export function renderTerrain(container, { mode = 'breadth', onSelect } = {}) {
  container.classList.add('sw-terrain');
  container.innerHTML = sceneMarkup();
  const stage = container.querySelector('.sw-terrain__stage');
  const canvas = stage.querySelector('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const markerButtons = new Map([...stage.querySelectorAll('[data-concept]')].map((button) => [button.dataset.concept, button]));
  const cameraButtons = stage.querySelectorAll('[data-camera]');
  const pathButtons = container.querySelectorAll('[data-path]');
  const guide = stage.querySelector('.sw-terrain__guide');
  const explanation = container.querySelector('.sw-terrain__concept');
  const coordinates = explanation.querySelector('.sw-terrain__coordinates');
  const pathDetail = container.querySelector('.sw-terrain__path-detail');
  const stepList = container.querySelector('.sw-terrain__steps');
  const stepRows = new Map();
  const contributionsList = container.querySelector('.sw-terrain__contributions');
  const confidenceStatus = container.querySelector('.sw-terrain__confidence-status');

  const camera = { ...initialCamera };
  const pointers = new Map();
  let selected = 'singularity';
  let pathId = Object.hasOwn(paths, mode) ? mode : 'breadth';
  let frame = 0;
  let width = 0;
  let height = 0;
  let scores;
  let milestoneVerdicts;
  let milestoneEvidence;
  const scenePoints = new Map();
  let contributionKey;
  let coordinateKey;

  function refreshScene() {
    if (!ctx) return;
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function draw() {
    frame = 0;
    if (!width || !height) return;
    const project = createProjector(camera, width, height);
    paintBackground(ctx, width, height);
    paintGround(ctx, project, width, height);
    paintAxes(ctx, project, width);
    if (!scenePoints.size) return;
    const steps = scores?.[pathId]?.steps ?? [];
    for (const leg of paths[pathId].legs) {
      const step = steps.find(({ from, to }) => from === leg.from && to === leg.to);
      paintLeg(ctx, leg, scenePoints, project, selected === leg.from || selected === leg.to, step?.score);
    }
    const projected = [...scenePoints].map(([id, point]) => ({ id, screen: project(point) }));
    projected.sort((a, b) => Number(a.id === selected) - Number(b.id === selected) || a.screen[2] - b.screen[2]);
    for (const { id, screen } of projected) paintConcept(ctx, concepts[id], screen, id === selected);
    const labels = projected.reverse().map(({ id, screen: [x, y] }) => ({ id, x, y }));
    positionMarkers(ctx, labels, markerButtons, width, height);
  }

  function resize() {
    if (!ctx) return;
    width = stage.clientWidth;
    height = stage.clientHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    refreshScene();
  }

  function select(id, notify = true) {
    if (!Object.hasOwn(concepts, id)) return;
    selected = id;
    const concept = concepts[id];
    for (const [key, button] of markerButtons) button.setAttribute('aria-pressed', String(key === id));
    explanation.style.setProperty('--selected-color', concept.color);
    explanation.querySelector('h3').textContent = concept.title;
    explanation.querySelector('.sw-terrain__definition').textContent = concept.description;
    explanation.querySelector('.sw-terrain__implication').textContent = concept.implication;
    explanation.querySelector('.sw-terrain__example span').textContent = concept.example;
    explanation.querySelector('.sw-terrain__daily span').textContent = concept.daily;
    const link = explanation.querySelector('.sw-terrain__concept-source');
    link.href = concept.source;
    link.textContent = concept.sourceName + ' ↗';
    renderCoordinates();
    renderVerdict();
    refreshScene();
    if (notify) onSelect?.(id, concept);
  }

  function renderCoordinates() {
    const reading = milestoneEvidence?.[selected];
    coordinates.hidden = !reading;
    if (!reading) return;
    const key = JSON.stringify([selected, reading]);
    if (key === coordinateKey) return;
    coordinateKey = key;

    const rows = [...reading.axes, ...(reading.additional ?? [])].map((axis) => {
      const label = axis.axis ? `${axis.axis.toUpperCase()} · ${axis.label}` : axis.label;
      const result = (axis.axis ? `${confidenceNumber.format(axis.percent)}%` : 'Additional criterion') +
        (axis.pending ? ' · pending' : '');
      const item = node('li');
      const heading = node('div', 'sw-terrain__coordinate-heading');
      heading.append(node('strong', '', label), node('span', '', result));
      item.append(heading);
      const credit = `${confidenceNumber.format(axis.points ?? 0)} / ${confidenceNumber.format(axis.weight)} points credited`;
      const value = Number.isFinite(axis.value) ? confidenceNumber.format(axis.value) + (axis.unit ?? '').replace(/^[a-z]/i, ' $&') : '';
      item.append(node('p', '', credit + (value ? ` · Measured ${value}` : '')));
      if (axis.detail) item.append(node('p', '', axis.detail));
      if (axis.sourceUrl?.startsWith('https://') && axis.source) {
        const source = node('a', 'sw-terrain__coordinate-source', axis.source + ' ↗');
        source.href = axis.sourceUrl;
        source.target = '_blank';
        source.rel = 'noopener noreferrer';
        item.append(source);
      }
      return item;
    });
    coordinates.querySelector('ul').replaceChildren(...rows);
  }

  function renderVerdict() {
    const result = milestoneVerdicts?.[selected];
    const section = explanation.querySelector('.sw-terrain__verdict');
    section.hidden = !result;
    if (!result) return;
    section.querySelector('strong').textContent = result.headline + ' · ' + result.confidence;
    section.querySelector('.sw-terrain__verdict-reason').textContent = result.reason;
    section.querySelector('.sw-terrain__verdict-human').textContent = result.humanContext ?? '';
    section.querySelector('.sw-terrain__verdict-change').textContent = result.change;
  }

  function setPath(id) {
    pathId = id;
    const path = paths[id];
    for (const button of pathButtons) button.setAttribute('aria-pressed', String(button.dataset.path === id));
    pathDetail.textContent = path.detail;
    stepRows.clear();
    stepList.replaceChildren(...path.legs.map((leg) => {
      const row = node('li', 'sw-terrain__step');
      const details = node('details');
      const summary = node('summary');
      const label = concepts[leg.from].label + ' → ' + concepts[leg.to].label;
      const heading = node('span', 'sw-terrain__step-heading');
      const count = node('span', 'sw-terrain__step-score', '—');
      heading.append(node('strong', '', label), count);
      const meter = node('span', 'sw-terrain__step-meter');
      meter.setAttribute('aria-hidden', 'true');
      const fill = node('span');
      meter.append(fill);
      summary.append(heading, meter);
      const body = node('div', 'sw-terrain__step-body');
      const evidence = node('p');
      body.append(node('p', 'sw-terrain__step-kind', leg.required ? 'Required by our definition' : 'Possible under this scenario'),
        node('p', '', leg.detail), node('p', '', 'Example · ' + leg.example), evidence);
      details.append(summary, body);
      row.append(details);
      stepRows.set(leg.from + ':' + leg.to, { fill, count, evidence });
      return row;
    }));
    renderRouteEvidence();
    refreshScene();
  }

  function renderRouteEvidence() {
    const route = scores?.[pathId];
    for (const step of route?.steps ?? []) {
      const row = stepRows.get(step.from + ':' + step.to);
      if (!row) continue;
      row.fill.style.width = (step.score ?? 0) + '%';
      row.count.textContent = step.score == null ? 'Awaiting evidence' : confidenceNumber.format(step.score) + ' / 100';
      row.evidence.textContent = step.detail + ' Evidence coverage ' + step.coverage + '%.';
    }

    const key = JSON.stringify([pathId, route?.contributions]);
    if (key === contributionKey) return;
    contributionKey = key;
    const rows = (route?.contributions ?? []).map((contribution) => {
      const row = node('li');
      const header = node('div', 'sw-terrain__contribution');
      const points = contribution.points == null ? 'Open · ' + contribution.weight + ' pts' :
        confidenceNumber.format(contribution.points) + ' / ' + contribution.weight + ' pts';
      header.append(node('strong', '', contribution.label), node('span', '', points));
      row.append(header, node('p', '', contribution.detail));
      if (contribution.sourceUrl?.startsWith('https://')) {
        const link = node('a', '', contribution.source + ' ↗');
        link.href = contribution.sourceUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        row.append(link);
      }
      return row;
    });
    contributionsList.replaceChildren(...rows);
  }

  function updateConfidence(nextScores, { status, method, verdicts, evidence } = {}) {
    scores = nextScores;
    if (evidence && evidence !== milestoneEvidence) {
      milestoneEvidence = evidence;
      for (const [id, button] of markerButtons) {
        const reading = evidence[id];
        if (!reading) continue;
        scenePoints.set(id, reading.axes.map(({ percent }) => plotValue(percent)));
        button.title = reading.axes.map(({ axis, percent }) => `${axis.toUpperCase()} ${confidenceNumber.format(percent)}%`).join(' · ');
      }
      stage.toggleAttribute('data-waiting', !scenePoints.size);
      renderCoordinates();
    }
    if (verdicts && verdicts !== milestoneVerdicts) {
      milestoneVerdicts = verdicts;
      renderVerdict();
    }
    if (status) confidenceStatus.textContent = status;
    if (method) container.querySelector('.sw-terrain__method-copy').textContent = method;
    for (const button of pathButtons) {
      const { path } = button.dataset;
      const route = scores?.[path];
      button.querySelector('[data-route-score]').textContent = route?.score == null ? '—' : confidenceNumber.format(route.score);
      button.querySelector('.sw-terrain__coverage').textContent = route ? route.coverage + '% evidence coverage' : '';
      button.title = route?.score == null ? paths[path].label : route.coverage + '% evidence coverage. ' + route.summary;
    }
    renderRouteEvidence();
    refreshScene();
  }

  function zoomBy(factor) {
    camera.zoom = clamp(camera.zoom * factor, .68, 2.1);
    refreshScene();
  }

  function resetCamera() {
    Object.assign(camera, initialCamera);
    refreshScene();
  }

  function rotate(dx, dy) {
    camera.yaw = (camera.yaw + dx) % (Math.PI * 2);
    camera.pitch = clamp(camera.pitch + dy, .14, 1.05);
    refreshScene();
  }

  function pan(dx, dy) {
    camera.panX = clamp(camera.panX + dx, -width * .31, width * .31);
    camera.panY = clamp(camera.panY + dy, -height * .27, height * .27);
    refreshScene();
  }

  function stopPointer(event) {
    pointers.delete(event.pointerId);
    if (!pointers.size) stage.removeAttribute('data-dragging');
  }

  const controls = new AbortController();
  const listener = { signal: controls.signal };
  for (const [id, button] of markerButtons) button.addEventListener('click', () => select(id), listener);
  for (const button of pathButtons) button.addEventListener('click', () => setPath(button.dataset.path), listener);
  for (const button of cameraButtons) {
    button.addEventListener('click', () => {
      if (button.dataset.camera === 'reset') resetCamera();
      else zoomBy(button.dataset.camera === 'close' ? 1.2 : 1 / 1.2);
    }, listener);
  }

  if (ctx) {
    canvas.addEventListener('pointerdown', (event) => {
      const mouseButton = event.pointerType === 'mouse' ? event.button : null;
      if (mouseButton !== null && mouseButton !== 0 && mouseButton !== 2) return;
      canvas.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, mouseButton });
      stage.setAttribute('data-dragging', '');
    }, listener);

    canvas.addEventListener('pointermove', (event) => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      const { x, y, mouseButton } = previous;
      if (mouseButton !== null && !(event.buttons & (mouseButton === 2 ? 2 : 1))) {
        stopPointer(event);
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        return;
      }
      const dx = event.clientX - x;
      const dy = event.clientY - y;
      previous.x = event.clientX;
      previous.y = event.clientY;
      const other = mouseButton === null
        ? [...pointers].find(([id, pointer]) => id !== event.pointerId && pointer.mouseButton === null)?.[1]
        : null;
      if (other) {
        const before = Math.hypot(x - other.x, y - other.y);
        const after = Math.hypot(previous.x - other.x, previous.y - other.y);
        if (before > 10 && after > 10) zoomBy(after / before);
        pan(dx / 2, dy / 2);
      } else if (mouseButton === 2 || event.shiftKey) pan(dx, dy);
      else rotate(dx * -.009, dy * .006);
    }, listener);

    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, stopPointer, listener);

    canvas.addEventListener('contextmenu', (event) => {
      if (event.button === 2) event.preventDefault();
    }, listener);

    canvas.addEventListener('wheel', (event) => {
      if (document.activeElement !== canvas || event.ctrlKey) return;
      event.preventDefault();
      zoomBy(Math.exp(-event.deltaY * .0015));
    }, { ...listener, passive: false });

    canvas.addEventListener('keydown', (event) => {
      const change = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, 1],
        ArrowDown: [0, -1],
      }[event.key];
      if (change) {
        if (event.shiftKey) pan(change[0] * 16, change[1] * -16);
        else rotate(change[0] * .13, change[1] * .08);
      } else if (event.key === '+' || event.key === '=') zoomBy(1.16);
      else if (event.key === '-') zoomBy(1 / 1.16);
      else if (event.key === 'Home') resetCamera();
      else return;
      event.preventDefault();
    }, listener);

    if (matchMedia('(pointer: coarse)').matches) guide.textContent = 'Swipe sideways to rotate';
  } else {
    stage.setAttribute('data-fallback', '');
    canvas.hidden = true;
    stage.querySelector('.sw-terrain__camera').hidden = true;
    guide.textContent = 'Choose a concept to explore';
  }

  const sizeObserver = ctx && typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  if (sizeObserver) sizeObserver.observe(stage);
  else if (ctx) window.addEventListener('resize', resize, listener);

  setPath(pathId);
  select(selected, false);
  resize();

  return {
    select,
    updateConfidence,
    destroy() {
      controls.abort();
      sizeObserver?.disconnect();
      cancelAnimationFrame(frame);
      container.replaceChildren();
      container.classList.remove('sw-terrain');
    },
  };
}
