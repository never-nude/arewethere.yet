import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, readdir, writeFile} from 'node:fs/promises';
import {selectOutlook} from '../site/observatory-acceleration.js';
import {singularityReference} from '../site/observatory-reference.js';

const origin = 'https://arewethereyet.now/';
const editionTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', timeZoneName: 'short', year: 'numeric', month: 'short',
  day: 'numeric', hour: 'numeric', minute: '2-digit',
});

const htmlText = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const scriptJson = value => JSON.stringify(value).replaceAll('<', '\\u003c');

function replaceSlot(html, name, content) {
  const slot = new RegExp('<!-- ' + name + ' -->[\\s\\S]*?<!-- /' + name + ' -->');
  assert.ok(slot.test(html), 'Missing publication slot: ' + name);
  return html.replace(slot, () => content);
}

function publishForecast(html, page, feed) {
  const {assessment} = feed;
  const {outlook, bulletin} = selectOutlook(assessment, feed);
  const {headline, range} = singularityReference(assessment, outlook);
  const summary = [headline + '.', range].filter(Boolean).join(' ');
  const forecast = page === 'dashboard.html' ? htmlText(summary) :
    '<p class="obs-clock-state">' + htmlText(headline) + '</p>' + (range ? '<p>' + htmlText(range) + '</p>' : '');
  html = replaceSlot(html, 'published-forecast', forecast);
  const edition = assessment.checkpointAt;
  html = replaceSlot(html, 'edition-time', 'Evidence edition · <time datetime="' + htmlText(edition) + '">' +
    editionTime.format(new Date(edition)) + '</time>');

  const jsonUrl = origin + 'data/observatory.json';
  const modified = [assessment.validatedAt || edition, bulletin?.issuedAt].filter(Boolean).sort().at(-1);
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {'@type': 'WebSite', '@id': origin + '#website', url: origin, name: 'Singularity Watch'},
      {'@type': 'Dataset', '@id': jsonUrl + '#dataset', url: jsonUrl,
        name: 'Singularity Observatory assessments', description: 'Published AI milestone forecasts, observations and checkpoint history. ' + summary,
        dateModified: modified, isPartOf: {'@id': origin + '#website'},
        distribution: {'@type': 'DataDownload', contentUrl: jsonUrl, encodingFormat: 'application/json'}},
    ],
  };
  html = html.replace(/(<meta (?:name|property)="(?:description|og:description|twitter:description)" content=")/g,
    (_, prefix) => prefix + htmlText(headline) + '. ');
  return html.replace('</head>', '  <script type="application/ld+json">' + scriptJson(graph) + '</script>\n</head>');
}

// Import maps stamp transitive browser requests without rewriting module contents.
// This preserves the bytes that the published methodology hashes are meant to identify.
async function assetVersion(target, files, recordHash) {
  const assets = files.filter(file => /\.(?:m?js|css)$/.test(file)).sort();
  const sources = await Promise.all(assets.map(name => readFile(new URL(name, target))));
  const digest = createHash('sha256').update(recordHash);
  assets.forEach((name, index) => {
    const source = sources[index];
    digest.update('\0' + name + '\0').update(source);
  });
  const stamp = '?v=' + digest.digest('hex').slice(0, 16);
  const modules = assets.filter(name => /\.m?js$/.test(name));
  const imports = Object.fromEntries(modules.map(name => ['./' + name, './' + name + stamp]));
  return {stamp, imports};
}

export async function createPageRenderer(target, feed) {
  const files = await readdir(target, {recursive: true});
  const {stamp, imports} = await assetVersion(target, files, feed.currentRecord.sha256);
  return (page, html) => {
    if (['index.html', 'dashboard.html'].includes(page)) html = publishForecast(html, page, feed);
    html = html.replace(/(<(?:link|script)\b[^>]*?\s(?:href|src)=["'])([^"']+)(["'])/gi,
      (tag, start, url, end) => {
        if (/^(?:[a-z]+:|\/\/)/i.test(url)) return tag;
        const resource = url.match(/^([^?#]+\.(?:m?js|css))(?:\?v=[^#]*)?(#.*)?$/i);
        return resource ? start + resource[1] + stamp + (resource[2] || '') + end : tag;
      });
    if (/<script\b[^>]*type="module"/.test(html)) {
      html = html.replace(/<script\b[^>]*type="module"/, match =>
        '<script type="importmap">' + scriptJson({imports}) + '</script>\n  ' + match);
    }
    return html;
  };
}

export async function publishHtml(target, feed) {
  const render = await createPageRenderer(target, feed);
  for (const page of (await readdir(target)).filter(name => name.endsWith('.html'))) {
    const file = new URL(page, target);
    await writeFile(file, render(page, await readFile(file, 'utf8')));
  }
}
