import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { buildObservatoryAssessment } from '../site/observatory-model.js';
import { deriveField } from '../site/observatory-field-model.js';
import { buildArrivalOutlook } from '../site/observatory-outlook-model.js';
import firstOutlook from '../site/data/first-arrival-outlook.json' with { type: 'json' };

const [filename, parentFile] = process.argv.slice(2);
assert.ok(filename, 'Pass the downloaded checkpoint and its predecessor, if any.');
const record = JSON.parse(await readFile(filename, 'utf8'));
if (record.kind === 'milestone-outlook') {
  assert.ok(parentFile, 'Pass the original evidence checkpoint as the next argument.');
  for (const name of ['observatory-outlook-model.js', 'observatory-outlook-sources.js']) {
    const modelBytes = await readFile(new URL('../site/' + name, import.meta.url));
    assert.equal(createHash('sha256').update(modelBytes).digest('hex'), record.modelFileSha256[name],
      'Model or sources differ. Use the source revision that published this bulletin.');
  }
  const bytes = await readFile(parentFile);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), record.basedOnSha256, 'Incorrect evidence checkpoint.');
  const base = JSON.parse(bytes);
  assert.equal(base.assessment.checkpointAt, record.basedOnCheckpoint);
  assert.deepEqual(buildArrivalOutlook(base.assessment, { researchForecast: base.signals.researchForecast }), record.outlook);
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
  previousOutlook: previous?.arrivalOutlook ?? (record.previousSha256 === firstOutlook.basedOnSha256 ? firstOutlook.outlook : null),
});
rebuilt.kind = record.kind;
if (record.assessment.trigger) rebuilt.trigger = record.assessment.trigger;
rebuilt.field = deriveField(rebuilt);
assert.deepEqual(rebuilt, record.assessment, 'Replay differed. Use the archived source revision ' + record.sourceRevision + '.');
console.log('Reproduced ' + record.assessment.checkpointAt + ' from archived observations and model inputs.');
