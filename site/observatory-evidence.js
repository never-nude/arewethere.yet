import { dated, safeLink } from './observatory-criteria.js';

const metricTopics = {
  breadth: [
    'Independent evaluation',
    'Epoch’s combined test score measures benchmark performance. It does not establish skilled-human breadth or unfamiliar-task transfer. Uncertainty intervals can overlap.',
  ],
  horizon: [
    'Independent evaluation',
    'The 50% success horizon concerns a selected task suite. Model release dates locate the tests historically; publication can occur later.',
  ],
  reliability: [
    'Independent evaluation',
    'The 80% success horizon concerns selected verifiable tasks. It cannot establish reliability across all cognitive domains.',
  ],
  compute: [
    'Independent estimate',
    'Training computation is a resource input. Estimates may be revised and some runs have no public estimate.',
  ],
  'research-autonomy': [
    'First-party measurement',
    'The lab chose internal research tasks. The percentage does not establish independently replicated end-to-end research.',
  ],
  'research-acceleration': [
    'Independent evaluation',
    'An estimated change at one lab has multiple potential causes. It does not isolate AI’s contribution across successor generations.',
  ],
};
const catalogs = [
  ['breadth', 'Broad capability and general reasoning'],
  ['generalization', 'Unfamiliar-task generalization'],
  ['reliability', 'Reliable autonomous work'],
  ['horizon', 'Autonomous task duration'],
  ['scientific-discovery', 'Scientific discovery and experimentation'],
  ['research-autonomy', 'Autonomous AI research'],
  ['successor-development', 'AI-assisted successor development'],
  ['recursive-improvement', 'Repeated successor improvement'],
  ['research-acceleration', 'Research productivity and capability growth'],
  ['compute', 'Computing resources'],
  ['algorithmic-efficiency', 'Algorithmic efficiency'],
  ['semiconductors', 'Semiconductor production'],
  ['energy', 'Energy availability'],
  ['data-centers', 'Data-center capacity and electricity use'],
  ['strategic-reasoning', 'Strategic reasoning'],
  ['oversight', 'Oversight and intervention reliability'],
  ['deployment', 'Real-world deployment and operational autonomy'],
  ['publications', 'Publisher announcements and research notices'],
];
const classifications = new Set([
  ...Object.values(metricTopics).map(([kind]) => kind),
  'Official statistics',
  'Scientific publication',
  'Evidence review',
  'Publisher announcement',
  'External forecast',
  'First-party claim',
  'Unverified report',
  'Theoretical proposal',
]);
const humanNumber = new Intl.NumberFormat('en', { maximumSignificantDigits: 3 });
const bounded = (val, limit) => dated(val) && Date.parse(val) <= Date.parse(limit);
const identifier = (...parts) => parts.map((p) => encodeURIComponent(String(p))).join(':');

function rowsFor(metric) {
  const rows = metric.observations?.length ? metric.observations : metric.history;
  return rows?.length
    ? rows
    : [
        {
          value: metric.value,
          date: metric.modelDate ?? metric.asOf,
          label: metric.model,
          low: metric.low,
          high: metric.high,
        },
      ];
}

