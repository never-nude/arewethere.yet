import {
  metricDefinitions,
  publishedResearch,
  referenceEvents,
  snapshot,
  sourceDefinitions,
  studyDate,
} from "./snapshot.js";
import { collectGridDemand, reviewedObservations } from './global-evidence.mjs';
import ledger from './observatory-ledger.json' with { type: 'json' };
import { getProviderIncidents } from './provider-incidents.mjs';

const metrAssets = "https://metr.org/assets/images/q4-2026-capability-update/";
const marketId = "hh2bXhwKDTioZ7KtGKfC";
const manifoldApi = "https://api.manifold.markets/v0/";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const day = 86_400_000;

async function read(fetcher, url, format) {
  const response = await fetcher(url, { signal: AbortSignal.timeout(4500) });
  if (!response.ok) throw new Error(`Source responded with ${response.status}`);
  return response[format]();
}

function toIso(value) {
  const date = new Date(value);
  return value != null && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function byDate(a, b) {
  return a.date.localeCompare(b.date);
}

function modelOrder(a, b) {
  return byDate(a, b) || b.value - a.value || a.label.localeCompare(b.label);
}

function frontier(points) {
  let best = -Infinity;
  return [...points]
    .sort(modelOrder)
    .filter(point => {
      if (point.value <= best) return false;
      best = point.value;
      return true;
    });
}

async function getBenchmark(fetcher, id, url, series, report) {
  const figure = await read(fetcher, url, "json");
  const rows = figure.panels[0].tables.find(table => table.name === "models").rows;
  const points = rows.filter(row =>
    row.series === series && datePattern.test(row.released) &&
    Number.isFinite(row.horizon_minutes) && row.horizon_minutes > 0
  ).map(row => ({
    date: row.released,
    label: row.model,
    value: row.horizon_minutes / 60,
    low: Number.isFinite(row.horizon_minutes_low_95) ? row.horizon_minutes_low_95 / 60 : null,
    high: Number.isFinite(row.horizon_minutes_high_95) ? row.horizon_minutes_high_95 / 60 : null,
    frontier: row.frontier,
  }));
  const observations = points.sort(modelOrder);
  const history = frontier(observations.filter(point => point.frontier));
  if (!history.length) throw new Error("Benchmark contains no matching results");
  const { date, label, value, low, high } = history.at(-1);
  const definition = metricDefinitions[id];
  return {
    ...definition,
    sourceUrl: report?.url ?? definition.sourceUrl,
    model: label,
    modelDate: date,
    value,
    low,
    high,
    history,
    observations,
    asOf: report?.date ?? studyDate,
    status: "live",
  };
}

// Epoch's CSV includes quoted multiline fields, embedded commas, and doubled quotes.
function parseCsv(csv) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const character = csv[i];
    if (quoted && character === '"' && csv[i + 1] === '"') {
      field += '"';
      i++;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (!quoted && (character === "," || character === "\n")) {
      row.push(field);
      field = "";
      if (character === "\n") {
        rows.push(row);
        row = [];
      }
    } else if (quoted || character !== "\r") {
      field += character;
    }
  }
  if (row.length || field) rows.push([...row, field]);
  return rows;
}

function numberOrNull(raw) {
  return typeof raw === "string" && raw.trim() && Number.isFinite(Number(raw)) ? Number(raw) : null;
}

function csvColumns(csv, names) {
  const [header, ...rows] = parseCsv(csv.replace(/^\uFEFF/, ""));
  const indexes = names.map(name => header.indexOf(name));
  if (indexes.includes(-1)) throw new Error("CSV data columns changed");
  return rows.map(row => indexes.map(index => row[index]));
}

async function getCompute(fetcher) {
  const csv = await read(fetcher, "https://epoch.ai/data/frontier_ai_models.csv", "text");
  const rows = csvColumns(csv, ["Model", "Publication date", "Training compute (FLOP)"]);
  const observations = rows.map(([label, date, value]) => ({ label, date, value: numberOrNull(value) }))
    .filter(point => point.label && datePattern.test(point.date) && point.date >= "2012-01-01" && point.value > 0)
    .sort(modelOrder);
  const history = frontier(observations);
  if (!history.length) throw new Error("Epoch has no usable frontier estimates");
  const { date, label, value } = history.at(-1);
  return { ...metricDefinitions.compute, model: label, modelDate: date, value, history, observations, asOf: date, status: "live" };
}

function eciMetric(id, observations) {
  const history = frontier(observations);
  if (!history.length) throw new Error("Epoch has no usable capability scores");
  const { date, label, value, low, high } = history.at(-1);
  return {
    ...metricDefinitions[id],
    model: label,
    modelDate: date,
    value,
    low,
    high,
    history,
    observations,
    asOf: date,
    lastObservationDate: observations.at(-1).date,
    status: "live",
  };
}

