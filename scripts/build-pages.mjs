import assert from 'node:assert/strict';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { getSignals } from '../src/signals.mjs';
import { buildIndex } from '../site/index-model.js';
import { buildCompanionFeed } from '../site/companion-feed.js';
import { checkResearchForecast } from '../site/research-forecast.js';

const target = new URL('../dist-pages/', import.meta.url);

async function previousRelease() {
  const url = process.env.PREVIOUS_SIGNALS_URL;
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

const previousBuild = previousRelease();
const [current, previous, researchForecast] = await Promise.all([
  getSignals(), previousBuild, previousBuild.then(previous => checkResearchForecast(previous?.researchForecast)),
]);
if (process.env.REQUIRE_LIVE === 'true') {
  assert(current.sources.some((source) => source.status === 'live'), 'Public sources unavailable. The current Pages release is preserved.');
}

const previousMetrics = new Map(previous?.metrics?.map((metric) => [metric.id, metric]));
const preserveMetrics = current.metrics.map((metric) => {
  const prior = previousMetrics.get(metric.id);
  if (metric.status === 'live' || prior?.value == null || (metric.asOf && prior.asOf <= metric.asOf)) return metric;
  return { ...prior, status: 'snapshot' };
});
const events = [...new Map([
  ...(previous?.events ?? []).map((event) => [event.url.replace(/\/$/, ''), event]),
  ...current.events.map((event) => [event.url.replace(/\/$/, ''), event]),
]).values()].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 120);
const incidentCutoff = new Date(Date.parse(current.checkedAt) - 365 * 86_400_000).toISOString();
const liveIncidentProviders = new Set(current.incidentSources.filter(({ status }) => status === 'live').map(({ organization }) => organization));
const savedIncidents = (previous?.incidents ?? []).filter((incident) =>
  incident.startedAt >= incidentCutoff && (incident.status === 'resolved' || !liveIncidentProviders.has(incident.organization)));
const incidents = [...new Map([...savedIncidents, ...current.incidents].map((incident) => [incident.id, incident])).values()]
  .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
const previousIncidentSources = new Map((previous?.incidentSources ?? []).map((source) => [source.organization, source]));
const incidentSources = current.incidentSources.map((source) => {
  const prior = previousIncidentSources.get(source.organization);
  const oldestDate = incidents.findLast((incident) => incident.organization === source.organization)?.date ?? null;
  const lastSuccessAt = source.lastSuccessAt ?? prior?.lastSuccessAt ?? null;
  return { ...source, oldestDate, lastSuccessAt, status: source.status === 'live' || !lastSuccessAt ? source.status : 'snapshot' };
});
const published = {
  ...current,
  metrics: preserveMetrics,
  researchForecast,
  events,
  incidents,
  incidentSources,
  delivery: {
    kind: 'github-pages',
    builtAt: new Date().toISOString(),
    checkTimes: ['00:00', '06:00', '09:30', '16:00'],
    checkTimeZone: 'America/New_York',
  },
};

const result = buildIndex(published);
assert(result.history.length > 0 && result.factors.length >= 6, 'Expected usable historical frames and factor metadata');
await rm(target, { recursive: true, force: true });
await cp(new URL('../site/', import.meta.url), target, { recursive: true });
await cp(new URL('../licenses/', import.meta.url), new URL('licenses/', target), { recursive: true });
await mkdir(new URL('data/', target), { recursive: true });
await writeFile(new URL('data/signals.json', target), JSON.stringify(published));
await writeFile(new URL('data/companion.json', target), JSON.stringify(buildCompanionFeed(published, result)));
await writeFile(new URL('.nojekyll', target), '');
console.log(`Pages bundle ready. ${published.sources.filter((source) => source.status === 'live').length} sources checked; ${result.history.length} index dates.`);
