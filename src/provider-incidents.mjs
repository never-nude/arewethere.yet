const timeoutMs = 4000;

const providers = [
  {
    id: 'openai', organization: 'OpenAI', source: 'OpenAI Status',
    url: 'https://status.openai.com/history',
    endpoint: 'https://status.openai.com/proxy/status.openai.com/incidents',
    scope: 'Incidents publicly reported across OpenAI products and APIs.',
    read: openAiRows,
  },
  {
    id: 'anthropic', organization: 'Anthropic', source: 'Claude Status',
    url: 'https://status.claude.com/history',
    endpoint: 'https://status.claude.com/api/v2/incidents.json',
    scope: 'Incidents publicly reported across Claude products and APIs.',
    read: statusPageRows,
  },
  {
    id: 'mistral', organization: 'Mistral AI', source: 'Mistral AI Status',
    url: 'https://status.mistral.ai/',
    endpoint: 'https://status.mistral.ai/api/v2/incidents.json',
    scope: 'Incidents publicly reported across Mistral AI products and APIs.',
    read: statusPageRows,
  },
  {
    id: 'google', organization: 'Google', source: 'Google Workspace Status Dashboard',
    url: 'https://www.google.com/appsstatus/dashboard/',
    endpoint: 'https://www.google.com/appsstatus/dashboard/incidents.json',
    scope: 'Gemini and Gemini Notebook incidents published on the Workspace dashboard. Other Google AI services have separate status reporting.',
    read: workspaceRows,
  },
];