export function evidenceRecords(payload, cutoff) {
  const observations = [];
  for (const metric of payload.metrics ?? []) {
    if (!metricTopics[metric?.id] || !safeLink(metric.sourceUrl) || !metric.source) continue;
    const [classification, limitations] = metricTopics[metric.id];
    const research = metric.id.startsWith('research-');
    const benchmark = ['horizon', 'reliability'].includes(metric.id);
    for (const point of rowsFor(metric)) {
      if (!Number.isFinite(point?.value) || !bounded(point.date, cutoff)) continue;
      const publishedOn = point.publishedAt ?? (research ? point.date : benchmark ? metric.asOf : null);
      if (publishedOn && !bounded(publishedOn, cutoff)) continue;
      const referenceOn = dated(point.date);
      // The lab report describes a month, and the store uses its final day as
      // an index. Neither report dates nor model release dates are test dates.
      const measuredOn = point.measuredOn && bounded(point.measuredOn, cutoff) ? dated(point.measuredOn) : null;
      const organization =
        point.organization ||
        (metric.id === 'research-autonomy' ? 'OpenAI' : metric.id === 'research-acceleration' ? 'Anthropic' : null);
      const system = research ? null : (point.label ?? metric.model ?? null);
      const refBasis = research
        ? 'Source observation or report reference date'
        : metric.id === 'compute'
          ? 'Model publication date'
          : 'Model release date';
      const dataset =
        metric.id === 'breadth'
          ? 'https://epoch.ai/data/eci_scores.csv'
          : metric.id === 'compute'
            ? 'https://epoch.ai/data/frontier_ai_models.csv'
            : metric.sourceUrl;
      observations.push({
        id: identifier(metric.id, referenceOn, system ?? point.label ?? metric.source),
        topic: metric.id,
        label: metric.label,
        value: point.value,
        unit: metric.unit,
        weightAccess: ['Open weights', 'Closed weights'].includes(point.access) ? point.access : null,
        low: Number.isFinite(point.low) ? point.low : null,
        high: Number.isFinite(point.high) ? point.high : null,
        system,
        organization,
        source: metric.source,
        sourceUrl: metric.sourceUrl,
        datasetUrl: dataset,
        measuredOn,
        publishedOn: dated(publishedOn),
        referenceOn,
        referenceDateBasis: refBasis,
        measurementDateBasis: measuredOn ? 'Reported measurement date' : 'Exact measurement date unavailable',
        publicationDateBasis: publishedOn
          ? 'Dated report'
          : 'Version publication date unavailable for the rolling dataset',
        retrievedAt: metric.retrievedAt ?? payload.checkedAt,
        classification,
        limitations,
        intervalLabel: metric.intervalLabel ?? (benchmark ? '95% interval' : null),
        sourceStatus: metric.status ?? 'unknown',
      });
    }
  }
  for (const event of payload.events ?? []) {
    if (!event?.title || !event.source || !safeLink(event.url) || !bounded(event.date, cutoff)) continue;
    observations.push({
      id: identifier('publication', event.url),
      topic: 'publications',
      label: event.title,
      value: null,
      unit: null,
      system: null,
      organization: null,
      source: event.source,
      sourceUrl: event.url,
      measuredOn: null,
      publishedOn: dated(event.date),
      referenceOn: dated(event.date),
      referenceDateBasis: 'Publication date',
      retrievedAt: payload.checkedAt,
      measurementDateBasis: 'Publication notice',
      publicationDateBasis: 'Publisher or source feed date',
      classification: 'Publisher announcement',
      limitations:
        'This record establishes the publication or announcement. Capability findings require their own measurement records.',
      low: null,
      high: null,
    });
  }
  for (const row of payload.observatoryObservations ?? []) {
    if (
      !row?.id ||
      !row.topic ||
      !row.label ||
      !row.source ||
      !safeLink(row.sourceUrl) ||
      !row.limitations ||
      !classifications.has(row.classification) ||
      (row.value != null && !Number.isFinite(row.value))
    )
      continue;
    if ([row.publishedOn, row.measuredOn, row.referenceOn, row.retrievedAt].some((d) => d && !bounded(d, cutoff)))
      continue;
    observations.push({
      ...row,
      system: row.system ?? null,
      organization: row.organization ?? null,
      referenceOn: row.referenceOn ?? row.measuredOn ?? row.publishedOn ?? null,
      value: row.value ?? null,
      unit: row.unit ?? null,
      measuredOn: row.measuredOn ?? null,
      publishedOn: row.publishedOn ?? null,
      measurementDateBasis:
        row.measurementDateBasis ??
        (row.measuredOn ? 'Reported measurement date' : 'Exact measurement date unavailable'),
      publicationDateBasis:
        row.publicationDateBasis ??
        (row.publishedOn ? 'Reported publication date' : 'Publication date unavailable'),
      retrievedAt: row.retrievedAt ?? payload.checkedAt,
      low: row.low ?? null,
      high: row.high ?? null,
    });
  }
  return [...new Map(observations.map((row) => [row.id, row])).values()].sort(
    (a, b) => String(b.referenceOn ?? '').localeCompare(String(a.referenceOn ?? '')) || a.id.localeCompare(b.id),
  );
}