async function getCapability(fetcher) {
  const csv = await read(fetcher, "https://epoch.ai/data/eci_scores.csv", "text");
  const rows = csvColumns(csv, ["Display name", "date", "eci", "eci_ci_low", "eci_ci_high", "Accessibility group", "Organization"]);
  const observations = rows.map(([label, date, value, low, high, access, organization]) => ({
    label,
    date,
    value: numberOrNull(value),
    low: numberOrNull(low),
    high: numberOrNull(high),
    access,
    organization,
  })).filter(point => point.label && datePattern.test(point.date) && point.value !== null).sort(modelOrder);
  return {
    breadth: eciMetric("breadth", observations),
    openBreadth: eciMetric("open-breadth", observations.filter(point => point.access === "Open weights")),
    closedBreadth: eciMetric("closed-breadth", observations.filter(point => point.access === "Closed weights")),
  };
}

function isProbability(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function marketPercent(probability) {
  return Math.round(probability * 10000) / 100;
}

async function getForecast(fetcher, now) {
  const [market, bets] = await Promise.all([
    read(fetcher, manifoldApi + "market/" + marketId, "json"),
    read(fetcher, manifoldApi + "bets?contractId=" + marketId + "&limit=1000", "json").catch(() => null),
  ]);
  if (!isProbability(market.probability)) throw new Error("Market probability unavailable");
  const asOf = toIso(market.lastBetTime ?? market.lastUpdatedTime) ?? now;
  const value = marketPercent(market.probability);
  const latestDate = asOf.slice(0, 10);
  const historyByDay = new Map();
  if (Array.isArray(bets)) {
    for (const bet of [...bets].reverse()) {
      const date = toIso(bet.createdTime)?.slice(0, 10);
      if (date && date <= latestDate && bet.isFilled && !bet.isRedemption && isProbability(bet.probAfter)) {
        historyByDay.set(date, { date, value: marketPercent(bet.probAfter) });
      }
    }
  }
  historyByDay.set(latestDate, { date: latestDate, value });
  const fallbackHistory = snapshot.metrics.find(metric => metric.id === "forecast").history;
  const history = [...historyByDay.values()].sort(byDate);
  const earliest = history[0].date;
  return {
    ...metricDefinitions.forecast,
    value,
    history: [...fallbackHistory.filter(point => point.date < earliest), ...history],
    asOf,
    status: "live",
    closed: Boolean(market.isResolved),
    question: market.question,
  };
}

const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function cleanText(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
      if (entity[0] !== "#") return entities[entity] ?? match;
      const code = entity[1].toLowerCase() === "x" ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return code <= 0x10ffff ? String.fromCodePoint(code) : match;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function tag(item, name) {
  return cleanText(item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1] ?? "");
}

function canonical(url) {
  return url.replace(/\/$/, "");
}

function feedCategory(feed, title, category, url) {
  if (feed.id === "metr-news" && /capabilit|evaluation|time horizon|ai agents|research|r&d/i.test(title)) {
    return /evaluation|benchmark|time horizon|capabilit/i.test(title) ? "Evaluation" : "Research";
  }
  if (feed.id === "openai" && /^(product|research)$/i.test(category)) {
    const normalized = title.replace(/[\u2010-\u2015]/g, "-");
    const releaseTitle = /^(introducing|announcing|releasing) (?:openai )?(?:gpt-\d|o\d\b)/i.test(normalized);
    const modelPage = /^https:\/\/openai\.com\/index\/(?:gpt-\d+(?:-\d+)*(?:-(?:astra|sol|luna|terra))?|o\d(?:-and-o\d-mini)?)\/?$/i.test(url);
    if (releaseTitle || modelPage) return "Release";
  }
  if (feed.id === "openai" && category === "Research" && /intelligence|research acceleration|chip design|capabilit|benchmark|time horizon|ai researcher/i.test(title)) {
    return "Research";
  }
  return null;
}

function downloadUrl(item, filename, origin) {
  for (const [link] of item.matchAll(/<a\s[^>]+>/g)) {
    if (!link.includes('download="' + filename + '"')) continue;
    const href = link.match(/\bhref="([^"]+)"/)?.[1];
    if (!href) continue;
    const url = new URL(href, origin);
    if (url.origin === origin && /^\/assets\/images\/[^/]+\/[\w-]+\.json$/.test(url.pathname)) return url.href;
  }
  return null;
}

