// Smaller graphics for the visual front page: the speed gauge, the dial icons
// and the square-by-square pictures. The ladder lives in clock-charts.js.
import {svg} from './clock-charts.js';

// Today's speed sits at the top of the dial. Slower fills the left half and
// faster the right, up to the most the dials can add up to.
export const gaugeTop = 3.5;
export const gaugeShare = speed => {
  const value = Math.min(gaugeTop, Math.max(0, speed));
  return value <= 1 ? value / 2 : 0.5 + (value - 1) / (gaugeTop - 1) / 2;
};

export function drawGauge(host) {
  const cx = 130, cy = 140, r = 96;
  const at = (share, radius) => {
    const angle = Math.PI * (1 - share);
    return [cx + radius * Math.cos(angle), cy - radius * Math.sin(angle)];
  };
  const root = svg('svg', {class: 'gauge-svg', viewBox: '0 0 260 170', role: 'img', 'aria-label': 'Speed of progress'});
  const arc = 'M' + (cx - r) + ' ' + cy + 'A' + r + ' ' + r + ' 0 0 1 ' + (cx + r) + ' ' + cy;
  root.append(svg('path', {class: 'gauge-track', d: arc}));
  const fill = svg('path', {class: 'gauge-fill', d: arc, pathLength: 100, 'stroke-dasharray': '50 100'});
  root.append(fill);
  for (const [speed, name, anchor] of [[0, 'stopped', 'start'], [0.5, 'half', 'end'], [1, 'today', 'middle'], [2, '2×', 'start'], [gaugeTop, gaugeTop + '×', 'end']]) {
    const share = gaugeShare(speed), [x1, y1] = at(share, r + 9), [x2, y2] = at(share, r + 15), [tx, ty] = at(share, r + 26);
    root.append(svg('line', {class: 'gauge-tick' + (speed === 1 ? ' is-today' : ''), x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1)}));
    const edge = speed === 0 || speed === gaugeTop;
    root.append(svg('text', {
      class: 'gauge-name', x: edge ? (speed ? cx + r + 6 : cx - r - 6).toFixed(1) : tx.toFixed(1), y: edge ? cy + 20 : (ty + 4).toFixed(1),
      'text-anchor': edge ? anchor : speed === 1 ? 'middle' : share < 0.5 ? 'end' : 'start',
    }, name));
  }
  const needle = svg('g', {class: 'gauge-needle'});
  needle.append(svg('line', {x1: cx, y1: cy, x2: cx, y2: cy - r + 18}), svg('circle', {cx, cy, r: 7}));
  root.append(needle);
  host.replaceChildren(root);
  return {
    set(speed) {
      const share = gaugeShare(speed);
      fill.setAttribute('stroke-dasharray', (share * 100).toFixed(2) + ' 100');
      needle.style.transform = 'rotate(' + (share * 180 - 90).toFixed(2) + 'deg)';
      root.setAttribute('aria-label', 'Speed of progress: ' + Math.round(speed * 100) + '% of today’s');
    },
  };
}

const iconPaths = {
  build: 'M3 21h18M5 21V8l7-4v17M12 11l7 3v7M8.5 10.5v.01M8.5 14v.01M8.5 17.5v.01M15.5 16v.01M15.5 19v.01',
  chips: 'M8 8h8v8H8zM10 4v4M14 4v4M10 16v4M14 16v4M4 10h4M4 14h4M16 10h4M16 14h4',
  money: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM14.6 9.4c-.5-.9-1.4-1.4-2.6-1.4c-1.5 0-2.6.8-2.6 2s1 1.7 2.6 2s2.6.8 2.6 2s-1.1 2-2.6 2c-1.2 0-2.2-.5-2.7-1.4M12 6.4V8M12 16v1.6',
  power: 'M13 2.5L5.5 13.5H11L10 21.5l8-11.5h-5.6z',
  ideas: 'M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.7 10.7c.7.6 1.1 1.3 1.2 2.3h5c.1-1 .5-1.7 1.2-2.3A6 6 0 0 0 12 3z',
  self: 'M19.5 12a7.5 7.5 0 1 1-2.4-5.5M19.5 4.5V9H15',
  pause: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM10 8.5v7M14 8.5v7',
};

export function dialIcon(id) {
  const root = svg('svg', {class: 'dial-icon', viewBox: '0 0 24 24', width: 24, height: 24, 'aria-hidden': 'true'});
  root.append(svg('path', {d: iconPaths[id] ?? iconPaths.ideas}));
  return root;
}

// One square for each unit. A switch moves between the two readings, and the
// squares that differ are the ones that stand out.
export function drawSquares(host, {before, after, unit}) {
  const low = Math.min(before.value, after.value), high = Math.max(before.value, after.value);
  const total = Math.max(100, Math.ceil(high));
  const grid = document.createElement('div');
  grid.className = 'squares';
  grid.setAttribute('role', 'img');
  const cells = Array.from({length: total}, (_, index) => {
    const cell = document.createElement('i');
    cell.style.setProperty('--n', index);
    if (index >= low && index < high) cell.dataset.gap = '';
    grid.append(cell);
    return cell;
  });
  host.replaceChildren(grid);
  return {
    show(reading) {
      const lit = Math.round(reading.value);
      cells.forEach((cell, index) => cell.classList.toggle('is-on', index < lit));
      grid.dataset.state = reading === after ? 'after' : 'before';
      grid.setAttribute('aria-label', reading.label + ': ' + reading.text + ' ' + unit + '.');
    },
  };
}
