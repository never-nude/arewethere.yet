import assert from 'node:assert/strict';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { getSignals } from '../src/signals.mjs';
import { buildIndex } from '../site/index-model.js';

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

const [current, previous] = await Promise.all([getSignals(), previousRelease()]);
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
const published = {
  ...current,
  metrics: preserveMetrics,
  events,
  delivery: { kind: 'github-pages', builtAt: new Date().toISOString(), checkIntervalHours: 1 },
};

const result = buildIndex(published);
assert(result.history.length > 0 && result.factors.length >= 6, 'Expected usable historical frames and factor metadata');
await rm(target, { recursive: true, force: true });
await cp(new URL('../site/', import.meta.url), target, { recursive: true });
await cp(new URL('../licenses/', import.meta.url), new URL('licenses/', target), { recursive: true });
await mkdir(new URL('data/', target), { recursive: true });
await writeFile(new URL('data/signals.json', target), JSON.stringify(published));
await writeFile(new URL('.nojekyll', target), '');
console.log(`Pages bundle ready. ${published.sources.filter((source) => source.status === 'live').length} sources checked; ${result.history.length} index dates.`);
