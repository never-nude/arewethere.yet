import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEventPace } from '../site/observatory-event-pace.js';

const cutoff = '2026-11-25T14:37:00.000Z';
const dayMs = 86_400_000;
const edition = { evidenceCutoff: cutoff, observations: [] };
const emptyFeed = {
  checkedAt: cutoff,
  releaseStart: '2025-11-25',
  releaseEvents: [],
  sources: [
    { id: 'openai', status: 'live' },
    { id: 'anthropic', status: 'live' },
  ],
};
function feedWithCounts(counts) {
  const first = Date.parse('2026-11-25') - 360 * dayMs;
  const events = [];
  for (const [i, n] of counts.entries()) {
    for (let j = 0; j < n; j++) {
      const date = new Date(first + (30 * i + Math.floor(j / 2)) * dayMs).toISOString().slice(0, 10);
      const openai = j % 2 === 0;
      events.push({
        source: openai ? 'OpenAI' : 'Anthropic',
        category: 'Release',
        date,
        url: 'https://' + (openai ? 'openai.com' : 'www.anthropic.com') + '/index/' + i + '-' + j,
      });
    }
  }
  return { ...emptyFeed, releaseEvents: events };
}
function scored(name, date, value) {
  return {
    topic: 'breadth',
    source: 'Epoch AI',
    datasetUrl: 'https://epoch.ai/data/eci_scores.csv',
    unit: 'ECI',
    classification: 'Independent evaluation',
    referenceDateBasis: 'Model release date',
    sourceStatus: 'live',
    system: name,
    referenceOn: date,
    retrievedAt: cutoff,
    value,
  };
}

test('release-day cadence deduplicates announcements and omits partial days, unrelated news and copied stories', () => {
  const feed = structuredClone(emptyFeed);
  const event = {
    source: 'Anthropic',
    category: 'Release',
    date: '2026-11-07',
    url: 'https://platform.claude.com/docs/en/release-notes/overview#november-7',
  };
  feed.releaseEvents.push(
    event,
    { ...event, url: 'https://www.anthropic.com/news/new-model' },
    { ...event, date: '2026-11-08', url: event.url + '?irrelevant-alias' },
    { ...event, date: '2026-11-09', url: 'https://platform.claude.com/docs/en/release-notes/overview#november-9' },
    { ...event, date: '2026-11-12', url: 'https://my-press-service.test/news/model' },
    { ...event, date: '2026-11-13', category: 'Research', url: 'https://anthropic.com/research/study' },
    { ...event, date: '2026-11-14', url: 'https://www.anthropic.com/news/new-model?utm_campaign=release' },
    { source: 'OpenAI', category: 'Release', date: '2026-11-07', url: 'https://openai.com/index/new-model' },
    { source: 'OpenAI', category: 'Release', date: '2026-11-25', url: 'https://openai.com/index/partial-day' },
  );
  // Tracking parameters belong before the release-note anchor.
  feed.releaseEvents[2].url =
    'https://platform.claude.com/docs/en/release-notes/overview?utm_medium=feed#november-7';
  const pace = buildEventPace(edition, feed);
  assert.equal(pace.periods.length, 12);
  assert.equal(pace.periods.at(-1).releaseDays, 3);
  assert.equal(pace.periods.at(-1).end, '2026-11-24');
  assert.equal(pace.periods.at(-2).releaseDays, 0);
  assert.equal(pace.periods.at(-1).scoredModels, null);
  assert.deepEqual(pace, JSON.parse(JSON.stringify(pace)));
  assert.deepEqual(buildEventPace(edition, { ...feed, releaseEvents: feed.releaseEvents.reverse() }), pace);
});

test('unknown feed coverage yields an open count; a fully covered empty window yields zero', () => {
  assert.equal(buildEventPace(edition, emptyFeed).periods.at(-1).releaseDays, 0);
  for (const broken of [
    { ...emptyFeed, checkedAt: '2026-11-26' },
    { ...emptyFeed, releaseStart: null },
    {
      ...emptyFeed,
      sources: [
        { id: 'openai', status: 'live' },
        { id: 'anthropic', status: 'unavailable' },
      ],
    },
    { ...emptyFeed, releaseEvents: null },
    { ...emptyFeed, releaseStart: '2026-11-04' },
    { ...emptyFeed, checkedAt: '2026-11-20' },
  ])
    assert.equal(buildEventPace(edition, broken).periods.at(-1).releaseDays, null);
});

