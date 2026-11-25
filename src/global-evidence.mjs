const gridResource = '177f6fa4-ae49-4182-81ea-0c6b35f26ca6';
const gridSource = 'https://www.neso.energy/data-portal/daily-demand-update/demand_data_update';
const gridApi = 'https://api.neso.energy/api/3/action/';

// Each entry is an attributable published result. A missing experiment date stays null.
export const reviewedObservations = [
  {
    id: 'deepseek-r1-zero-aime24',
    topic: 'generalization',
    label: 'Mathematical reasoning on AIME 2024',
    system: 'DeepSeek-R1-Zero',
    organization: 'DeepSeek',
    source: 'DeepSeek researchers in Nature',
    sourceUrl: 'https://www.nature.com/articles/s41586-025-09422-z',
    publishedOn: '2025-09-17',
    value: 77.9,
    unit: '% average pass@1',
    classification: 'First-party measurement',
    summary: 'The authors report that performance rose from 15.6% to 77.9% during reinforcement learning.',
    limitations:
      'One mathematics contest and one training procedure. Peer review does not provide an independent replication on unfamiliar domains.',
  },
  {
    id: 'cicero-diplomacy-2022',
    topic: 'strategic-reasoning',
    label: 'Strategy in multiplayer Diplomacy',
    system: 'CICERO',
    organization: 'Meta',
    source: 'Meta AI',
    sourceUrl: 'https://ai.meta.com/blog/cicero-ai-negotiates-persuades-and-cooperates-with-people/',
    publishedOn: '2022-11-22',
    value: 40,
    unit: 'games played',
    classification: 'First-party measurement',
    summary:
      'In its August–October 2022 study, CICERO placed in the top tenth of human participants who played more than once.',
    limitations:
      'Repeated play within a single structured game. This test cannot establish strategic ability in other settings or intent in deployment.',
  },
  {
    id: 'waymo-rider-only-2025-01',
    topic: 'deployment',
    label: 'Rider-only distance observed',
    system: 'Waymo Driver',
    organization: 'Waymo',
    source: 'Kusano and colleagues, Traffic Injury Prevention',
    sourceUrl: 'https://doi.org/10.1080/15389588.2025.2499887',
    publishedOn: '2025-05-16',
    measuredOn: '2025-01-31',
    measurementDateBasis: 'End of the reported driving period',
    value: 56.7,
    unit: 'million rider-only miles',
    classification: 'First-party measurement',
    limitations:
      'The authors work for Waymo. Distance in the service’s operational domain measures exposure. Other environments, tasks and human support practices need separate evaluation.',
  },
  {
    id: 'alphaevolve-training-efficiency',
    topic: 'successor-development',
    label: 'An AI-discovered improvement to model training',
    system: 'AlphaEvolve',
    organization: 'Google DeepMind',
    source: 'Google DeepMind',
    sourceUrl:
      'https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/',
    publishedOn: '2025-05-14',
    value: 1,
    unit: '% reduction in Gemini training time',
    classification: 'First-party measurement',
    limitations:
      'A reported training-kernel improvement. It does not demonstrate a capability increase in a named successor or a repeated improvement cycle.',
  },
  {
    id: 'alphaevolve-algorithm-discovery',
    topic: 'scientific-discovery',
    label: 'Discovery of algorithms with automated evaluation',
    system: 'AlphaEvolve',
    organization: 'Google DeepMind',
    source: 'Google DeepMind',
    sourceUrl:
      'https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/',
    publishedOn: '2025-05-14',
    value: null,
    unit: null,
    classification: 'First-party measurement',
    summary:
      'The research team used Gemini models to propose algorithms, with automated evaluation of candidate solutions in mathematics and computing.',
    limitations:
      'Experiments with a computable objective and human-chosen problems. Open-ended research and effects on successor generations require other evidence.',
  },
  {
    id: 'arc-agi-2-opus45-2025',
    topic: 'generalization',
    label: 'Unfamiliar visual reasoning puzzles',
    system: 'Claude Opus 4.5 (Thinking, 64k)',
    organization: 'Anthropic',
    source: 'ARC Prize',
    sourceUrl: 'https://arcprize.org/blog/arc-prize-2025-results-analysis',
    publishedOn: '2025-12-05',
    value: 37.6,
    unit: '% of ARC-AGI-2 tasks solved',
    classification: 'Independent evaluation',
    limitations:
      'A verified result on one visual puzzle suite at a specified reasoning budget. It establishes neither broad competence nor performance on a later model.',
  },
  {
    id: 'uk-aisi-research-oversight-2026',
    topic: 'oversight',
    label: 'Continuation of a supplied research-sabotage trajectory',
    system: 'Claude Mythos Preview',
    organization: 'Anthropic',
    source: 'UK AI Security Institute',
    sourceUrl: 'https://arxiv.org/abs/2604.24618',
    publishedOn: '2026-04-27',
    value: 7,
    unit: '% of seeded continuations',
    classification: 'Scientific publication',
    summary:
      'In a controlled evaluation the model continued a supplied sabotage attempt in 7% of cases. Researchers found no spontaneous sabotage in the unprompted tests.',
    limitations:
      'The team tested with developer access. The seeded scenario and possible awareness of evaluation limit inference about real deployments or human intervention.',
  },
  {
    id: 'iea-global-data-centres-2025',
    topic: 'data-centers',
    label: 'Worldwide growth in data-centre electricity demand',
    source: 'International Energy Agency',
    sourceUrl:
      'https://www.iea.org/news/data-centre-electricity-use-surged-in-2025-even-with-tightening-bottlenecks-driving-a-scramble-for-solutions',
    publishedOn: '2026-04-16',
    measuredOn: '2025-12-31',
    measurementDateBasis: 'End of the 2025 reporting year',
    value: 17,
    unit: '% year-on-year growth',
    classification: 'Official statistics',
    limitations:
      'A global estimate for all data centres. Electricity use includes non-AI workloads and does not measure spare capacity.',
  },
  {
    id: 'tsmc-manufacturing-2025',
    topic: 'semiconductors',
    label: 'Foundry manufacturing capacity',
    source: 'TSMC annual Form 20-F',
    organization: 'TSMC',
    sourceUrl: 'https://investor.tsmc.com/sites/ir/sec-filings/2025_20F%20Report.pdf',
    publishedOn: '2026-04-16',
    measuredOn: '2025-12-31',
    measurementDateBasis: 'End of the 2025 reporting year',
    value: 17,
    unit: 'million 12-inch-equivalent wafers per year (lower bound)',
    classification: 'First-party measurement',
    limitations:
      'TSMC states that managed annual capacity exceeded this figure. It spans many chips and countries. AI accelerator availability also depends on packaging, memory and allocation.',
  },
  {
    id: 'ho-lm-efficiency-2024',
    topic: 'algorithmic-efficiency',
    label: 'Compute needed for a fixed language-model result',
    source: 'Ho and colleagues',
    sourceUrl: 'https://arxiv.org/abs/2403.05812',
    publishedOn: '2024-03-09',
    value: 8,
    unit: 'months per estimated halving',
    classification: 'Scientific publication',
    summary: 'The authors fit historical evaluations from 2012–2023 on two language-modeling benchmarks.',
    limitations:
      'A retrospective estimate conditional on sample and benchmark. It cannot establish the rate on current research tasks.',
  },
].map((row) => ({
  measuredOn: null,
  organization: null,
  system: null,
  measurementDateBasis: 'Exact test day undisclosed',
  ...row,
}));

