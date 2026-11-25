import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogEntries, chartMeasurements, rankingsThrough, scoreDomain } from '../site/observatory-charts.js';

const assessment = rows => ({ evidenceCutoff: '2026-11-25T00:00:00Z', observations: rows });
const score = (system, value, overrides = {}) => ({
  topic: 'breadth', source: 'Epoch AI', datasetUrl: 'https://epoch.ai/data/eci_scores.csv',
  classification: 'Independent evaluation', unit: 'ECI', system, value, referenceOn: '2026-10-01',
  referenceDateBasis: 'Model release date', weightAccess: 'Open weights', sourceStatus: 'live', ...overrides,
});
const horizon = (system, value, referenceOn, overrides = {}) => ({
  topic: 'reliability', source: 'METR', classification: 'Independent evaluation', unit: 'h',
  referenceDateBasis: 'Model release date', publishedOn: '2026-11-20', system, value, referenceOn, ...overrides,
});

test('rankings compare like scores, keep distinct releases and ignore records beyond an edition', () => {
  const rows = [
    score('Cedar', 120), score('Cedar', 118, { referenceOn: '2026-11-01' }),
    score('Cedar Mini', 119), score('Oak', 150, { weightAccess: 'Closed weights', sourceStatus: 'snapshot' }),
    score('Wrong scale', 600, { unit: '%' }), score('Unreleased', 600, { referenceOn: '2026-12-01' }),
    score('Retracted', 600, { sourceStatus: 'withdrawn' }), score('Late', 600, { publishedOn: '2026-11-30' }),
    score('Different test', 600, { datasetUrl: 'https://example.org/test' }), score('Unknown', 600, { weightAccess: null }),
    score('Retrieved after cutoff', 600, { retrievedAt: '2026-11-25T01:00:00Z' }), score('Wrong classification', 600, { classification: 'First-party measurement' }),
  ];
  const { rankings } = chartMeasurements(assessment(rows));
  assert.deepEqual(rankings.open.map(row => row.system), ['Cedar Mini', 'Cedar']);
  assert.equal(rankings.open[1].value, 118);
  assert.deepEqual(rankings.closed.map(row => row.system), ['Oak']);
  assert.deepEqual(rankings.other.map(row => row.system), ['Unknown']);
});

test('release scrubber shows only eligible releases and scores versions using the selected edition', () => {
  const data = chartMeasurements(assessment([score('Cedar', 136), score('Oak', 135, { weightAccess: 'Closed weights' }),
    score('Cedar', 139, { referenceOn: '2026-11-01' }), score('Willow', 135, { weightAccess: null })]));
  assert.deepEqual(catalogEntries(rankingsThrough(data.modelRows, '2026-09')), []);
  const catalog = catalogEntries(rankingsThrough(data.modelRows, '2026-10'));
  assert.deepEqual(catalog.map(entry => [entry.row.system, entry.rank]), [['Cedar', 1], ['Oak', 2], ['Willow', 2]]);
  assert.equal(catalog[0].row.value, 136);
  assert.deepEqual(data.rankings.open.map(row => row.value), [139]);
});

test('shared scale contains both groups and handles absent or malformed intervals without inventing bounds', () => {
  assert.deepEqual(scoreDomain([{ value: 160, low: null, high: null }, { value: 175, low: 170, high: 181 }]), [155, 185]);
  assert.deepEqual(scoreDomain([{ value: 160, low: -105, high: 159 }]), [159, 161]);
  assert.equal(scoreDomain([]), null);
});

test('monthly 50% and 80% peaks rank independently within each suite’s latest report', () => {
  const rows = [
    horizon('A', 1, '2026-01-01'), horizon('B', 2, '2026-03-05'),
    horizon('C', 1.5, '2026-03-20'), horizon('Old suite', 90, '2026-03-06', { publishedOn: '2026-04-10' }),
    horizon('B', 22, '2026-03-05', { topic: 'horizon', publishedOn: '2026-05-05' }),
    horizon('C', 28, '2026-03-20', { topic: 'horizon' }), horizon('B', 26, '2026-03-05', { topic: 'horizon' }),
  ];
  const { history, halfHistory } = chartMeasurements(assessment(rows));
  assert.deepEqual(history.map(row => row.system), ['A', 'B']);
  assert.deepEqual(halfHistory.map(row => [row.system, row.value]), [['C', 28]]);
});

test('research comparisons retain their attribution and report only evidence available in the edition', () => {
  const rate = { topic: 'research-acceleration', unit: '×', referenceOn: '2026-10-01', source: 'METR',
    organization: 'Anthropic', classification: 'Independent evaluation', value: 1.9 };
  const share = { topic: 'research-autonomy', unit: '%', referenceOn: '2026-10-05', source: 'OpenAI',
    organization: 'OpenAI', classification: 'First-party measurement', value: 35 };
  const result = chartMeasurements(assessment([rate, { ...rate, referenceOn: '2026-12-01' }, share, { ...share, value: 135 }]));
  assert.equal(result.rate, rate);
  assert.deepEqual(result.tasks, [share]);
  assert.deepEqual(chartMeasurements({}).history, []);
  assert.equal(chartMeasurements({}).rate, undefined);
});