export function assessOrganizations(observations, previous) {
  const groups = new Map();
  for (const record of observations.filter((o) => o.organization)) {
    if (!groups.has(record.organization)) groups.set(record.organization, []);
    groups.get(record.organization).push(record);
  }
  const before = new Map((previous?.observations ?? []).map((o) => [o.id, o]));
  return [...groups]
    .map(([name, group]) => {
      const scores = group
        .filter((o) => o.topic === 'breadth' && o.system)
        .sort((a, b) => b.value - a.value || String(b.referenceOn).localeCompare(String(a.referenceOn)));
      const leader = scores[0];
      const systems = [...new Set(group.map((o) => o.system).filter(Boolean))];
      const changes = previous ? group.filter((o) => !before.has(o.id) || before.get(o.id).value !== o.value) : [];
      const change = changes[0];
      let movement = !previous ? 'First checkpoint for comparison.' : 'No change in the recorded measurements.';
      if (change) {
        const prior = before.get(change.id);
        movement = (change.system ?? name) + ' has a new or revised reading for ' + change.label + '.';
        if (
          prior &&
          Number.isFinite(prior.value) &&
          Number.isFinite(change.value) &&
          prior.value !== change.value
        ) {
          movement +=
            ' The source revised ' +
            humanNumber.format(prior.value) +
            ' to ' +
            humanNumber.format(change.value) +
            ' ' +
            change.unit +
            '.';
        } else if (!prior && leader?.id === change.id) {
          const oldLeader = [...before.values()]
            .filter((o) => o.organization === name && o.topic === 'breadth')
            .sort((a, b) => b.value - a.value)[0];
          if (oldLeader) {
            movement +=
              ' The previous recorded leader was ' +
              oldLeader.system +
              ' at ' +
              humanNumber.format(oldLeader.value) +
              ' ECI.';
            if (Number.isFinite(leader.low) && Number.isFinite(oldLeader.high) && leader.low <= oldLeader.high)
              movement += ' The reported intervals overlap.';
          }
        }
      }
      const summary = leader
        ? leader.system +
          ' has the highest recorded Epoch score for this developer group (' +
          humanNumber.format(leader.value) +
          ' ECI). ' +
          (Number.isFinite(leader.low) && Number.isFinite(leader.high)
            ? 'Its 90% interval is ' + humanNumber.format(leader.low) + '–' + humanNumber.format(leader.high) + '. '
            : '') +
          'The test supplies context for AGI breadth and ASI expert comparison. Neither gate is adjudicated by ECI.'
        : 'Available reports cover ' + [...new Set(group.map((o) => o.label))].slice(0, 2).join(' and ') + '.';
      return {
        name,
        systems,
        summary,
        change: movement,
        forecastEffect: 'An organizational proxy alone cannot establish an arrival date.',
        observationIds: group.map((o) => o.id),
        leadingObservationId: leader?.id ?? group[0].id,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function topicCoverage(observations) {
  return catalogs.map(([id, label]) => {
    const ids = observations.filter((o) => o.topic === id).map((o) => o.id);
    return {
      id,
      label,
      status: ids.length ? 'Source readings available' : 'No eligible reading in this edition',
      observationIds: ids,
    };
  });
}

export function assessOversight(observations) {
  const studies = observations.filter((o) =>
    ['oversight', 'strategic-reasoning', 'intervention', 'instruction-adherence'].includes(o.topic),
  );
  return {
    status: 'Indeterminate',
    summary: studies.length
      ? 'The cited evaluations describe behavior under particular supervision and access conditions. They do not establish general reliability of human intervention in deployment.'
      : 'Comparable independent tests of instruction adherence, monitoring and intervention in deployment are missing from this edition.',
    observationIds: studies.map((o) => o.id),
    limitations:
      'Measured intelligence supplies no evidence by itself about intent, unauthorized action or the ability of operators to intervene.',
  };
}

const scenarios = [
  [
    'Public-health or natural disruption',
    'Illness, disasters or power loss can interrupt work and computing capacity. Automation investment or relocation could increase.',
  ],
  [
    'Conflict, political violence or cyber incidents',
    'Service availability, trade and collaboration can deteriorate while investment in alternative supply or resilience grows. AI attribution requires independent evidence.',
  ],
  [
    'Economic or regulatory change',
    'Capital, deployment and international cooperation may shift in different directions across regions.',
  ],
  [
    'Grid, data center or semiconductor constraint',
    'Reduced delivered capacity can delay experiments. Rerouting compute or improved efficiency can offset some effects.',
  ],
  [
    'Scientific breakthrough',
    'A replicated improvement can raise capability while new resource requirements constrain adoption.',
  ],
].map(([label, effect]) => ({
  label,
  effect,
  probability: null,
  forecastImpact: 'Direction and duration depend on measured consequences.',
}));

export function assessXFactors(payload, cutoff, observations) {
  const events = [];
  for (const incident of payload.incidents ?? []) {
    if (
      !incident?.id ||
      !bounded(incident.startedAt, cutoff) ||
      (incident.publishedAt && !bounded(incident.publishedAt, cutoff)) ||
      !safeLink(incident.url) ||
      !incident.source
    )
      continue;
    const resolvedAt = bounded(incident.resolvedAt, cutoff) ? incident.resolvedAt : null;
    events.push({
      id: incident.id,
      label: incident.title,
      source: incident.source,
      sourceUrl: incident.url,
      measuredOn: incident.startedAt,
      publishedOn: incident.publishedAt ?? null,
      classification: 'Provider incident report',
      attribution: 'Unknown',
      resolvedAt,
      organization: incident.organization,
      effects: [
        {
          area: 'Service availability',
          direction: incident.impact === 'unknown' ? 'Unknown' : 'Delay',
          detail: incident.detail || 'Provider-reported interruption or degradation in the named service.',
        },
      ],
      forecastImpact: 'No measured effect on worldwide research throughput in this report.',
      capabilityEffect: 'None established',
      limitations:
        'Coverage is limited to services the provider discloses. The underlying cause and effects on unrelated work remain unknown.',
    });
  }
  const records = new Map(observations.map((o) => [o.id, o]));
  for (const event of payload.observatoryEvents ?? []) {
    if (
      !event?.id ||
      !event.label ||
      !bounded(event.publishedOn, cutoff) ||
      !safeLink(event.sourceUrl) ||
      !event.source
    )
      continue;
    const effects = (event.effects ?? []).filter(
      (e) =>
        e.area &&
        e.detail &&
        ['Advance', 'Delay', 'Mixed', 'Unknown'].includes(e.direction) &&
        e.evidenceIds?.length &&
        e.evidenceIds.every((id) => records.has(id)),
    );
    if (!effects.length) continue;
    const attributionEvidence = event.attributionEvidenceIds?.map((id) => records.get(id)) ?? [];
    const established =
      attributionEvidence.length &&
      attributionEvidence.every(
        (r) =>
          r?.topic === 'event-attribution' &&
          r.eventId === event.id &&
          r.finding === event.attribution &&
          r.publishedOn &&
          ['Independent evaluation', 'Official statistics', 'Scientific publication'].includes(r.classification),
      );
    const attribution =
      established &&
      ['Independent of AI', 'Indirect AI influence', 'Verified direct AI involvement'].includes(event.attribution)
        ? event.attribution
        : 'Unknown';
    events.push({
      ...event,
      effects,
      attribution,
      forecastImpact: 'Only quantified consequences linked to a modeled criterion may change a forecast.',
    });
  }
  return {
    events,
    scenarios,
    limitations:
      'Scenarios describe unweighted alternatives. No defensible frequency or duration distribution is available for global extreme events.',
  };
}
