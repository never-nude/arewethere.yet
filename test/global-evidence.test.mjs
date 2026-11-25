import assert from 'node:assert/strict';
import test from 'node:test';
import { collectGridDemand, reviewedObservations } from '../src/global-evidence.mjs';
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