async function getJson(fetcher, url) {
  const response = await fetcher(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error('Provider incident feed unavailable');
  return response.json();
}

function incidentRows(payload) {
  if (!Array.isArray(payload?.incidents)) throw new Error('Unrecognized provider incident feed');
  return payload.incidents;
}

function timestamp(raw) {
  const time = typeof raw === 'string' ? Date.parse(raw) : NaN;
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function impactLevel(statuses, title, severity) {
  if (statuses.some((value) => ['major_outage', 'partial_outage', 'SERVICE_OUTAGE'].includes(value)) ||
      /\boutage\b|\bunavailab(?:le|ility)\b/i.test(title)) return 'interruption';
  if (statuses.some((value) => ['degraded_performance', 'SERVICE_DISRUPTION'].includes(value)) ||
      ['minor', 'major', 'critical'].includes(severity) || /\berrors?\b|\bdegrad\w+\b|\bdelay\w*\b/i.test(title)) return 'degraded';
  return 'unknown';
}

function normalize(provider, { id, title, startedAt, publishedAt, resolvedAt, status, services = [], statuses = [], severity }) {
  if (typeof id !== 'string' || !/^[a-z0-9-]+$/i.test(id) || typeof title !== 'string') return null;
  const name = title.trim();
  const start = timestamp(startedAt);
  if (!name || !start) return null;
  const end = timestamp(resolvedAt);
  const affected = [...new Set(services.filter((service) => typeof service === 'string' && service.trim()))];
  const url = new URL(provider.id === 'google' ? 'incidents/' + id : '/incidents/' + id, provider.url).href;
  return {
    id: provider.id + ':' + id,
    organization: provider.organization,
    title: name,
    detail: affected.length ? 'Reported services include ' + affected.join(', ') + '.' : '',
    date: start.slice(0, 10),
    startedAt: start,
    publishedAt: timestamp(publishedAt),
    resolvedAt: end && end >= start ? end : null,
    status: ['resolved', 'postmortem'].includes(status) ? 'resolved' : status === 'monitoring' ? 'monitoring' : 'reported',
    impact: impactLevel(statuses, name, severity),
    services: affected,
    source: provider.source,
    url,
  };
}

function statusPageIncident(provider, row) {
  if (!row || row.impact === 'maintenance' || /^\[FIRING:\d+\]/.test(row.name ?? '')) return null;
  const updates = Array.isArray(row.incident_updates) ? row.incident_updates : [];
  const affected = updates.flatMap((update) => Array.isArray(update?.affected_components) ? update.affected_components : []);
  const components = Array.isArray(row.components) ? row.components : [];
  const start = timestamp(row.started_at);
  const end = timestamp(row.resolved_at);
  const reportedAt = start && (!end || start <= end) ? start : row.created_at;
  return normalize(provider, {
    id: row.id, title: row.name, startedAt: reportedAt, publishedAt: row.created_at,
    resolvedAt: end, status: row.status, severity: row.impact,
    services: [...affected, ...components].map((component) => component?.name),
    statuses: affected.map((component) => component?.new_status),
  });
}

async function statusPageRows(fetcher, provider, endpoint = provider.endpoint) {
  return incidentRows(await getJson(fetcher, endpoint)).map((row) => statusPageIncident(provider, row));
}

async function openAiRows(fetcher, provider) {
  const primary = getJson(fetcher, provider.endpoint).then(incidentRows).catch(() => null);
  const names = getJson(fetcher, 'https://status.openai.com/api/v2/components.json')
    .then(({ components }) => new Map(components.map(({ id, name }) => [id, name])))
    .catch(() => new Map());
  const [rows, componentNames] = await Promise.all([primary, names]);
  if (rows === null) return statusPageRows(fetcher, provider, 'https://status.openai.com/api/v2/incidents.json');

  return rows.map((row) => {
    if (row?.type !== 'incident') return null;
    const impacts = Array.isArray(row.component_impacts) ? row.component_impacts : [];
    const affected = Array.isArray(row.affected_components) ? row.affected_components : [];
    const updates = Array.isArray(row.updates) ? row.updates : [];
    const starts = impacts.map((impact) => timestamp(impact?.start_at)).filter(Boolean).sort();
    const resolution = updates.filter((update) => update?.to_status === 'resolved')
      .map((update) => timestamp(update?.published_at)).filter(Boolean).sort().at(-1);
    const components = [...impacts, ...affected];
    return normalize(provider, {
      id: row.id, title: row.name, startedAt: starts[0] ?? row.published_at, publishedAt: row.published_at,
      resolvedAt: resolution, status: row.status,
      services: components.map((component) => componentNames.get(component?.component_id)),
      statuses: components.map((component) => component?.status),
    });
  });
}

async function workspaceRows(fetcher, provider) {
  const rows = await getJson(fetcher, provider.endpoint);
  if (!Array.isArray(rows)) throw new Error('Unrecognized Workspace incident feed');
  return rows.map((row) => {
    const products = Array.isArray(row?.affected_products) ? row.affected_products : [];
    const services = products.map((product) => product?.title).filter((title) => /^(Gemini|Gemini Notebook)$/i.test(title));
    if (!services.length || typeof row.external_desc !== 'string') return null;
    const title = row.external_desc.replace(/^\s*\*\*(?:summary|title):?\*\*:?\s*:?\s*/i, '').split(/\r?\n/)[0].trim();
    return normalize(provider, {
      id: row.id, title, startedAt: row.begin, publishedAt: row.created, resolvedAt: row.end,
      status: row.end ? 'resolved' : 'reported', services, statuses: [row.status_impact],
    });
  });
}

export async function getProviderIncidents(fetcher, checkedAt) {
  const results = await Promise.allSettled(providers.map((provider) => provider.read(fetcher, provider)));
  const incidents = [];
  const incidentSources = results.map((result, position) => {
    const { organization, source, url, scope } = providers[position];
    const records = result.status === 'fulfilled'
      ? result.value.filter((incident) => incident && incident.startedAt <= checkedAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      : [];
    incidents.push(...records);
    return {
      organization, source, url, scope, checkedAt,
      status: result.status === 'fulfilled' ? 'live' : 'unavailable',
      lastSuccessAt: result.status === 'fulfilled' ? checkedAt : null,
      oldestDate: records.at(-1)?.date ?? null,
    };
  });
  return { incidents: incidents.sort((a, b) => b.startedAt.localeCompare(a.startedAt)), incidentSources };
}
