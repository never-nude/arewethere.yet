import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {createPageRenderer} from '../scripts/publish-html.mjs';
import {singularityReference} from '../site/observatory-reference.js';

const site = new URL('../site/', import.meta.url);
const checkpointAt = '2026-11-25T14:30:00.000Z';
const sha256 = 'a'.repeat(64);
const scenario = {
  id: 'singularity', status: 'Scenario estimate', centralYear: 2050,
  range: {low: 2040, high: 2095}, horizonYear: 2100, beyondHorizonPathCount: 1,
};
const outlook = {milestones: [scenario]};
const assessment = {checkpointAt, validatedAt: '2026-11-25T14:37:00.000Z', forecasts: [], arrivalOutlook: outlook};
const feed = {currentRecord: {checkpointAt, sha256}, assessment};

test('both published headers and metadata reflect a verified bulletin for this checkpoint', async () => {
  const bulletin = {
    issuedAt: '2026-11-25T16:00:00.000Z', basedOnCheckpoint: checkpointAt, basedOnSha256: sha256,
    outlook: {milestones: [{...scenario, centralYear: 2062}]},
  };
  const render = await createPageRenderer(site, {...feed, supplementalPaceOutlook: bulletin});
  for (const page of ['index.html', 'dashboard.html']) {
    const template = await readFile(new URL(page, site), 'utf8');
    const html = render(page, template);
    const body = html.slice(html.indexOf('<main'), html.indexOf('id="milestone-progress"'));
    assert.match(body, /Singularity reference year 2062/);
    assert.match(body, /Scenario range 2040–2095/);
    assert.match(body, /extends beyond 2100/);
    assert.ok(body.includes('<time datetime="' + checkpointAt + '">Nov 25, 2026, 9:30 AM EST</time>'));
    for (const attr of ['name="description"', 'property="og:description"'])
      assert.ok(html.includes('<meta ' + attr + ' content="Singularity reference year 2062.'));
    const data = JSON.parse(html.match(/<script type="application\/ld\+json">(.+?)<\/script>/)[1]);
    const [website, dataset] = data['@graph'];
    assert.equal(website['@type'], 'WebSite');
    assert.equal(dataset['@type'], 'Dataset');
    assert.equal(dataset.isPartOf['@id'], website['@id']);
    assert.equal(dataset.distribution.contentUrl, 'https://arewethereyet.now/data/observatory.json');
    assert.equal(dataset.dateModified, bulletin.issuedAt);
  }
  const stale = await createPageRenderer(site, {...feed, supplementalPaceOutlook: {...bulletin, basedOnSha256: 'b'.repeat(64)}});
  assert.match(stale('index.html', await readFile(new URL('index.html', site), 'utf8')), /Singularity reference year 2050/);
});

test('all page asset URLs and transitive module requests resolve to the same build stamp', async () => {
  const render = await createPageRenderer(site, feed);
  const files = await readdir(site, {recursive: true});
  let stamp;
  for (const page of files.filter(name => name.endsWith('.html'))) {
    const html = render(page, await readFile(new URL(page, site), 'utf8'));
    const resources = [...html.matchAll(/<(?:link|script)\b[^>]* (?:href|src)="([^"]+\.(?:css|js)(?:\?[^"]*)?)"/g)];
    for (const [, url] of resources) {
      const version = new URL(url, 'https://example.test/').search;
      assert.match(version, /^\?v=[a-f0-9]{16}$/);
      stamp ??= version;
      assert.equal(version, stamp);
    }
    if (!html.includes('type="module"')) continue;
    assert.ok(html.indexOf('type="importmap"') < html.indexOf('type="module"'));
    const {imports} = JSON.parse(html.match(/<script type="importmap">(.+?)<\/script>/)[1]);
    for (const name of files.filter(name => name.endsWith('.js'))) {
      const js = await readFile(new URL(name, site), 'utf8');
      const dependencies = js.matchAll(/\b(?:from\s*|import\s*\(?\s*)["'](\.\.?\/[^"']+\.js(?:\?[^"']*)?)["']/g);
      for (const [, specifier] of dependencies) {
        const key = './' + path.posix.join(path.posix.dirname(name), specifier);
        assert.equal(imports[key], key + stamp, name + ' imports ' + specifier);
      }
    }
  }
});

test('undated, open-ended, confirmed and criterion forecasts keep their meaning in the published HTML', () => {
  const read = (scenarioRow, forecast) => singularityReference({forecasts: forecast ? [forecast] : []},
    scenarioRow ? {milestones: [scenarioRow]} : null);
  assert.match(read(null).headline, /No dated singularity estimate/);
  assert.equal(read({...scenario, centralYear: null, range: {low: null, high: null}}).headline,
    'Singularity reference scenario extends beyond 2100');
  assert.equal(read({...scenario, range: {low: 2040, high: null}}).range, 'Scenario range 2040 to beyond 2100.');
  const observed = {id: 'singularity', status: 'Observed', centralDate: '2029-11-25'};
  assert.deepEqual(read(null, observed), {headline: 'Singularity confirmed in 2029', range: ''});
  const monthly = {id: 'singularity', status: 'Estimated', centralDate: '2029-05-01',
    range: {low: '2029-04-01', high: null}, horizonEnd: '2031-11-25'};
  assert.deepEqual(read(null, monthly), {headline: 'Singularity forecast for May 2029', range: 'Conditional range April 2029 to beyond 2031.'});
});
