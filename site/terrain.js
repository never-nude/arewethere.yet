import { describeAgiInputs } from './relationship-map.js';

const concepts = {
  agi: {
    label: 'AGI',
    title: 'Artificial general intelligence',
    color: '#59e0c9',
    description: 'An AI system that consistently performs at least as well as skilled people across a wide, representative range of unfamiliar tasks.',
    implication: 'Across the same broad range of tasks, a system that outperforms leading experts also meets the skilled-human standard for AGI. One evaluation could establish both milestones together.',
    example: 'Imagine one assistant that can help with a lease, tutor a teenager, plan an accessible trip, and pick up a new kind of task from a few instructions.',
    daily: 'More people could hand off routine paperwork, planning, and basic troubleshooting to one tool. Teachers, clinicians, and other specialists would still be responsible for consequential decisions.',
    source: 'https://research.google/pubs/levels-of-agi-operationalizing-progress-on-the-path-to-agi/',
    sourceName: 'Levels of AGI',
  },
  asi: {
    label: 'ASI',
    title: 'Artificial superintelligence',
    color: '#b69bff',
    description: 'An AI system that consistently outperforms leading human experts across a wide, representative range of unfamiliar tasks.',
    implication: 'A chess win establishes superhuman performance on one task. Establishing ASI would require similarly strong results across many fields. Human-led engineering or repeated AI-led improvements could help achieve that. Self-awareness is a separate question.',
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
    implication: 'The loop could start with a research specialist before AGI, with a broadly capable system before ASI, or after ASI. Each round depends on usable ideas, computing power, and ways to check that the changes worked.',
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
    implication: 'The watch requires evidence of reliable workday-length autonomy, repeated end-to-end research, and accelerating gains across AI generations that can be traced to AI-led research. Those tests apply regardless of when AGI or ASI is confirmed.',
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
  detail: 'The feedback loop must make successive AI generations improve faster. A loop can keep producing better systems at a steady or slowing pace and still fall short of this milestone.',
  example: 'A tool improves the next version, and each new version saves the team more time than the one before it.',
};

const paths = {
  breadth: {
    label: 'Broad skills first',
    intro: 'Broadly capable AI reaches ASI before it starts improving its successors.',
    detail: 'In this example, AI reaches skilled human performance across many fields, then outperforms leading experts before a repeatable research loop starts. Evidence for AGI and ASI could arrive together, and the loop could also start between them.',
    legs: [
      { from: 'agi', to: 'asi', detail: 'Across the same broad range of tasks, ASI meets the skilled-human threshold for AGI and exceeds the level of leading human experts. A single evaluation could establish both thresholds together.', example: 'A versatile assistant might first match skilled workers at a broad mix of tasks and later outperform leading experts at that same mix.' },
      { from: 'asi', to: 'rsi', detail: 'Teams could use a broadly superhuman system to build successors if it can do the research and has access to tools, compute, and testing.', example: 'A software team uses its strongest AI to find and test changes that make the next version of that AI more useful.' },
      compounding,
    ],
  },
  research: {
    label: 'Research specialist first',
    intro: 'AI starts improving its successors while its other skills are still narrow.',
    detail: 'A research specialist could start a loop that improves successive AI systems before reaching AGI. The loop could stay narrow. Reaching AGI and ASI along this route would require gains that carry over to many kinds of work.',
    legs: [compounding],
  },
};

const conceptEntries = ['singularity', 'rsi', 'asi', 'agi'].map((id) => [id, concepts[id]]);
const initialCamera = { yaw: -.85, pitch: .35, zoom: 1, panX: 0, panY: 0 };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const confidenceNumber = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
const axes = [
  { id: 'x', label: 'Range of skills', endLabel: 'Many fields', levels: ['No minimum', 'Many kinds of work'], color: '#82dbe5' },
  { id: 'y', label: 'AI builds better AI', endLabel: 'Faster each round', levels: ['No loop required', 'Repeated improvement', 'Faster gains each generation'], color: '#ffc78f' },
  { id: 'z', label: 'Skill vs. people', endLabel: 'Above experts', levels: ['No minimum', 'Matches skilled people', 'Beats leading experts'], color: '#d1b2ff' },
];
// Requirements on the three shared scales, in X, Y, Z order.
const requirements = {
  agi: [1, 0, 1],
  asi: [1, 0, 2],
  rsi: [0, 1, 0],
  singularity: [0, 2, 0],
};
const relationships = {
  agi: 'AGI and ASI both cover many kinds of work. AGI sets the bar at skilled human performance.',
  asi: 'ASI covers the same broad range as AGI and sets a higher bar on those tasks.',
  rsi: 'A research specialist can help build a better successor, which can then improve the next one.',
  singularity: 'The same loop must produce faster gains across successive AI generations.',
};
const plotEdge = 1.3;
const lowerCorner = axes.map(() => -plotEdge);
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
    <div class="sw-terrain__toolbar" id="terrain-routes">
      <div class="sw-terrain__confidence-head"><h3>Evidence for two example routes</h3><span class="sw-terrain__confidence-status">Waiting for evidence</span></div>
      <div class="sw-terrain__path-buttons" role="group" aria-label="Choose an example sequence">
        ${Object.entries(paths).map(([id, path]) => `<button type="button" data-path="${id}" aria-pressed="false"><span><b>${path.label}</b><span class="sw-terrain__route-intro">${path.intro}</span><small class="sw-terrain__coverage"></small></span><strong><span data-route-score="${id}">—</span><small> / 100</small></strong></button>`).join('')}
      </div>
      <p class="sw-terrain__route-note">Each score totals weighted evidence points for the example shown. <a class="evidence-jump" href="#milestone-order">See which milestones can happen first.</a></p>
    </div>
    <div class="sw-terrain__stage">
      <canvas class="sw-terrain__canvas" tabindex="0" aria-describedby="terrain-position-key terrain-arrow-key" aria-label="Interactive 3D map of milestone requirements. Height shows the research feedback loop required. Use arrow keys to rotate, Shift and arrow keys to pan, plus or minus to zoom, and Home to reset."></canvas>
      <button type="button" class="sw-terrain__orbit" data-camera="orbit">Start orbit</button>
      <div class="sw-terrain__markers" role="group" aria-label="Explore AI concepts">
        ${conceptEntries.map(([id, concept]) => `<button type="button" class="sw-terrain__marker" data-concept="${id}" style="--node-color:${concept.color}" aria-label="${concept.label}, ${concept.title}" aria-pressed="false"><span aria-hidden="true"></span>${concept.label}</button>`).join('')}
      </div>
      <div class="sw-terrain__guide"><span>Left-drag to rotate · Right-drag or Shift-drag to pan</span><span class="sw-terrain__touch-guide">Swipe across to rotate. Use two fingers to pan or zoom.</span></div>
      <div class="sw-terrain__camera" role="group" aria-label="View controls">
        <button type="button" data-camera="far" aria-label="Zoom out" title="Zoom out">−</button>
        <button type="button" data-camera="close" aria-label="Zoom in" title="Zoom in">+</button>
        <button type="button" data-camera="reset" class="sw-terrain__reset" aria-label="Reset view" title="Reset view">Reset</button>
      </div>
    </div>
    <div class="sw-terrain__base-note"><h3>At the base · Evidence leading toward AGI</h3><p>Look for skilled human-level results on unfamiliar tasks across many fields, alongside reliable independent work.</p><p data-agi-inputs>${describeAgiInputs([])}</p><a href="#agi">Inspect AGI evidence</a></div>
    <div class="sw-terrain__chart-key">
      <div class="sw-terrain__position-key">
        <h2>What <span data-selected-concept>the Singularity</span> requires</h2>
        <p id="terrain-position-key">Height shows the research loop each milestone requires. AGI and ASI sit at the base because either could be achieved through human-led research. The floor axes show the breadth and skill each requires. The Singularity sits highest because it requires sustained acceleration.</p>
        <dl class="sw-terrain__axis-readings" aria-live="polite" aria-atomic="true">
          ${axes.map(({ id, label, color }) => `<div data-axis="${id}" style="--axis-color:${color}"><dt><b>${id.toUpperCase()}</b> ${label}</dt><dd></dd></div>`).join('')}
        </dl>
        <p class="sw-terrain__relationship"></p>
        <a class="sw-terrain__detail-jump evidence-jump" href="#terrain-concept">Definition and measurements ↓</a>
      </div>
      <div class="sw-terrain__arrow-key">
        <h2>Arrow fill · evidence for each step</h2>
        <p id="terrain-arrow-key">Arrows show possible orders. The bright part shows how many of 100 evidence points each step earned.</p>
        <ul class="sw-terrain__arrow-readings" aria-label="Evidence scores for the steps shown"></ul>
        <a class="evidence-jump" href="#terrain-routes">See what earns points</a>
      </div>
    </div>
    <div class="sw-terrain__legend">
      <div class="sw-terrain__arrow-keys"><span><i aria-hidden="true"></i>Possible step</span><span><i class="sw-terrain__solid" aria-hidden="true"></i>Required by our definition</span><span><i class="sw-terrain__filled" aria-hidden="true"></i>Evidence score</span></div>
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
      <div class="sw-terrain__concept" id="terrain-concept" aria-live="polite" aria-atomic="true">
        <p class="sw-terrain__overline">Selected concept</p>
        <h3></h3>
        <div class="sw-terrain__coordinates" hidden>
          <h4>What we measure</h4>
          <p>Each test earns points under this milestone’s scoring rules. Checks that still need evidence show as pending.</p>
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

const terrainLines = ticks.flatMap((tick) => {
  const position = plotValue(tick);
  return [
    [[-plotEdge, -plotEdge, position], [plotEdge, -plotEdge, position]],
    [[position, -plotEdge, -plotEdge], [position, -plotEdge, plotEdge]],
  ];
});

const stars = Array.from({ length: 96 }, (_, index) => ({
  x: ((index * 73 + 23) % 193) / 193,
  y: ((index * 107 + 19) % 179) / 179,
  size: index % 17 === 0 ? 1.2 : .55,
  color: index % 7 === 0 ? '#84f7df' : '#cbb9f0',
  opacity: .09 + (index % 9) * .033,
}));

function createProjector(camera, width, height) {
  const cosYaw = Math.cos(camera.yaw);
  const sinYaw = Math.sin(camera.yaw);
  const cosPitch = Math.cos(camera.pitch);
  const sinPitch = Math.sin(camera.pitch);
  const scale = Math.min(width * .196, height * .215) * camera.zoom;
  const originX = width * .51 + camera.panX;
  const originY = height * .48 + camera.panY;

  return ([x, y, z]) => {
    const horizontal = x * cosYaw - z * sinYaw;
    const depth = x * sinYaw + z * cosYaw;
    const vertical = y * cosPitch + depth * sinPitch;
    const distance = 7 + depth * cosPitch - y * sinPitch;
    const perspective = 7 / distance;
    return [originX + horizontal * scale * perspective, originY - vertical * scale * perspective, perspective];
  };
}

function paintBackground(ctx, width, height, yaw) {
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  for (const star of stars) {
    ctx.fillStyle = star.color;
    ctx.globalAlpha = star.opacity;
    ctx.beginPath();
    ctx.arc(star.x * width + Math.sin(yaw + star.y * 2) * 11, star.y * height, star.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function trace(ctx, points) {
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
}

function paintGround(ctx, project) {
  ctx.save();
  ctx.lineWidth = .9;
  ctx.setLineDash([2, 4]);
  for (const line of terrainLines) {
    const points = line.map(project);
    const [from, to] = points;
    const mesh = ctx.createLinearGradient(from[0], from[1], to[0], to[1]);
    mesh.addColorStop(0, '#a88dec00');
    mesh.addColorStop(.32, '#9db3f16d');
    mesh.addColorStop(.68, '#7ad8ca62');
    mesh.addColorStop(1, '#7ad8ca00');
    ctx.strokeStyle = mesh;
    trace(ctx, points);
    ctx.stroke();
  }
  ctx.restore();
}

function paintAxes(ctx, project, width, height) {
  ctx.save();
  const labelBounds = [];
  const [originX, originY] = project(lowerCorner);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  for (const [index, axis] of axes.entries()) {
    const at = (percent) => project(lowerCorner.map((value, dimension) => dimension === index ? plotValue(percent) : value));
    const [endX, endY] = at(100);
    const dx = endX - originX;
    const dy = endY - originY;
    const length = Math.hypot(dx, dy);
    if (length < 12) continue;
    const normal = [-dy / length * 3, dx / length * 3];
    const side = index === 1 ? -1 : Math.sign(dx) || 1;
    ctx.strokeStyle = axis.color;
    ctx.fillStyle = axis.color;
    ctx.lineWidth = 1.45;
    trace(ctx, [[originX, originY], [endX, endY]]);
    ctx.stroke();
    for (let level = 1; level < axis.levels.length; level += 1) {
      const [x, y] = at(100 * level / (axis.levels.length - 1));
      trace(ctx, [[x - normal[0], y - normal[1]], [x + normal[0], y + normal[1]]]);
      ctx.stroke();
    }
    ctx.font = '600 11px system-ui, sans-serif';
    const compact = width < 520;
    const name = compact ? ['Range', 'Research loop', 'Skill'][index] : `${axis.id.toUpperCase()} · ${axis.label}`;
    const textWidth = compact ? ctx.measureText(name).width : Math.max(ctx.measureText(name).width, ctx.measureText(axis.endLabel).width);
    const labelX = endX + side * (textWidth / 2 + 14);
    const boundedX = clamp(index === 1 ? endX : labelX, textWidth / 2 + 8, width - textWidth / 2 - 8);
    if (endX >= 0 && endX <= width && endY >= 0 && endY <= height) {
      const labelY = clamp(endY + (index === 1 ? -26 : 12), 16, height - 33);
      ctx.strokeStyle = '#130e24';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.strokeText(name, boundedX, labelY);
      ctx.fillText(name, boundedX, labelY);
      if (!compact) {
        ctx.font = '11px system-ui, sans-serif';
        ctx.strokeText(axis.endLabel, boundedX, labelY + 13);
        ctx.fillText(axis.endLabel, boundedX, labelY + 13);
      }
      labelBounds.push({ left: boundedX - textWidth / 2, right: boundedX + textWidth / 2, top: labelY - 7, bottom: labelY + (compact ? 7 : 20) });
    }
  }

  ctx.restore();
  return labelBounds;
}

function paintCoordinateGuides(ctx, project, point) {
  if (!point) return;
  const onFloor = [point[0], lowerCorner[1], point[2]];
  const [floorX, floorY] = project(onFloor);
  ctx.save();
  ctx.lineWidth = 1;
  for (const [index, axis] of axes.entries()) {
    const endpoint = [...lowerCorner];
    endpoint[index] = point[index];
    const [x, y] = project(endpoint);
    ctx.strokeStyle = axis.color + '86';
    ctx.fillStyle = axis.color;
    ctx.setLineDash([2, 5]);
    if (axis.id === 'y') {
      if (point[index] > lowerCorner[index]) trace(ctx, [project(point), [floorX, floorY]]);
      else ctx.beginPath();
    } else {
      trace(ctx, [[floorX, floorY], [x, y]]);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 2.3, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.restore();
}

function routeCurve([startX, startY], [endX, endY], required) {
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.hypot(dx, dy);
  const lift = (required ? 53 : 28) + Math.min(distance * .22, 20);
  const spread = Math.max(0, 19 - distance * .6);
  const a = [startX, startY];
  const b = [startX + dx * .29 - spread, startY + dy * .20 - lift];
  const c = [endX - dx * .29 + spread, endY - dy * .20 - lift];
  const d = [endX, endY];
  return Array.from({ length: 33 }, (_, index) => {
    const t = index / 32;
    const u = 1 - t;
    return a.map((value, axis) => u ** 3 * value + 3 * u ** 2 * t * b[axis] + 3 * u * t ** 2 * c[axis] + t ** 3 * d[axis]);
  });
}

function pathDistance(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function pathSlice(points, distance) {
  const result = [points[0]];
  for (let index = 1; index < points.length && distance > 0; index += 1) {
    const before = points[index - 1];
    const after = points[index];
    const span = pathDistance(before, after);
    const ratio = span ? Math.min(1, distance / span) : 1;
    result.push(before.map((value, axis) => value + (after[axis] - value) * ratio));
    distance -= span;
  }
  return result;
}

function paintLeg(ctx, { from: start, to: end, required }, positions, project, active, score) {
  if (!positions.has(start) || !positions.has(end)) return;
  const [a, b] = [concepts[start], concepts[end]];
  const startPoint = project(positions.get(start));
  const endPoint = project(positions.get(end));
  const [startX, startY] = startPoint;
  const points = routeCurve(startPoint, endPoint, required);
  const length = points.slice(1).reduce((sum, point, index) => sum + pathDistance(points[index], point), 0);

  ctx.save();
  ctx.strokeStyle = required ? '#ded2f3' : '#c0b1d6';
  ctx.globalAlpha = active ? .79 : .56;
  ctx.lineWidth = required ? 1.8 : 1.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (!required) ctx.setLineDash([4, 5]);
  trace(ctx, points);
  ctx.stroke();
  ctx.setLineDash([]);

  const fraction = Number.isFinite(score) ? clamp(score / 100, 0, 1) : 0;
  if (fraction > 0) {
    const highlight = pathSlice(points, length * fraction);
    const [highlightX, highlightY] = highlight.at(-1);
    const gradient = ctx.createLinearGradient(startX, startY, highlightX === startX && highlightY === startY ? startX + 1 : highlightX, highlightY);
    gradient.addColorStop(0, a.color);
    gradient.addColorStop(1, b.color);
    ctx.strokeStyle = gradient;
    ctx.globalAlpha = active ? .25 : .15;
    ctx.lineWidth = 8;
    trace(ctx, highlight);
    ctx.stroke();
    ctx.globalAlpha = active ? 1 : .85;
    ctx.lineWidth = 2.8;
    ctx.stroke();
  }

  const arrow = pathSlice(points, length * .72);
  const [x, y] = arrow.at(-1);
  const [beforeX, beforeY] = arrow.at(-2);
  const angle = Math.atan2(y - beforeY, x - beforeX);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = b.color;
  ctx.lineWidth = 1.7;
  trace(ctx, [[x - 6 * Math.cos(angle - .5), y - 6 * Math.sin(angle - .5)], [x, y],
    [x - 6 * Math.cos(angle + .5), y - 6 * Math.sin(angle + .5)]]);
  ctx.stroke();
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

function positionMarkers(ctx, positions, markers, width, height, axisLabels) {
  const spacing = 6;
  const occupied = [...axisLabels];
  let previousTop = -Infinity;
  for (const point of positions) {
    const button = markers.get(point.id);
    const buttonWidth = button.offsetWidth;
    const buttonHeight = button.offsetHeight;
    const halfWidth = buttonWidth / 2;
    const place = (dx, dy) => {
      const x = clamp(point.x + dx, halfWidth + spacing, width - halfWidth - spacing);
      const bottom = clamp(point.y + dy, buttonHeight + 49, height - 56);
      return { x, left: x - halfWidth, right: x + halfWidth, top: bottom - buttonHeight, bottom };
    };
    const below = point === positions.at(-1) && point.y > height / 2;
    const near = below ? buttonHeight + 13 : -13;
    const far = below ? -13 : buttonHeight + 13;
    const clear = (candidate) => occupied.every((other) =>
      candidate.right + spacing < other.left || candidate.left - spacing > other.right ||
      candidate.bottom + spacing <= other.top || candidate.top - spacing >= other.bottom);
    const baseline = place(0, near);
    let label = null;
    let bestCost = Infinity;
    for (const dy of [near, far, near - 12, near + 12, near - 28, near + 28, near - 52, near + 52, near - 92, near + 92]) {
      for (const dx of [0, -12, 12, -28, 28, -halfWidth - 16, halfWidth + 16, -buttonWidth, buttonWidth]) {
        const candidate = place(dx, dy);
        const cost = Math.hypot(candidate.x - baseline.x, candidate.top - baseline.top) + (candidate.top < previousTop + 10 ? height : 0);
        if (cost < bestCost && clear(candidate)) {
          bestCost = cost;
          label = candidate;
        }
      }
    }
    label ??= baseline;
    previousTop = label.top;
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

export function renderTerrain(container, { mode = 'breadth', onSelect, stageMount } = {}) {
  container.classList.add('sw-terrain');
  container.innerHTML = sceneMarkup();
  const stage = container.querySelector('.sw-terrain__stage');
  const chartKey = container.querySelector('.sw-terrain__chart-key');
  const baseNote = container.querySelector('.sw-terrain__base-note');
  if (stageMount) {
    stageMount.classList.add('sw-terrain');
    stageMount.replaceChildren(stage, baseNote, chartKey);
  }
  const axisReadings = [...chartKey.querySelectorAll('[data-axis] dd')];
  const arrowReadings = chartKey.querySelector('.sw-terrain__arrow-readings');
  const canvas = stage.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const markerButtons = new Map([...stage.querySelectorAll('[data-concept]')].map((button) => [button.dataset.concept, button]));
  const cameraButtons = stage.querySelectorAll('[data-camera]');
  const orbitButton = stage.querySelector('[data-camera="orbit"]');
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
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
  const scenePoints = new Map(Object.entries(requirements).map(([id, levels]) => [id,
    levels.map((level, index) => plotValue(100 * level / (axes[index].levels.length - 1)))]));
  let contributionKey;
  let coordinateKey;
  let arrowKey;
  let orbitEnabled = false;
  let lastOrbitFrame = null;
  let hoveredMarker = null;
  let inView = typeof IntersectionObserver !== 'function';

  function refreshScene() {
    if (!ctx) return;
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function draw(timestamp) {
    frame = 0;
    if (!width || !height) return;
    const orbiting = orbitEnabled && inView && !document.hidden && !hoveredMarker;
    if (orbiting && lastOrbitFrame != null) {
      const elapsed = timestamp - lastOrbitFrame;
      if (elapsed < 32) {
        refreshScene();
        return;
      }
      camera.yaw = (camera.yaw + Math.min(elapsed, 50) * .00024) % (Math.PI * 2);
    }
    lastOrbitFrame = orbiting ? timestamp : null;
    const project = createProjector(camera, width, height);
    paintBackground(ctx, width, height, camera.yaw);
    paintGround(ctx, project);
    const axisLabels = paintAxes(ctx, project, width, height);
    if (orbiting) refreshScene();
    paintCoordinateGuides(ctx, project, scenePoints.get(selected));
    const steps = scores?.[pathId]?.steps ?? [];
    for (const leg of paths[pathId].legs) {
      const step = steps.find(({ from, to }) => from === leg.from && to === leg.to);
      paintLeg(ctx, leg, scenePoints, project, selected === leg.from || selected === leg.to, step?.score);
    }
    const projected = [...scenePoints].map(([id, point]) => ({ id, screen: project(point) }));
    projected.sort((a, b) => Number(a.id === selected) - Number(b.id === selected) || a.screen[2] - b.screen[2]);
    for (const { id, screen } of projected) paintConcept(ctx, concepts[id], screen, id === selected);
    const labels = projected.map(({ id, screen: [x, y] }) => ({ id, x, y })).sort((a, b) => a.y - b.y);
    positionMarkers(ctx, labels, markerButtons, width, height, axisLabels);
  }

  function setOrbit(enabled) {
    orbitEnabled = enabled;
    lastOrbitFrame = null;
    orbitButton.textContent = enabled ? 'Pause orbit' : 'Start orbit';
    orbitButton.toggleAttribute('data-active', enabled);
    refreshScene();
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
    chartKey.querySelector('[data-selected-concept]').textContent = id === 'singularity' ? 'the Singularity' : concept.label;
    requirements[id].forEach((level, index) => { axisReadings[index].textContent = axes[index].levels[level]; });
    chartKey.querySelector('.sw-terrain__relationship').textContent = relationships[id];
    renderMeasurements();
    renderVerdict();
    refreshScene();
    if (notify) onSelect?.(id, concept);
  }

  function renderMeasurements() {
    const reading = milestoneEvidence?.[selected];
    coordinates.hidden = !reading;
    const key = JSON.stringify([selected, reading]);
    if (key === coordinateKey) return;
    coordinateKey = key;
    if (!reading) return;

    const rows = reading.map((criterion) => {
      const item = node('li');
      const heading = node('div', 'sw-terrain__coordinate-heading');
      const available = confidenceNumber.format(criterion.weight);
      const credit = criterion.points == null ? `Pending · ${available} pts` :
        `${confidenceNumber.format(criterion.points)} / ${available} pts`;
      heading.append(node('strong', '', criterion.label), node('span', '', credit));
      item.append(heading);
      const value = Number.isFinite(criterion.rawValue) ? confidenceNumber.format(criterion.rawValue) + (criterion.unit ?? '').replace(/^[a-z]/i, ' $&') : '';
      if (value) item.append(node('p', '', 'Measured ' + value));
      if (criterion.detail) item.append(node('p', '', criterion.detail));
      if (criterion.sourceUrl?.startsWith('https://') && criterion.source) {
        const source = node('a', 'sw-terrain__coordinate-source', criterion.source + ' ↗');
        source.href = criterion.sourceUrl;
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
    const readings = paths[pathId].legs.map(({ from, to }) => {
      const step = route?.steps.find((item) => item.from === from && item.to === to);
      return [concepts[from].label + ' → ' + concepts[to].label, step?.score];
    });
    const readingKey = JSON.stringify(readings);
    if (readingKey !== arrowKey) {
      arrowKey = readingKey;
      arrowReadings.replaceChildren(...readings.map(([label, score]) => {
        const item = node('li');
        item.append(node('span', '', label), node('strong', '', score == null ? 'Awaiting evidence' : `${confidenceNumber.format(score)} / 100`));
        return item;
      }));
    }
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
      baseNote.querySelector('[data-agi-inputs]').textContent = describeAgiInputs(evidence.agi ?? []);
      renderMeasurements();
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
  for (const [id, button] of markerButtons) {
    button.addEventListener('click', () => {
      if (ctx) setOrbit(false);
      select(id);
    }, listener);
    button.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'mouse') return;
      hoveredMarker = button;
      refreshScene();
    }, listener);
    button.addEventListener('pointerleave', () => {
      if (hoveredMarker !== button) return;
      hoveredMarker = null;
      refreshScene();
    }, listener);
    button.addEventListener('focus', () => {
      if (ctx && orbitEnabled) setOrbit(false);
    }, listener);
  }
  for (const button of pathButtons) button.addEventListener('click', () => setPath(button.dataset.path), listener);
  for (const button of cameraButtons) {
    button.addEventListener('click', () => {
      if (button.dataset.camera === 'orbit') {
        setOrbit(!orbitEnabled);
        return;
      }
      setOrbit(false);
      if (button.dataset.camera === 'reset') resetCamera();
      else zoomBy(button.dataset.camera === 'close' ? 1.2 : 1 / 1.2);
    }, listener);
  }

  if (ctx) {
    canvas.addEventListener('pointerdown', (event) => {
      const mouseButton = event.pointerType === 'mouse' ? event.button : null;
      if (mouseButton !== null && mouseButton !== 0 && mouseButton !== 2) return;
      setOrbit(false);
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
      setOrbit(false);
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
      setOrbit(false);
      event.preventDefault();
    }, listener);

    motionPreference.addEventListener('change', (event) => {
      if (event.matches) setOrbit(false);
    }, listener);
    document.addEventListener('visibilitychange', () => {
      lastOrbitFrame = null;
      refreshScene();
    }, listener);
    if (matchMedia('(pointer: coarse)').matches) guide.textContent = 'Swipe sideways to rotate';
    setOrbit(false);
  } else {
    stage.setAttribute('data-fallback', '');
    canvas.hidden = true;
    stage.querySelector('.sw-terrain__camera').hidden = true;
    orbitButton.hidden = true;
    guide.textContent = 'Choose a concept to explore';
  }

  const viewObserver = ctx && typeof IntersectionObserver === 'function' ? new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    lastOrbitFrame = null;
    refreshScene();
  }) : null;
  if (viewObserver) viewObserver.observe(stage);
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
      viewObserver?.disconnect();
      sizeObserver?.disconnect();
      cancelAnimationFrame(frame);
      if (stageMount) {
        stage.remove();
        baseNote.remove();
        chartKey.remove();
        stageMount.classList.remove('sw-terrain');
      }
      container.replaceChildren();
      container.classList.remove('sw-terrain');
    },
  };
}
