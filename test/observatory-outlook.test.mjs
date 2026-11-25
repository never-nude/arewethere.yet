import assert from 'node:assert/strict';
import test from 'node:test';
import { buildArrivalOutlook } from '../site/observatory-outlook-model.js';
import { milestoneDefinitions } from '../site/observatory-criteria.js';

const stamp = '2026-11-25T02:30:05.950Z';
const bare = {
  checkpointAt:stamp, evidenceCutoff:stamp, observations:[], forecasts:[],
  milestones:milestoneDefinitions.map(m => ({id:m.id,label:m.label,criteria:[],
    coverage:{met:0,assessed:0,total:m.gates.length},score:null})),
};
const panel = (month, day = '2026-11-10') => ({
  medians: [{month,author:'A'},{month,author:'B'}],publishedOn:day,articleUrl:'https://blog.aifutures.org/p/test',
});
const paths = x => Object.fromEntries(x.milestones.map(m => [m.id, m]));
const forecast = (x = bare, researchForecast = panel('2027-08'), previous = null) =>
  buildArrivalOutlook(x, {researchForecast,previous});

test('issues a dated, reproducible outlook for every milestone even when confirmed completion is unknown', () => {
  const original = JSON.stringify(bare);
  const out = forecast(), byId = paths(out);
  assert.deepEqual(out, forecast());
  assert.equal(JSON.stringify(bare), original);
  assert.deepEqual(Object.fromEntries(Object.entries(byId).map(([id,m]) => [id,m.centralYear])),
    {agi:2046,rsi:2034,asi:2070,singularity:2062});
  assert.equal(byId.agi.yearsRemaining,20);
  for (const m of out.milestones) {
    assert.ok(m.range.low <= m.centralYear && m.centralYear <= m.range.high);
    assert.equal(m.scenarios.at(-1).year,null);
    assert.equal(m.beyondHorizonPathCount,1);
    assert.ok(m.progress.evidence.length && m.progress.coverage.assessed === 0);
    for (const id of m.sourceIds) assert.ok(out.sources.some(s => s.id === id));
  }
  for (let i=0;i<3;i++) assert.ok(byId.asi.scenarios[i].year >= byId.agi.scenarios[i].year);
  assert.ok(byId.rsi.centralYear < byId.agi.centralYear);
  assert.ok(byId.singularity.centralYear < byId.asi.centralYear);
  assert.deepEqual(buildArrivalOutlook({...bare,evidenceCutoff:'2026-11-09T08:00:00Z'}),null);
});

test('a new contemporaneous research panel changes the research path without moving unrelated dates', () => {
  const prev = forecast();
  const updated = paths(forecast(bare,panel('2041-08','2026-11-21'),prev));
  assert.ok(updated.rsi.centralYear > paths(prev).rsi.centralYear);
  assert.equal(updated.agi.centralYear, paths(prev).agi.centralYear);
  assert.equal(updated.rsi.previousYear,paths(prev).rsi.centralYear);
  assert.match(updated.rsi.change,/Revised/);
  const future = paths(forecast(bare,panel('2099-12','2028-01-01')));
  const fallback = paths(forecast(bare,null));
  assert.deepEqual(future, fallback);
});

function taskSeries(hours) {
  return hours.map((value,i) => ({
    id:'h'+i,topic:'reliability',source:'METR',system:'Agent '+i,classification:'Independent evaluation',unit:'h',
    referenceDateBasis:'Model release date',referenceOn:'2026-'+String(i+1).padStart(2,'0')+'-01',value,
    publishedOn:'2026-11-20',retrievedAt:stamp,
  }));
}
test('the work-duration bridge responds to measured pace; stalled growth and future records cannot silently bring arrival closer', () => {
  const fast = paths(forecast({...bare,observations:taskSeries([1,2,4,8,16,32])}));
  const slowing = paths(forecast({...bare,observations:taskSeries([1,1.005,1.010,1.015,1.020,1.025])}));
  assert.ok(slowing.agi.centralYear > fast.agi.centralYear);
  assert.ok(slowing.rsi.centralYear === null || slowing.rsi.centralYear > fast.rsi.centralYear);
  const flat = taskSeries([1,1,1,1]);
  const stalled = paths(forecast({...bare,observations:[...flat,{...flat[0],referenceOn:'2028-01-01',value:999}]}));
  assert.equal(stalled.rsi.centralYear,2054);
  assert.equal(stalled.agi.centralYear,2065);
  assert.equal(stalled.agi.range.high,null);
  assert.equal(stalled.asi.range.high,null);
  assert.equal(stalled.singularity.range.high,null);
});

test('a verified first successor link and complete same-system forecasts take precedence over bridge assumptions', () => {
  const partial = structuredClone(bare);
  partial.milestones.find(m => m.id === 'rsi').criteria.push({id:'rsi-contribution',status:'met',reviews:[{reviewedAt:'2026-02-01'}]});
  assert.equal(paths(forecast(partial)).rsi.centralYear,2027);
  const direct = structuredClone(bare);
  direct.milestones.find(m=>m.id==='agi').score = 100;
  direct.forecasts = [{id:'agi',status:'Observed',centralDate:'2026-03-01',reason:'All criteria met.'},
    {id:'rsi',status:'Estimated',centralDate:'2030-07-31',range:{low:'2029-01-31',high:null},reason:'Criterion trajectories.'}];
  const m = paths(forecast(direct));
  assert.equal(m.agi.status,'Observed');
  assert.equal(m.agi.centralYear,2026);
  assert.equal(m.agi.beyondHorizonPathCount,0);
  assert.deepEqual(m.agi.range,{low:2026,high:2026});
  assert.equal(m.rsi.status,'Criterion-based estimate');
  assert.deepEqual(m.rsi.range,{low:2029,high:null});
  assert.ok(m.asi.centralYear < paths(forecast()).asi.centralYear);
});

test('an independently dated ASI sets an upper bound on AGI under the observatory definitions', () => {
  const f={id:'asi',status:'Estimated',centralDate:'2031-02-28',range:{low:'2029-01-31',high:'2035-01-31'}};
  const m=paths(forecast({...bare,forecasts:[f]}));
  assert.ok(m.agi.centralYear <= m.asi.centralYear);
  assert.ok(m.agi.range.high <= m.asi.range.high);
});

test('elapsed time alone preserves reference years and marks a missed reference rather than rolling it forward', () => {
  const later = paths(forecast({...bare,evidenceCutoff:'2075-02-01T00:00:00Z'}));
  assert.equal(later.agi.centralYear,2046);
  assert.equal(later.agi.yearsRemaining,0);
  assert.equal(later.agi.timingStatus,'Reference year passed');
});
