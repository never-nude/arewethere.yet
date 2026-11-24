import { factorDefinitions } from './index-model.js';
import { measureMilestoneProgress } from './milestone-progress.js';

const factorById = new Map(factorDefinitions.map((factor) => [factor.id, factor]));

function coordinate(reading, axis) {
  const { id = 'verification', points, weight, rawValue, verification } = reading;
  const factor = factorById.get(id);
  const pending = points === null;
  return {
    axis,
    id,
    label: reading.label === id ? factor?.label ?? id : reading.label,
    percent: 100 * (points ?? 0) / weight,
    points,
    weight,
    value: rawValue ?? null,
    unit: reading.unit || factor?.unit || '',
    pending,
    verified: verification ? !pending : null,
    detail: reading.detail || [factor?.detail, factor?.scoring].filter(Boolean).join(' '),
    source: reading.source ?? factor?.source ?? null,
    sourceUrl: reading.sourceUrl ?? factor?.sourceUrl ?? null,
  };
}

export function measureTerrainEvidence(index) {
  return Object.fromEntries(measureMilestoneProgress(index).map(({ id, contributions, score, coverage }) => {
    const [first, second, ...criteria] = contributions;
    const confirmation = criteria.find((reading) => reading.id === 'compounding') ?? criteria[0];
    return [id, {
      axes: [coordinate(first, 'x'), coordinate(confirmation, 'y'), coordinate(second, 'z')],
      additional: criteria.filter((reading) => reading !== confirmation).map((reading) => coordinate(reading, null)),
      score,
      coverage,
    }];
  }));
}
