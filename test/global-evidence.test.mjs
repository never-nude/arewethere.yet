import assert from 'node:assert/strict';
import test from 'node:test';
import { collectGridDemand, reviewedObservations } from '../src/global-evidence.mjs';
import { checkpointMetrics } from '../src/signals.mjs';
import { evidenceRecords } from '../site/observatory-evidence.js';
const now = new Date('2026-11-24T19:00:00Z');
const actual = { ND: 34964, FORECAST_ACTUAL_INDICATOR: 'A', SETTLEMENT_DATE: '2026-11-24', SETTLEMENT_PERIOD: 15 };
function feed(row, last_modified = '2026-11-24T08:20:08.716002') {
  return async (url) =>
    new Response(
      JSON.stringify({
        success: true,
        result: url.includes('resource_show') ? { last_modified } : { records: [row] },
      }),
    );
}
test('grid source retains actual settlement interval and release date separately', async () => {
  const result = await collectGridDemand(feed(actual), now);
  assert.equal(result.value, 34964);
  assert.equal(result.publishedOn, '2026-11-24');
  assert.match(result.measurementDateBasis, /15/);
});
test('grid source refuses forecasts, future releases and unknown units or missing readings', async () => {
  for (const row of [
    { ...actual, FORECAST_ACTUAL_INDICATOR: 'F' },
    { ...actual, ND: null },
    { ...actual, SETTLEMENT_PERIOD: 51 },
  ])
    await assert.rejects(() => collectGridDemand(feed(row), now));
  await assert.rejects(() => collectGridDemand(feed(actual, '2026-11-25T08:20:00'), now));
});
test('reviewed observations retain provenance and explicitly missing test dates', () => {
  assert.equal(new Set(reviewedObservations.map((r) => r.id)).size, reviewedObservations.length);
  for (const r of reviewedObservations) {
    assert.ok(r.sourceUrl.startsWith('https://') && r.publishedOn && r.limitations && r.measurementDateBasis);
    assert.ok(Object.hasOwn(r, 'measuredOn'));
  }
});

test('global data-centre figures and national grid load have separate coverage', () => {
  assert.equal(reviewedObservations.find(row => row.id === 'iea-global-data-centres-2025').topic, 'data-centers');
});

test('an offline source preserves the complete previously retrieved series across multiple checkpoints', () => {
  const date = '2026-10-02';
  const cached = {
    id: 'breadth', label: 'Capability', value: 110, source: 'Evaluator', sourceUrl: 'https://example.org/data',
    asOf: date, status: 'snapshot', observations: [{date, label:'A', value:110}],
  };
  const full = { ...cached, status:'live', observations: [...cached.observations, {date, label:'B', value:95}] };
  const prior = { checkedAt: '2026-11-23T00:00:00Z', metrics: [full] };
  const current = { checkedAt: '2026-11-24T00:00:00Z', metrics: [cached] };
  const metrics = checkpointMetrics(current, prior);
  assert.equal(metrics[0].observations.length, 2);
  assert.equal(metrics[0].status, 'snapshot');
  const retry = checkpointMetrics(current, {...current, metrics});
  assert.deepEqual(new Set(evidenceRecords({...current, metrics:retry}, current.checkedAt).map(r => r.retrievedAt)), new Set([prior.checkedAt]));
  const live = checkpointMetrics({...current, metrics: [full]}, prior)[0];
  assert.equal(live.retrievedAt, current.checkedAt);
  assert.equal(live.status, 'live');
});
