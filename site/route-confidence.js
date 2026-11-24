const marketId = 'hh2bXhwKDTioZ7KtGKfC';
const marketEndpoint = 'https://api.manifold.markets/v0/market/' + marketId;
const marketPage = 'https://manifold.markets/RemNi/will-we-get-agi-before-2030';

const routes = {
  breadth: {
    summary: 'This route emphasizes strong performance across many tasks and reliable work on difficult tasks.',
    steps: ['broad-performance', 'research-feedback', 'compounding'],
    weights: {
      breadth: 27,
      'access-breadth': 3,
      reliability: 12,
      horizon: 9,
      'research-autonomy': 7,
      'research-acceleration': 4,
      research: 8,
      compounding: 25,
      forecast: 5,
    },
  },
  research: {
    summary: 'This route emphasizes how independently AI can do AI research and how much it speeds up development.',
    steps: ['compounding'],
    weights: {
      'research-autonomy': 24,
      'research-acceleration': 16,
      reliability: 10,
      horizon: 5,
      breadth: 4,
      'access-breadth': 3,
      research: 8,
      compounding: 25,
      forecast: 5,
    },
  },
};

const transitions = {
  'broad-performance': {
    from: 'agi',
    to: 'asi',
    detail: 'Broad benchmark performance and long-task results give partial evidence. This step calls for performance across many fields that exceeds the strongest humans.',
    weights: { breadth: 60, reliability: 20, horizon: 20 },
  },
  'research-feedback': {
    from: 'asi',
    to: 'rsi',
    detail: 'Task results and reported research speed help gauge this step. Independent evidence that AI can repeatedly complete whole research projects carries 30 points.',
    weights: { 'research-autonomy': 40, 'research-acceleration': 20, reliability: 10, research: 30 },
  },
  compounding: {
    from: 'rsi',
    to: 'singularity',
    detail: 'Task results and research speed cover part of the evidence. Independent verification of end-to-end work and accelerating gains across generations accounts for 60 points.',
    weights: { 'research-autonomy': 15, 'research-acceleration': 25, research: 20, compounding: 40 },
  },
};

const gateLabels = {
  research: 'Independently verified end-to-end research',
  compounding: 'Independently verified compounding gains',
};

const standardize = (value) => Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

export const routeConfidenceMethod = 'Each reading is put on a 0–100 scale, multiplied by its weight, then divided by 100. The earned points add up to the route score. Evidence still awaiting verification leaves its points open. Coverage is the share of the total weight backed by available readings. We choose the weights based on which evidence is relevant to each route or step.';

function measuredReading(factor) {
  return {
    label: factor?.label,
    value: standardize(factor?.score),
    rawValue: factor?.value ?? null,
    unit: factor?.unit ?? '',
    detail: [factor?.detail, factor?.scoring].filter(Boolean).join(' '),
    source: factor?.source ?? null,
    sourceUrl: factor?.sourceUrl ?? null,
    observedAt: factor?.publishedAt ?? factor?.date ?? null,
    status: factor?.status ?? 'unavailable',
  };
}

function gateReading(gate, id) {
  const verified = gate?.status === 'met';
  return {
    label: gateLabels[id],
    value: verified ? 100 : null,
    rawValue: null,
    unit: '',
    detail: (gate?.detail ? gate.detail + ' ' : '') + (verified
      ? 'Qualifying evidence has been documented.'
      : 'These points remain open until qualifying evidence is independently verified.'),
    source: gate?.source ?? null,
    sourceUrl: gate?.sourceUrl ?? null,
    observedAt: verified ? gate?.date ?? null : null,
    status: verified ? 'verified' : 'unverified',
  };
}

function forecastReading(factor, forecast) {
  const prior = measuredReading(factor);
  const live = Number.isFinite(forecast?.value);
  return {
    ...prior,
    label: 'AGI forecast sentiment',
    value: live ? standardize(forecast.value) : prior.value,
    rawValue: live ? forecast.value : prior.rawValue,
    unit: '%',
    detail: 'The play-money YES price for AGI before 2030 adds a small amount of context to both routes. The market asks about AGI timing under its own definition.',
    source: forecast?.source ?? 'Manifold',
    sourceUrl: forecast?.sourceUrl ?? marketPage,
    observedAt: forecast?.observedAt ?? prior.observedAt,
    status: live ? 'live' : prior.status,
  };
}

