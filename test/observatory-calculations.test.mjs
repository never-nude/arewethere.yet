import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {chronologicalMilestones, unitSuffix} from '../site/observatory-display.js';
import {calculationGuide, scenarioTimeline} from '../site/observatory-calculations.js';
import {buildArrivalOutlook} from '../site/observatory-outlook-model.js';

const {outlook} = JSON.parse(readFileSync(new URL('../site/data/first-arrival-outlook.json', import.meta.url)));
const base = {checkpointAt: outlook.asOf, observations: [], forecasts: [], milestones: []};

test('the published launch calculation shows the three actual calendar constraints', () => {
  const {conditions, rows} = calculationGuide(base, outlook);
  assert.deepEqual(conditions.map(c => c.year), [2035, 2045, 2062]);
  assert.equal(Math.max(...conditions.map(c => c.year)), rows.find(r => r.id === 'singularity').year);
  assert.deepEqual(rows.map(r => r.equation), [
    '(2027 + 2036) ÷ 2 + 2 years ≈ 2034',
    '(2042 + 2050) ÷ 2 = 2046',
    'Latest of 2035, 2045, 2062 = 2062',
    '2046 + 24.4 years ≈ 2070',
  ]);
});

test('a later archived research panel supplies the year in its own calculation', () => {
  const researchForecast = {
    medians: [{month: '2040-07', author: 'A'}],
    publishedOn: '2026-11-24', articleUrl: 'https://blog.aifutures.org/p/test',
  };
  const dated = buildArrivalOutlook(base, {researchForecast});
  const guide = calculationGuide(base, dated);
  assert.match(guide.rows.find(r => r.id === 'rsi').equation, /2040.*2036.*2040/);
  assert.equal(guide.conditions[0].year, 2041);
});

test('an independent first successor review replaces the research-panel formula', () => {
  const assessment = {...base, milestones: [
    {id: 'rsi', criteria: [{id: 'rsi-contribution', status: 'met', reviews: [{reviewedAt: '2026-08-01'}]}]},
  ]};
  const guide = calculationGuide(assessment, buildArrivalOutlook(assessment));
  assert.equal(guide.rows.find(r => r.id === 'rsi').equation, '2026 + 1 year = 2027');
});

test('direct verification or an unknown method displays the issued basis', () => {
  const assessment = {...base, forecasts: [
    {id: 'singularity', status: 'Observed', centralDate: '2026-11-20', reason: 'Independent review published.'},
  ]};
  const observed = calculationGuide(assessment, buildArrivalOutlook(assessment));
  assert.deepEqual(observed.conditions, []);
  assert.equal(observed.rows.find(r => r.id === 'singularity').explanation, assessment.forecasts[0].reason);
  assert.equal(observed.rows.find(r => r.id === 'singularity').equation, '');
  const unknown = calculationGuide({}, {...outlook, version: '2.0.0'});
  assert.deepEqual(unknown.conditions, []);
  assert.ok(unknown.rows.every(r => r.equation === '' && r.explanation === outlook.milestones.find(m => m.id === r.id).basis));
  assert.deepEqual(calculationGuide({}, null), {rows: [], conditions: []});
});

test('all timeline positions reflect the selected edition on one year scale', () => {
  const guide = scenarioTimeline(outlook);
  assert.equal(guide.start, 2026);
  assert.equal(guide.end, 2100);
  assert.equal(guide.selected, 'reference');
  assert.deepEqual(guide.milestones.map(m => m.id), ['rsi', 'agi', 'singularity', 'asi']);
  for (const m of guide.milestones) {
    const issued = outlook.milestones.find(row => row.id === m.id);
    for (const p of guide.options) {
      assert.equal(m.values[p.key], issued.scenarios.find(s => s.label === p.issued).year);
    }
  }
  const panel = {
    medians: [{author: 'A', month: '2040-07'}], publishedOn: '2026-11-24',
    articleUrl: 'https://blog.aifutures.org/p/test',
  };
  const updated = scenarioTimeline(buildArrivalOutlook(base, {researchForecast: panel}));
  assert.notEqual(updated.milestones.find(m => m.id === 'rsi').values.reference,
    guide.milestones.find(m => m.id === 'rsi').values.reference);
});

