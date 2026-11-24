const dayMs = 86_400_000;
const month = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const year = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', timeZone: 'UTC' });
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const axisFont = 'font: 600 12px Geist, sans-serif; fill: #ecdefb';
const plotTop = 29;
const plotBottomInset = 39;

function svgFrame(width, height, body, label) {
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">${body}</svg>`;
}

function plottedValues(frames, x, y) {
  let move = true;
  return frames.map((frame, index) => {
    if (!Number.isFinite(frame.score)) {
      move = true;
      return '';
    }
    const point = `${move ? 'M' : 'L'}${x(index).toFixed(2)},${y(frame.score).toFixed(2)}`;
    move = false;
    return point;
  }).join(' ');
}

function grid(width, height, lower, upper, ticks, xStart, y, bottomLabels, watch) {
  const rules = ticks.filter((tick) => tick >= lower && tick <= upper).map((tick) =>
    `<line class="guide-line" x1="${xStart}" x2="${width - 9}" y1="${y(tick)}" y2="${y(tick)}"/><text x="${xStart - 6}" y="${y(tick) + 4}" text-anchor="end">${tick}</text>`);
  const floor = bottomLabels.map(([x, label, anchor]) =>
    `<text x="${x}" y="${height - 21}" text-anchor="${anchor}">${label}</text>`);
  if (!Number.isFinite(watch) || watch < lower || watch > upper) return [...rules, ...floor].join('');
  const watchY = y(watch);
  return [...rules, ...floor,
    `<line class="watch-line" x1="${xStart}" x2="${width - 9}" y1="${watchY}" y2="${watchY}" stroke-dasharray="4 4"/><text class="watch-label" x="${width - 12}" y="${watchY - 5}" text-anchor="end">${watch} WATCH LINE</text>`,
  ].join('');
}

function indexAxes(width, height) {
  return `<text x="6" y="13" style="${axisFont}">Y · Evidence index (0–100 points)</text>
    <text x="${width / 2}" y="${height - 3}" text-anchor="middle" style="${axisFont}">X · Date (UTC)</text>`;
}

function makeSize(container) {
  const width = Math.max(256, container.clientWidth);
  return { width, height: Math.max(168, Math.min(262, Math.round(innerWidth * .23))), start: 32, end: width - 9 };
}

export function historyPlot(container, frames, selected, watch, onSelect) {
  const { width, height, start, end } = makeSize(container);
  if (!frames.length) return;
  const frameCount = Math.max(1, frames.length - 1);
  const values = frames.map((frame) => frame.score).filter(Number.isFinite);
  const lower = Math.max(0, Math.floor((Math.min(watch, ...values) - 8) / 10) * 10);
  const upper = Math.min(100, Math.max(80, Math.ceil((Math.max(watch, ...values) + 5) / 10) * 10));
  const x = (index) => start + index / frameCount * (end - start);
  const bottom = height - plotBottomInset;
  const y = (score) => bottom - (score - lower) / (upper - lower) * (bottom - plotTop);
  const dates = [...new Set([0, Math.floor(frameCount / 2), frames.length - 1])]
    .map((index) => [x(index), month.format(new Date(frames[index].date)), index === 0 ? 'start' : index === frameCount ? 'end' : 'middle']);
  const ticks = Array.from({ length: 11 }, (_, i) => i * 10)
    .filter((tick) => tick === lower || tick === upper || upper - lower < 55 || tick % 20 === 0);
  const path = plottedValues(frames, x, y);
  const frame = frames[selected];
  const selectedX = x(selected);
  const mark = Number.isFinite(frame?.score)
    ? `<line class="cursor-line" x1="${selectedX}" x2="${selectedX}" y1="${plotTop}" y2="${bottom}" opacity=".55"/><circle cx="${selectedX}" cy="${y(frame.score)}" r="4" fill="#8bf6dd" stroke="#1a1627" stroke-width="2"/>`
    : '';
  const markers = frames.map((day, i) => day.events.length && Number.isFinite(day.score)
    ? `<circle cx="${x(i)}" cy="${y(day.score)}" r="2.1" fill="#e8d7ff" opacity=".8"/>` : '').join('');
  container.innerHTML = svgFrame(width, height, `
    ${grid(width, height, lower, upper, ticks, start, y, dates, watch)}
    ${indexAxes(width, height)}
    <path class="data-line" d="${path}" fill="none" stroke-width="2.4" stroke-linejoin="round"/>
    ${markers}${mark}
    <rect class="plot-hit" x="${start}" y="${plotTop}" width="${end - start}" height="${bottom - plotTop}" fill="transparent"/>
  `, `Observed evidence index in points by date (UTC). The vertical scale shows ${lower} to ${upper} points out of 100. Use the replay slider to move between dates.`)
    + '<p class="small-note">The vertical scale adjusts to show the selected readings and the watch line.</p>';
  container.onpointerup = (event) => {
    if (!event.target.classList.contains('plot-hit')) return;
    const rect = event.target.getBoundingClientRect();
    const position = (event.clientX - rect.left) / rect.width;
    onSelect(Math.max(0, Math.min(frames.length - 1, Math.round(position * frameCount))));
  };
}

