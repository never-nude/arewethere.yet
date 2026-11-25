const labels = {
  breadth: 'Broad capability · Epoch score',
  reliability: 'Reliable task length · hours at 80% success',
  horizon: 'Difficult task length · hours at 50% success',
};
const num = new Intl.NumberFormat('en', { maximumSignificantDigits: 3 });
const ym = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', timeZone: 'UTC' });
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
  const label = node('label', 'Compare historical measurements '),
    select = node('select');
  select.className = 'obs-picker';
  for (const [key, name] of Object.entries(labels)) select.add(new Option(name, key));
  label.append(select);
  const fig = node('figure'),
    caption = node('figcaption'),
    chart = node('div'),
    table = node('details'),
    summary = node('summary', 'Monthly measurements and sources'),
    values = node('ul');
  fig.className = 'obs-history-plot';
  table.className = 'obs-detail';
  table.append(summary, values);
  fig.append(chart, caption);
  root.replaceChildren(label, fig, table);
  function show() {
    const data = assessment.observations.filter(
      (r) => r.topic === select.value && r.referenceOn && Number.isFinite(r.value),
    );
    const months = new Map();
    for (const r of data) {
      const key = r.referenceOn.slice(0, 7);
      if (!months.has(key) || months.get(key).value < r.value) months.set(key, r);
    }
    const points = [...months.values()].sort((a, b) => a.referenceOn.localeCompare(b.referenceOn));
    values.replaceChildren();
    chart.replaceChildren();
    if (!points.length) {
      caption.textContent = 'No comparable historical observations in this edition.';
      return;
    }
    const first = points[0],
      last = points.at(-1);
    caption.textContent =
      'Each dot is the highest published result for a model released that month. The systems can differ. Months with no measurements are left empty. Source revisions can change the reconstructed series.';
    const width = Math.max(230, Math.round(root.clientWidth || 600)),
      height = 196,
      left = 45,
      right = width - 14,
      top = 16,
      bottom = height - 39;
    const t0 = Date.parse(first.referenceOn),
      t1 = Date.parse(last.referenceOn),
      max = Math.max(1, ...points.map((p) => p.value)) * 1.08;
    const x = (r) => left + ((Date.parse(r.referenceOn) - t0) / Math.max(1, t1 - t0)) * (right - left);
    const y = (v) => bottom - ((bottom - top) * v) / max;
    const svg = mark('svg', {
      width: '100%',
      height,
      viewBox: '0 0 ' + width + ' ' + height,
      role: 'img',
      'aria-label': labels[select.value] + ' by model release month. Full measurements in the list below.',
    });
    for (const v of [0, max / 2, max])
      svg.append(
        mark('line', { x1: left, x2: right, y1: y(v), y2: y(v), stroke: '#51435e' }),
        mark('text', { x: left - 6, y: y(v) + 4, 'text-anchor': 'end' }, num.format(v)),
      );
    for (const p of points) {
      const dot = mark('circle', { cx: x(p), cy: y(p.value), r: 3.6, fill: '#73e8cc' });
      dot.append(mark('title', {}, p.referenceOn + ' · ' + p.system + ' · ' + num.format(p.value) + ' ' + p.unit));
      svg.append(dot);
    }
    svg.append(mark('text', { x: left, y: height - 11 }, ym.format(t0)));
    if (t1 !== t0) svg.append(mark('text', { x: right, y: height - 11, 'text-anchor': 'end' }, ym.format(t1)));
    chart.append(svg);
    for (const p of points.toReversed()) {
      const li = node('li', p.referenceOn + ' · ' + p.system + ' · ' + num.format(p.value) + ' ' + p.unit + ' · ');
      const a = node('a', p.source);
      a.href = p.sourceUrl;
      li.append(a);
      values.append(li);
    }
  }
  select.onchange = show;
  show();
  const observer = new ResizeObserver((entries) => {
    const w = Math.round(entries[0].contentRect.width);
    if (w !== lastWidth) {
      lastWidth = w;
      show();
    }
  });
  let lastWidth = root.clientWidth;
  observer.observe(root);
  return () => observer.disconnect();
}
