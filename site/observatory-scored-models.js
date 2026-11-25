import { dated } from './observatory-criteria.js';

// Both capability and resource comparisons use the same benchmark population.
export function scoredModelObservations(assessment) {
  const cutoff = assessment.evidenceCutoff || assessment.checkpointAt;
  if (!dated(cutoff)) return [];
  const cutoffTime = Date.parse(cutoff);
  const available = date => dated(date) && Date.parse(date) <= cutoffTime;
  return (assessment.observations || []).filter(row => row?.topic === 'breadth' &&
    row.source === 'Epoch AI' && row.classification === 'Independent evaluation' &&
    row.datasetUrl === 'https://epoch.ai/data/eci_scores.csv' && row.unit === 'ECI' &&
    row.referenceDateBasis === 'Model release date' && typeof row.system === 'string' &&
    row.system.trim() && Number.isFinite(row.value) && available(row.referenceOn) &&
    (!row.publishedOn || available(row.publishedOn)) && (!row.retrievedAt || available(row.retrievedAt)) &&
    !['unavailable', 'withdrawn', 'retracted', 'missing'].includes(row.sourceStatus));
}
