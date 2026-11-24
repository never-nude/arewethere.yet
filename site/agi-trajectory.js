const dayMs = 86_400_000;
const lookback = 180;
const horizon = 90;
const newsLookback = 60;
const marketUrl = 'https://manifold.markets/RemNi/will-we-get-agi-before-2030';
const epochUrl = 'https://epoch.ai/eci';
const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const fullDate = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
});
const shortDate = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', timeZone: 'UTC',
});
const rendered = new WeakMap();

function timeOf(value) {
  const time = Date.parse(typeof value === 'string' ? value.slice(0, 10) : '');
  return Number.isFinite(time) ? time : null;
}

function secureUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function newsReading(event) {
  const text = [event.title, event.summary].join(' ');
  if (event.category === 'Release') return null;
  if (event.source === 'METR' && event.category === 'Evaluation' && /capabilit|time horizon/i.test(text)) {
    return ['Independent evaluation', 'Longer task horizons support progress in autonomy. The measurement ranges show how uncertain the size of that progress can be.'];
  }
  if (event.source === 'METR' && /risks from automated r&d/i.test(event.title)) {
    return ['Independent review', 'The reviewers found that the early-warning judgment depended on how researchers interpreted an uncertain trend.'];
  }
  if (event.source === 'METR' && /investigate evidence of acceleration/i.test(event.title)) {
    return ['Evaluation method', 'A plan for testing whether AI is speeding up research and separating that effect from changes in staffing, resources, or measurement.'];
  }
  if (event.source === 'METR' && /assesses ai research acceleration/i.test(event.title)) {
    return ['Independent assessment', 'One lab’s measured gains help explain why research acceleration is worth watching. Three plausible explanations are AI assistance, greater inputs, and changing evaluation conditions.'];
  }
  if (/perplexity and intelligence/i.test(event.title)) {
    return ['Measurement context', 'This proposes another way to compare model progress and helps explain why estimates can vary across metrics.'];
  }
  if (/jagged frontier|uneven progress|limitations|regression/i.test(text) && /capabilit|task|research/i.test(text)) {
    return ['Qualifies the trend', 'Performance varies by task and setting. A single overall score can hide those gaps.'];
  }
  if (event.category === 'Evaluation' && /benchmark|capabilit|generaliz|performance|autonom/i.test(text)) {
    return ['Related evaluation', 'The findings provide another check on how widely recent capability gains apply.'];
  }
  return null;
}

export function getAgiTrajectory(dataset, liveForecast) {
  const metrics = dataset?.metrics ?? [];
  const breadth = metrics.find((metric) => metric.id === 'breadth');
  const saved = metrics.find((metric) => metric.id === 'forecast');
  const market = !saved?.closed && Number.isFinite(liveForecast?.value ?? saved?.value)
    ? {
      value: liveForecast?.value ?? saved.value,
      publishedAt: timeOf(liveForecast?.observedAt ?? saved?.asOf),
      url: secureUrl(liveForecast?.sourceUrl ?? saved?.sourceUrl) ?? marketUrl,
    } : null;
  const points = (breadth?.history ?? []).flatMap((item) => {
    const time = timeOf(item.date);
    return time !== null && Number.isFinite(item.value) ? [{ ...item, time }] : [];
  }).sort((a, b) => a.time - b.time || a.value - b.value);
  const asOf = timeOf(dataset?.checkedAt) ?? points.at(-1)?.time;
  const available = points.filter((point) => point.time <= asOf);
  const latest = available.at(-1);
  const start = asOf - lookback * dayMs;
  const baseline = available.findLast((point) => point.time <= start);
  const recent = available.filter((point) => point.time > start);
  const change = baseline && recent.length ? latest.value - baseline.value : null;
  const projection = change === null ? null : {
    time: asOf + horizon * dayMs,
    value: latest.value + change * horizon / lookback,
  };
  const urls = new Set();
  const news = (dataset?.events ?? [])
    .filter((event) => timeOf(event.date) !== null && timeOf(event.date) <= asOf && timeOf(event.date) >= asOf - newsLookback * dayMs)
    .sort((a, b) => b.date.localeCompare(a.date))
    .flatMap((event) => {
      const url = secureUrl(event.url);
      const reading = newsReading(event);
      if (!url || !reading || urls.has(url)) return [];
      urls.add(url);
      return [{ ...event, url, kind: reading[0], relevance: reading[1] }];
    }).slice(0, 5);
  return {
    asOf, start, baseline, latest, recent, change, projection, market, news,
    benchmarkUrl: secureUrl(breadth?.sourceUrl) ?? epochUrl,
  };
}

