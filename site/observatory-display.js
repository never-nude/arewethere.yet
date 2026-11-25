// Keep the unit as published, including any description following its symbol.
export function unitSuffix(unit) {
  if (!unit) return '';
  return /^[%×]/.test(unit) ? unit : ' ' + unit;
}

// Dated rows come first. Equal and undated rows keep their source order.
export function chronologicalMilestones(rows, outlook, forecasts = []) {
  function referenceYear(row) {
    const estimate = outlook?.milestones?.find(m => m.id === row.id);
    if (estimate) return Number.isInteger(estimate.centralYear) ? estimate.centralYear : Infinity;
    const date = forecasts.find(m => m.id === row.id)?.centralDate;
    const year = date && new Date(date).getUTCFullYear();
    return Number.isInteger(year) ? year : Infinity;
  }
  return [...rows].sort((a, b) => referenceYear(a) - referenceYear(b));
}
