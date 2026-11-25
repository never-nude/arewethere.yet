import test from 'node:test';
import assert from 'node:assert/strict';
import { buildObservatoryAssessment as assess, methodologyVersion } from '../site/observatory-model.js';
import { validateIndicators } from '../site/observatory-forecast.js';

const checkpoint = '2026-11-24T21:00:00.000Z';
const source = { checkedAt: checkpoint, metrics: [], events: [] };
const run = (extra = {}, previous = null) =>
  assess({ ...source, ...extra }, { checkpointAt: checkpoint, previous });
const find = (a, id) => a.milestones.find((m) => m.id === id);
const evidence = (id, system = 'Test system') => ({
  id,
  topic: 'generalization',
  label: 'Independent test record',
  value: 1,
  unit: 'ratio',
  system,
  organization: 'Developer A',
  source: 'Evaluator B',
  sourceUrl: 'https://evaluation.example/paper',
  publishedOn: '2025-02-01',
  measuredOn: '2025-01-01',
  classification: 'Independent evaluation',
  limitations: 'One documented endpoint.',
});
const review = (criterion, id, result = 'met', system = 'Test system') => ({
  criterion,
  evidenceIds: [id],
  result,
  system,
  rationale: 'Protocol and independent replication reviewed.',
  reviewer: 'Method panel',
  protocolUrl: 'https://evaluation.example/protocol',
  reviewedAt: '2026-01-01',
  methodologyVersion,
});
const agi = ['agi-breadth', 'agi-transfer', 'agi-reliability'];

test('empty sources, capability proxies and mere model launches cannot earn points', () => {
  const a = run({
    events: [{ category: 'Release', title: 'A launch' }],
    observatoryObservations: [evidence('proxy')],
  });
  for (const m of a.milestones) {
    assert.equal(m.score, null);
    assert.equal(m.coverage.assessed, 0);
  }
  assert.ok(
    a.forecasts.every((f) => f.status === 'Not reliably estimable' && f.centralDate === null && f.range === null),
  );
});

test('independent and disjoint same-system gates, zero and ASI logical implication', () => {
  const required = [...agi, 'asi-experts'];
  const sources = required.map((id) => evidence(id));
  let a = run({ observatoryObservations: sources, criterionReviews: required.map((id) => review(id, id)) });
  assert.equal(find(a, 'asi').score, 100);
  assert.equal(find(a, 'agi').score, 100);
  assert.equal(find(a, 'rsi').score, null);
  assert.equal(a.forecasts.find((f) => f.id === 'agi').status, 'Observed');
  a = run({ observatoryObservations: sources, criterionReviews: agi.map((id) => review(id, id, 'unmet')) });
  assert.equal(find(a, 'agi').score, 0);
  assert.equal(find(a, 'agi').coverage.assessed, 3);
  a = run({
    observatoryObservations: sources,
    criterionReviews: agi.map((id, i) => review(id, id, i === 0 ? 'met' : 'unmet')),
  });
  assert.equal(find(a, 'agi').score, 33);
  const double = run({
    observatoryObservations: [evidence('one')],
    criterionReviews: agi.map((id) => review(id, 'one')),
  });
  assert.equal(find(double, 'agi').score, null);
});

test('conflicts, partial coverage and different labs cannot silently complete a milestone', () => {
  const observations = [...agi.map((id) => evidence(id)), evidence('counter'), evidence('other', 'Other system')];
  const a = run({
    observatoryObservations: observations,
    criterionReviews: [...agi.map((id) => review(id, id)), review('agi-breadth', 'counter', 'unmet')],
  });
  assert.equal(find(a, 'agi').score, null);
  assert.equal(find(a, 'agi').criteria[0].status, 'conflicting');
  const split = run({
    observatoryObservations: observations,
    criterionReviews: [
      ...agi.slice(1).map((id) => review(id, id)),
      review('agi-breadth', 'other', 'met', 'Other system'),
    ],
  });
  assert.equal(find(split, 'agi').score, null);
  assert.equal(find(split, 'agi').coverage.met, 2);
  const firstParty = run({
    observatoryObservations: [{ ...evidence('x'), classification: 'First-party measurement' }],
    criterionReviews: [review('agi-breadth', 'x')],
  });
  assert.equal(find(firstParty, 'agi').coverage.met, 0);
});

