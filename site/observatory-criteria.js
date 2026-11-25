// Necessary conditions carry one vote each. Only an audited, same-system finding
// can adjudicate a condition. Proxy measurements are linked for context separately.
export const methodologyVersion = '2.0.0';
const gates = {
  'agi-breadth': [
    'Breadth at skilled human level',
    'On a preregistered, representative battery spanning reasoning, language, quantitative work and practical problem solving, the same system reaches the skilled-human comparison group in each domain. Use the lower uncertainty bound of its paired performance difference and a published equivalence margin.',
    ['breadth', 'generalization'],
  ],
  'agi-transfer': [
    'Transfer to unfamiliar tasks',
    'An independent evaluation finds skilled-human performance on held-out task families, with an audit for training overlap, fixed resource limits and no task-specific retraining.',
    ['generalization', 'breadth'],
  ],
  'agi-reliability': [
    'Reliability across settings',
    'Independent evaluators repeat the breadth and transfer findings on fresh cases and task variants with the same system and disclosed assistance. They report failures and uncertainty.',
    ['reliability', 'horizon'],
  ],
  'asi-experts': [
    'Broad expert superiority',
    'On that same cross-domain battery, the system repeatedly exceeds leading experts by a practically meaningful preregistered margin in each domain. Independent replications must support the lower bound of the difference.',
    ['generalization', 'breadth'],
  ],
  'rsi-contribution': [
    'A material contribution to a successor',
    'A controlled comparison attributes a reproducible gain in a named successor to its predecessor’s research, holding other inputs fixed or estimating their effects. Evaluate the gain on independent held-out tasks.',
    ['research-autonomy', 'research-acceleration'],
  ],
  'rsi-repeat': [
    'Repeated improvement by successors',
    'The improved successor itself contributes a material independently verified improvement to the next generation in the same lineage. Publish protocols and evidence for both links.',
    ['research-autonomy', 'research-acceleration'],
  ],
  'singularity-feedback': [
    'Self-reinforcing research',
    'Independent evidence identifies successive generations carrying their improvements into further research, with repeatable gains attributable to their work.',
    ['research-autonomy', 'research-acceleration'],
  ],
  'singularity-acceleration': [
    'Sustained acceleration',
    'At least three successive development intervals allow two successive increases in the comparable rate of capability gain. Uncertainty bounds and alternative explanations, including spending, compute and staffing, must be addressed.',
    ['research-acceleration', 'compute', 'algorithmic-efficiency'],
  ],
  'singularity-transition': [
    'A change in technological progress',
    'Independent replication across development settings demonstrates a sustained break from the preceding rate of technological progress, attributable to that feedback. Report comparable pre-transition and post-transition measurements.',
    ['research-acceleration', 'scientific-discovery', 'deployment'],
  ],
};

export const milestoneDefinitions = [
  {
    id: 'agi',
    label: 'Artificial general intelligence',
    definition:
      'Reliable, adaptable intelligence at skilled human level across a representative range of unfamiliar cognitive tasks.',
    gates: ['agi-breadth', 'agi-transfer', 'agi-reliability'],
  },
  {
    id: 'rsi',
    label: 'Recursive self-improvement',
    definition:
      'Repeatable cycles in which an AI materially improves a successor that itself contributes to further improvements.',
    gates: ['rsi-contribution', 'rsi-repeat'],
  },
  {
    id: 'asi',
    label: 'Artificial superintelligence',
    definition:
      'Reliable capabilities substantially exceeding leading human experts across a broad range of cognitive domains. Under this definition it also satisfies AGI.',
    gates: ['agi-breadth', 'agi-transfer', 'agi-reliability', 'asi-experts'],
  },
  {
    id: 'singularity',
    label: 'Technological singularity',
    definition:
      'A sustained transition in which AI-driven feedback accelerates technological improvement across successive generations and changes its established rate.',
    gates: ['singularity-feedback', 'singularity-acceleration', 'singularity-transition'],
  },
];

export function safeLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function dated(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value.slice(0, 10)
    ? value.slice(0, 10)
    : null;
}

