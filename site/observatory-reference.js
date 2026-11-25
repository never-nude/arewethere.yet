// The published HTML and live dashboard describe the same selected outlook.
const month = new Intl.DateTimeFormat('en-US', {month: 'long', year: 'numeric', timeZone: 'UTC'});

export function scenarioRange(forecast) {
  const {low, high} = forecast.range;
  if (!Number.isFinite(low)) return 'Beyond ' + forecast.horizonYear;
  if (low === high) return String(low);
  return low + (Number.isFinite(high) ? '–' + high : ' to beyond ' + forecast.horizonYear);
}

export function singularityReference(assessment, outlook) {
  const scenario = outlook?.milestones.find(row => row.id === 'singularity');
  const forecast = assessment?.forecasts?.find(row => row.id === 'singularity');
  if (forecast?.status === 'Observed' || scenario?.status === 'Observed') {
    const year = forecast?.centralDate?.slice(0, 4) || scenario.centralYear;
    return {headline: 'Singularity confirmed in ' + year, range: ''};
  }
  if (scenario?.status === 'Scenario estimate') {
    const headline = Number.isFinite(scenario.centralYear)
      ? 'Singularity reference year ' + scenario.centralYear
      : 'Singularity reference scenario extends beyond ' + scenario.horizonYear;
    const range = 'Scenario range ' + scenarioRange(scenario) + '.';
    const open = scenario.beyondHorizonPathCount && Number.isFinite(scenario.range.high)
      ? ' At least one scenario extends beyond ' + scenario.horizonYear + '.' : '';
    return {headline, range: range + open};
  }
  if (Number.isFinite(Date.parse(forecast?.centralDate))) {
    const headline = 'Singularity forecast for ' + month.format(Date.parse(forecast.centralDate));
    const low = forecast.range?.low;
    const high = forecast.range?.high;
    let range = '';
    if (low) {
      const last = high ? month.format(Date.parse(high)) : 'beyond ' + forecast.horizonEnd.slice(0, 4);
      range = 'Conditional range ' + month.format(Date.parse(low)) + (low === high ? '' : ' to ' + last) + '.';
    }
    return {headline, range};
  }
  return {headline: 'No dated singularity estimate', range: 'This edition has too little verified evidence to give a date.'};
}
