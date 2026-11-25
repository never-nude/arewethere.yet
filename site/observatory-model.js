import { assessMilestones, dated, methodologyVersion } from './observatory-criteria.js';
import {
  assessOrganizations,
  assessOversight,
  assessXFactors,
  evidenceRecords,
  topicCoverage,
} from './observatory-evidence.js';
import { forecastMilestones, modelVersion, validateIndicators } from './observatory-forecast.js';

export { methodologyVersion, modelVersion };

function changesSince(previous, milestones, observations, forecasts, events) {
  if (!previous) return ['First checkpoint under this methodology. Earlier index readings use a different scale.'];
  if (previous.methodologyVersion !== methodologyVersion)
    return ['The methodology changed. The prior checkpoint retains its original assessments.'];
  const changes = milestones
    .filter((m) => m.change !== 'No change in verified criteria.')
    .map((m) => m.label + ' · ' + m.change);
  const before = new Map((previous.observations ?? []).map((o) => [o.id, o]));
  const newer = observations.filter((o) => !before.has(o.id));
  const revised = observations.filter(
    (o) =>
      before.has(o.id) &&
      ['value', 'low', 'high', 'classification', 'sourceUrl', 'publishedOn', 'measuredOn'].some(
        (k) => (before.get(o.id)[k] ?? null) !== (o[k] ?? null),
      ),
  );
  const removed = [...before.keys()].filter((id) => !observations.some((o) => o.id === id));
  if (newer.length)
    changes.push(
      newer.length +
        ' source ' +
        (newer.length === 1 ? 'reading entered' : 'readings entered') +
        ' this checkpoint. A newly available reading may describe an earlier measurement.',
    );
  if (revised.length)
    changes.push(
      revised.length +
        ' existing ' +
        (revised.length === 1 ? 'reading has' : 'readings have') +
        ' revised data or provenance.',
    );
  if (removed.length)
    changes.push(
      removed.length +
        ' earlier ' +
        (removed.length === 1 ? 'reading is' : 'readings are') +
        ' absent from this source snapshot. The archived checkpoint retains them.',
    );
  const earlierEvents = new Map((previous.xFactors?.events ?? []).map((e) => [e.id, e]));
  const affected = events.filter((e) => {
    const old = earlierEvents.get(e.id);
    return (
      !old ||
      e.resolvedAt !== old.resolvedAt ||
      e.attribution !== old.attribution ||
      JSON.stringify(e.effects) !== JSON.stringify(old.effects)
    );
  });
  if (affected.length)
    changes.push(
      affected.length +
        ' new or revised event ' +
        (affected.length === 1 ? 'report.' : 'reports.') +
        ' Reported local effects are assessed separately from global capability.',
    );
  for (const f of forecasts)
    if (f.change !== 'Unchanged from the previous checkpoint.') changes.push(f.label + ' forecast · ' + f.change);
  return changes.length
    ? changes
    : ['The evidence readings, verified criteria and forecast destinations are unchanged.'];
}

export function buildObservatoryAssessment(
  payload,
  { checkpointAt, validatedAt = payload?.checkedAt, previous = null } = {},
) {
  if (!dated(checkpointAt) || !dated(validatedAt) || !dated(payload?.checkedAt))
    throw new Error('Valid checkpoint, source and validation times are required.');
  if (payload.reviewedLedgerVersion && payload.reviewedLedgerVersion !== methodologyVersion)
    throw new Error('Reviewed evidence ledger uses a different methodology.');
  if (Date.parse(payload.checkedAt) > Date.parse(validatedAt) || Date.parse(checkpointAt) > Date.parse(validatedAt))
    throw new Error('Source collection and checkpoint must precede validation.');
  const cutoff = new Date(payload.checkedAt).toISOString();
  if (previous && Date.parse(previous.checkpointAt) >= Date.parse(checkpointAt))
    throw new Error('Previous assessment must precede this checkpoint.');
  const observations = evidenceRecords(payload, cutoff);
  const milestones = assessMilestones(observations, payload.criterionReviews, cutoff, previous);
  const xFactors = assessXFactors(payload, cutoff, observations);
  const forecasts = forecastMilestones(
    milestones,
    observations,
    payload.criterionTrajectories,
    previous,
    checkpointAt,
    cutoff,
    methodologyVersion,
    xFactors.events,
  );
  for (const event of xFactors.events) {
    const affected = forecasts.filter((f) => f.drivers.some((d) => d.adjustment?.eventId === event.id));
    if (affected.length)
      event.forecastImpact =
        'A measured net schedule change entered the conditional projection for ' +
        affected.map((f) => f.label).join(', ') +
        '.';
  }
  return {
    checkpointAt,
    validatedAt,
    evidenceCutoff: cutoff,
    methodologyVersion,
    modelVersion,
    milestones,
    forecasts,
    observations,
    organizations: assessOrganizations(observations, previous),
    oversight: assessOversight(observations),
    xFactors,
    modelValidation: validateIndicators(observations),
    topicCoverage: topicCoverage(observations),
    changes: changesSince(previous, milestones, observations, forecasts, xFactors.events),
  };
}
export const buildAssessment = buildObservatoryAssessment;
