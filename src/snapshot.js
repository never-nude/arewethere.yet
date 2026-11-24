export const studyDate = "2026-11-20";
const studyUrl = "https://metr.org/blog/2026-11-20-q4-2026-capability-update/";

export const sourceDefinitions = {
  metr: {
    id: "metr",
    label: "METR",
    url: studyUrl,
    detail: "The task chart uses figures from the November 2026 study. New METR reports appear in the signal feed.",
  },
  epoch: {
    id: "epoch",
    label: "Epoch AI",
    url: "https://epoch.ai/data/ai-models",
    detail: "Frontier model training compute. The dataset includes estimated values and has gaps where compute is undisclosed.",
  },
  epochEci: {
    id: "epoch-eci",
    label: "Epoch Capabilities Index",
    url: "https://epoch.ai/eci",
    detail: "A Bayesian estimate based on benchmark results across several domains, published by Epoch AI under CC BY. Scores can change as the model is refit.",
  },
  manifold: {
    id: "manifold",
    label: "Manifold",
    url: "https://manifold.markets/RemNi/will-we-get-agi-before-2030",
    detail: "A play-money market with its own resolution rules for when a general AI system is publicly announced.",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    url: "https://openai.com/news/",
    detail: "First-party research and frontier model announcements.",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    url: "https://platform.claude.com/docs/en/release-notes/overview",
    detail: "First-party general-purpose Claude model releases recorded in the platform changelog.",
  },
  metrNews: {
    id: "metr-news",
    label: "METR publications",
    url: "https://metr.org/blog/",
    detail: "Independent analyses of frontier model capabilities and AI research acceleration.",
  },
};

export const metricDefinitions = {
  horizon: {
    id: "horizon",
    label: "50% task horizon",
    unit: "h",
    detail: "Human-expert task duration at an estimated 50% success rate on METR’s combined TH1.1 and TH2 suite.",
    source: "METR",
    sourceUrl: studyUrl + "#3c1-across-th11-and-th2-we-find-that-capabilities-are-doubling-roughly-every-36-months",
  },
  reliability: {
    id: "reliability",
    label: "80% task horizon",
    unit: "h",
    detail: "Human-expert task duration at an estimated 80% success rate on METR’s verifiable TH2 tasks.",
    source: "METR",
    sourceUrl: studyUrl + "#80-time-horizon",
  },
  compute: {
    id: "compute",
    label: "Frontier training compute",
    unit: "FLOP",
    detail: "Record known or estimated training compute among frontier models in the Epoch AI dataset since 2012.",
    source: "Epoch AI",
    sourceUrl: sourceDefinitions.epoch.url,
  },
  forecast: {
    id: "forecast",
    label: "AGI before 2030",
    unit: "%",
    detail: "Price of YES in Manifold’s play-money market for a general AI system publicly announced before 2030, under its resolution rules.",
    source: "Manifold",
    sourceUrl: sourceDefinitions.manifold.url,
  },
  breadth: {
    id: "breadth",
    label: "Broad capability",
    unit: "ECI",
    detail: "Epoch Capabilities Index across many benchmarks. The published scale anchors Claude 3.5 Sonnet at 130 and GPT-5 at 150 and has no maximum.",
    source: "Epoch AI",
    sourceUrl: sourceDefinitions.epochEci.url,
    intervalLabel: "90% credible interval",
  },
  "open-breadth": {
    id: "open-breadth",
    label: "Open-weight capability",
    unit: "ECI",
    detail: "Epoch Capabilities Index for the highest-scoring model with published weights. Some weight licenses restrict use.",
    source: "Epoch AI",
    sourceUrl: sourceDefinitions.epochEci.url,
    intervalLabel: "90% credible interval",
  },
  "closed-breadth": {
    id: "closed-breadth",
    label: "Closed-weight capability",
    unit: "ECI",
    detail: "Epoch Capabilities Index for the highest-scoring model in its closed-weights category.",
    source: "Epoch AI",
    sourceUrl: sourceDefinitions.epochEci.url,
    intervalLabel: "90% credible interval",
  },
  "research-autonomy": {
    id: "research-autonomy",
    label: "Unassisted research tasks",
    unit: "%",
    detail: "OpenAI’s estimate of completion without human intervention for delegated internal tasks requiring four to eight hours of human work. Task selection can change.",
    source: "OpenAI",
    sourceUrl: "https://openai.com/index/research-acceleration-jagged-frontier/",
  },
  "research-acceleration": {
    id: "research-acceleration",
    label: "Research capability growth rate",
    unit: "×",
    detail: "METR’s estimate of Anthropic’s recent benchmark growth rate relative to its earlier rate. The study includes AI-assisted research and other potential contributors.",
    source: "METR",
    sourceUrl: "https://metr.org/blog/2026-11-05-anthropic-ai-rd-acceleration-assessment/",
    intervalLabel: "95% confidence interval",
  },
};

