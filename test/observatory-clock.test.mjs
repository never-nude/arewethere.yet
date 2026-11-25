import test from 'node:test';
import assert from 'node:assert/strict';
import { countdownParts, referenceInstant } from '../site/observatory-clock.js';

const parts = (start, end) => countdownParts(Date.parse(start), Date.parse(end));

test('a scenario year maps to the published UTC display convention', () => {
  assert.equal(new Date(referenceInstant(2062)).toISOString(), '2062-07-01T00:00:00.000Z');
});

test('a running countdown borrows across calendar boundaries', () => {
  assert.deepEqual(parts('2028-02-29T23:59:59Z', '2029-03-01T00:00:00Z'), [1, 0, 0, 0, 0, 1]);
  assert.deepEqual(parts('2027-01-31T12:00:00Z', '2027-03-01T11:59:59Z'), [0, 1, 0, 23, 59, 59]);
  assert.deepEqual(parts('2027-08-01T00:00:00Z', '2028-07-01T00:00:00Z'), [0, 11, 0, 0, 0, 0]);
  assert.deepEqual(parts('2062-06-30T23:59:59.750Z', '2062-07-01T00:00:00Z'), [0, 0, 0, 0, 0, 1]);
  assert.equal(parts('2062-07-01T00:00:00Z', '2062-07-01T00:00:00Z'), null);
});
