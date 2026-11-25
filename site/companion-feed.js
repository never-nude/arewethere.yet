import { buildIndex } from './index-model.js';
import { scoreRoutes } from './route-confidence.js';
import { assessAcceleration } from './watchtower.js';

const metricIds = ['reliability', 'breadth', 'open-breadth', 'closed-breadth', 'research-acceleration', 'forecast'];
const routeLabels = { breadth: 'Broad skills first', research: 'Research specialist first' };
const watchLabels = {
  surge: ['Rapid gains corroborated', 'Independent capability and research findings crossed the watch criteria.'],
  watch: ['On watch', 'At least one independent finding crossed a cutoff. Separate capability and research findings can corroborate it.'],
  quiet: ['Below watch criteria', 'Comparable capability and research observations are available. No finding crossed its cutoff.'],
  limited: ['Limited evidence', 'Recent comparable capability and research findings are sparse.'],
};

function isPublicLink(url) {
  if (typeof url !== 'string') return false;
  try {
    const link = new URL(url);
    return link.protocol === 'https:' && !link.username && !link.password;
  } catch {
    return false;
  }
}

export function observatoryCompanionReading(assessment) {
  return {
    schemaVersion: 2,
    kind: assessment.kind,
    checkpointAt: assessment.checkpointAt,
    evidenceCutoff: assessment.evidenceCutoff,
    methodologyVersion: assessment.methodologyVersion,
    milestoneForecastVersion: assessment.modelVersion,
    indicatorForecastVersion: assessment.indicatorForecastVersion ?? null,
    ...(assessment.trigger && { trigger: assessment.trigger }),
    url: 'https://arewethereyet.now/data/observatory.json',
    dashboardUrl: 'https://arewethereyet.now/dashboard.html?assessment=' + encodeURIComponent(assessment.checkpointAt),
    milestones: assessment.milestones.map(({ id, score, status, coverage }) => ({ id, score, status, coverage })),
    milestoneForecasts: assessment.forecasts.map(({ id, status, centralDate }) => ({ id, status, centralDate })),
    indicatorForecasts: assessment.indicatorForecasts ?? [],
    indicatorOutcomes: assessment.indicatorOutcomes ?? [],
  };
}

export function buildCompanionFeed(payload, index = buildIndex(payload)) {
  const byId = new Map(payload.metrics.map((metric) => [metric.id, metric]));
  const routeScores = scoreRoutes(index, {
    openBreadth: byId.get('open-breadth'),
    closedBreadth: byId.get('closed-breadth'),
  });
  const { state: status } = assessAcceleration(payload, { asOf: index.date });
  const [label, detail] = watchLabels[status];

  return {
    schemaVersion: 1,
    checkedAt: payload.checkedAt,
    index: {
      score: index.score,
      delta: index.delta,
      coverage: index.coverage,
      observed: index.threshold.observed,
    },
    routes: Object.entries(routeLabels).map(([id, label]) => {
      const { score, coverage } = routeScores[id];
      return { id, label, score, coverage };
    }),
    watch: { status, label, detail },
    metrics: metricIds.map((id) => byId.get(id)).filter((metric) => Number.isFinite(metric?.value))
      .map(({ id, label, value, unit, model = null, asOf = null }) => ({ id, label, value, unit, model, asOf })),
    events: payload.events.filter(({ title, source, date, url }) => title && source && date && isPublicLink(url))
      .slice(0, 3).map(({ title, source, date, url }) => ({ title, source, date, url })),
  };
}