function auditedFindings(reviews, observations, cutoff) {
  const records = new Map(observations.map((record) => [record.id, record]));
  return (Array.isArray(reviews) ? reviews : []).filter((review) => {
    if (
      !review ||
      review.methodologyVersion !== methodologyVersion ||
      !gates[review.criterion] ||
      !review.system ||
      !['met', 'unmet'].includes(review.result) ||
      !review.reviewer ||
      !review.rationale?.trim() ||
      !safeLink(review.protocolUrl) ||
      !dated(review.reviewedAt) ||
      Date.parse(review.reviewedAt) > Date.parse(cutoff)
    )
      return false;
    return (
      review.evidenceIds?.length > 0 &&
      review.evidenceIds.every((id) => {
        const record = records.get(id);
        return (
          record?.classification === 'Independent evaluation' &&
          record.system === review.system &&
          record.publishedOn &&
          record.publishedOn <= dated(review.reviewedAt) &&
          record.source !== record.organization &&
          safeLink(record.sourceUrl)
        );
      })
    );
  });
}

export function assessMilestones(observations, reviews, cutoff, previous) {
  const verified = auditedFindings(reviews, observations, cutoff);
  return milestoneDefinitions.map(({ gates: required, ...definition }) => {
    const relevant = verified.filter((f) => required.includes(f.criterion));
    const candidates = [...new Set(relevant.map((f) => f.system))];
    if (!candidates.length) candidates.push(null);
    const assessments = candidates.map((system) => {
      const sameSystem = relevant.filter((f) => f.system === system);
      const endpointUses = new Map();
      for (const finding of sameSystem) {
        for (const id of finding.evidenceIds) {
          if (!endpointUses.has(id)) endpointUses.set(id, new Set());
          endpointUses.get(id).add(finding.criterion);
        }
      }
      const criteria = required.map((id) => {
        const [label, rule, topics] = gates[id];
        const findings = sameSystem.filter(
          (f) => f.criterion === id && f.evidenceIds.some((ref) => endpointUses.get(ref).size === 1),
        );
        const states = new Set(findings.map((f) => f.result));
        const status = states.size > 1 ? 'conflicting' : (states.values().next().value ?? 'unknown');
        return {
          id,
          label,
          rule,
          status,
          evidenceIds: [...new Set(findings.flatMap((f) => f.evidenceIds))],
          reviews: findings.map(({ reviewer, reviewedAt, rationale, protocolUrl }) => ({
            reviewer,
            reviewedAt,
            rationale,
            protocolUrl,
          })),
          relatedIds: observations
            .filter((o) => topics.includes(o.topic) && (!system || o.system === system))
            .map((o) => o.id),
        };
      });
      const met = criteria.filter((c) => c.status === 'met').length;
      const assessed = criteria.filter((c) => ['met', 'unmet'].includes(c.status)).length;
      return {
        system,
        criteria,
        coverage: { met, assessed, total: criteria.length },
        score: assessed === criteria.length ? Math.round((100 * met) / assessed) : null,
      };
    });
    // A demonstrated complete system takes priority; a sparse subject is never
    // merged with other candidates. An unresolved alternative can keep a global
    // frontier unknown even when one subject has a documented negative result.
    assessments.sort(
      (a, b) =>
        Number(b.score === 100) - Number(a.score === 100) ||
        b.coverage.met - a.coverage.met ||
        b.coverage.assessed - a.coverage.assessed ||
        String(a.system).localeCompare(String(b.system)),
    );
    const best = assessments[0];
    const status =
      best.score === 100 ? 'Demonstrated' : best.score === null ? 'Indeterminate' : 'Criteria assessed';
    const prior = previous?.milestones?.find((m) => m.id === definition.id);
    const comparable = previous?.methodologyVersion === methodologyVersion;
    const priorStates = prior?.criteria?.map((c) => c.status).join(',');
    const changed =
      prior &&
      comparable &&
      (best.system !== prior.system || best.criteria.map((c) => c.status).join(',') !== priorStates);
    const updates = best.criteria.filter(c => prior?.criteria?.some(old => old.id === c.id && old.status !== c.status));
    const change = !prior
      ? 'First assessment under these rules.'
      : !comparable
        ? 'Methodology changed. Scores across versions are not comparable.'
        : changed
          ? [(best.system !== prior.system ? 'Assessment now concerns ' + (best.system || 'an unresolved system') + '.' : ''), ...updates.map(c => c.label + ' is now ' + c.status + '.')].filter(Boolean).join(' ')
          : 'No change in verified criteria.';
    return {
      ...definition,
      ...best,
      status,
      change,
      confidence: best.score === null ? 'Insufficient evidence' : 'Independent criterion reviews',
      limitations:
        best.score === null
          ? 'Unmeasured or conflicting criteria leave the total indeterminate. Related benchmarks describe narrower abilities.'
          : 'The result applies to the named system or lineage and the published evaluation conditions.',
      candidateCount: candidates.filter(Boolean).length,
    };
  });
}