function accessReading(openBreadth, closedBreadth) {
  const accessReadings = [
    ['Open weights', openBreadth],
    ['Closed weights', closedBreadth],
  ].map(([label, metric]) => ({
    label,
    value: Number.isFinite(metric?.value) ? metric.value : null,
    model: metric?.model ?? null,
    observedAt: metric?.modelDate ?? metric?.asOf ?? metric?.date ?? null,
  }));
  const available = accessReadings.every(({ value }) => value != null);
  const normalized = accessReadings.map(({ value }) => value == null ? null : standardize((value - 130) / 70 * 100));
  const readingSummary = accessReadings.map(({ label, value, model }) =>
    label + ' ' + (value == null ? 'unavailable' : round(value) + ' ECI' + (model ? ' (' + model + ')' : ''))).join(' · ');
  return {
    label: 'Capability across model access types',
    value: available ? round((normalized[0] + normalized[1]) / 2) : null,
    rawValue: null,
    unit: 'ECI',
    source: 'Epoch AI',
    sourceUrl: 'https://epoch.ai/data/eci-documentation/methodology',
    detail: 'The best open- and closed-weight benchmark scores use the same ECI scale (130–200), then contribute equally to this input. ' + readingSummary + '.',
    accessReadings,
    status: !available
      ? 'unavailable'
      : [openBreadth, closedBreadth].some((metric) => metric.status === 'snapshot') ? 'snapshot' : 'published',
  };
}

function tally(weights, readings) {
  const contributions = Object.entries(weights).map(([id, weight]) => {
    const reading = readings.get(id);
    return {
      ...reading,
      id,
      label: reading.label ?? id,
      weight,
      points: reading.value == null ? null : round(reading.value * weight / 100),
    };
  });
  const available = contributions.filter(({ points }) => points != null);
  const coverage = available.reduce((total, item) => total + item.weight, 0);
  const points = available.reduce((total, item) => total + item.points, 0);
  return { score: coverage ? round(points) : null, coverage, contributions };
}

export function scoreRoutes(index, { forecast, openBreadth, closedBreadth } = {}) {
  const factors = new Map((index?.factors ?? []).map((factor) => [factor.id, factor]));
  const gates = new Map((index?.threshold?.criteria ?? []).map((gate) => [gate.id, gate]));
  const readings = new Map(
    ['breadth', 'reliability', 'horizon', 'research-autonomy', 'research-acceleration'].map((id) =>
      [id, measuredReading(factors.get(id))]),
  );
  for (const id of Object.keys(gateLabels)) readings.set(id, gateReading(gates.get(id), id));
  readings.set('forecast', forecastReading(factors.get('forecast'), forecast));
  readings.set('access-breadth', accessReading(openBreadth, closedBreadth));
  const steps = Object.fromEntries(Object.entries(transitions).map(([id, step]) => {
    const { weights, ...description } = step;
    return [id, { ...description, ...tally(weights, readings) }];
  }));
  return Object.fromEntries(Object.entries(routes).map(([id, route]) => {
    return [id, {
      ...tally(route.weights, readings),
      steps: route.steps.map((stepId) => steps[stepId]),
      summary: route.summary,
    }];
  }));
}

function timestamp(value) {
  if (!Number.isFinite(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) ? date.toISOString() : null;
}

export async function getLiveRouteInputs({ signal, fetcher = fetch } = {}) {
  const timeout = AbortSignal.timeout(8000);
  const response = await fetcher(marketEndpoint, {
    cache: 'no-store',
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) throw new Error('Manifold forecast is unavailable');
  const market = await response.json();
  const probability = market?.probability;
  if (!Number.isFinite(probability) || probability < 0 || probability > 1 || market.isResolved) {
    throw new Error('Manifold has no active forecast reading');
  }
  return {
    forecast: {
      value: round(probability * 100),
      observedAt: timestamp(market.lastBetTime ?? market.lastUpdatedTime),
      checkedAt: new Date().toISOString(),
      source: 'Manifold',
      sourceUrl: marketPage,
    },
  };
}
