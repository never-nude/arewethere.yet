import { indicatorObservations } from './observatory-forecast.js';

const series = [
  { key: 'breadth-open', label: 'Open-weight models · Epoch score', forecast: 'breadth-open' },
  { key: 'breadth-closed', label: 'Closed-weight models · Epoch score', forecast: 'breadth-closed' },
  { key: 'breadth', label: 'All models · Epoch score' },
  { key: 'reliability', label: 'Reliable task length · hours at 80% success' },
  { key: 'horizon', label: 'Difficult task length · hours at 50% success', forecast: 'task-horizon' },
  { key: 'compute', label: 'Training computation · operations', forecast: 'training-compute' },
];
const num = new Intl.NumberFormat('en', { maximumSignificantDigits: 4 });
const eci = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
const ym = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', timeZone: 'UTC' });
function number(value, unit) {
  if (unit === 'FLOP' && value !== 0) return value.toExponential(2);
  return unit === 'ECI' ? eci.format(value) : num.format(value);
}
function node(tag, text) {
  const n = document.createElement(tag);
  if (text) n.textContent = text;
  return n;
}
function mark(tag, attrs, text) {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text) n.textContent = text;
  return n;
}
export function renderTrends(root, assessment) {
  const label = node('label', 'Choose a measurement '), select = node('select');
  const rows = assessment.observations;
  const options = new Map();
  for (const entry of series) {
    const readings = entry.forecast ? indicatorObservations(rows, entry.forecast) :
      rows.filter(r => r.topic === entry.key && r.referenceOn && Number.isFinite(r.value));
    // An unlabeled historical model cannot be assigned to either access group.
    if (entry.key.startsWith('breadth-') && !readings.length) continue;
    const prediction = assessment.indicatorForecasts?.find(f => f.id === entry.forecast);
    options.set(entry.key, { ...entry, readings, prediction });
    select.add(new Option(entry.label, entry.key));
  }
  select.className = 'obs-picker';
  label.append(select);
  const fig = node('figure'), caption = node('figcaption'), chart = node('div'),
    table = node('details'), summary = node('summary', 'Monthly measurements and sources'), values = node('ul');
  fig.className = 'obs-history-plot';
  caption.id = root.id + '-caption';
  caption.setAttribute('aria-live', 'polite');
  table.className = 'obs-detail';
  table.append(summary, values);
  fig.append(chart, caption);
  root.replaceChildren(label, fig, table);
  function show() {
    const { key, label: seriesLabel, readings, prediction } = options.get(select.value);
    const months = new Map();
    for (const row of readings) {
      const month = row.referenceOn.slice(0, 7);
      const prior = months.get(month);
      if (!prior || row.value > prior.value || (row.value === prior.value && row.referenceOn < prior.referenceOn))
        months.set(month, row);
    }
    const points = [...months.values()].sort((a, b) => a.referenceOn.localeCompare(b.referenceOn));
    chart.replaceChildren();
    values.replaceChildren();
    if (!points.length) {
      caption.textContent = 'No comparable historical observations in this edition.';
      return;
    }
    const first = points[0], last = points.at(-1), unit = last.unit;
    const issued = prediction?.status === 'Issued' && Number.isFinite(prediction.centralValue);
    const band = issued && Number.isFinite(prediction.range?.low) && Number.isFinite(prediction.range?.high);
    const dateBasis = key === 'compute' ? 'publication' : 'release';
    caption.textContent = 'Each dot marks the highest measured result for a model in its ' + dateBasis + ' month. Months without a measurement are empty.';
    if (issued) {
      caption.append(' The diamond is the ' + ym.format(Date.parse(prediction.targetStart)) + ' estimate of ' +
        number(prediction.centralValue, unit) + ' ' + prediction.unit + '. ');
      if (band) caption.append('The bar shows the range based on past errors, ' + number(prediction.range.low, unit) +
        ' to ' + number(prediction.range.high, unit) + ' ' + prediction.unit + '. ');
    }
    if (prediction) {
      const a = node('a', issued ? 'How this prediction was made' : 'Why this series has no prediction');
      a.href = '#prediction-' + prediction.id;
      caption.append(' ', a);
    }
    const width = Math.max(230, Math.round(root.clientWidth || 600)), height = 205,
      left = unit === 'FLOP' ? 73 : 56, right = width - 10, top = 22, bottom = height - 35;
    // The outlook is a separate monthly target. Reserving a column keeps it legible
    // next to long histories without visually stretching the measured time axis.
    const column = issued ? 78 : 0, observedRight = right - column, estimateX = right - column / 2;
    const t0 = Date.parse(first.referenceOn), t1 = Date.parse(last.referenceOn);
    const domain = points.map(p => p.value);
    if (issued) domain.push(prediction.centralValue);
    if (band) domain.push(prediction.range.low, prediction.range.high);
    const low = Math.min(...domain), high = Math.max(...domain);
    const pad = (high - low || Math.abs(high) || 1) * 0.07;
    const min = unit === 'ECI' || low < 0 ? low - pad : 0, max = high + pad;
    const x = date => left + (t1 === t0 ? 0.5 : (Date.parse(date) - t0) / (t1 - t0)) * (observedRight - left);
    const y = v => bottom - ((bottom - top) * (v - min)) / (max - min);
    const svg = mark('svg', { width: '100%', height, viewBox: '0 0 ' + width + ' ' + height,
      role: 'img', 'aria-label': seriesLabel + ' by model ' + dateBasis + ' month.', 'aria-describedby': caption.id });
    for (const v of [min, (min + max) / 2, max])
      svg.append(mark('line', { x1: left, x2: right, y1: y(v), y2: y(v), stroke: '#51435e' }),
        mark('text', { x: left - 6, y: y(v) + 4, 'text-anchor': 'end' }, number(v, unit)));
    for (const p of points) {
      const dot = mark('circle', { cx: x(p.referenceOn), cy: y(p.value), r: 3.6, fill: '#73e8cc' });
      dot.append(mark('title', {}, p.referenceOn + ' · ' + p.system + ' · ' + number(p.value, unit) + ' ' + unit));
      svg.append(dot);
    }
    svg.append(mark('text', { x: left, y: height - 10 }, ym.format(t0)));
    if (t1 !== t0 && observedRight - left > 128)
      svg.append(mark('text', { x: observedRight, y: height - 10, 'text-anchor': 'end' }, ym.format(t1)));
    if (issued) {
      const center = y(prediction.centralValue), color = '#ffc471', split = observedRight + 8;
      svg.append(mark('line', { x1: split, x2: split, y1: top - 3, y2: bottom + 4, stroke: '#887c99', 'stroke-dasharray': '3 4' }));
      if (band) {
        const y0 = y(prediction.range.high), y1 = y(prediction.range.low);
        svg.append(mark('rect', { x: estimateX - 7, y: y0, width: 14, height: y1 - y0, fill: color, 'fill-opacity': 0.22 }),
          mark('path', { d: 'M' + (estimateX - 7) + ' ' + y0 + 'h14 M' + estimateX + ' ' + y0 + 'V' + y1 +
            ' M' + (estimateX - 7) + ' ' + y1 + 'h14', fill: 'none', stroke: color, 'stroke-width': 2 }));
      }
      const diamond = mark('path', { d: 'M' + estimateX + ' ' + (center - 6) + 'l6 6-6 6-6-6z', fill: color });
      diamond.append(mark('title', {}, 'Estimate · ' + number(prediction.centralValue, unit) + ' ' + prediction.unit));
      svg.append(diamond, mark('text', { x: estimateX, y: top - 8, 'text-anchor': 'middle' }, 'Estimate'),
        mark('text', { x: estimateX, y: height - 10, 'text-anchor': 'middle' }, ym.format(Date.parse(prediction.targetStart))));
    }
    chart.append(svg);
    for (const p of points.toReversed()) {
      const li = node('li', p.referenceOn + ' · ' + p.system + ' · ' + number(p.value, unit) + ' ' + unit + ' · ');
      const a = node('a', p.source);
      a.href = p.sourceUrl;
      li.append(a);
      values.append(li);
    }
  }
  select.onchange = show;
  show();
  let lastWidth = root.clientWidth;
  const observer = new ResizeObserver(([entry]) => {
    const w = Math.round(entry.contentRect.width);
    if (w !== lastWidth) {
      lastWidth = w;
      show();
    }
  });
  observer.observe(root);
  return () => observer.disconnect();
}
