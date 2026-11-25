import { createHash } from 'node:crypto';
import { csvColumns } from '../src/signals.mjs';
import { fundingDisclosures } from '../src/developer-funding.mjs';

export const resourcesUrl = 'https://epoch.ai/data/all_ai_models.csv';
const columns = ['Model', 'Publication date', 'Training compute cost (2023 USD)', 'Training compute (FLOP)', 'Training time (hours)', 'Confidence'];
const positive = v => Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null;

// Match only a unique, exact model-version name and date, or a unique exact
// name if the two datasets use different dates. Never propagate a family cost.
export function captureResources(csv, observedModels, checkedAt) {
  const cutoff = checkedAt.slice(0, 10);
  const resources = new Map();
  for (const [name, date, dollars, operations, time, confidence] of csvColumns(csv, columns)) {
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > cutoff) continue;
    const row = {model: name, published: date, cost: positive(dollars), operations: positive(operations), hours: positive(time), confidence};
    if (!resources.has(name)) resources.set(name, []);
    resources.get(name).push(row);
  }
  if (!resources.size) throw new Error('No dated records in the training resources dataset');
  const models = [];
  const seen = new Set();
  for (const {label, date} of observedModels) {
    if (!label || !date || date > cutoff || seen.has(label)) continue;
    seen.add(label);
    const candidates = resources.get(label) || [];
    const exact = candidates.filter(r => r.published === date);
    const row = exact.length === 1 ? exact[0] : candidates.length === 1 ? candidates[0] : null;
    if (row && (row.cost || row.operations || row.hours)) models.push(row);
  }
  return {checkedAt, status: 'verified', dataset: resourcesUrl, sha256: createHash('sha256').update(csv).digest('hex'),
    models: models.sort((a,b) => a.model.localeCompare(b.model, 'en')), funding: fundingDisclosures.filter(r => r.published <= cutoff)};
}

export async function collectModelResources(observations, checkedAt, previous, fetcher = fetch) {
  try {
    const response = await fetcher(resourcesUrl, {signal: AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error('Training resource download unavailable');
    return captureResources(await response.text(), observations, checkedAt);
  } catch {
    const funding = fundingDisclosures.filter(r => r.published <= checkedAt.slice(0, 10));
    if (previous?.sha256 && Number.isFinite(Date.parse(previous.checkedAt)) && previous.checkedAt <= checkedAt) {
      const {forEdition, ...verified} = previous;
      return {...verified, status: 'last verified', funding};
    }
    return {status: 'unavailable', checkedAt: null, dataset: resourcesUrl, models: [], funding};
  }
}
