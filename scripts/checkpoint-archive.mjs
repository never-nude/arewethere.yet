import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { checkpointWindow } from '../site/checkpoint-schedule.js';

const stamp = date => date.replaceAll(':', '-').replace('.000Z', 'Z');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function location(kind, checkpointAt, trigger) {
  if (kind === 'commissioning') return 'commissioning/baseline';
  // All attempts at the one initial measurement compete for the same write-once folder.
  return trigger?.type === 'initial-measurement' ? 'checkpoints/initial-measurement' : 'checkpoints/' + stamp(checkpointAt);
}

function validateRecord(record) {
  const { assessment, signals, kind, sourceRevision } = record;
  assert.equal(record.schemaVersion, 2);
  assert.ok(kind === 'commissioning' || kind === 'official');
  assert.ok(typeof sourceRevision === 'string' && /^[a-f\d]{40}$/.test(sourceRevision), 'Source revision must be a Git SHA.');
  assert.equal(assessment.kind, kind);
  for (const value of [assessment.checkpointAt, assessment.validatedAt, signals.checkedAt]) {
    assert.equal(new Date(value).toISOString(), value, 'Timestamps must be explicit UTC instants.');
  }
  assert.ok(assessment.checkpointAt <= signals.checkedAt && signals.checkedAt <= assessment.validatedAt, 'Invalid collection or verification chronology.');
  if (assessment.trigger) {
    const {type, actor, runId, requestedAt} = assessment.trigger;
    assert.equal(kind, 'official');
    assert.equal(type, 'initial-measurement');
    assert.equal(assessment.trigger.label, 'Launch test');
    assert.ok(typeof actor === 'string' && actor.trim() && typeof runId === 'string' && /^\d+$/.test(runId));
    assert.equal(new Date(requestedAt).toISOString(), requestedAt);
    assert.ok(requestedAt <= signals.checkedAt, 'Measurement precedes the original request.');
    assert.equal(assessment.checkpointAt, signals.checkedAt, 'The initial measurement must use actual collection time.');
    assert.equal(checkpointWindow(requestedAt).previous, checkpointWindow(assessment.validatedAt).previous,
      'The first measurement must complete before the next scheduled slot.');
  } else if (kind === 'official') {
    assert.equal(checkpointWindow(assessment.checkpointAt).previous, assessment.checkpointAt);
  }
  assert.ok(assessment.methodologyVersion && assessment.modelVersion && assessment.field);
  const ids = ['agi','asi','rsi','singularity'];
  assert.deepEqual(assessment.milestones.map(row=>row.id).sort(), ids);
  assert.deepEqual(assessment.forecasts.map(row=>row.id).sort(), ids);
  for (const milestone of assessment.milestones) {
    const {met,assessed,total} = milestone.coverage;
    assert.ok([met,assessed,total].every(Number.isInteger) && 0 <= met && met <= assessed && assessed <= total && total > 0);
    assert.ok(milestone.score === null || Number.isFinite(milestone.score) && milestone.score >= 0 && milestone.score <= 100);
    assert.ok(milestone.score !== 100 || met === total, 'A complete milestone requires all criteria.');
  }
  for (const forecast of assessment.forecasts) {
    if (forecast.status === 'Not reliably estimable') assert.ok(forecast.centralDate === null && forecast.range === null);
    else assert.ok(['Estimated','Observed'].includes(forecast.status) && Number.isFinite(Date.parse(forecast.centralDate)));
  }
  const nodes = assessment.field.nodes;
  assert.deepEqual(nodes.map(row=>row.id).sort(), [...ids,'current'].sort());
  for (const node of nodes) assert.ok(node.id === 'current' && node.coordinates === null ||
    Array.isArray(node.coordinates) && node.coordinates.length === 3 && node.coordinates.every(Number.isFinite));
  assert.ok(Array.isArray(signals.sources) && Array.isArray(signals.metrics));
  assert.ok(signals.metrics.some(metric => ['reliability','horizon','breadth'].includes(metric.id) &&
    metric.status === 'live' && Number.isFinite(metric.value)), 'No independent capability measurement could be rechecked. Keeping the previous assessment.');
}

