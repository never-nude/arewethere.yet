export const forecastArticle = 'https://blog.aifutures.org/p/q35-timelines-update-looks-like-the';
export const forecastDefinition = 'https://www.aifuturesmodel.com/p?acam=time-horizon&base=daniel-08-16-26&v=2';
export const publicationDate = '2026-11-10';
const publisherFeed = 'https://blog.aifutures.org/api/v1/posts?limit=20';
const originalChart = 'e6bKu';
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const authors = Object.freeze({
  Eli: 'Eli Lifland', Brendan: 'Brendan Halstead', Daniel: 'Daniel Kokotajlo',
  Lukas: 'Lukas Finnveden', Thomas: 'Thomas Larsen', Romeo: 'Romeo Dean',
});

// The six SAR medians in version 9 of the project’s November 10 forecast table.
const published = Object.freeze({
  articleUrl: forecastArticle, publishedOn: publicationDate, chartId: originalChart, version: 9, status: 'saved', lastCheckedAt: null,
  medians: [
    ['Eli', '2027-08'], ['Brendan', '2027-09'], ['Daniel', '2027-05'],
    ['Lukas', '2027-11'], ['Thomas', '2027-11'], ['Romeo', '2027-08'],
  ].map(([author, month]) => ({ author: authors[author], month })),
});

export function forecastTable(version, chartId = originalChart) {
  return 'https://datawrapper.dwcdn.net/' + chartId + '/' + version + '/';
}

function validPostUrl(url) {
  return typeof url === 'string' && /^https:\/\/blog\.aifutures\.org\/p\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url);
}

function validDay(day) {
  if (typeof day !== 'string' || !/^20\d\d-\d\d-\d\d$/.test(day)) return false;
  const time = Date.parse(day);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === day &&
    day >= publicationDate && day <= new Date().toISOString().slice(0, 10);
}

function validForecast(record) {
  const names = new Set(Object.values(authors));
  return record && validDay(record.publishedOn) && validPostUrl(record.articleUrl) &&
    typeof record.chartId === 'string' && /^[a-zA-Z0-9]{5}$/.test(record.chartId) &&
    Number.isSafeInteger(record.version) && record.version >= (record.chartId === originalChart ? 9 : 1) &&
    Array.isArray(record.medians) && record.medians.length === names.size &&
    record.medians.every(row => row && names.delete(row.author) && /^20\d\d-(0[1-9]|1[0-2])$/.test(row.month) &&
      row.month >= record.publishedOn.slice(0, 7));
}

export function readResearchForecast(record) {
  // Older saved editions predate explicit source identifiers.
  if (record?.publishedOn === publicationDate) record = { articleUrl: forecastArticle, chartId: originalChart, ...record };
  if (!validForecast(record)) return published;
  const { newerPublication, ...forecast } = record;
  return validNewerPublication(newerPublication, forecast.publishedOn)
    ? { ...forecast, newerPublication } : forecast;
}

export function parseForecastTable(csv, version, edition = published) {
  // The published table has unquoted cells. Unknown schemas need editorial review.
  const [head, ...body] = csv.trim().replace(/^\uFEFF/, '').split(/\r?\n/).map(line => line.split(',').map(cell => cell.trim()));
  const column = head.indexOf('SAR median');
  if (column < 1 || !['', 'Author', 'Forecaster'].includes(head[0]) || new Set(head).size !== head.length) throw new Error('Forecast table headers changed');
  const medians = body.map(row => {
    const match = /^(\w{3}) (20\d\d)$/.exec(row[column] ?? '');
    const author = Object.hasOwn(authors, row[0]) ? authors[row[0]] : row[0];
    if (row.length !== head.length || !match || !Object.values(authors).includes(author) || !months.includes(match[1])) {
      throw new Error('Forecast table row changed');
    }
    const mm = String(months.indexOf(match[1]) + 1).padStart(2, '0');
    return { author, month: match[2] + '-' + mm };
  });
  const { publishedOn, articleUrl, chartId } = edition;
  const record = { publishedOn, articleUrl, chartId, version, medians };
  if (!validForecast(record)) throw new Error('Incomplete or invalid forecast table');
  return record;
}

async function fetchVerified(url, fetchSource) {
  const response = await fetchSource(url, { signal: AbortSignal.timeout(6000), redirect: 'error' });
  if (!response.ok || (response.url && new URL(response.url).origin !== new URL(url).origin)) throw new Error('Publisher unavailable');
  return response;
}

function validNewerPublication(post, after) {
  return post && typeof post.title === 'string' && validPostUrl(post.url) &&
    validDay(post.publishedOn) && post.publishedOn > after;
}

