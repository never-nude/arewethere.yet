const lanes = [
  { id: 'ideas', label: 'History of the idea', color: '#baa5fa', depth: -1.26 },
  { id: 'capability', label: 'Capability evaluations', color: '#67e4d0', depth: -.42 },
  { id: 'research', label: 'AI research', color: '#f6c484', depth: .42 },
  { id: 'latest', label: 'Latest reading', color: '#f59ccd', depth: 1.26 },
];
const laneById = new Map(lanes.map((lane) => [lane.id, lane]));
const initial = { yaw: -.23, pitch: .36, zoom: 1, x: 0, y: 0 };
const axis = { start: -2.7, end: 2.7, step: .49 };
const axisFront = lanes[0].depth - .32;
const axisBack = lanes.at(-1).depth + .13;
const handleOffsets = [[0, 0], [0, -26], [-26, 0], [26, 0], [0, 26], [-26, -26], [26, -26], [-26, 26], [26, 26]];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function shape(ctx, points) {
  ctx.beginPath();
  for (const [index, [x, y]] of points.entries()) {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
}

function projector(camera, width, height) {
  const cy = Math.cos(camera.yaw);
  const sy = Math.sin(camera.yaw);
  const cp = Math.cos(camera.pitch);
  const sp = Math.sin(camera.pitch);
  const compact = width < 380;
  const scale = Math.min(width / (compact ? 8.6 : 7.2), height / 3.95) * camera.zoom;
  const verticalScale = scale * (compact ? 1.3 : 1);
  const baseline = height * (compact ? .69 : .77);
  return ([x, y, z]) => {
    const horizontal = x * cy - z * sy;
    const depth = x * sy + z * cy;
    const vertical = y * cp + depth * sp;
    const factor = 9 / (9 + depth * cp - y * sp);
    return [width * .5 + camera.x + horizontal * scale * factor, baseline + camera.y - vertical * verticalScale * factor];
  };
}

function paintGrid(ctx, project, dateX, model, width) {
  ctx.lineWidth = 1;
  ctx.font = '10px IBM Plex Mono, monospace';
  ctx.textBaseline = 'middle';

  for (const lane of lanes) {
    const ends = [[axis.start, 0, lane.depth], [axis.end, 0, lane.depth]];
    shape(ctx, ends.map(project));
    ctx.strokeStyle = lane.color + '3e';
    ctx.stroke();
  }

  const yearLast = Number(model.lastDate.slice(0, 4));
  const labels = [{ date: model.firstDate, label: model.firstDate.slice(0, 4) }];
  const endGap = width < 380 ? 12 : 5;
  for (const year of [1980, 2000, 2020]) {
    if (yearLast - year > endGap) labels.push({ date: year + '-01-01', label: String(year) });
  }
  labels.push({ date: model.lastDate, label: String(yearLast) });
  for (const { date, label } of labels) {
    const x = dateX(date);
    shape(ctx, [[x, 0, axisFront], [x, 0, axisBack]].map(project));
    ctx.strokeStyle = '#66547c64';
    ctx.stroke();
    const [sx, sy] = project([x, 0, axisFront - .12]);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#b6a6c6';
    ctx.fillText(label, sx, sy + 12);
  }

  shape(ctx, [[axis.start, axis.step * model.total, axisFront], [axis.start, 0, axisFront],
    [axis.end, 0, axisFront], [axis.end, 0, axisBack]].map(project));
  ctx.strokeStyle = '#a78db480';
  ctx.stroke();
  for (let count = 0; count <= model.total; count += 1) {
    const [sx, sy] = project([axis.start, count * axis.step, axisFront]);
    shape(ctx, [[sx - 3, sy], [sx + 4, sy]]);
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillStyle = '#c0adc9';
    ctx.fillText(String(count), sx - 7, sy);
  }
}

function paintAxisLabels(ctx, project, total, width, height) {
  const narrow = width < 370;
  const labels = [
    [narrow ? 'X · Date' : 'X · Calendar date', [0, 0, axisFront], narrow ? 34 : 29],
    [narrow ? 'Y · Landmarks' : 'Y · Landmarks documented', [axis.start, axis.step * total, axisFront], -17],
    [narrow ? 'Z · Category' : 'Z · Evidence category', [axis.end, 0, axisBack], narrow ? 16 : -15],
  ];
  ctx.font = '600 12px Geist, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const placed = [];
  for (const [label, location, offset] of labels) {
    const [x, y] = project(location);
    if (x < 0 || x > width || y < 0 || y > height) continue;
    const halfWidth = ctx.measureText(label).width / 2 + 6;
    const center = clamp(x, halfWidth + 5, width - halfWidth - 5);
    const line = clamp(y + offset, 13, height - 13);
    if (placed.some(([px, py, span]) => Math.abs(py - line) < 22 && Math.abs(px - center) < span + halfWidth)) continue;
    placed.push([center, line, halfWidth]);
    ctx.fillStyle = '#231830';
    ctx.fillRect(center - halfWidth, line - 9, halfWidth * 2, 18);
    ctx.fillStyle = '#ecdefb';
    ctx.fillText(label, center, line + 1);
  }
}

function paintTrace(ctx, project, points, selected, currentX) {
  if (points.length) {
    shape(ctx, points.map(({ world }) => project(world)));
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#cfadf5';
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (!selected) {
    shape(ctx, [[currentX, 0, axisFront], [currentX, 0, axisBack]].map(project));
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#f3c9fc';
    ctx.stroke();
  }
  for (const point of points) {
    const [x, y, z] = point.world;
    const lane = laneById.get(point.lane);
    if (y > 0) {
      shape(ctx, [[x, 0, z], point.world].map(project));
      ctx.lineWidth = 1;
      ctx.strokeStyle = lane.color + '48';
      ctx.stroke();
    }
    const [px, py] = project(point.world);
    ctx.beginPath();
    ctx.arc(px, py, point.id === selected?.id ? 6 : 3, 0, Math.PI * 2);
    ctx.fillStyle = lane.color;
    ctx.fill();
  }
}

export function mountHistoricTerrain(container, onSelect) {
  container.innerHTML = `
    <div class="hist-plot__top">
      <div><h4>History in 3D</h4><p>Move across dates and look up to see how many evidence landmarks were documented by then. Each lane at a different depth groups events by category. The dashed path connects events in date order.</p></div>
      <div class="hist-plot__actions" role="group" aria-label="Historical 3D view controls">
        <button class="calendar-step" type="button" data-hist-action="out" aria-label="Zoom out of history">−</button>
        <button class="calendar-step" type="button" data-hist-action="in" aria-label="Zoom into history">+</button>
        <button class="calendar-step" type="button" data-hist-action="reset">Reset view</button>
      </div>
    </div>
    <dl class="hist-plot__coordinates" id="history-plot-coordinates">
      <div><dt>X · Calendar date</dt><dd data-hist-time></dd></div>
      <div><dt>Y · Landmarks documented</dt><dd data-hist-count></dd></div>
      <div><dt>Z · Evidence category</dt><dd data-hist-lane></dd></div>
    </dl>
    <div class="hist-plot__stage">
      <canvas tabindex="0" aria-describedby="history-plot-coordinates" aria-label="3D history plot. Arrow keys rotate. Shift with arrow keys pans. Plus and minus zoom. Home resets the view."></canvas>
      <div class="hist-plot__points" role="group" aria-label="Select a dated point"></div>
    </div>
    <div class="hist-plot__legend">
      <ul aria-label="Evidence categories">
        ${lanes.map(({ label, color }) => `<li style="--hist-point:${color}">${label}</li>`).join('')}
      </ul>
      <span data-hist-hint>Left-drag rotates · Right-drag pans</span>
    </div>`;

  const stage = container.querySelector('.hist-plot__stage');
  const canvas = stage.querySelector('canvas');
  const overlay = stage.querySelector('.hist-plot__points');
  const time = container.querySelector('[data-hist-time]');
  const count = container.querySelector('[data-hist-count]');
  const lane = container.querySelector('[data-hist-lane]');
  const hint = container.querySelector('[data-hist-hint]');
  const actions = container.querySelector('.hist-plot__actions');
  const camera = { ...initial };
  const buttons = new Map();
  const pointers = new Map();
  let width = 0;
  let height = 0;
  let frame = 0;
  let model;
  let ctx;
  try { ctx = canvas.getContext('2d', { alpha: false }); } catch {}
  if (!ctx) {
    stage.hidden = true;
    actions.hidden = true;
    hint.textContent = 'Select a dated event below to explore its coordinates.';
  } else if (matchMedia('(pointer: coarse)').matches) {
    hint.textContent = 'Swipe sideways to rotate · Pinch to zoom';
  }

  function refresh() {
    if (ctx && !frame) frame = requestAnimationFrame(draw);
  }

  function draw() {
    frame = 0;
    if (!model || !width || !height) return;
    const from = Date.parse(model.firstDate);
    const through = Date.parse(model.lastDate);
    const dateX = (date) => axis.start + clamp((Date.parse(date) - from) / (through - from || 1), 0, 1) * (axis.end - axis.start);
    const project = projector(camera, width, height);
    const points = model.points.map((point) => ({
      ...point,
      world: [dateX(point.date), point.count * axis.step, laneById.get(point.lane).depth],
    }));
    const selected = points.find(({ id }) => id === model.selectedId);
    ctx.fillStyle = '#110e1c';
    ctx.fillRect(0, 0, width, height);
    const fog = ctx.createRadialGradient(width * .57, height * .46, 0, width * .57, height * .46, width * .55);
    fog.addColorStop(0, '#3d285d66');
    fog.addColorStop(1, '#3d285d00');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, width, height);
    paintGrid(ctx, project, dateX, model, width);
    paintTrace(ctx, project, points, selected, dateX(model.selectedDate));
    paintAxisLabels(ctx, project, model.total, width, height);
    const occupied = [];
    const newestFirst = [...points].reverse();
    if (selected) {
      newestFirst.splice(newestFirst.indexOf(selected), 1);
      newestFirst.unshift(selected);
    }
    const inView = ([x, y]) => x >= 12 && x <= width - 12 && y >= 12 && y <= height - 12;
    const separated = ([x, y]) => occupied.every(([ox, oy]) => Math.hypot(x - ox, y - oy) >= 24);
    for (const point of newestFirst) {
      const [x, y] = project(point.world);
      const button = buttons.get(point.id);
      button.hidden = !inView([x, y]);
      if (button.hidden) continue;
      const [hx, hy] = handleOffsets.map(([dx, dy]) => [x + dx, y + dy])
        .find((candidate) => inView(candidate) && separated(candidate)) ?? [x, y];
      button.style.left = hx + 'px';
      button.style.top = hy + 'px';
      const captionHalfWidth = point.label.length * 2.9 + 6;
      const captionOffset = width < 380 ? clamp(hx, captionHalfWidth, width - captionHalfWidth) - hx : 0;
      button.style.setProperty('--hist-caption-offset', captionOffset + 'px');
      button.dataset.crowded = String(occupied.some(([ox, oy]) => Math.abs(hx - ox) < 54 && Math.abs(hy - oy) < 18));
      occupied.push([hx, hy]);
      if (hx !== x || hy !== y) {
        shape(ctx, [[x, y], [hx, hy]]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = laneById.get(point.lane).color + '84';
        ctx.stroke();
      }
    }
  }

  function resize() {
    if (!ctx) return;
    width = stage.clientWidth;
    height = stage.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    refresh();
  }

  function zoom(factor) {
    camera.zoom = clamp(camera.zoom * factor, .64, 2.5);
    refresh();
  }

  function reset() {
    Object.assign(camera, initial);
    refresh();
  }

  function pan(dx, dy) {
    camera.x = clamp(camera.x + dx, -width * .48, width * .48);
    camera.y = clamp(camera.y + dy, -height * .48, height * .48);
    refresh();
  }

  function rotate(dx, dy) {
    camera.yaw = (camera.yaw + dx) % (Math.PI * 2);
    camera.pitch = clamp(camera.pitch + dy, .12, 1.08);
    refresh();
  }

  function stopPointer({ pointerId }) {
    pointers.delete(pointerId);
    if (!pointers.size) stage.removeAttribute('data-dragging');
  }

  if (ctx) {
    actions.addEventListener('click', (event) => {
      const choice = event.target.closest('[data-hist-action]')?.dataset.histAction;
      if (choice === 'reset') reset();
      if (choice === 'in' || choice === 'out') zoom(choice === 'in' ? 1.2 : 1 / 1.2);
    });
    canvas.addEventListener('pointerdown', (event) => {
      const mouseButton = event.pointerType === 'mouse' ? event.button : null;
      if (mouseButton !== null && mouseButton !== 0 && mouseButton !== 2) return;
      canvas.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, mouseButton });
      stage.setAttribute('data-dragging', '');
    });
    canvas.addEventListener('pointermove', (event) => {
      const pointer = pointers.get(event.pointerId);
      if (!pointer) return;
      const { x, y, mouseButton } = pointer;
      if (mouseButton !== null && !(event.buttons & (mouseButton === 2 ? 2 : 1))) {
        stopPointer(event);
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        return;
      }
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      const dx = pointer.x - x;
      const dy = pointer.y - y;
      const other = mouseButton === null
        ? [...pointers.values()].find((candidate) => candidate !== pointer && candidate.mouseButton === null)
        : null;
      if (other) {
        const before = Math.hypot(x - other.x, y - other.y);
        const after = Math.hypot(pointer.x - other.x, pointer.y - other.y);
        if (before > 10 && after > 10) zoom(after / before);
        pan(dx / 2, dy / 2);
      } else if (mouseButton === 2 || event.shiftKey) pan(dx, dy);
      else rotate(dx * -.008, dy * .0055);
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, stopPointer);
    canvas.addEventListener('contextmenu', (event) => {
      if (event.button === 2) event.preventDefault();
    });
    canvas.addEventListener('wheel', (event) => {
      if (document.activeElement !== canvas || event.ctrlKey) return;
      event.preventDefault();
      zoom(Math.exp(-event.deltaY * .0015));
    }, { passive: false });
    canvas.addEventListener('keydown', (event) => {
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (direction) {
        const [dx, dy] = direction;
        if (event.shiftKey) pan(dx * 16, dy * 16);
        else rotate(dx * .13, dy * -.08);
      } else if (event.key === 'Home') reset();
      else if (event.key === '+' || event.key === '=') zoom(1.2);
      else if (event.key === '-') zoom(1 / 1.2);
      else return;
      event.preventDefault();
    });
    if (typeof ResizeObserver === 'function') new ResizeObserver(resize).observe(stage);
    else window.addEventListener('resize', resize);
    resize();
  }

  return {
    update(next) {
      model = next;
      const selected = model.points.find(({ id }) => id === model.selectedId);
      time.textContent = model.dateLabel;
      count.textContent = model.count + ' of ' + model.total + ' documented';
      lane.textContent = selected ? laneById.get(selected.lane).label : 'Between points';
      if (!ctx) return;
      for (const [id, button] of buttons) {
        if (!model.points.some((point) => point.id === id)) {
          button.remove();
          buttons.delete(id);
        }
      }
      for (const point of model.points) {
        let button = buttons.get(point.id);
        if (!button) {
          button = document.createElement('button');
          button.type = 'button';
          button.style.setProperty('--hist-point', laneById.get(point.lane).color);
          button.addEventListener('click', () => onSelect(point.id));
          const label = document.createElement('span');
          button.append(label);
          overlay.append(button);
          buttons.set(point.id, button);
        }
        button.firstChild.textContent = point.label;
        button.title = point.title;
        button.setAttribute('aria-label', point.label + '. ' + point.title + ', ' + point.when + ', ' + point.count + ' documented landmarks');
        button.setAttribute('aria-pressed', String(point.id === selected?.id));
        button.dataset.latest = String(point.lane === 'latest');
      }
      refresh();
    },
  };
}
