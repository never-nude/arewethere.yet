import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { buildObservatoryAssessment } from '../site/observatory-model.js';
import { deriveField } from '../site/observatory-field-model.js';
import { buildArrivalOutlook } from '../site/observatory-outlook-model.js';
import { previouslyIssuedOutlook } from './issued-outlooks.mjs';
import { buildEventPace } from '../site/observatory-event-pace.js';
import { buildPaceOutlook } from '../site/observatory-pace-model.js';

const [filename, parentFile] = process.argv.slice(2);
assert.ok(filename, 'Pass the downloaded checkpoint and its predecessor, if any.');
const record = JSON.parse(await readFile(filename, 'utf8'));
if (record.kind === 'milestone-outlook' || record.kind === 'pace-outlook') {
  assert.ok(parentFile, 'Pass the original evidence checkpoint as the next argument.');
  const models = record.kind === 'milestone-outlook' ? ['observatory-outlook-model.js', 'observatory-outlook-sources.js'] :
    ['observatory-outlook-model.js', 'observatory-outlook-sources.js', 'observatory-pace-model.js', 'observatory-pace-fit.js', 'observatory-event-pace.js', 'observatory-scored-models.js', 'observatory-criteria.js'];
  for (const name of models) {
    const modelBytes = await readFile(new URL('../site/' + name, import.meta.url));
    assert.equal(createHash('sha256').update(modelBytes).digest('hex'), record.modelFileSha256[name],
      'Model or sources differ. Use the source revision that published this bulletin.');
  }
  const bytes = await readFile(parentFile);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), record.basedOnSha256, 'Incorrect evidence checkpoint.');
  const base = JSON.parse(bytes);
  assert.equal(base.assessment.checkpointAt, record.basedOnCheckpoint);
  const original = base.assessment.arrivalOutlook;
  const replayed = record.kind === 'pace-outlook' ? buildPaceOutlook(base.assessment, original, {
    previous: original, researchForecast: base.signals.researchForecast, eventPace: buildEventPace(base.assessment, base.signals),
  }) : buildArrivalOutlook(base.assessment, {researchForecast: base.signals.researchForecast});
  assert.deepEqual(replayed, record.outlook);
  console.log('Reproduced all four arrival outlooks from the verified evidence checkpoint.');
  process.exit(0);
}
let previous = null;
if (record.previousSha256) {
  assert.ok(parentFile, 'This checkpoint requires a predecessor with SHA-256 ' + record.previousSha256);
  const bytes = await readFile(parentFile);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), record.previousSha256, 'Incorrect predecessor.');
  previous = JSON.parse(bytes).assessment;
}
const rebuilt = buildObservatoryAssessment(record.signals, {
  checkpointAt: record.assessment.checkpointAt, validatedAt: record.assessment.validatedAt, previous,
  includeIndicatorForecasts: Object.hasOwn(record.assessment, 'indicatorForecasts'),
  includeArrivalOutlook: Object.hasOwn(record.assessment, 'arrivalOutlook'),
  includePaceOutlook: !!record.assessment.arrivalOutlook?.pace,
  previousOutlook: previouslyIssuedOutlook(previous, record.previousSha256, !!record.assessment.arrivalOutlook?.pace),
});
rebuilt.kind = record.kind;
if (record.assessment.trigger) rebuilt.trigger = record.assessment.trigger;
rebuilt.field = deriveField(rebuilt);
assert.deepEqual(rebuilt, record.assessment, 'Replay differed. Use the archived source revision ' + record.sourceRevision + '.');
console.log('Reproduced ' + record.assessment.checkpointAt + ' from archived observations and model inputs.');