test('known-by cutoffs, provenance, and reconstructing an archived checkpoint', () => {
  const a = run({
    observatoryObservations: [{ ...evidence('later'), publishedOn: '2027-01-01' }, evidence('ok')],
    metrics: [
      {
        id: 'reliability',
        source: 'METR',
        sourceUrl: 'https://metr.org/',
        label: 'Task horizon',
        asOf: '2026-11-25',
        history: [{ date: '2025-01-01', value: 3, label: 'X' }],
      },
      {
        id: 'breadth',
        source: 'Epoch',
        sourceUrl: 'https://epoch.ai/',
        label: 'ECI',
        asOf: '2025-01-01',
        observations: [{ date: '2025-01-01', value: 150, label: 'M' }],
      },
    ],
  });
  assert.ok(!a.observations.some((o) => o.id === 'later' || o.topic === 'reliability'));
  const ec = a.observations.find((o) => o.topic === 'breadth');
  assert.equal(ec.referenceOn, '2025-01-01');
  assert.equal(ec.measuredOn, null);
  assert.equal(ec.publishedOn, null);
  assert.throws(() => assess(source, { checkpointAt: checkpoint, validatedAt: '2025-01-01' }));
  const prior = assess(
    { ...source, checkedAt: '2026-11-24T14:30:00.000Z', observatoryObservations: [evidence('ok')] },
    { checkpointAt: '2026-11-24T14:30:00.000Z' },
  );
  const old = JSON.stringify(prior);
  const next = run({ observatoryObservations: [{ ...evidence('ok'), value: 2 }] }, prior);
  assert.match(next.changes.join(' '), /revised/);
  assert.equal(JSON.stringify(prior), old);
  assert.deepEqual(run(), run());
});

test('X factors have independently signed consequences, and unsupported attribution stays unknown', () => {
  const rows = [evidence('disruption'), evidence('research')];
  const shock = {
    id: 'test-shock',
    label: 'Conditional test event',
    source: 'Official bulletin',
    sourceUrl: 'https://evaluation.example/bulletin',
    publishedOn: '2026-11-20',
    attribution: 'Verified direct AI involvement',
    effects: [
      { area: 'Compute', direction: 'Delay', detail: 'Supply interrupted', evidenceIds: ['disruption'] },
      { area: 'Research', direction: 'Advance', detail: 'Measured gain', evidenceIds: ['research'] },
    ],
  };
  const a = run({ observatoryObservations: rows, observatoryEvents: [shock] });
  assert.equal(a.xFactors.events[0].attribution, 'Unknown');
  assert.deepEqual(
    a.xFactors.events[0].effects.map((e) => e.direction),
    ['Delay', 'Advance'],
  );
  assert.ok(a.xFactors.scenarios.every((s) => s.probability === null));
  assert.ok(a.milestones.every((m) => m.score === null));
  const unrelated = run({
    observatoryObservations: rows,
    observatoryEvents: [{ ...shock, attributionEvidenceIds: ['research'] }],
  });
  assert.equal(unrelated.xFactors.events[0].attribution, 'Unknown');
  const attribution = {
    ...evidence('investigation'),
    topic: 'event-attribution',
    eventId: shock.id,
    finding: shock.attribution,
  };
  const b = run({
    observatoryObservations: [...rows, attribution],
    observatoryEvents: [{ ...shock, attributionEvidenceIds: ['investigation'] }],
  });
  assert.equal(b.xFactors.events[0].attribution, 'Verified direct AI involvement');
});