function node(tag, text, className) {
  const item = document.createElement(tag);
  if (text) item.textContent = text;
  if (className) item.className = className;
  return item;
}

function link(text, url, className) {
  const anchor = node('a', text, className);
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  return anchor;
}

function svgNode(tag, attributes, text) {
  const item = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) item.setAttribute(key, value);
  if (text) item.textContent = text;
  return item;
}

function trajectoryChart({ start, asOf, baseline, latest, recent, projection }) {
  const width = 620;
  const height = 116;
  const timespan = projection.time - start;
  const values = [baseline.value, ...recent.map((point) => point.value), projection.value];
  const minimum = Math.floor((Math.min(...values) - 1) / 5) * 5;
  const maximum = Math.ceil((Math.max(...values) + 1) / 5) * 5;
  const middle = (minimum + maximum) / 2;
  const x = (time) => (time - start) / timespan * width;
  const y = (value) => height - (value - minimum) / (maximum - minimum) * height;
  const svg = svgNode('svg', {
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'none',
    role: 'img',
    'aria-label': `Epoch Capabilities Index in points by date (UTC). The vertical scale shows ${num.format(minimum)} to ${num.format(maximum)} points. The measured score moved from ${num.format(baseline.value)} to ${num.format(latest.value)} in 180 days. If that pace holds, it would reach ${num.format(projection.value)} 90 days later.`,
  });
  svg.append(
    svgNode('rect', { x: x(asOf), y: 0, width: width - x(asOf), height, class: 'agi-projection-zone' }),
    svgNode('line', { x1: x(asOf), x2: x(asOf), y1: 0, y2: height, class: 'agi-gridline' }),
    ...[maximum, middle, minimum].map((value) => svgNode('line', { x1: 0, x2: width, y1: y(value), y2: y(value), class: 'agi-gridline' })),
  );
  const observed = [`M ${x(start)} ${y(baseline.value)}`];
  for (const point of recent) observed.push(`H ${x(point.time)} V ${y(point.value)}`);
  observed.push(`H ${x(asOf)}`);
  svg.append(
    svgNode('path', { d: observed.join(' '), class: 'agi-measured' }),
    svgNode('path', { d: `M ${x(asOf)} ${y(latest.value)} L ${x(projection.time)} ${y(projection.value)}`, class: 'agi-projected' }),
    svgNode('circle', { cx: x(asOf), cy: y(latest.value), r: 3.8, class: 'agi-observed-dot' }),
    svgNode('circle', { cx: x(projection.time), cy: y(projection.value), r: 3.8, class: 'agi-projected-dot' }),
  );
  const yTicks = node('div', '', 'agi-y-ticks');
  const dates = node('div', '', 'agi-x-ticks');
  yTicks.setAttribute('aria-hidden', 'true');
  dates.setAttribute('aria-hidden', 'true');
  yTicks.append(...[maximum, middle, minimum].map((value) => node('span', num.format(value))));
  dates.append(...[start, asOf, projection.time].map((time) => node('span', shortDate.format(time))));
  dates.style.setProperty('--agi-present', `${x(asOf) / width * 100}%`);
  const plot = node('div', '', 'agi-plot');
  plot.append(yTicks, svg, dates);
  const chart = node('div');
  chart.append(node('p', 'Y · Epoch Capabilities Index (ECI points)', 'agi-axis-title'), plot,
    node('p', 'X · Date (UTC)', 'agi-axis-title agi-axis-date'));
  return chart;
}