async function latestUpdate(fetchSource, after) {
  const feed = await (await fetchVerified(publisherFeed, fetchSource)).json();
  if (!Array.isArray(feed.posts)) throw new Error('Unrecognized publication feed');
  return feed.posts.slice(0, 20).map(post => ({
    title: post?.title, url: post?.canonical_url, publishedOn: post?.post_date?.slice(0, 10),
  })).filter(post => validNewerPublication(post, after) &&
    /(?:timelines?.*(?:update|forecast)|(?:update|forecast).*timelines?|superhuman AI researcher.*forecast)/i.test(post.title))
    .sort((a, b) => b.publishedOn.localeCompare(a.publishedOn))[0];
}

async function verifyEdition(edition, fetchSource, previous) {
  const html = await (await fetchVerified(edition.articleUrl, fetchSource)).text();
  const body = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const embeds = new Map();
  for (const match of body.matchAll(/https:\/\/datawrapper\.dwcdn\.net\/([a-zA-Z0-9]{5})\/(\d+)\//g)) {
    const id = match[1], version = Number(match[2]);
    if (edition.chartId && id !== edition.chartId) continue;
    if (Number.isSafeInteger(version) && version > (embeds.get(id) ?? 0)) embeds.set(id, version);
  }
  // A new edition must explicitly describe the same research milestone and agree with the publisher's dated feed.
  if (!edition.chartId || embeds.get(edition.chartId) > previous.version) {
    const metadata = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
      .flatMap(match => { try { return [JSON.parse(match[1])]; } catch { return []; } });
    const article = metadata.find(record => ['NewsArticle', 'BlogPosting', 'Article'].includes(record?.['@type']) &&
      record.url === edition.articleUrl && record.datePublished?.slice(0, 10) === edition.publishedOn);
    const words = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const projectCoding = /(?:fully|completely) automat\w* (?:the )?(?:coding|programming) (?:in|of|for|on) (?:the |an? )?(?:(?:AI|AGI|research) ){0,2}project\b/i.test(words) ||
      /automat\w* (?:all|every) (?:of )?(?:the )?(?:(?:AI|AGI|research) )?project(?:'s|’s)? (?:coding|programming)\b/i.test(words) ||
      /automat\w* (?:all|every) (?:of )?(?:the )?(?:coding|programming)(?: tasks?)? (?:in|of|for|on) (?:the |an? )?(?:(?:AI|AGI|research) ){0,2}project\b/i.test(words);
    if (!article || !projectCoding || !/superhuman AI researcher/i.test(words) || !/\bSAR\b/.test(words) ||
        !/(?:best|top)[\w -]{0,32}human[\w -]{0,28}researchers?|(?:best|top)[\w -]{0,35}researchers? in the world/i.test(words)) {
      throw new Error('Milestone needs review');
    }
  }

  // Inspect a bounded set of publisher-linked tables. A new post can also contain charts for other milestones.
  const tables = await Promise.allSettled([...embeds].slice(0, 5).map(async ([chartId, version]) => {
    if (chartId === previous.chartId && (edition.chartId ? version < previous.version : version <= previous.version)) throw new Error('Older table');
    const csv = await (await fetchVerified(forecastTable(version, chartId) + 'dataset.csv', fetchSource)).text();
    return parseForecastTable(csv, version, { ...edition, chartId });
  }));
  const verified = tables.filter(result => result.status === 'fulfilled');
  if (verified.length !== 1) throw new Error('Expected one comparable forecast table');
  return { ...verified[0].value, status: 'checked', lastCheckedAt: new Date().toISOString() };
}

export async function checkResearchForecast(previous, fetchSource = fetch) {
  const saved = readResearchForecast(previous);
  const [refreshed, discovered] = await Promise.allSettled([
    verifyEdition(saved, fetchSource, saved), latestUpdate(fetchSource, saved.publishedOn),
  ]);
  const base = refreshed.status === 'fulfilled' ? refreshed.value : { ...saved, status: 'saved' };
  // Retry a flagged post even if it leaves the most recent feed page.
  const pending = [saved.newerPublication, discovered.status === 'fulfilled' && discovered.value]
    .filter(post => validNewerPublication(post, base.publishedOn))
    .sort((a, b) => b.publishedOn.localeCompare(a.publishedOn))[0];
  if (!pending) return base;
  try {
    return await verifyEdition({ publishedOn: pending.publishedOn, articleUrl: pending.url }, fetchSource, base);
  } catch {
    return { ...base, newerPublication: pending };
  }
}

export function forecastWindow(record, now = new Date()) {
  const months = readResearchForecast(record).medians.map(row => row.month).sort();
  const first = months[0];
  const last = months.at(-1);
  const ordinal = value => Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7)) - 1;
  const current = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const start = ordinal(first) - current;
  const end = ordinal(last) - current;
  let remaining = 'Within the forecast window';
  if (end < 0) remaining = 'Forecast window passed';
  else if (start > 0) remaining = start === end
    ? start + (start === 1 ? ' month' : ' months')
    : start + '–' + end + ' months';
  return { first, last, remaining, passed: end < 0 };
}
