import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getSignals } from '../src/signals.mjs';

const https = value => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
};

// Discovery records keep their stated source and retrieval time. Capability
// scores, criterion reviews, and forecasts are never imported from this queue.
export function pendingEvidence(scans, since, cutoff) {
  const eligible = scans.filter(scan => scan.schemaVersion === 1 && Date.parse(scan.checkedAt) > Date.parse(since) &&
    Date.parse(scan.checkedAt) <= Date.parse(cutoff)).sort((a,b) => a.checkedAt.localeCompare(b.checkedAt));
  const events = new Map();
  const incidents = new Map();
  const infrastructure = new Map();
  for (const scan of eligible) {
    for (const row of scan.events ?? []) {
      if (row.source && row.title && https(row.url) && Date.parse(row.date) <= Date.parse(scan.checkedAt)) {
        events.set(row.url, { ...row, retrievedAt: scan.checkedAt });
      }
    }
    for (const row of scan.infrastructureObservations ?? []) {
      if (row.topic === 'energy' && row.id?.startsWith('gb-demand-') && https(row.sourceUrl) &&
        Number.isFinite(row.value) && Date.parse(row.measuredOn) <= Date.parse(scan.checkedAt) &&
        Date.parse(row.publishedOn) <= Date.parse(scan.checkedAt)) {
        infrastructure.set(row.id, { ...row, retrievedAt: scan.checkedAt });
      }
    }
    for (const row of scan.incidents ?? []) {
      if (row.id && row.source && https(row.url) && Date.parse(row.startedAt) <= Date.parse(scan.checkedAt)) {
        incidents.set(row.id, { ...row, retrievedAt: scan.checkedAt });
      }
    }
  }
  return { scans: eligible.map(scan=>({checkedAt:scan.checkedAt,sourceStatuses:scan.sourceStatuses})),
    events: [...events.values()], incidents:[...incidents.values()], infrastructureObservations:[...infrastructure.values()] };
}

export async function loadCandidateQueue(dir, since, cutoff) {
  if (!dir) return { status: 'Checkpoint sources only', ...pendingEvidence([], since, cutoff) };
  const entries = await readdir(dir, {withFileTypes:true});
  const captures = await Promise.all(entries.filter(entry=>entry.isDirectory()).map(entry=>
    readFile(path.join(dir,entry.name,'candidate.json'),'utf8').then(JSON.parse)));
  const status = await readFile(path.join(dir,'status.txt'),'utf8');
  return { status:status.trim(), ...pendingEvidence(captures, since, cutoff) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const feed = await getSignals();
  if (!feed.sources.some(source=>source.status==='live')) throw new Error('No source responded to discovery.');
  const capture = {schemaVersion:1,checkedAt:feed.checkedAt,events:feed.events,incidents:feed.incidents,
    infrastructureObservations: feed.observatoryObservations?.filter(row=>row.topic === 'energy' && row.id?.startsWith('gb-demand-')) ?? [],
    sourceStatuses: [...feed.sources,...feed.incidentSources].map(row=>({source:row.provider ?? row.source ?? row.organization ?? row.name,status:row.status})) };
  await writeFile(process.argv[2] || 'candidate.json', JSON.stringify(capture));
}
