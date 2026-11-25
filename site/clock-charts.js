// The ladder chart for the visual front page. It is drawn at the real pixel
// width of its container, so labels keep their size on a phone.
import {approxWhen, monthYear, plainHours, rangeWhen} from './clock-model.js';

const ns = 'http://www.w3.org/2000/svg';

export function svg(tag, attrs = {}, text) {
  const node = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attrs)) if (value !== null && value !== undefined) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

const fixed = value => Number(value.toFixed(1));

// A long system name is cut to the room beside its dot, so it never runs off the chart.
const fitName = (name, room, size) => {
  const most = Math.max(8, Math.floor(room / (size * 0.6)));
  return name.length > most ? name.slice(0, most - 1).trimEnd() + '…' : name;
};

// Each label is drawn twice. The copy underneath is the colour of the page and
// slightly swollen, so a line passing behind never cuts through the words.
function label(group, attrs, parts) {
  for (const halo of [true, false]) {
    const text = svg('text', {...attrs, class: attrs.class + (halo ? ' is-halo' : ''), 'aria-hidden': halo ? 'true' : null});
    for (const [content, extra = {}] of parts) text.append(svg('tspan', extra, content));
    group.append(text);
  }
}

export function drawLadder(host, ladder, {width, now, animate = false}) {
  const compact = width < 720;
  const height = compact ? 440 : Math.round(Math.min(620, Math.max(500, width * 0.5)));
  const margin = compact ? {top: 36, right: 10, bottom: 32, left: 10} : {top: 38, right: 24, bottom: 36, left: 196};
  const innerW = width - margin.left - margin.right, innerH = height - margin.top - margin.bottom;
  const left = margin.left, right = width - margin.right, top = margin.top, bottom = height - margin.bottom;
  const {from, reach, low, high} = ladder.domain;
  // Leave room to the right of the furthest marker for the date beside it.
  const room = Math.min(0.34, (compact ? 96 : 168) / innerW);
  const until = (reach - room * from) / (1 - room);
  const x = time => left + (time - from) / (until - from) * innerW;
  const logLow = Math.log(low), logHigh = Math.log(high);
  const y = hours => top + (logHigh - Math.log(Math.min(Math.max(hours, low), high))) / (logHigh - logLow) * innerH;
  const {points, record, first, stops, trend, band} = ladder;
  // On a phone, two unreached rungs can sit too close together to carry every
  // label. The note and the further date then give way. The tooltip keeps both.
  const ahead = stops.filter(stop => stop.status !== 'reached');
  const roomy = !compact || ahead.length < 2 || y(ahead[0].hours) - y(ahead[1].hours) >= 60;

  const root = svg('svg', {
    class: 'ladder-svg' + (animate ? ' is-first' : ''), viewBox: '0 0 ' + width + ' ' + height, width, height,
    role: 'img', 'aria-label': ladder.summary,
  });
  const defs = svg('defs');
  const clip = (id, x0, x1) => {
    const path = svg('clipPath', {id});
    path.append(svg('rect', {x: fixed(x0), y: top, width: fixed(Math.max(0, x1 - x0)), height: innerH}));
    defs.append(path);
    return 'url(#' + id + ')';
  };
  root.append(defs);

  // Rungs. On a wide screen their names sit in a gutter beside a route line that
  // fills up to the present record. On a phone the names move inside the plot and
  // read down the right edge as a checklist, which leaves the left to the record.
  const rungLayer = svg('g', {class: 'rungs'});
  for (const stop of stops) {
    const line = y(stop.hours);
    rungLayer.append(svg('line', {class: 'rung is-' + stop.status, x1: left, x2: right, y1: fixed(line), y2: fixed(line)}));
    if (compact) {
      rungLayer.append(svg('text', {class: 'rung-name is-' + stop.status, x: right, y: fixed(line - 7), 'text-anchor': 'end'},
        stop.name + (stop.status === 'reached' ? ' ✓' : '')));
      if (stop.status === 'next' && roomy) rungLayer.append(svg('text', {class: 'rung-note', x: right, y: fixed(line - 25), 'text-anchor': 'end'}, 'Next stop'));
    } else {
      const text = svg('text', {class: 'rung-name is-' + stop.status, x: left - 44, y: fixed(line + (stop.status === 'next' ? -1 : 5)), 'text-anchor': 'end'}, stop.name);
      rungLayer.append(text);
      if (stop.status === 'next') rungLayer.append(svg('text', {class: 'rung-note', x: left - 44, y: fixed(line + 17), 'text-anchor': 'end'}, 'next stop'));
    }
  }
  root.append(rungLayer);

  if (!compact) {
    const route = svg('g', {class: 'route'}), axis = left - 22;
    const done = y(record.hours);
    route.append(svg('line', {class: 'route-ahead', x1: axis, x2: axis, y1: fixed(y(stops.at(-1).hours)), y2: fixed(done)}));
    route.append(svg('line', {class: 'route-done', x1: axis, x2: axis, y1: fixed(done), y2: fixed(y(stops[0].hours))}));
    for (const stop of stops) {
      const cy = fixed(y(stop.hours));
      if (stop.status === 'reached') {
        route.append(svg('circle', {class: 'node is-reached', cx: axis, cy, r: 7}));
        route.append(svg('path', {class: 'node-check', d: 'M' + (axis - 3.2) + ' ' + cy + 'l2.3 2.4 4.2-4.8'}));
      } else {
        route.append(svg('circle', {class: 'node is-' + stop.status, cx: axis, cy, r: stop.status === 'next' ? 7 : 5}));
      }
    }
    root.append(route);
  }

  // Year marks along the bottom.
  const years = svg('g', {class: 'years'});
  for (let year = new Date(from).getUTCFullYear() + 1; Date.UTC(year, 0, 1) < until; year++) {
    const at = x(Date.UTC(year, 0, 1));
    if (at < left + 14 || at > right - 14) continue;
    years.append(svg('line', {class: 'year-tick', x1: fixed(at), x2: fixed(at), y1: bottom, y2: bottom + 5}));
    years.append(svg('text', {class: 'year-name', x: fixed(at), y: bottom + 22, 'text-anchor': 'middle'}, String(year)));
  }
  root.append(years);

  const items = [];
  if (trend) {
    const future = svg('g', {class: 'future' + (trend.supported ? '' : ' is-untested')});
    const origin = trend.origin, tested = trend.testedUntil ?? origin;
    const end = stops.at(-1).when ?? until;
    const path = (start, stop, slope) => {
      // Sampled, so a straight-line trend still draws correctly on the ladder's scale.
      const steps = 48, parts = [];
      for (let i = 0; i <= steps; i++) {
        const time = start + (stop - start) * i / steps;
        parts.push((i ? 'L' : 'M') + fixed(x(time)) + ' ' + fixed(y(ladder.hoursAt(time, slope))));
      }
      return parts.join('');
    };
    if (band) {
      const shape = path(origin, until, band.fast) + path(until, origin, band.slow).replace('M', 'L') + 'Z';
      if (tested > origin) future.append(svg('path', {class: 'spread is-tested', d: shape, 'clip-path': clip('ladder-tested', x(origin), x(tested))}));
      future.append(svg('path', {class: 'spread', d: shape, 'clip-path': clip('ladder-beyond', x(tested), right)}));
    }
    future.append(svg('path', {class: 'pace is-past', d: path(first.time, origin)}));
    if (tested > origin) future.append(svg('path', {class: 'pace is-tested', d: path(origin, Math.min(tested, end))}));
    if (end > tested) future.append(svg('path', {class: 'pace', d: path(tested, end)}));
    root.append(future);
  }

  if (now > from && now < until) {
    const at = fixed(x(now));
    const here = svg('g', {class: 'here'});
    here.append(svg('line', {x1: at, x2: at, y1: top - 6, y2: bottom}));
    here.append(svg('text', {x: Math.min(Math.max(at, left + 44), right - 44), y: top - 14, 'text-anchor': 'middle'}, 'We are here'));
    root.append(here);
    if (ladder.today) items.push({kind: 'today', x: x(now), y: y(ladder.today.hours), hours: ladder.today.hours});
  }

  const measured = svg('g', {class: 'measured'});
  measured.append(svg('path', {
    class: 'climb', pathLength: 1,
    d: points.map((point, i) => (i ? 'L' : 'M') + fixed(x(point.time)) + ' ' + fixed(y(point.hours))).join(''),
  }));
  points.forEach((point, index) => {
    const cx = x(point.time), cy = y(point.hours), leading = point === record;
    measured.append(svg('circle', {
      class: 'dot' + (leading ? ' is-record' : ''), cx: fixed(cx), cy: fixed(cy), r: leading ? (compact ? 6.5 : 7.5) : compact ? 4.5 : 5,
      style: '--i:' + index,
    }));
    items.push({kind: 'point', x: cx, y: cy, point});
  });
  root.append(measured);

  if (trend) {
    const marks = svg('g', {class: 'crossings'});
    for (const stop of stops) {
      if (stop.status === 'reached' || !(stop.when || stop.due)) continue;
      const time = stop.when ?? now, cx = x(time), cy = y(stop.hours);
      marks.append(svg('circle', {class: 'crossing' + (stop.tested ? ' is-tested' : ''), cx: fixed(cx), cy: fixed(cy), r: compact ? 5.5 : 6}));
      const when = stop.when && !stop.due ? approxWhen(stop.when, now) : null;
      // No halo here. These dates sit on the wash, where an outline shows as a smudge.
      if (roomy || stop.status === 'next') marks.append(svg('text', {class: 'crossing-name', x: fixed(cx + 10), y: fixed(cy + 18)},
        when ? (compact ? when : 'around ' + when) : 'due any day'));
      items.push({kind: 'crossing', x: cx, y: cy, stop});
    }
    root.append(marks);
  }

  // Two direct labels only: where the climb began and where it stands.
  const names = svg('g', {class: 'names'});
  const cx = x(record.time), cy = y(record.hours), system = {class: 'point-system'};
  if (compact) {
    const at = fixed(cx - 11);
    label(names, {class: 'point-name', x: at, y: fixed(cy - 30), 'text-anchor': 'end'},
      [[fitName(record.system, cx - 11 - left, 13), {...system, x: at}], [plainHours(record.hours), {x: at, dy: 17}]]);
  } else {
    const reading = ', ' + plainHours(record.hours);
    label(names, {class: 'point-name', x: fixed(cx - 13), y: fixed(cy - 14), 'text-anchor': 'end'},
      [[fitName(record.system, cx - 13 - left - reading.length * 8, 14), system], [reading]]);
  }
  if (first !== record) {
    const from = x(first.time) + 10, reading = ', ' + plainHours(first.hours);
    label(names, {class: 'point-name', x: fixed(from), y: fixed(y(first.hours) + 21)},
      [[fitName(first.system, right - from - reading.length * 8, 14), system], [reading]]);
  }
  root.append(names);

  const cross = svg('g', {class: 'crosshair', hidden: ''});
  const hair = svg('line', {y1: top, y2: bottom}), ring = svg('circle', {r: 10});
  cross.append(hair, ring);
  root.append(cross);

  host.replaceChildren(root);
  items.sort((a, b) => a.x - b.x);
  return {
    items, height,
    nearest: px => items.reduce((best, item) => Math.abs(item.x - px) < Math.abs(best.x - px) ? item : best),
    mark(item) {
      if (!item) { cross.setAttribute('hidden', ''); return; }
      cross.removeAttribute('hidden');
      hair.setAttribute('x1', fixed(item.x)); hair.setAttribute('x2', fixed(item.x));
      ring.setAttribute('cx', fixed(item.x)); ring.setAttribute('cy', fixed(item.y));
    },
  };
}

// The same readings as rows, for people who would rather read than point.
export function ladderRows(ladder, now) {
  const rows = ladder.points.map(point => [monthYear(point.time), point.system, plainHours(point.hours), 'Measured', '']);
  for (const stop of ladder.stops) {
    if (stop.status === 'reached' || !(stop.when || stop.due)) continue;
    rows.push(stop.due
      ? ['Due any day', stop.name, plainHours(stop.hours), 'The pace says so. Not measured yet', '']
      : ['Around ' + approxWhen(stop.when, now), stop.name, plainHours(stop.hours),
        stop.tested ? 'If the pace holds' : 'If the pace holds, beyond the tested range',
        stop.earliest && stop.latest ? rangeWhen(stop.earliest, stop.latest) : '']);
  }
  return rows;
}