function reading(title, value, note, className) {
  const result = node('div', '', 'agi-reading');
  result.append(node('span', title), node('strong', value, className), node('p', note));
  return result;
}

export function renderAgiTrajectory(panel, dataset, forecast) {
  if (!dataset) return;
  const last = rendered.get(panel) ?? {};
  if (last.dataset === dataset && last.value === forecast?.value && last.date === forecast?.observedAt) return;
  const model = getAgiTrajectory(dataset, forecast);
  const { latest, baseline, change, projection, market, news } = model;
  const trend = panel.querySelector('.agi-readings');
  const spark = panel.querySelector('.agi-chart');
  const chartKey = panel.querySelector('.agi-chart-key');
  const method = panel.querySelector('.agi-method');
  const newsList = panel.querySelector('.agi-news-list');
  const source = panel.querySelector('.agi-benchmark');
  source.href = model.benchmarkUrl;
  const credibleInterval = Number.isFinite(latest?.low) && Number.isFinite(latest?.high)
    ? `90% interval ${num.format(latest.low)}–${num.format(latest.high)}`
    : '';
  trend.replaceChildren(
    reading('Latest measured frontier', latest ? `${num.format(latest.value)} ECI` : 'Unavailable',
      latest ? [latest.label, fullDate.format(latest.time), credibleInterval].filter(Boolean).join(' · ') : 'Waiting for a dated benchmark reading.'),
    reading('180-day momentum', change === null ? 'Insufficient data' : `${change > 0 ? '+' : ''}${num.format(change)} ECI`,
      baseline && change !== null ? `From ${num.format(baseline.value)} ECI to the latest frontier.` : 'Needs a baseline and a newer reading.'),
    reading('90-day projection', projection ? `${num.format(projection.value)} ECI` : 'Unavailable',
      projection ? `By ${fullDate.format(projection.time)} if the recent pace holds.` : 'A projection needs comparable history.', 'agi-estimate'),
  );
  spark.replaceChildren(...(projection ? [trajectoryChart(model)] : []));
  spark.hidden = !projection;
  chartKey.hidden = !projection;
  method.textContent = projection
    ? `Epoch combines results from multiple tests. The vertical scale fits the scores shown. The solid line shows scores by model release date, with ${model.recent.length} updates in the last 180 days. The dashed line shows how the score would change if that pace continued.`
    : 'Epoch’s index aggregates benchmarks. A trajectory needs a dated frontier reading from before the 180-day window and a newer one inside it.';
  if (market) {
    const marketReading = node('strong', `${num.format(market.value)}%`);
    panel.querySelector('.agi-market').replaceChildren(marketReading,
      node('span', 'Play-money market on whether AGI is publicly announced before 2030 under Manifold’s resolution rules.'),
      link('Market rules and history ↗', market.url),
      node('small', market.publishedAt !== null ? `Reading ${fullDate.format(market.publishedAt)}` : ''));
  } else {
    panel.querySelector('.agi-market').replaceChildren(node('span', 'No current Manifold market reading.'));
  }
  if (last.dataset !== dataset) {
    newsList.replaceChildren(...(news.length ? news.map((event) => {
      const row = node('li', '', 'agi-article');
      const info = node('p', [event.kind, event.source, fullDate.format(timeOf(event.date))].filter(Boolean).join(' · '), 'agi-article-meta');
      row.append(info, link(event.title + ' ↗', event.url, 'agi-article-title'));
      if (event.summary) row.append(node('p', event.summary));
      row.append(node('p', event.relevance, 'agi-relevance'));
      return row;
    }) : [node('li', 'No relevant articles from the last 60 days are available in the feed.')]));
  }
  rendered.set(panel, { dataset, value: forecast?.value, date: forecast?.observedAt });
}