export const referenceEvents = [
  {
    id: "metr-q4",
    date: "2026-11-20",
    title: "METR updates independent AI capability measurements",
    category: "Evaluation",
    source: "METR",
    url: studyUrl,
    summary: "Estimates reach 40 hours at 50% success on the combined task suite and 5.4 hours at 80% success on verifiable TH2 tasks. Both estimates have wide uncertainty.",
  },
  {
    id: "openai-research",
    date: "2026-11-18",
    title: "OpenAI reports uneven progress on autonomous research tasks",
    category: "Research",
    source: "OpenAI",
    url: "https://openai.com/index/research-acceleration-jagged-frontier/",
    summary: "OpenAI estimates 46% zero-intervention success on 2–4-hour internal research tasks and 35% on 4–8-hour tasks, with large differences by task type.",
  },
  {
    id: "openai-chip-design",
    date: "2026-11-18",
    title: "OpenAI reports AI-assisted chip design improvements",
    category: "Research",
    source: "OpenAI",
    url: "https://openai.com/index/advancing-chip-design-with-our-models/",
    summary: "OpenAI reports that its models helped optimize circuits used in silicon and improve RISC-V core designs.",
  },
  {
    id: "openai-gpt-6-2",
    date: "2026-11-17",
    title: "OpenAI introduces GPT-6.2 Astra and Sol",
    category: "Release",
    source: "OpenAI",
    url: "https://openai.com/index/introducing-gpt-6-2-astra-sol/",
    summary: "OpenAI reports improvements in professional work, coding, and computer use for the new models.",
  },
  {
    id: "anthropic-fable-mythos",
    date: "2026-11-09",
    title: "Anthropic releases Claude Fable 5.2 and Mythos 5.2",
    category: "Release",
    source: "Anthropic",
    url: "https://www.anthropic.com/claude-fable-and-mythos-5-2",
    summary: "Anthropic reports coding, reasoning, and vision improvements, with limited availability for Mythos.",
  },
  {
    id: "metr-anthropic",
    date: "2026-11-05",
    title: "METR assesses AI research acceleration at Anthropic",
    category: "Research",
    source: "METR",
    url: "https://metr.org/blog/2026-11-05-anthropic-ai-rd-acceleration-assessment/",
    summary: "METR estimates Anthropic’s benchmarks improved at 1.9× the previous rate. Staff described the gains as primarily coming from AI assistance.",
  },
];

function benchmarkMetric(id, rows, otherRows) {
  const toPoint = ([date, label, minutes, lower, upper], frontier) => ({
    date,
    label,
    value: minutes / 60,
    low: lower / 60,
    high: upper / 60,
    frontier,
  });
  const history = rows.map(row => toPoint(row, true));
  const observations = [...history, ...otherRows.map(row => toPoint(row, false))]
    .sort((a, b) => a.date.localeCompare(b.date) || b.value - a.value);
  const { date, label, value, low, high } = history.at(-1);
  return {
    ...metricDefinitions[id],
    model: label,
    modelDate: date,
    value,
    low,
    high,
    history,
    observations,
    asOf: studyDate,
    status: "snapshot",
  };
}