export function scenarioPlot(container, index, pace, crossing) {
  const { width, height, start, end } = makeSize(container);
  if (!Number.isFinite(index.score)) return;
  const bottom = height - plotBottomInset;
  const y = (score) => bottom - score / 100 * (bottom - plotTop);
  const x = (atMonth) => start + (end - start) * atMonth / 60;
  const startDate = Date.parse(index.date);
  const date = (atMonth) => new Date(startDate + Math.round(atMonth * 30.4375) * dayMs);
  const dates = [0, 24, 60].map((atMonth, i) => [x(atMonth), year.format(date(atMonth)), ['start', 'middle', 'end'][i]]);
  const path = Array.from({ length: 61 }, (_, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(Math.min(100, Math.max(0, index.score + pace * i))).toFixed(2)}`).join(' ');
  const markX = crossing?.days != null ? x(crossing.days / 30.4375) : -1;
  const mark = markX >= start && markX <= end
    ? `<line class="cursor-line" x1="${markX}" x2="${markX}" y1="${y(index.threshold.target)}" y2="${bottom}" stroke-dasharray="3 3"/>
    <circle cx="${markX}" cy="${y(index.threshold.target)}" r="5" fill="#7ae7cd" stroke="#1a1627" stroke-width="2"/>
    <text class="marker-label" x="${markX + (markX > width * .65 ? -7 : 7)}" y="${y(index.threshold.target) + 18}" text-anchor="${markX > width * .65 ? 'end' : 'start'}">${month.format(new Date(crossing.date))}</text>`
    : '';
  container.innerHTML = svgFrame(width, height, `
    ${grid(width, height, 0, 100, [0, 25, 50, 100], start, y, dates, index.threshold.target)}
    ${indexAxes(width, height)}
    <path class="trend-line" d="${path}" fill="none" stroke-width="2.4" stroke-dasharray="5 4" stroke-linecap="round"/>
    <circle cx="${start}" cy="${y(index.score)}" r="3.5" fill="#d3bbff"/>${mark}
  `, 'Evidence index in points out of 100 by date (UTC). The dot shows the latest observed reading. The dashed line shows a five-year scenario at the selected pace.')
    + '<p class="small-note">The dot shows the latest observation. The dashed line shows how the index would move at the pace you choose.</p>';
}

export function factorPlot(container, values, label) {
  const observed = values.filter(Number.isFinite);
  if (observed.length < 2 || Math.max(...observed) === Math.min(...observed)) {
    container.hidden = true;
    return;
  }
  const min = Math.min(...observed);
  const max = Math.max(...observed);
  const points = values.map((score) => ({ score }));
  const path = plottedValues(points, (i) => 38 + i / (values.length - 1) * 218, (value) => 64 - (value - min) / (max - min) * 40);
  container.hidden = false;
  container.innerHTML = svgFrame(260, 87, `
    <text x="1" y="13" style="${axisFont}">Y · Index points from this signal</text>
    <text x="34" y="28" text-anchor="end" style="${axisFont}">${number.format(max)}</text>
    <text x="34" y="68" text-anchor="end" style="${axisFont}">${number.format(min)}</text>
    <line x1="38" y1="24" x2="256" y2="24" stroke="#544768"/>
    <line x1="38" y1="64" x2="256" y2="64" stroke="#544768"/>
    <text x="130" y="84" text-anchor="middle" style="${axisFont}">X · Last ${values.length} days</text>
    <path d="${path}" stroke="#c5adff" stroke-width="2" fill="none"/>
  `, `Index points from this signal over the last ${values.length} days. The vertical scale fits the observed values, ${number.format(min)} to ${number.format(max)} points.`);
  container.setAttribute('title', label);
}
