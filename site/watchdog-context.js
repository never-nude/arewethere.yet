export const watchdogContext = [
  {
    date: '2026-10-20',
    organization: 'Google',
    title: 'Power loss disrupts AI services in a Google Cloud region',
    detail: 'Google traced the London-region incident to a power failure at one facility and trouble starting backup generators. Some Vertex AI Workbench resources became unreachable, and some Prediction operations were degraded in the region.',
    source: 'Google Cloud Service Health',
    url: 'https://status.cloud.google.com/incidents/Xs2XTHzAVC9YnafnPyzj',
  },
  {
    date: '2026-09-29',
    organization: 'Microsoft',
    title: 'A software rollout interrupts Azure AI services in Sweden',
    detail: 'Microsoft’s post-incident review links a regional rollout and several underlying system faults to failed and slower requests for Azure OpenAI, Foundry Models, and related services.',
    source: 'Microsoft Azure Status',
    url: 'https://rssfeed.azure.status.microsoft/en-us/status/history/',
  },
  {
    date: '2026-09-11',
    organization: 'Industry',
    title: 'Reuters reports a rethink of a planned UAE AI data center',
    detail: 'Reuters reported that the Iran war led planners to reconsider where and how to build the proposed five-gigawatt AI campus. The report concerns future computing capacity.',
    source: 'Reuters',
    url: 'https://www.aol.com/articles/exclusive-uae-revises-ai-data-090358000.html',
  },
];

export function getWatchdogAnomaly(history, date) {
  const position = history.findIndex((frame) => frame.date === date);
  const frame = history[position];
  if (!Number.isFinite(frame?.delta)) return null;

  const priorMoves = history.slice(Math.max(0, position - 30), position)
    .map(({ delta }) => delta)
    .filter(Number.isFinite)
    .map(Math.abs)
    .sort((a, b) => a - b);
  if (priorMoves.length < 7) return null;
  const middle = Math.floor(priorMoves.length / 2);
  const median = priorMoves.length % 2 ? priorMoves[middle] : (priorMoves[middle - 1] + priorMoves[middle]) / 2;
  const threshold = Math.max(1, 3 * median);
  if (Math.abs(frame.delta) < threshold) return null;

  const previous = new Map((history[position - 1]?.factors ?? []).map((factor) => [factor.id, factor.contribution]));
  const factors = (frame.factors ?? [])
    .flatMap(({ id, label, contribution, contributionDelta }) => {
      const prior = previous.get(id);
      const delta = contributionDelta ?? (contribution ?? 0) - (prior ?? 0);
      if (!Number.isFinite(delta) || delta === 0) return [];
      const coverage = prior == null && contribution != null ? 'new evidence' :
        prior != null && contribution == null ? 'evidence no longer counted' : '';
      return [{ label, delta, coverage }];
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return { delta: frame.delta, threshold, factors, coverageDelta: frame.coverageDelta ?? 0 };
}