async function getFeed(fetcher, feed, feedUrl, startDay) {
  const xml = await read(fetcher, feedUrl, "text");
  if (!xml.includes("<rss") || !xml.includes("<item>")) throw new Error("Unrecognized feed format");
  const events = [];
  const benchmarkUpdates = [];
  let firstDate = null;
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const title = tag(item, "title");
    const url = tag(item, "link");
    const date = toIso(tag(item, "pubDate"))?.slice(0, 10);
    if (date) firstDate = !firstDate || firstDate > date ? date : firstDate;
    const category = feedCategory(feed, title, tag(item, "category"), url);
    if (!title || !url.startsWith("https://") || !date || !category) continue;
    if (date < startDay) continue;
    const source = feed.id === "metr-news" ? "METR" : feed.label;
    const event = {
      id: canonical(url),
      date,
      title,
      category,
      source,
      url,
      summary: tag(item, "description"),
    };
    events.push(event);
    if (feed.id === "metr-news" && date > studyDate && category === "Evaluation" &&
        /(?:time horizon|capabilit(?:y|ies).*(?:measur|updat)|(?:measur|updat).*capabilit)/i.test(title)) {
      benchmarkUpdates.push({
        ...event,
        h50: downloadUrl(item, "headline-panel2.json", "https://metr.org"),
        h80: downloadUrl(item, "th-trends-separate-task-sets-p80.json", "https://metr.org"),
      });
    }
  }
  return { events: events.sort((a, b) => byDate(b, a)), firstDate, benchmarkUpdates };
}

