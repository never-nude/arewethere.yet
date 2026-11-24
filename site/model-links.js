const organizations = new Map(Object.entries({
  '01.AI': 'https://www.01.ai/',
  'Alibaba': 'https://qwenlm.github.io/',
  'Anthropic': 'https://www.anthropic.com/',
  'Arcee AI': 'https://www.arcee.ai/',
  'Baichuan': 'https://www.baichuan-ai.com/',
  'BigCode': 'https://www.bigcode-project.org/',
  'Cerebras Systems': 'https://www.cerebras.ai/',
  'Databricks': 'https://www.databricks.com/',
  'DeepSeek': 'https://www.deepseek.com/en/',
  'Google': 'https://blog.google/innovation-and-ai/',
  'Google DeepMind': 'https://deepmind.google/',
  'Hugging Face': 'https://huggingface.co/',
  'Meta AI': 'https://ai.meta.com/',
  'Microsoft': 'https://www.microsoft.com/en-us/ai',
  'Microsoft Research': 'https://www.microsoft.com/en-us/research/',
  'MiniMax': 'https://www.minimax.io/',
  'Mistral AI': 'https://mistral.ai/',
  'Moonshot': 'https://www.moonshot.ai/',
  'Moonshot AI': 'https://www.moonshot.ai/',
  'MosaicML': 'https://github.com/mosaicml',
  'Nvidia': 'https://www.nvidia.com/en-us/ai/',
  'OpenAI': 'https://openai.com/',
  'Peking University': 'https://english.pku.edu.cn/',
  'Prime Intellect': 'https://www.primeintellect.ai/',
  'Reflection': 'https://reflection.ai/',
  'Salesforce': 'https://www.salesforce.com/artificial-intelligence/',
  'ServiceNow': 'https://www.servicenow.com/',
  'Stability AI': 'https://stability.ai/',
  'Technology Innovation Institute': 'https://www.tii.ae/',
  'Thinking Machines': 'https://thinkingmachines.ai/',
  'xAI': 'https://x.ai/',
  'Z.ai (Zhipu AI)': 'https://z.ai/',
}));

const releases = new Map(Object.entries({
  'Claude Fable 5.2': 'https://www.anthropic.com/claude-fable-and-mythos-5-2',
  'DeepSeek V4.1 Flash 1017': 'https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017',
  'Gemini 4 Carbon': 'https://deepmind.google/models/model-cards/gemini-4-carbon/',
  'GPT-6.2 Astra': 'https://openai.com/index/introducing-gpt-6-2-astra-sol/',
  'Kimi K3': 'https://huggingface.co/moonshotai/Kimi-K3',
  'Kimi K3.1 Pro': 'https://huggingface.co/moonshotai/Kimi-K3.1-Pro',
}).map(([label, url]) => [modelKey(label), url]));

function modelKey(label) {
  return typeof label === 'string' ? label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() : '';
}

export function organizationSites(label) {
  if (typeof label !== 'string') return [];
  return label.split(',').map((part) => part.trim()).filter(Boolean)
    .map((name) => ({ label: name, url: organizations.get(name) ?? null }));
}

export function modelReleaseUrl(label, date, events = []) {
  const key = modelKey(label);
  if (!key) return null;
  const exact = releases.get(key);
  if (exact) return exact;
  if (!date) return null;
  const match = events.find((event) => event.date === date && event.category === 'Release'
    && typeof event.url === 'string' && event.url.startsWith('https://')
    && ` ${modelKey(event.title)} `.includes(` ${key} `));
  return match?.url ?? null;
}