const horizon = benchmarkMetric("horizon", [
  ["2024-05-13", "GPT-4o", 7.11244, 3.81807, 13.529],
  ["2024-12-05", "o1", 35.2501, 15.6642, 66.0704],
  ["2025-08-07", "GPT-5", 180.559, 97.8775, 334.456],
  ["2025-11-24", "Claude Opus 4.5", 275.373, 144.68, 510.983],
  ["2026-02-05", "Claude Opus 4.6", 384.048, 193.378, 729.588],
  ["2026-04-16", "Claude Opus 4.7", 502.97, 257.936, 937.606],
  ["2026-04-23", "GPT-5.5", 664.343, 365.901, 1116.4],
  ["2026-05-28", "Claude Opus 4.8", 710.613, 366.906, 1268.14],
  ["2026-06-09", "Claude Fable 5", 934.74, 534.843, 1939.3],
  ["2026-07-24", "Claude Opus 5", 1194.81, 566.788, 5174.83],
  ["2026-09-01", "Claude Fable 5.1", 1812.89, 718.743, 18464.1],
  ["2026-09-03", "GPT-6 Astra", 2416.33, 791.513, 158701],
], [
  ["2026-03-05", "GPT-5.4", 356.668, 199.457, 592.046],
  ["2026-07-09", "GPT-5.6 Sol", 716.592, 393.39, 1239.23],
  ["2026-09-22", "Claude Opus 5.5", 2337.38, 714.87, 75176.6],
]);

const reliability = benchmarkMetric("reliability", [
  ["2026-02-05", "Claude Opus 4.6", 11.8671, 5.66486, 103.047],
  ["2026-03-05", "GPT-5.4", 20.0735, 7.2322, 166.02],
  ["2026-04-16", "Claude Opus 4.7", 37.2953, 14.5883, 235.841],
  ["2026-04-23", "GPT-5.5", 99.752, 13.1317, 378.288],
  ["2026-06-09", "Claude Fable 5", 119.269, 16.0463, 550.276],
  ["2026-07-24", "Claude Opus 5", 180.347, 66.4544, 765.193],
  ["2026-09-01", "Claude Fable 5.1", 189.436, 64.7793, 944.077],
  ["2026-09-03", "GPT-6 Astra", 326.279, 60.6958, 2053.88],
], [
  ["2026-05-28", "Claude Opus 4.8", 55.718, 14.9201, 273.739],
  ["2026-07-09", "GPT-5.6 Sol", 23.1111, 16.1019, 652.576],
  ["2026-09-22", "Claude Opus 5.5", 182.541, 42.8466, 1377.15],
]);

const compute = {
  ...metricDefinitions.compute,
  value: 9.4e26,
  model: "GPT-6 Astra",
  modelDate: "2026-09-03",
  history: [
    ["2013-01-16", "DistBelief NNLM", 2.612736e18],
    ["2014-12-03", "SNM-skip", 2.976e20],
    ["2018-05-02", "ResNeXt-101 32x48d", 8.74395e21],
    ["2020-01-28", "Meena", 1.12e23],
    ["2022-03-15", "GPT-3.5 (davinci-002)", 2.578e24],
    ["2025-02-17", "Grok 3", 3.5e26],
    ["2026-09-03", "GPT-6 Astra", 9.4e26],
  ].map(([date, label, value]) => ({ date, label, value })),
  asOf: "2026-09-03",
  status: "snapshot",
};

const forecast = {
  ...metricDefinitions.forecast,
  value: 49,
  history: [
    ["2026-08-17", 37.5],
    ["2026-08-27", 40.6],
    ["2026-09-02", 41.03],
    ["2026-09-09", 49.74],
    ["2026-09-14", 51.01],
    ["2026-09-18", 49.1],
    ["2026-09-22", 49.1],
    ["2026-09-28", 53.52],
    ["2026-10-08", 49.58],
    ["2026-10-23", 52],
    ["2026-11-03", 50.46],
    ["2026-11-07", 51.66],
    ["2026-11-17", 52],
    ["2026-11-23", 49],
  ].map(([date, value]) => ({ date, value })),
  asOf: "2026-11-23T22:16:31.530Z",
  status: "snapshot",
};

