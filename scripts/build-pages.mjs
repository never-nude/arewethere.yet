import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSignals } from '../src/signals.mjs';
import { buildIndex } from '../site/index-model.js';
import { summarizeScaleHistory } from '../site/front-scale.js';
import { buildCompanionFeed } from '../site/companion-feed.js';
import { checkResearchForecast } from '../site/research-forecast.js';
import { buildObservatoryAssessment } from '../site/observatory-model.js';
import { deriveField } from '../site/observatory-field-model.js';
import { checkTimes, checkTimeZone, checkpointForRun, checkpointWindow } from '../site/checkpoint-schedule.js';
import { loadCandidateQueue } from './candidate-observations.mjs';
import { appendRecord, assertPublishedAncestry, readArchive, nextRecord } from './checkpoint-archive.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const archiveDir = path.resolve(process.env.OBSERVATORY_ARCHIVE_DIR ?? path.join(repo, '.observatory-archive'));
const target = new URL('../dist-pages/', import.meta.url);

async function priorV1Release() {
  const url = process.env.PREVIOUS_SIGNALS_URL;
  if (!url) return null;
  const read = async url => {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    assert.ok(response.ok, 'Unable to preserve both original published feeds.');
    return response.json();
  };
  const [signals, companion] = await Promise.all([read(url), read(new URL('companion.json', url))]);
  assert.ok(signals.metrics?.length && signals.sources?.length && signals.checkedAt);
  assert.equal(companion.checkedAt, signals.checkedAt, 'Legacy feeds must belong to the same release.');
  assert.ok(companion.schemaVersion === 1 && !companion.assessment, 'Refusing to replace a missing v2 archive from a later feed.');
  return { schemaVersion: 1, kind: 'legacy-v1', signals, companion,
    sourceRevision: process.env.LEGACY_SOURCE_REVISION || null };
}

async function collect(previous) {
  const [current, researchForecast] = await Promise.all([
    getSignals(), checkResearchForecast(previous?.researchForecast),
  ]);
  const pending = await loadCandidateQueue(process.env.OBSERVATORY_CANDIDATE_DIR,
    previous?.checkedAt ?? new Date(Date.parse(current.checkedAt) - 7 * 86400000).toISOString(), current.checkedAt);
  const previousMetrics = new Map(previous?.metrics?.map((metric) => [metric.id, metric]));
  const preserveMetrics = current.metrics.map((metric) => {
    const prior = previousMetrics.get(metric.id);
    if (metric.status === 'live' || prior?.value == null || (metric.asOf && prior.asOf <= metric.asOf)) return metric;
    return { ...prior, status: 'snapshot' };
  });
  const events = [...new Map([
    ...(previous?.events ?? []).map((event) => [event.url.replace(/\/$/, ''), event]),
    ...pending.events.map((event) => [event.url.replace(/\/$/, ''), event]),
    ...current.events.map((event) => [event.url.replace(/\/$/, ''), event]),
  ]).values()].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 120);
  const incidentCutoff = new Date(Date.parse(current.checkedAt) - 365 * 86_400_000).toISOString();
  const liveIncidentProviders = new Set(current.incidentSources.filter(({ status }) => status === 'live').map(({ organization }) => organization));
  const savedIncidents = [...(previous?.incidents ?? []), ...pending.incidents].filter((incident) =>
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
  const grid = current.sources.find(source => source.id === 'neso');
  const observed = current.observatoryObservations ?? [];
  // An unavailable grid endpoint cannot erase the last verified measurement or advance its source date.
  const gridRows = [...(previous?.observatoryObservations ?? []), ...pending.infrastructureObservations]
    .filter(row => row.topic === 'energy' && row.id?.startsWith('gb-demand-'));
  const savedGrid = gridRows.sort((a,b) => String(b.measuredOn).localeCompare(String(a.measuredOn)) ||
    String(b.retrievedAt).localeCompare(String(a.retrievedAt)))[0];
  const carryGrid = grid?.status === 'unavailable' && savedGrid;
  const sources = current.sources.map(source => source === grid && carryGrid ? {
    ...source, status:'snapshot', asOf:savedGrid.measuredOn,
    detail:'The provider is unavailable. This is its last verified demand reading.',
  } : source);
  const observatoryObservations = carryGrid
    ? [...observed, {...savedGrid,retrievedAt:savedGrid.retrievedAt ?? previous?.checkedAt}]
    : observed;
  const published = {
    ...current,
    candidateDiscovery: pending,
    observatoryObservations,
    sources,
    metrics: preserveMetrics,
    researchForecast,
    events,
    incidents,
    incidentSources,
    delivery: {
      kind: 'github-pages',
      builtAt: new Date().toISOString(),
      checkTimes,
      checkTimeZone,
    },
  };

  const result = buildIndex(published);
  assert.ok(result.history.length && result.factors.length >= 6);
  published.scaleHistory = summarizeScaleHistory(published, result);
  return published;
}