async function getAnthropicReleases(fetcher, startDay) {
  const base = sourceDefinitions.anthropic.url;
  const markdown = await read(fetcher, base + ".md", "text");
  if (!markdown.startsWith("---") || !markdown.includes("title: Claude Platform release notes")) {
    throw new Error("Unrecognized Claude release notes");
  }
  const events = [];
  let earliest = null;
  for (const [, heading, body] of markdown.matchAll(/^### ([A-Za-z]+ \d{1,2}, \d{4})\r?\n([\s\S]*?)(?=^#{2,3} |$(?![\s\S]))/gm)) {
    const date = toIso(heading + " UTC")?.slice(0, 10);
    if (!date) continue;
    earliest = !earliest || date < earliest ? date : earliest;
    if (date < startDay) continue;
    for (const bullet of body.split(/\r?\n/)) {
      const bold = bullet.match(/^\* We(?:['’]ve| have)? (?:launched|released|introduced) \*\*(Claude (?:Fable|Mythos|Opus|Sonnet|Haiku) \d+(?:\.\d+)*)\*\*/i);
      const linked = bullet.match(/^\* We(?:['’]ve| have)? \[(?:launched|released|introduced) (Claude (?:Fable|Mythos|Opus|Sonnet|Haiku) \d+(?:\.\d+)*)\]\((https:\/\/www\.anthropic\.com\/news\/[\w-]+)\)/i);
      const model = bold?.[1] ?? linked?.[1];
      if (!model) continue;
      const slug = heading.toLowerCase().replace(",", "").replace(/\s+/g, "-");
      const url = linked?.[2] ?? base + "#" + slug;
      events.push({
        id: "anthropic-release-" + date,
        date,
        title: "Anthropic releases " + model,
        category: "Release",
        source: "Anthropic",
        url,
        summary: "Anthropic documented API availability in its official release notes.",
      });
      break;
    }
  }
  if (!earliest) throw new Error("Claude release notes have no coverage dates");
  return { events: events.sort((a, b) => byDate(b, a)), firstDate: earliest };
}

function metricResult(result, id) {
  if (result.status === "fulfilled") return result.value;
  return snapshot.metrics.find(metric => metric.id === id) ?? {
    ...metricDefinitions[id],
    value: null,
    history: [],
    asOf: null,
    status: "unavailable",
  };
}

function sourceResult(definition, status, asOf) {
  const detail = status === "snapshot" ? `Using a saved reading. ${definition.detail}` : definition.detail;
  return { ...definition, asOf, status, detail };
}

function feedResult(definition, result) {
  return sourceResult(definition, result.status === "fulfilled" ? "live" : "unavailable", result.value?.events[0]?.date ?? null);
}

export async function getSignals({ fetcher = fetch, now = new Date() } = {}) {
  const checkedAt = now.toISOString();
  const startDay = new Date(now.getTime() - 365 * day).toISOString().slice(0, 10);
  let [h50, h80, epoch, eci, manifold, openai, anthropic, metrNews, providerIncidents, grid] = await Promise.allSettled([
    getBenchmark(fetcher, "horizon", metrAssets + "cad6b5d98261f80c.json", "TH1.1 and TH2"),
    getBenchmark(fetcher, "reliability", metrAssets + "1dfa453dcd603b2d.json", "TH2 (Verifiable)"),
    getCompute(fetcher),
    getCapability(fetcher),
    getForecast(fetcher, checkedAt),
    getFeed(fetcher, sourceDefinitions.openai, "https://openai.com/news/rss.xml", startDay),
    getAnthropicReleases(fetcher, startDay),
    getFeed(fetcher, sourceDefinitions.metrNews, "https://metr.org/feed.xml", startDay),
    getProviderIncidents(fetcher, checkedAt),
    collectGridDemand(fetcher, now),
  ]);
  const benchmarkReports = metrNews.value?.benchmarkUpdates?.sort((a, b) => byDate(b, a)) ?? [];
  const latestBenchmarkReport = benchmarkReports[0];
  const comparableReport = benchmarkReports.find(report => report.h50 && report.h80);
  if (comparableReport) {
    const newer = await Promise.allSettled([
      getBenchmark(fetcher, "horizon", comparableReport.h50, "TH1.1 and TH2", comparableReport),
      getBenchmark(fetcher, "reliability", comparableReport.h80, "TH2 (Verifiable)", comparableReport),
    ]);
    if (newer.every(result => result.status === "fulfilled")) [h50, h80] = newer;
  }
  const horizon = metricResult(h50, "horizon");
  const reliability = metricResult(h80, "reliability");
  const compute = metricResult(epoch, "compute");
  const forecast = metricResult(manifold, "forecast");
  const breadth = eci.value?.breadth ?? snapshot.metrics.find(metric => metric.id === "breadth");
  const openBreadth = eci.value?.openBreadth ?? snapshot.metrics.find(metric => metric.id === "open-breadth");
  const closedBreadth = eci.value?.closedBreadth ?? snapshot.metrics.find(metric => metric.id === "closed-breadth");
  const eventsByUrl = new Map();
  const releaseKey = event => event.source + ":" + event.date;
  const releasesByDay = new Map();
  for (const event of [...(openai.value?.events ?? []), ...(anthropic.value?.events ?? []), ...(metrNews.value?.events ?? []), ...referenceEvents]) {
    eventsByUrl.set(canonical(event.url), event);
    if (event.category === "Release") releasesByDay.set(releaseKey(event), event);
  }
  const releaseEvents = [...releasesByDay.values()].sort((a, b) => byDate(b, a));
  const releaseStart = openai.value?.firstDate && anthropic.value?.firstDate
    ? [openai.value.firstDate, anthropic.value.firstDate, startDay].sort().at(-1)
    : null;
  const events = [
    ...[...eventsByUrl.values()].filter(event => event.category !== "Release"),
    ...releaseEvents,
  ].sort((a, b) => byDate(b, a)).slice(0, 35);
  const benchmarkSource = sourceResult(sourceDefinitions.metr, horizon.status === "live" && reliability.status === "live" ? "live" : "snapshot", horizon.asOf);
  if (comparableReport?.date === horizon.asOf) {
    benchmarkSource.url = comparableReport.url;
    benchmarkSource.detail = "The task charts use the latest METR report with comparable published figures.";
  }
  if (latestBenchmarkReport && latestBenchmarkReport.date > horizon.asOf) {
    const { date, title, url } = latestBenchmarkReport;
    benchmarkSource.pendingReport = { date, title, url };
    benchmarkSource.detail = "A newer METR report is available. Its chart data needs a comparability review.";
  }

  return {
    checkedAt,
    metrics: [horizon, reliability, compute, forecast, breadth, openBreadth, closedBreadth, ...publishedResearch],
    events,
    releaseEvents,
    releaseStart,
    incidents: providerIncidents.value?.incidents ?? [],
    observatoryObservations: [...reviewedObservations.filter(row => row.publishedOn <= checkedAt.slice(0, 10)), ...(grid.value ? [grid.value] : []), ...ledger.observations],
    criterionReviews: ledger.criterionReviews,
    criterionTrajectories: ledger.criterionTrajectories,
    observatoryEvents: ledger.events,
    reviewedLedgerVersion: ledger.methodologyVersion,
    incidentSources: providerIncidents.value?.incidentSources ?? [],
    sources: [
      benchmarkSource,
      { id: 'neso', name: 'GB grid demand', provider: 'NESO', url: 'https://www.neso.energy/data-portal/daily-demand-update/demand_data_update', status: grid.value ? 'live' : 'unavailable', asOf: grid.value?.measuredOn ?? null, detail: 'Operator-reported demand in Great Britain.' },
      sourceResult(sourceDefinitions.epoch, compute.status, compute.asOf),
      sourceResult(sourceDefinitions.epochEci, breadth.status, breadth.asOf),
      sourceResult(sourceDefinitions.manifold, forecast.status, forecast.asOf),
      feedResult(sourceDefinitions.openai, openai),
      feedResult(sourceDefinitions.anthropic, anthropic),
      feedResult(sourceDefinitions.metrNews, metrNews),
    ],
  };
}
