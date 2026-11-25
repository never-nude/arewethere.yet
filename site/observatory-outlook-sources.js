// A dated research vintage. The model owns the translation from these published
// quantities to its different milestone definitions, including all scenario weights.
export const outlookResearchCheckedOn = '2026-11-24';

export const outlookAnchors = {
  hlmi: { q10: 2027, q50: 2042, sourceId: 'espai-2024' },
  researchJob: { q50: 2052, sourceId: 'espai-2024' },
  mlPaper: { q10: 2026, q50: 2036, q90: 2183, sourceId: 'espai-2024' },
  asiLag: { years1: 2, p1: 0.10, years2: 30, p2: 0.60, sourceId: 'espai-2024' },
  speedupLag: { years1: 2, p1: 0.20, years2: 30, p2: 0.80, sourceId: 'espai-2024' },
  leapAgi: { q25: 2039, q50: 2050, q75: 2065, by2100: 0.80, sourceId: 'leap-8' },
  leapRapid: { q50: 2045, by2100: 0.68, sourceId: 'leap-8' },
  aiFutures: { sarYear: 2027, topExpertYear: 2028, sourceId: 'ai-futures-nov' },
};

export const outlookSources = [
  {
    id: 'espai-2024', title: 'AI Impacts · Survey of machine-learning researchers',
    url: 'https://aiimpacts.org/wp-content/uploads/2026/09/ESPAI2024.pdf',
    publishedOn: '2026-09', availableBy: '2026-09-25', surveyedOn: '2024-12', milestones: ['agi', 'rsi', 'asi', 'singularity'],
    finding: 'The survey obtained 1,580 valid responses. Its combined forecasts put a 10% chance on machines doing every task better and more cheaply by 2027 and 50% by 2042. The halfway year was 2036 for doing research and writing a machine-learning conference paper, and 2052 for automating the occupation of AI researcher.',
    limitation: 'Respondents answered subsets of questions and assumed no major disruption to science. Conditional on human-level machines, median respondents assigned 10% within two years and 60% within thirty years to vastly superhuman performance across professions. For a dramatic AI-driven acceleration of global technology, those figures were 20% and 80%. The Watch requires independent tests and evidence of a repeating causal loop.',
    locator: 'Sections 2.3 and 3.2, Table 2, and Appendices E and F',
  },
  {
    id: 'leap-8', title: 'Forecasting Research Institute · Longitudinal Expert AI Panel, wave 8',
    url: 'https://leap.forecastingresearch.org/reports/wave8',
    publishedOn: '2026-06-02', surveyedOn: '2026-04-20/2026-05-11', milestones: ['agi', 'asi', 'singularity'],
    finding: 'The median expert gave an 80% chance of majority panel agreement on expert-level AGI before 2100. Given that recognition, the quarter, halfway and three-quarter dates were 2039, 2050 and 2065. A separate question on recognizing rapid progress gave 68% before 2100 and a conditional halfway year of 2045.',
    limitation: 'The AGI question requires a commercial system that beats 90th-percentile professionals on at least 90% of nonphysical tasks in every primarily nonphysical occupation, at up to five times the equivalent labor cost. Its rapid-progress scenario also involves physical capabilities. Neither question stipulates the Watch’s testing or causal rules.',
  },
  {
    id: 'metaculus-agi', title: 'Metaculus · When will a general AI system be publicly announced?',
    url: 'https://www.metaculus.com/questions/5121/date-of-artificial-general-intelligence/',
    publishedOn: null, availableBy: '2026-11-24', dataThrough: '2026-11-24', milestones: ['agi'],
    finding: 'On November 24, the community forecast centered on 2030 for the first general AI system to be built, tested and publicly announced under the question’s rules.',
    limitation: 'This crowd forecast can change as people update their predictions. Its public announcement date offers a comparison with the Watch’s estimate for independently demonstrated ability across domains. It has no weight in the Watch’s calculation.',
    locator: 'Question 5121, community estimate checked November 24, 2026',
  },
  {
    id: 'ai-futures-nov', title: 'AI Futures Project · November timelines update',
    url: 'https://blog.aifutures.org/p/q35-timelines-update-looks-like-the',
    publishedOn: '2026-11-10', milestones: ['agi', 'rsi', 'asi', 'singularity'],
    finding: 'All six authors placed their halfway date for a superhuman AI researcher in 2027. Five placed the date for AI that outperforms top experts across virtually all cognitive tasks in 2028 and one in 2027.',
    limitation: 'The authors assume no substantial deliberate slowdown and draw heavily on the same METR report about Anthropic. Their research milestone requires automated coding and experiment selection on par with the best human researcher. It can be reached before anyone independently verifies a repeating successor lineage.',
    dataUrl: 'https://datawrapper.dwcdn.net/e6bKu/9/dataset.csv',
  },
  {
    id: 'fri-fast-year', title: 'Forecasting Research Institute · Measuring a year of unusually fast gains',
    url: 'https://forecastingresearch.org/research/recursive-self-improvement',
    publishedOn: '2026-11-24', dataThrough: '2026-11-20', milestones: ['rsi', 'singularity'],
    finding: 'The researchers modeled a rise of at least 30 points in the best Epoch Capabilities Index score within twelve months. Their statistical model put its chance at 12% by the end of 2027 and 38% by the end of 2030.',
    limitation: 'Under other plausible assumptions about volatility, their 2030 figure ranged from 7% to 59%. One year of gains on an index leaves the cause, persistence across generations and effect on technology beyond AI open.',
    locator: 'Section 2.3 and its second endnote, November 2026 revision',
  },
  {
    id: 'leap-growth', title: 'Forecasting Research Institute · Economic growth under rapid AI progress',
    url: 'https://leap.forecastingresearch.org/reports/wave10', publishedOn: '2026-07-28',
    surveyedOn: '2026-06-16/2026-07-07', milestones: ['singularity'],
    finding: 'Even assuming rapid AI progress, the expert panel’s median forecast for annual growth in advanced economies in 2050 was 5%, against a roughly 2% historical pace. The median among tournament forecasters was 3%.',
    limitation: 'Economic output reflects financing, adoption, physical production and regional conditions. A jump in research capability can take years to reach these measures. GDP growth alone cannot identify a repeating improvement cycle or its cause.',
  },
  {
    id: 'metr-research', title: 'METR · AI research and development at Anthropic',
    url: 'https://metr.org/blog/2026-11-05-anthropic-ai-rd-acceleration-assessment/',
    publishedOn: '2026-11-05', milestones: ['rsi', 'singularity'],
    finding: 'At Anthropic, measured gains on the lab’s capability index came 1.9 times as fast after October 2025 as in the earlier period. The reported 95% interval was 1.5–2.8 times. METR judged that AI probably accounted for most of the recent acceleration.',
    limitation: 'The attribution is a judgment under substantial uncertainty. Staff changes, compute, the choice of tasks and the earlier growth rate can also affect this one lab’s comparison.',
  },
  {
    id: 'metr-horizons', title: 'METR · Duration of AI tasks in the Q4 capability evaluation',
    url: 'https://metr.org/blog/2026-11-20-q4-2026-capability-update/',
    publishedOn: '2026-11-20', milestones: ['agi', 'rsi', 'asi'],
    finding: 'Across two task suites, METR estimated that the human-expert working time corresponding to 50% AI success doubled every 3.61 months. The 95% interval on the doubling time was 2.08–4.94 months.',
    limitation: 'These tasks emphasize software and research work. Longer tasks, higher reliability, transfer to unfamiliar domains and open-ended research each need their own measurements.',
    locator: 'Section 3.C.1',
  },
  {
    id: 'sakana-dgm', title: 'Sakana AI and UBC · Darwin Gödel Machine',
    url: 'https://sakana.ai/dgm/', publishedOn: '2025-05-30', milestones: ['rsi'],
    finding: 'Researchers reported a coding agent that repeatedly edited agent code and tested successors. The resulting system’s SWE-bench score rose from 20% to 50%, with a separate coding benchmark improving from 14.2% to 30.7%.',
    limitation: 'This developer experiment changed the software around a foundation model. A public, independently verified lineage would need to connect specific successive changes to the Watch’s required capability gains.',
  },
  {
    id: 'dgm-followup', title: 'Wang and colleagues · Testing self-improving coding agents',
    url: 'https://arxiv.org/abs/2510.21614', publishedOn: '2025-10-24', milestones: ['rsi'],
    finding: 'A second team reran the Darwin Gödel Machine method with different underlying models and a common starting agent. The starting agent solved 40% of a 60-task software test. Its selected successor scored 53.3%.',
    limitation: 'This independently tests whether the method can discover better coding agents. The initial-to-final comparison does not identify how much each of two successive generations contributed on independent held-out tasks.',
    locator: 'Section 4.2, Table 2',
  },
  {
    id: 'arc-agi-3', title: 'ARC Prize · GPT-6.2 Astra on interactive reasoning tasks',
    url: 'https://arcprize.org/results/openai-gpt-6-2-astra',
    publishedOn: null, availableBy: '2026-11-24', dataThrough: '2026-11-24', modelReleaseOn: '2026-11-17', milestones: ['agi', 'asi'],
    finding: 'On ARC-AGI-3, GPT-6.2 Astra at the same maximum reasoning setting scored 70.3% with the standard setup and 99.8% with the provider’s adapter, which retains the model’s internal reasoning state between requests.',
    limitation: 'The tested setup matters even for the same model. The score describes a specific collection of interactive puzzles. Evidence from other domains and independent tests of transfer are still needed.',
    locator: 'Verified scores table, Max row',
  },
  {
    id: 'epoch-frontiermath', title: 'Epoch AI · Attribution of solutions to open mathematics problems',
    url: 'https://epoch.ai/frontiermath/open-problems', publishedOn: '2026-09-16', milestones: ['asi'],
    dataThrough: '2026-11-24',
    finding: 'Of 49 open mathematical challenges in the register on November 24, Epoch credited five solutions to AI alone and five to people working with AI. The distinction records who contributed the ideas behind each solution.',
    limitation: 'A solution establishes a particular mathematical result. Judging broad superiority to leading experts requires repeatable comparisons across multiple disciplines.',
    locator: 'Changelog for September 16, 2026',
  },
  {
    id: 'epoch-work', title: 'Epoch AI · Can AI automate Epoch?',
    url: 'https://epoch.ai/publications/can-ai-automate-epoch', publishedOn: '2026-10-08', milestones: ['agi', 'rsi', 'asi'],
    finding: 'Epoch gave six models tasks drawn from its own work. Stronger systems could suggest research directions but struggled to design experiments that would resolve the question or to catch flaws in their own experimental setup.',
    limitation: 'The evaluators used one organization’s tasks and quality standards. The experiment identifies practical gaps without establishing a universal ceiling.',
  },
];