function eciSnapshot(id, rows, observations = rows) {
  const toPoint = ([date, label, value, low, high, access, organization]) =>
    ({ date, label, value, low, high, access, organization });
  const history = rows.map(toPoint);
  const { date, label, value, low, high } = history.at(-1);
  return {
    ...metricDefinitions[id],
    model: label,
    modelDate: date,
    value,
    low,
    high,
    history,
    observations: observations.map(toPoint),
    asOf: date,
    status: "snapshot",
  };
}

const breadthFrontier = [
  ["2024-06-20", "Claude 3.5 Sonnet", 130, 130, 130, "Closed weights", "Anthropic"],
  ["2025-08-07", "GPT-5", 150, 150, 150, "Closed weights", "OpenAI"],
  ["2026-09-03", "GPT-6 Astra", 169.21, 166.41, 172.49, "Closed weights", "OpenAI"],
  ["2026-11-09", "Claude Fable 5.2", 173.4, 170.04, 177.22, "Closed weights", "Anthropic"],
];
const closedEci = [
  ...breadthFrontier,
  ["2026-11-10", "Gemini 4 Carbon", 169.68, 166.58, 173.14, "Closed weights", "Google DeepMind"],
  ["2026-11-12", "Gemini 4 Hydrogen", 166.81, 163.99, 170.1, "Closed weights", "Google DeepMind"],
  ["2026-11-17", "GPT-6.2 Astra", 172.82, 169.37, 176.94, "Closed weights", "OpenAI"],
];
const openEci = [
  ["2026-07-16", "Kimi K3", 158.61, 156.66, 160.8, "Open weights", "Moonshot AI"],
  ["2026-10-17", "DeepSeek V4.1 Flash 1017", 159.41, 157.13, 161.91, "Open weights", "DeepSeek"],
  ["2026-10-23", "Kimi K3.1 Pro", 161.2, 158.95, 163.74, "Open weights", "Moonshot AI"],
];
const breadth = eciSnapshot("breadth", breadthFrontier, [...closedEci, ...openEci]);
const openBreadth = eciSnapshot("open-breadth", openEci);
const closedBreadth = eciSnapshot("closed-breadth", breadthFrontier, closedEci);

export const publishedResearch = [
  {
    ...metricDefinitions["research-autonomy"],
    value: 35,
    history: [
      { date: "2026-03-31", publishedAt: "2026-11-18", value: 13, label: "March estimate" },
      { date: "2026-10-31", publishedAt: "2026-11-18", value: 35, label: "October estimate" },
    ],
    asOf: "2026-11-18",
    evidenceType: "First-party study",
    status: "snapshot",
  },
  {
    ...metricDefinitions["research-acceleration"],
    value: 1.9,
    low: 1.5,
    high: 2.8,
    history: [{ date: "2026-11-05", value: 1.9, low: 1.5, high: 2.8, label: "METR assessment of Anthropic" }],
    asOf: "2026-11-05",
    evidenceType: "Independent study",
    status: "snapshot",
  },
];

const sourceDates = {
  metr: studyDate,
  epoch: compute.asOf,
  "epoch-eci": breadth.asOf,
  manifold: forecast.asOf,
  openai: "2026-11-18",
  anthropic: "2026-11-09",
  "metr-news": studyDate,
};

export const snapshot = {
  checkedAt: "2026-11-24T05:10:01.779Z",
  metrics: [horizon, reliability, compute, forecast, breadth, openBreadth, closedBreadth, ...publishedResearch],
  events: referenceEvents,
  releaseEvents: referenceEvents.filter(event => event.category === "Release"),
  releaseStart: null,
  sources: Object.values(sourceDefinitions).map(source => ({
    ...source,
    asOf: sourceDates[source.id],
    status: "snapshot",
  })),
};