test('chronological mathematical comparison keeps a genuinely later validation block', () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({
    ...evidence('t' + i),
    topic: 'horizon',
    label: 'Time',
    unit: 'h',
    value: 2 + i,
    referenceOn: new Date(Date.UTC(2020, i, 1)).toISOString().slice(0, 10),
  }));
  const first = validateIndicators(rows).find((v) => v.topic === 'horizon');
  assert.equal(first.months, 20);
  assert.ok(first.holdoutCount >= 4);
  assert.equal(first.models.length, 3);
  const damaged = rows.map((r, i) => ({ ...r, value: i >= 17 ? 1e4 : r.value }));
  const second = validateIndicators(damaged).find((v) => v.topic === 'horizon');
  assert.equal(second.selected, first.selected);
  assert.equal(second.models[1].selectionMAE, first.models[1].selectionMAE);
  assert.ok(second.models[1].holdoutMAE > first.models[1].holdoutMAE);
});

test('conditional date model requires calibrated repetitions for every necessary criterion in the same lineage', () => {
  const base = Date.parse('2025-10-01'),
    ms = 86400000,
    date = (n) => new Date(base + n * ms).toISOString().slice(0, 10);
  const observations = [],
    trajectories = [];
  for (const id of agi) {
    const observationIds = [];
    for (let i = 0; i < 20; i++) {
      const key = id + i;
      observationIds.push(key);
      observations.push({
        ...evidence(key),
        topic: id,
        value: 10 + i,
        protocolUrl: 'https://evaluation.example/protocol',
        measuredOn: date(i * 20),
        publishedOn: date(i * 20 + 1),
      });
    }
    trajectories.push({
      criterion: id,
      system: 'Test system',
      target: 33,
      direction: 'above',
      observationIds,
      calibration: 'Independent calibration of the endpoint to this gate.',
      registeredOn: '2024-01-01',
      reviewedAt: '2026-04-01',
      reviewer: 'Review panel',
      protocolUrl: 'https://evaluation.example/protocol',
    });
  }
  const start = run({ observatoryObservations: observations, criterionTrajectories: trajectories });
  const f = start.forecasts.find((f) => f.id === 'agi');
  assert.equal(f.status, 'Estimated');
  assert.ok(f.centralDate > '2026-11-24');
  assert.ok(f.range.low <= f.centralDate);
  const tooFar = run({
    observatoryObservations: observations,
    criterionTrajectories: trajectories.map((t) => ({ ...t, target: 1000 })),
  });
  assert.equal(tooFar.forecasts[0].centralDate, null);
  const missing = run({ observatoryObservations: observations, criterionTrajectories: trajectories.slice(1) });
  assert.equal(missing.forecasts[0].centralDate, null);
  const leaked = run({
    observatoryObservations: observations.map((r) => ({ ...r, publishedOn: '2026-11-01' })),
    criterionTrajectories: trajectories,
  });
  assert.equal(leaked.forecasts[0].centralDate, null);
  const lateProtocol = run({
    observatoryObservations: observations,
    criterionTrajectories: trajectories.map((t) => ({
      ...t,
      registeredOn: '2026-11-01',
      reviewedAt: '2026-11-15',
    })),
  });
  assert.equal(lateProtocol.forecasts[0].centralDate, null);
  const selfTested = run({
    observatoryObservations: observations.map((r) => ({ ...r, classification: 'First-party measurement' })),
    criterionTrajectories: trajectories,
  });
  assert.equal(selfTested.forecasts[0].centralDate, null);
  const schedule = {
    ...evidence('schedule'),
    topic: 'research-schedule',
    eventId: 'capacity',
    criterion: agi[0],
    unit: 'days',
    value: 90,
    measuredOn: '2026-11-16',
    publishedOn: '2026-11-17',
    basis: 'Net critical-path shift',
  };
  const event = {
    id: 'capacity',
    label: 'Documented change to the test program',
    source: 'Independent evaluator',
    sourceUrl: 'https://evaluation.example/delay',
    publishedOn: '2026-11-17',
    effects: [
      {
        area: 'Research time',
        direction: 'Delay',
        detail: 'Measured net change to this program',
        evidenceIds: ['schedule'],
      },
    ],
  };
  const delayed = run({
    observatoryObservations: [...observations, schedule],
    observatoryEvents: [event],
    criterionTrajectories: trajectories,
  });
  assert.ok(delayed.forecasts[0].centralDate > f.centralDate);
  assert.equal(delayed.forecasts[0].drivers[0].adjustment.days, 90);
  assert.deepEqual(delayed.milestones, start.milestones);
});
