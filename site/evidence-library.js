export const evidenceGroups = [
  {
    id: 'evidence-capability',
    title: 'Measured capability and its projection',
    claim: 'The AGI chart extends the recent change in Epoch’s measured frontier at a constant pace. Task horizons measure a different capability, completing selected work at a given success rate.',
    sources: [
      {
        title: 'Epoch Capabilities Index',
        by: 'Epoch AI · Updated dataset',
        kind: 'Benchmark data',
        url: 'https://epoch.ai/eci',
        role: 'Supplies the dated model scores and uncertainty intervals behind the measured line. Benchmark selection matters when interpreting the composite score.',
      },
      {
        title: 'AI R&D-relevant model capabilities are improving rapidly and are getting harder to measure',
        by: 'Megan Kinniment and colleagues · METR · Nov 20, 2026',
        kind: 'Independent evaluation',
        url: 'https://metr.org/blog/2026-11-20-q4-2026-capability-update/',
        role: 'Documents gains on selected tasks and uncertainty about how much they will carry over to less verifiable work.',
      },
      {
        title: 'He Wants AI Benchmarking To Be a Science, Not a Dark Art',
        by: 'John Pavlus · Quanta Magazine · Oct 16, 2026',
        kind: 'Independent reporting',
        url: 'https://www.quantamagazine.org/he-wants-ai-benchmarking-to-be-a-science-not-a-dark-art-20261016/',
        role: 'Computer scientist Moritz Hardt explains how repeated use of test sets and incentives to climb leaderboards can distort what the scores tell us.',
      },
      {
        title: 'Are We Thinking Correctly About AI Intelligence?',
        by: 'Steven Strogatz and Janna Levin · Quanta Magazine · Aug 20, 2026',
        kind: 'Expert interview',
        url: 'https://www.quantamagazine.org/are-we-thinking-correctly-about-ai-intelligence-20260820/',
        role: 'Computer scientist Melanie Mitchell explains why tests on unfamiliar variations can give a clearer picture of generalization.',
      },
    ],
  },
  {
    id: 'evidence-agi-timing',
    title: 'AGI timing and possible paths',
    claim: 'The market quote reflects one public event under its own rules. The diagram’s two paths use evidence points and stated weights to show possible sequences.',
    sources: [
      {
        title: 'Will we get AGI before 2030?',
        by: 'RemNi · Manifold · Live market and resolution rules',
        kind: 'Play-money market',
        url: 'https://manifold.markets/RemNi/will-we-get-agi-before-2030',
        role: 'Supplies the displayed market quote. Its wording and moderator notes determine what counts as a public AGI announcement.',
      },
      {
        title: 'Levels of AGI for Operationalizing Progress on the Path to AGI',
        by: 'Meredith Ringel Morris and colleagues · ICML · 2024',
        kind: 'Research framework',
        url: 'https://arxiv.org/abs/2311.02462',
        role: 'Distinguishes breadth, performance, and autonomy. These dimensions can develop at different rates, which helps explain why the map shows more than one possible sequence.',
      },
      {
        title: 'Tech companies want to build artificial general intelligence. But who decides when AGI is attained?',
        by: 'Matt O’Brien · Associated Press · Apr 4, 2024',
        kind: 'Independent reporting',
        url: 'https://apnews.com/article/ff5662a056d3cf3c5889a73e929e5a34',
        role: 'Reports how researchers and companies set different standards for AGI. Read those standards before comparing dates or claims of arrival.',
      },
    ],
  },
  {
    id: 'evidence-acceleration',
    title: 'Evidence for faster AI research',
    claim: 'The watch looks for corroborating capability and research findings. A sustained feedback loop would require evidence that AI assistance drives gains across multiple generations.',
    sources: [
      {
        title: 'Independent Assessment of AI R&D Acceleration at Anthropic in October 2026',
        by: 'Tom Cunningham and colleagues · METR · Nov 5, 2026',
        kind: 'Independent assessment',
        url: 'https://metr.org/blog/2026-11-05-anthropic-ai-rd-acceleration-assessment/',
        role: 'Assesses faster model improvement at one company. Redactions restrict what outside readers can verify about its causes.',
      },
      {
        title: 'How an assessor could investigate evidence of acceleration from the automation of AI R&D',
        by: 'METR · Oct 14, 2026',
        kind: 'Evaluation method',
        url: 'https://metr.org/blog/2026-10-14-ai-rd-acceleration-assessment-proposal/',
        role: 'Explains how an assessor could examine compute, staffing, and other inputs before attributing faster research to AI.',
      },
      {
        title: 'Research acceleration: The jagged frontier',
        by: 'OpenAI · Nov 18, 2026',
        kind: 'Company measurements',
        url: 'https://openai.com/index/research-acceleration-jagged-frontier/',
        role: 'Reports internal research task completion across different task lengths. Performance varies substantially with the type of task.',
      },
      {
        title: 'AlphaEvolve: A Gemini-powered coding agent for designing advanced algorithms',
        by: 'AlphaEvolve engineering team · Google DeepMind · May 14, 2025',
        kind: 'Engineering report',
        url: 'https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/',
        role: 'Describes algorithm improvements in areas with automated verification. The engineering team reports that one change reduced Gemini training time by about 1%.',
      },
    ],
  },
  {
    id: 'evidence-history',
    title: 'Where the idea came from',
    claim: 'These original writings trace how the idea evolved from faster technological change to a possible feedback loop in machine intelligence.',
    sources: [
      {
        title: 'John von Neumann, 1903–1957',
        by: 'Stanisław Ulam · Bulletin of the American Mathematical Society · 1958',
        kind: 'Historical source',
        url: 'https://projecteuclid.org/euclid.bams/1183522369',
        role: 'Ulam recalls a conversation with von Neumann about technological change reaching a turning point.',
      },
      {
        title: 'Speculations Concerning the First Ultraintelligent Machine',
        by: 'I. J. Good · Advances in Computers · 1965 · Virginia Tech reprint',
        kind: 'Historical source',
        url: 'https://vtechworks.lib.vt.edu/items/5085379d-b24c-424e-8861-e70a47b4b2fb',
        role: 'The mathematician describes how machines that help design stronger successors could drive a feedback loop.',
      },
      {
        title: 'The Coming Technological Singularity: How to Survive in the Post-Human Era',
        by: 'Vernor Vinge · NASA Vision-21 proceedings · 1993',
        kind: 'Historical source',
        url: 'https://ntrs.nasa.gov/api/citations/19940022856/downloads/19940022856.pdf',
        role: 'Vinge sketches several possible paths to superhuman intelligence. His proposed timing belongs to that historical scenario.',
      },
    ],
  },
  {
    id: 'evidence-journalism',
    title: 'Reporting and perspectives',
    claim: 'These accounts put benchmark claims, investment, and deployment in context. The numbers on this dashboard draw on the measured data and the market rules cited above.',
    sources: [
      {
        title: 'Microsoft Says New A.I. Shows Signs of Human Reasoning',
        by: 'Cade Metz · The New York Times · May 16, 2023',
        kind: 'Independent reporting',
        url: 'https://www.nytimes.com/2023/05/16/technology/microsoft-ai-human-reasoning.html',
        role: 'Reports Microsoft researchers’ interpretation of early GPT-4 experiments and includes disagreement over what those demonstrations show.',
      },
      {
        title: 'Bubbling questions about the limits of the AI revolution',
        by: 'Scott Detrow · NPR · Aug 24, 2025',
        kind: 'Interview transcript',
        url: 'https://www.npr.org/2025/08/24/nx-s1-5511705/bubbling-questions-about-the-limits-of-the-ai-revolution',
        role: 'Discusses arguments about scaling and reliability with computer scientist Cal Newport. The estimates discussed are attributed to the people and studies that made them.',
      },
      {
        title: 'OpenAI and others seek new path to smarter AI as current methods hit limitations',
        by: 'Krystal Hu and Anna Tong · Reuters · Nov 11, 2024',
        kind: 'Independent reporting',
        url: 'https://www.reuters.com/technology/artificial-intelligence/openai-rivals-seek-new-path-smarter-ai-current-methods-hit-limitations-2024-11-11/',
        role: 'Describes obstacles to continued gains from larger training runs and the interest in giving models more computation when they answer. Both factors can change the pace of progress.',
      },
      {
        title: 'AI’s Big Leaps Are Slowing. That Could Be a Good Thing.',
        by: 'Asa Fitch · The Wall Street Journal · Aug 24, 2025',
        kind: 'Reported analysis',
        url: 'https://www.wsj.com/tech/ai/ais-big-leaps-are-slowing-that-could-be-a-good-thing-34c87619',
        role: 'Examines smaller gains in some model releases and the opportunity to put existing capabilities to use. Provides historical context for changes in momentum.',
      },
      {
        title: 'Anthropic co-founder: “The most powerful technology ever built”',
        by: 'Nick Gillespie · Reason · Jun 24, 2026',
        kind: 'Interview transcript',
        url: 'https://reason.com/podcast/2026/06/24/anthropic-co-founder-the-most-powerful-technology-ever-built/',
        role: 'Gillespie questions Anthropic co-founder Jack Clark about company oversight and recursive self-improvement. The transcript makes clear who is making each claim.',
      },
    ],
  },
];

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function renderEvidenceLibrary(container) {
  let number = 0;
  for (const group of evidenceGroups) {
    const card = container.querySelector('#' + group.id);
    const list = element('ol', '', 'evidence-entries');
    for (const source of group.sources) {
      const item = element('li');
      number += 1;
      item.id = 'ref-' + number;
      item.value = number;
      const title = element('a', source.title + ' ↗');
      title.href = source.url;
      title.target = '_blank';
      title.rel = 'noopener noreferrer';
      item.append(
        element('span', '[' + number + ']', 'evidence-number'),
        element('p', source.kind, 'evidence-source-kind'),
        title,
        element('p', source.by, 'evidence-source-byline'),
        element('p', source.role, 'evidence-source-role'),
      );
      list.append(item);
    }
    card.replaceChildren(element('h3', group.title), element('p', group.claim, 'evidence-claim'), list);
  }
}