async function list(dir) {
  try { return await readdir(dir, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

export async function readArchive(root) {
  const records = [];
  for (const group of ['commissioning', 'checkpoints']) {
    for (const slot of await list(path.join(root, group))) {
      assert.ok(slot.isDirectory(), 'Unexpected archive path.');
      if (slot.name.startsWith('.writing-')) continue;
      const dir = path.join(root, group, slot.name);
      const children = await readdir(dir);
      assert.ok(children.length === 1 && /^[a-f\d]{64}\.json$/.test(children[0]), 'Incomplete archived record.');
      const file = path.join(dir, children[0]);
      const bytes = await readFile(file);
      const sha256 = hash(bytes);
      assert.equal(children[0], sha256 + '.json', 'Archived assessment failed its checksum.');
      const record = JSON.parse(bytes);
      validateRecord(record);
      assert.equal(location(record.kind, record.assessment.checkpointAt, record.assessment.trigger), group + '/' + slot.name);
      const { checkpointAt, validatedAt } = record.assessment;
      records.push({ file, sha256, checkpointAt, validatedAt, sourceRevision: record.sourceRevision, kind: record.kind, trigger: record.assessment.trigger, previous: record.previousSha256,
        url: 'data/' + group + '/' + stamp(checkpointAt) + '.json' });
    }
  }
  records.sort((a,b) => a.checkpointAt.localeCompare(b.checkpointAt));
  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    assert.equal(row.previous, records[i - 1]?.sha256 ?? null, 'The archive chain is incomplete or out of order.');
    assert.ok(i === 0 || row.kind === 'official' && row.checkpointAt > records[i - 1].checkpointAt);
    if (row.trigger) assert.ok(i === 1 && records[0].kind === 'commissioning' && records[0].validatedAt <= row.trigger.requestedAt,
      'The initial measurement must directly follow the validated launch baseline.');
  }
  return records;
}

export async function appendRecord(root, record) {
  validateRecord(record);
  if (record.assessment.trigger) {
    const records = await readArchive(root);
    assert.ok(records.length === 1 && records[0].kind === 'commissioning' && records[0].sha256 === record.previousSha256
      && records[0].validatedAt <= record.assessment.trigger.requestedAt, 'The initial measurement must follow the validated launch baseline.');
  }
  const folder = location(record.kind, record.assessment.checkpointAt, record.assessment.trigger);
  const parent = path.join(root, path.dirname(folder));
  await mkdir(parent, {recursive:true});
  const temp = await mkdtemp(path.join(parent, '.writing-'));
  try {
    const bytes = JSON.stringify(record);
    await writeFile(path.join(temp, hash(bytes) + '.json'), bytes, { flag: 'wx' });
    // An occupied slot is a nonempty directory. rename cannot replace it.
    await rename(temp, path.join(root, folder));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

export function assertPublishedAncestry(records, publishedSha) {
  if (publishedSha) assert.ok(records.some(record => record.sha256 === publishedSha),
    'The current public assessment is missing from this archive. Publication would replace history.');
}

export function firstMeasurementRequest({ event, enabled, ref, createdAt, actor, runId }) {
  if (event !== 'workflow_dispatch' || enabled !== 'true') return null;
  assert.equal(ref, 'refs/heads/main', 'The first production measurement must use main.');
  assert.ok(typeof actor === 'string' && actor.trim() && typeof runId === 'string' && /^\d+$/.test(runId),
    'A first measurement needs its original GitHub actor and run ID.');
  assert.ok(createdAt && Number.isFinite(Date.parse(createdAt)), 'The first measurement needs its original request time.');
  return {type:'initial-measurement', label:'Launch test', requestedAt:new Date(createdAt).toISOString(), actor, runId};
}

export function nextRecord(records, scheduled, request = null, now = new Date()) {
  const previous = records.at(-1);
  if (request) {
    if (previous?.kind === 'official') return null; // A rerun can recover publication without sampling again.
    assert.ok(previous?.kind === 'commissioning' && previous.validatedAt <= request.requestedAt,
      'A first measurement needs a preceding validated launch baseline.');
    assert.ok(Date.parse(request.requestedAt) <= new Date(now).getTime()
      && checkpointWindow(request.requestedAt).previous === checkpointWindow(now).previous,
      'The original first-measurement request is outside this checkpoint window.');
    return {kind:'official', checkpointAt:null, trigger:request};
  }
  if (scheduled && (!previous || scheduled > previous.checkpointAt)) return { kind: 'official', checkpointAt: scheduled };
  if (!previous && !scheduled) return { kind: 'commissioning', checkpointAt: null };
  return null;
}