test('scored releases and changes in best ECI share the eligible population and never backfill missing days', () => {
  const observations = [
    scored('Earlier', '2024-03-01', 110),
    scored('Alpha', '2026-11-01', 124),
    scored('Alpha', '2026-11-01', 124),
    scored('Beta', '2026-11-04', 122),
    { ...scored('Later vintage', '2026-11-03', 140), retrievedAt: '2026-11-26' },
    scored('Today', '2026-11-25', 150),
  ];
  const p = buildEventPace({ ...edition, observations }, emptyFeed);
  assert.equal(p.periods.at(-1).scoredModels, 2);
  assert.equal(p.periods.at(-1).frontierGain, 14);
  assert.deepEqual(p.periods.at(-1).scoreChanges, [
    { date: '2026-11-01', from: 110, to: 124, gain: 14, models: ['Alpha'] },
  ]);
  assert.equal(p.periods.at(-2).frontierGain, 0);
  const snapshot = observations.map((o) => ({ ...o, sourceStatus: 'snapshot', retrievedAt: '2026-11-10' }));
  assert.equal(
    buildEventPace({ ...edition, observations: snapshot }, emptyFeed).periods.at(-1).scoredModels,
    null,
  );
});

test('exponential count fit must predict later windows consistently and exclude a flat rate', () => {
  const fast = [1, 1, 2, 2, 3, 4, 6, 8, 11, 16, 22, 32];
  const growing = buildEventPace(edition, feedWithCounts(fast)).activityFit;
  assert.equal(growing.holdouts, 4);
  assert.equal(growing.stabilityWins, 4);
  assert.equal(growing.supported, true);
  assert.ok(growing.perWindowInterval.low > 0);
  assert.ok(growing.doublingDays > 0 && growing.doublingDays < 150);
  const quiet = buildEventPace(edition, feedWithCounts(Array(12).fill(2))).activityFit;
  assert.equal(quiet.supported, false);
  assert.equal(quiet.doublingDays, null);
  const weak = buildEventPace(edition, feedWithCounts([2, 0, 4, 1, 2, 1, 1, 3, 0, 4, 3, 3])).activityFit;
  assert.equal(weak.bestHeldout, 'exponential');
  assert.equal(weak.supported, false);
  assert.ok(weak.perWindowInterval.low < 0);
  assert.equal(weak.doublingDays, null);
});

test('reviewed impacts keep source populations, units, public dates and follow-up revisions distinct', () => {
  const early = buildEventPace({ evidenceCutoff: '2025-02-01', observations: [] }, null);
  assert.equal(early.impacts.length, 0);
  const mid = buildEventPace({ evidenceCutoff: '2025-08-01', observations: [] }, null);
  assert.equal(mid.impacts.find((r) => r.id === 'developer-completion-time').followupUrl, undefined);
  const study = buildEventPace(edition, null).impacts;
  assert.match(study.find((r) => r.id === 'developer-completion-time').followupUrl, /2026-02-24/);
  assert.equal(study.find((r) => r.id === 'service-issues-resolved').unit, '% more issues per hour');
  const first = {
    id: 'known',
    topic: 'research-autonomy',
    source: 'OpenAI',
    label: 'Unassisted research tasks',
    unit: '%',
    sourceUrl: 'https://openai.com/index/research-acceleration-jagged-frontier/',
    classification: 'First-party measurement',
    referenceOn: '2026-03-31',
    publishedOn: '2026-11-18',
    value: 13,
  };
  const final = { ...first, id: 'second', referenceOn: '2026-10-31', value: 35 };
  const impacts = buildEventPace(
    {
      ...edition,
      observations: [
        first,
        final,
        { ...first, sourceUrl: 'https://example.com', value: 79 },
        { ...final, value: 55, referenceOn: '2026-12-01' },
      ],
    },
    null,
  ).impacts;
  const change = impacts.find((r) => r.id === 'openai-unassisted-tasks');
  assert.deepEqual(
    [change.value, change.fromValue, change.toValue, change.unit],
    [22, 13, 35, 'percentage points'],
  );
  assert.deepEqual(change.observationIds, ['known', 'second']);
});