const creation = process.env.OBSERVATORY_RUN_CREATED_AT;
const scheduled = checkpointForRun({
  event: process.env.GITHUB_EVENT_NAME, cron: process.env.OBSERVATORY_CRON, createdAt: creation,
});
let records = await readArchive(archiveDir);
assertPublishedAncestry(records, process.env.PUBLISHED_HEAD_SHA256);
if (process.env.GITHUB_EVENT_NAME === 'schedule' && !scheduled && !records.length) {
  throw new Error('Expired or unrecognized scheduled run. No earlier checkpoint can be reconstructed.');
}
const plan = nextRecord(records, scheduled);
if (plan) {
  const latest = records.at(-1);
  const previous = latest ? JSON.parse(await readFile(latest.file, 'utf8')) : null;
  const legacy = previous ? null : await priorV1Release();
  const signals = await collect(previous?.signals ?? legacy?.signals);
  const checkpointAt = plan.checkpointAt ?? signals.checkedAt;
  const validatedAt = new Date().toISOString();
  if (scheduled) assert.equal(checkpointWindow(validatedAt).previous, scheduled, 'Verification crossed into a later assessment window.');
  const assessment = buildObservatoryAssessment(signals, { checkpointAt, validatedAt, previous: previous?.assessment ?? null });
  assessment.kind = plan.kind;
  assessment.field = deriveField(assessment);
  const sourceRevision = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  // Capture both kinds of output once. Republishing code never recomputes what a prior checkpoint believed.
  const companion = buildCompanionFeed(signals);
  companion.assessment = { schemaVersion: 2, kind: plan.kind, checkpointAt, url: 'https://arewethereyet.now/data/observatory.json' };
  companion.index.methodology = 'Legacy v1 index; retained for existing readers.';
  const archiveEntry = { schemaVersion: 2, kind: plan.kind, sourceRevision, previousSha256: latest?.sha256 ?? null,
    assessment, signals, companion };
  if (legacy) archiveEntry.legacyV1 = legacy;
  await appendRecord(archiveDir, archiveEntry);
  records = await readArchive(archiveDir);
}

const latest = records.at(-1);
assert.ok(latest, 'No validated edition is available for publication.');
const record = JSON.parse(await readFile(latest.file, 'utf8'));
const publicRow = ({ checkpointAt, validatedAt, url, sha256 }) => ({ checkpointAt, validatedAt, url, sha256 });
const commissioning = records.find(item => item.kind === 'commissioning');
const repository = process.env.GITHUB_ACTIONS === 'true' ? process.env.GITHUB_REPOSITORY : null;
const archiveRow = row => {
  const entry = publicRow(row);
  if (repository) {
    const address = path.relative(archiveDir, row.file).split(path.sep).join('/');
    entry.url = 'https://raw.githubusercontent.com/' + repository + '/refs/heads/assessment-archive/' + address;
  }
  return entry;
};
const feed = {
  schemaVersion: 2, status: record.kind === 'official' ? 'validated' : 'commissioning',
  schedule: { timezone: checkTimeZone, times: checkTimes },
  assessment: record.assessment, currentRecord: publicRow(latest),
  commissioning: commissioning ? publicRow(commissioning) : null,
  archive: records.filter(item => item.kind === 'official').map(archiveRow),
};

const genesis = latest === records[0] ? record : JSON.parse(await readFile(records[0].file, 'utf8'));
const legacyBytes = genesis.legacyV1 ? JSON.stringify(genesis.legacyV1) : null;
feed.legacy = legacyBytes ? {
  url: 'data/legacy-v1.json', sourceRevision: genesis.legacyV1.sourceRevision,
  checkedAt: genesis.legacyV1.signals.checkedAt, sha256: createHash('sha256').update(legacyBytes).digest('hex'),
} : null;

await rm(target, { recursive: true, force: true });
await cp(new URL('../site/', import.meta.url), target, { recursive: true });
await cp(new URL('../licenses/', import.meta.url), new URL('licenses/', target), { recursive: true });
await mkdir(new URL('data/', target), { recursive: true });
// A Pages release stays bounded as the permanent ledger grows. Older official
// records are served from their content-addressed paths on the archive branch.
const bundled = repository ? new Set([latest, commissioning].filter(Boolean)) : records;
for (const row of bundled) {
  const dest = new URL(row.url, target);
  await mkdir(new URL('./', dest), {recursive: true});
  await cp(row.file, dest);
}
if (legacyBytes) await writeFile(new URL('data/legacy-v1.json', target), legacyBytes);
await writeFile(new URL('data/observatory.json', target), JSON.stringify(feed));
await writeFile(new URL('data/signals.json', target), JSON.stringify(record.signals));
await writeFile(new URL('data/companion.json', target), JSON.stringify(record.companion));
await writeFile(new URL('.nojekyll', target), '');
console.log('Pages bundle ready. ' + record.kind + ' edition ' + latest.checkpointAt + '; ' + feed.archive.length + ' official records retained.');