test('observed milestones stay fixed; missing and explicitly open years stay distinct', () => {
  const partial = structuredClone(outlook);
  const rsi = partial.milestones.find(m => m.id === 'rsi');
  rsi.status = 'Observed';
  rsi.scenarios = [{label: 'First independently verified', year: 2024}];
  const agi = partial.milestones.find(m => m.id === 'agi');
  agi.scenarios = agi.scenarios.filter(s => s.label !== 'Slower development').reverse();
  const timeline = scenarioTimeline(partial);
  assert.deepEqual(timeline.milestones.find(m => m.id === 'rsi').values,
    {fast: 2024, reference: 2024, slow: 2024, stalled: 2024});
  assert.equal(timeline.start, 2024);
  assert.equal(timeline.milestones.find(m => m.id === 'agi').values.slow, undefined);
  assert.equal(timeline.milestones.find(m => m.id === 'agi').values.stalled, null);
  assert.equal(scenarioTimeline({...partial, milestones: [rsi]}).selected, 'observed');
  assert.equal(scenarioTimeline(null), null);
});

test('acceleration is a separate selectable published scenario and retains the issued reference arithmetic', () => {
  const v2=structuredClone(outlook);
  v2.version='2.0.0';
  v2.pace={milestones:v2.milestones.map(m=>({id:m.id,baselineYear:m.centralYear,referenceYear:m.centralYear,reason:'Kept the survey anchor.'})),
    referenceInputs:{referenceGates:[{label:'Research',year:2035},{label:'Spread',year:2045},{label:'Wider change',year:2062}]}};
  for(const m of v2.milestones)m.scenarios.push({label:'Sustained acceleration',year:m.centralYear-10});
  const guide=calculationGuide(base,v2);
  assert.equal(guide.conditions.at(-1).year,2062);
  assert.equal(scenarioTimeline(v2).milestones.find(m => m.id === 'singularity').values.acceleration,2052);
  assert.equal(scenarioTimeline(v2).selected,'reference');
});

test('only a live edition with a matching checkpoint and evidence hash accepts a new forecast bulletin',async()=>{
  const {selectOutlook}=await import('../site/observatory-acceleration.js');
  const sha256='a'.repeat(64);
  const edition={checkpointAt:'2026-11-25T14:30:00.000Z',arrivalOutlook:outlook};
  const bulletin={basedOnCheckpoint:edition.checkpointAt,basedOnSha256:sha256,outlook:{version:'2.0.0'}};
  const manifest={currentRecord:{checkpointAt:edition.checkpointAt,sha256},supplementalPaceOutlook:bulletin};
  assert.equal(selectOutlook(edition,manifest).outlook,bulletin.outlook);
  assert.equal(selectOutlook(edition,manifest,true).outlook,outlook);
  assert.equal(selectOutlook(edition,{...manifest,currentRecord:{...manifest.currentRecord,sha256:'b'.repeat(64)}}).outlook,outlook);
  assert.equal(selectOutlook({...edition,checkpointAt:'2026-11-25T05:00:00.000Z'},manifest).outlook,outlook);
  assert.equal(selectOutlook({checkpointAt:edition.checkpointAt},{...manifest,supplementalPaceOutlook:null,supplementalOutlook:bulletin}).outlook,bulletin.outlook);
});

test('edition order uses the reference year including for archived and open estimates', () => {
  const rows = [{id: 'asi'}, {id: 'singularity'}, {id: 'rsi'}, {id: 'agi'}];
  const oldForecasts = [{id: 'singularity', centralDate: '2062-07-01'}, {id: 'asi', centralDate: '2070-07-01'}];
  const model = {milestones: [{id: 'asi', centralYear: null}, {id: 'rsi', centralYear: 2034}, {id: 'agi', centralYear: 2034}]};
  assert.deepEqual(chronologicalMilestones(rows, null, oldForecasts).map(r => r.id), ['singularity', 'asi', 'rsi', 'agi']);
  assert.deepEqual(chronologicalMilestones(rows, model, oldForecasts).map(r => r.id), ['rsi', 'agi', 'singularity', 'asi']);
});

test('measurement unit suffixes attach symbols and separate words', () => {
  assert.deepEqual(['%', '% reduction', '×', 'ECI', null].map(unitSuffix), ['%', '% reduction', '×', ' ECI', '']);
});
