const concepts = {
  agi: {
    label: 'AGI',
    title: 'Artificial general intelligence',
    color: '#59e0c9',
    position: [-1.02, .29, -1.02],
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
    position: [1.05, .92, -.91],
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
    position: [-.96, .70, 1.02],
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
    position: [.99, 1.48, 1.16],
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
    label: 'General ability first',
    detail: 'Broadly superhuman performance includes broad general ability under these definitions. A single system could demonstrate both together.',
    legs: [
      { from: 'agi', to: 'asi', detail: 'Broad competence could deepen until the system outperforms top human experts across many fields.', example: 'A versatile assistant goes from helping you understand an electricity bill to consistently designing more efficient appliances than expert teams.' },
      { from: 'asi', to: 'rsi', detail: 'Teams could use a broadly superhuman system to build successors if it can do the research and has access to tools, compute, and testing.', example: 'A software team uses its strongest AI to find and test changes that make the next version of that AI more useful.' },
      compounding,
    ],
  },
  research: {
    label: 'AI research first',
    detail: 'A specialized research system could start the feedback loop before broad AGI or ASI. Broader abilities could emerge later if research gains transfer to other domains.',
    legs: [compounding],
  },
};

const conceptEntries = Object.entries(concepts);
const initialCamera = { yaw: .31, pitch: .39, zoom: 1, panX: 0, panY: 0 };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const confidenceNumber = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });

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
        ${Object.entries(paths).map(([id, path]) => `<button type="button" data-path="${id}" aria-pressed="false"><span>${path.label}<small class="sw-terrain__coverage"></small></span><strong><span data-route-score="${id}">—</span><small> / 100</small></strong></button>`).join('')}
      </div>
      <div class="sw-terrain__legend" id="terrain-legend">
        <p><span class="sw-terrain__grid-key" aria-hidden="true"></span><span><strong>Purple grid</strong> gives the scene depth. Spacing, height, and arrow length are illustrative.</span></p>
        <div class="sw-terrain__arrow-keys"><span><i aria-hidden="true"></i>Possible step</span><span><i class="sw-terrain__solid" aria-hidden="true"></i>Required by our definition</span></div>
      </div>
      <p class="sw-terrain__legend-hint">Select a dot for its definition and what it could mean in everyday life.</p>
    </div>
    <div class="sw-terrain__stage">
      <canvas class="sw-terrain__canvas" tabindex="0" aria-describedby="terrain-legend" aria-label="Rotating concept landscape. Use arrow keys to rotate, plus or minus to zoom, and Home to reset."></canvas>
      <div class="sw-terrain__markers" role="group" aria-label="Explore AI concepts">
        ${conceptEntries.map(([id, concept]) => `<button type="button" class="sw-terrain__marker" data-concept="${id}" style="--node-color:${concept.color}" aria-label="${concept.title}" aria-pressed="false"><span aria-hidden="true"></span>${concept.label}</button>`).join('')}
      </div>
      <div class="sw-terrain__guide">Drag to rotate · Shift + drag to pan</div>
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
        <p class="sw-terrain__definition"></p>
        <p class="sw-terrain__implication"></p>
        <p class="sw-terrain__example"><strong>Everyday example</strong><span></span></p>
        <p class="sw-terrain__daily"><strong>What you might notice</strong><span></span></p>
        <a target="_blank" rel="noopener noreferrer"></a>
      </div>
    </div>`;
}

const terrainLines = [];
for (let row = 0; row <= 18; row += 1) {
  const position = -2.05 + row * 4.1 / 18;
  terrainLines.push([[-2.05, -.07, position], [2.05, -.07, position]]);
  terrainLines.push([[position, -.07, -2.05], [position, -.07, 2.05]]);
}

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
  const scale = Math.min(width * .215, height * .328) * camera.zoom;
  const originX = width * .51 + camera.panX;
  const originY = height * .68 + camera.panY;

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
  const corners = [[-2.05, -.07, -2.05], [-2.05, -.07, 2.05], [2.05, -.07, 2.05], [2.05, -.07, -2.05]];
  trace(ctx, corners.map(project));
  ctx.closePath();
  const floor = ctx.createLinearGradient(0, height * .3, width, height);
  floor.addColorStop(0, 'rgba(35, 153, 165, .14)');
  floor.addColorStop(.48, 'rgba(142, 98, 252, .12)');
  floor.addColorStop(1, 'rgba(73, 37, 110, .06)');
  ctx.fillStyle = floor;
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
  trace(ctx, corners.map(project));
  ctx.closePath();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(163, 137, 239, .34)';
  ctx.stroke();
}

function paintLeg(ctx, { from: start, to: end, required }, project, active) {
  const [a, b] = [concepts[start], concepts[end]];
  const nodes = Array.from({ length: 33 }, (_, index) => {
    const t = index / 32;
    const curve = Math.sin(t * Math.PI);
    const [x, y, z] = a.position.map((value, axis) => value + (b.position[axis] - value) * t);
    return project([x, y + curve * .32, z + curve * .12]);
  });
  const [startX, startY] = nodes[0];
  const [endX, endY] = nodes.at(-1);
  if (Math.hypot(endX - startX, endY - startY) < 3) return;

  const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
  gradient.addColorStop(0, a.color);
  gradient.addColorStop(1, b.color);
  ctx.save();
  ctx.strokeStyle = gradient;
  ctx.globalAlpha = active ? .13 : .08;
  ctx.lineWidth = 6;
  trace(ctx, nodes);
  ctx.stroke();
  ctx.globalAlpha = active || required ? .95 : .65;
  ctx.lineWidth = required ? 2.2 : 1.55;
  if (!required) ctx.setLineDash([5, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  const [x, y] = nodes[21];
  const [prevX, prevY] = nodes[20];
  const angle = Math.atan2(y - prevY, x - prevX);
  ctx.translate(x, y);
  ctx.rotate(angle);
  trace(ctx, [[-5, -3.6], [0, 0], [-5, 3.6]]);
  ctx.strokeStyle = b.color;
  ctx.stroke();
  ctx.restore();
}

function paintConcept(ctx, concept, project, selected) {
  const [x, y, z] = concept.position;
  const [centerX, centerY, perspective] = project([x, y, z]);
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
  return { x: centerX, y: centerY - radius - 10 };
}

function positionMarkers(positions, markers, width, height) {
  const spacing = 8;
  const occupied = [];
  for (const point of positions) {
    const button = markers.get(point.id);
    const buttonWidth = button.offsetWidth;
    const buttonHeight = button.offsetHeight;
    const minX = buttonWidth / 2 + spacing;
    const centerX = clamp(point.x, minX, width - minX);
    let y = clamp(point.y, buttonHeight + 20, height - 50);
    const left = centerX - buttonWidth / 2;
    const right = centerX + buttonWidth / 2;
    for (const other of occupied) {
      const overlapsX = left < other.right + spacing && right > other.left - spacing;
      if (overlapsX && Math.abs(other.y - y) < buttonHeight + spacing) {
        const above = other.y - buttonHeight - spacing;
        y = above > buttonHeight + spacing ? above : other.y + buttonHeight + spacing;
      }
    }
    y = clamp(y, buttonHeight + 12, height - 45);
    button.style.left = `${centerX}px`;
    button.style.top = `${y}px`;
    occupied.push({ left, right, y });
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
  let contributionKey;

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
    for (const leg of paths[pathId].legs) {
      paintLeg(ctx, leg, project, selected === leg.from || selected === leg.to);
    }
    const sorted = [...conceptEntries].sort((a, b) => project(a[1].position)[2] - project(b[1].position)[2]);
    const positions = sorted.map(([id, concept]) => ({ id, ...paintConcept(ctx, concept, project, selected === id) }));
    positions.sort((a, b) => a.y - b.y);
    positionMarkers(positions, markerButtons, width, height);
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
    const link = explanation.querySelector('a');
    link.href = concept.source;
    link.textContent = concept.sourceName + ' ↗';
    refreshScene();
    if (notify) onSelect?.(id, concept);
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

  function updateConfidence(nextScores, { status, method } = {}) {
    scores = nextScores;
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
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      canvas.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, [event.clientX, event.clientY]);
      stage.setAttribute('data-dragging', '');
    }, listener);

    canvas.addEventListener('pointermove', (event) => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      const current = [event.clientX, event.clientY];
      const [dx, dy] = current.map((value, i) => value - previous[i]);
      pointers.set(event.pointerId, current);
      const other = [...pointers].find(([id]) => id !== event.pointerId)?.[1];
      if (other) {
        const before = Math.hypot(previous[0] - other[0], previous[1] - other[1]);
        const after = Math.hypot(current[0] - other[0], current[1] - other[1]);
        if (before > 10 && after > 10) zoomBy(after / before);
        pan(dx / 2, dy / 2);
      } else if (event.shiftKey) pan(dx, dy);
      else rotate(dx * -.009, dy * .006);
    }, listener);

    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, stopPointer, listener);

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
