import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { buildObservatoryAssessment } from '../site/observatory-model.js';
import { deriveField } from '../site/observatory-field-model.js';

const [filename, parentFile] = process.argv.slice(2);
assert.ok(filename, 'Pass the downloaded checkpoint and its predecessor, if any.');
const record = JSON.parse(await readFile(filename, 'utf8'));
let previous = null;
if (record.previousSha256) {
  assert.ok(parentFile, 'This checkpoint requires a predecessor with SHA-256 ' + record.previousSha256);
  const bytes = await readFile(parentFile);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), record.previousSha256, 'Incorrect predecessor.');
  previous = JSON.parse(bytes).assessment;
}
const rebuilt = buildObservatoryAssessment(record.signals, {
  checkpointAt: record.assessment.checkpointAt, validatedAt: record.assessment.validatedAt, previous,
});
rebuilt.kind = record.kind;
rebuilt.field = deriveField(rebuilt);
assert.deepEqual(rebuilt, record.assessment, 'Replay differed. Use the archived source revision ' + record.sourceRevision + '.');
console.log('Reproduced ' + record.assessment.checkpointAt + ' from archived observations and model inputs.');