export async function collectGridDemand(fetcher, now) {
  const query = new URLSearchParams({
    resource_id: gridResource,
    filters: JSON.stringify({ FORECAST_ACTUAL_INDICATOR: 'A' }),
    sort: 'SETTLEMENT_DATE desc, SETTLEMENT_PERIOD desc',
    limit: '1',
  });
  async function read(route) {
    const response = await fetcher(gridApi + route, { signal: AbortSignal.timeout(6500) });
    if (!response.ok) throw new Error('Grid source unavailable');
    const result = await response.json();
    if (!result.success) throw new Error('Grid query unavailable');
    return result.result;
  }
  const [rows, metadata] = await Promise.all([
    read('datastore_search?' + query),
    read('resource_show?id=' + gridResource),
  ]);
  const row = rows.records?.[0];
  const publication = metadata.last_modified;
  const publishedAt =
    typeof publication === 'string'
      ? Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(publication) ? publication : publication + 'Z')
      : NaN;
  if (
    row?.FORECAST_ACTUAL_INDICATOR !== 'A' ||
    !Number.isFinite(row.ND) ||
    row.ND <= 0 ||
    !Number.isInteger(row.SETTLEMENT_PERIOD) ||
    row.SETTLEMENT_PERIOD < 1 ||
    row.SETTLEMENT_PERIOD > 50 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(row.SETTLEMENT_DATE) ||
    !Number.isFinite(publishedAt) ||
    publishedAt > now.getTime() ||
    row.SETTLEMENT_DATE > new Date(publishedAt).toISOString().slice(0, 10)
  )
    throw new Error('Unverified grid observation');
  return {
    id: 'gb-demand-' + row.SETTLEMENT_DATE + '-' + row.SETTLEMENT_PERIOD,
    topic: 'energy',
    label: 'Great Britain grid demand',
    system: null,
    organization: null,
    source: 'National Energy System Operator',
    sourceUrl: gridSource,
    measuredOn: row.SETTLEMENT_DATE,
    measurementDateBasis: 'Settlement period ' + row.SETTLEMENT_PERIOD + ' in Great Britain',
    publishedOn: new Date(publishedAt).toISOString().slice(0, 10),
    publicationDateBasis: 'Operator timestamp for the data release',
    value: row.ND,
    unit: 'MW national demand',
    classification: 'Official statistics',
    limitations:
      'An observed half-hour of national demand. Spare power, data-centre outages and AI capacity require separate evidence.',
  };
}
