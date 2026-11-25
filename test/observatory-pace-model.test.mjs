import assert from 'node:assert/strict';
import test from 'node:test';
import {milestoneDefinitions} from '../site/observatory-criteria.js';
import {buildArrivalOutlook} from '../site/observatory-outlook-model.js';
import {buildPaceOutlook} from '../site/observatory-pace-model.js';
import {fitPace,taskPace,waypoint} from '../site/observatory-pace-fit.js';

const at='2026-11-25T17:00:00.000Z';
const bare={checkpointAt:at,evidenceCutoff:at,observations:[],forecasts:[],
  milestones:milestoneDefinitions.map(m=>({id:m.id,label:m.label,criteria:[],coverage:{met:0,assessed:0,total:m.gates.length},score:null}))};
const panel={medians:[{author:'A',month:'2027-08'},{author:'B',month:'2027-08'}],publishedOn:'2026-11-10',articleUrl:'https://blog.aifutures.org/p/test'};
const run=(assessment=bare,options={})=>buildPaceOutlook(assessment,buildArrivalOutlook(assessment,{researchForecast:options.researchForecast??panel}),{researchForecast:panel,...options});
const way=(o,id,scenario)=>o.milestones.find(r=>r.id===id).scenarios.find(p=>p.label===scenario).year;
const sustained='Sustained acceleration';
const day=86400000;
const source='https://metr.org/blog/2026-11-05-anthropic-ai-rd-acceleration-assessment/';
const lab={source:'METR',sourceUrl:source,classification:'Independent evaluation',organization:'Anthropic',topic:'research-acceleration',
  referenceOn:'2026-11-05',publishedOn:'2026-11-05',unit:'×',value:1.9,low:1.5,high:2.8};

function series(first, dates, value, topic='reliability') {
  return dates.map(offset=>{
    const date=new Date(Date.parse(first)+offset*day).toISOString().slice(0,10);
    return {referenceOn:date,referenceDateBasis:'Model release date',publishedOn:new Date(Date.parse(first)+dates.at(-1)*day).toISOString().slice(0,10),
      source:'METR',sourceUrl:'https://metr.org/blog/test',datasetUrl:'https://metr.org/blog/test#'+topic,system:'Model '+date,
      classification:'Independent evaluation',unit:'h',topic,value:value(offset)};
  });
}

test('irregular release dates, held-out original-unit errors and finite projection horizon distinguish actual laws',()=>{
  const days=[0,32,74,105,139,180,216,250,291,325,360];
  const points=series('2025-01-01',days,t=>2**(t/72)).map(r=>({date:r.referenceOn,value:r.value}));
  const selected=fitPace(points);
  assert.equal(selected.fit.winner,'Exponential');
  assert.ok(selected.fit.supported);
  assert.ok(Math.abs(selected.fit.doublingDays-72)<.001);
  assert.ok(selected.fit.errors.exponential<1e-9);
  assert.equal(selected.fit.holdouts,4);
  const linear=fitPace(points.map((p,i)=>({...p,value:2+days[i]/100})));
  assert.ok(linear.fit.supported); assert.equal(linear.fit.winner,'Linear'); assert.equal(linear.fit.doublingDays,null);
  assert.equal(fitPace(points.slice(0,7)).fit.supported,false);
  assert.equal(fitPace(points.map(p=>({...p,value:10}))).fit.supported,false);
  const seriesRow={points,fit:selected.fit};
  assert.ok(waypoint(seriesRow,selected,40).estimatedDate);
  assert.equal(waypoint(seriesRow,selected,100000).estimatedDate,null);
  assert.equal(waypoint(seriesRow,selected,4).status,'Observed on this suite');
  const fall=points.map((p,i)=>({...p,value:i===0?90:2}));
  assert.equal(waypoint({points:fall,fit:fitPace(fall).fit},fitPace(fall),8).previouslyReachedDate,fall[0].date);
});

test('fits use same protocol, latest report, actual peak release and only evidence available at issue',()=>{
  const rows=series('2025-01-01',[0,35,75,110,140,180,215,250,280],t=>1+t/100);
  const alt={...rows[0],referenceOn:'2025-01-10',system:'Same month peak',value:7};
  const bad=[{...alt,value:8,retrievedAt:'2026-11-25T18:00:00Z'},{...alt,value:9,sourceStatus:'retracted'},
    {...alt,value:10,source:'Another evaluator'},{...alt,value:14,publishedOn:'2026-11-26'}];
  const result=taskPace({...bare,observations:[...rows,alt,...bad]});
  assert.equal(result.series[0].points.length,9);assert.equal(result.series[0].points[0].value,7);
  assert.equal(result.series[0].points[0].date,'2025-01-10');
  assert.equal(taskPace({...bare,observations:[...rows,{...alt,datasetUrl:source}]}).series[0].points.length,0);
  assert.equal(taskPace({...bare,observations:rows.map(r=>({...r,topic:'horizon'}))}).series[0].points.length,0);
});

test('conditional lab transfer applies to one interval and an independent diffusion gate still controls the clock',()=>{
  const eventPace={activityFit:{supported:true,perWindowPercent:900}};
  const obs={...bare,observations:[lab]};
  const original=JSON.stringify(obs);const frozen=buildArrivalOutlook(obs,{researchForecast:panel});const snapshot=JSON.stringify(frozen);
  const outlook=buildPaceOutlook(obs,frozen,{researchForecast:panel,eventPace});
  assert.equal(outlook.version,'2.0.0');assert.equal(outlook.asOf,at);assert.equal(JSON.stringify(obs),original);assert.equal(JSON.stringify(frozen),snapshot);
  assert.equal(outlook.pace.cycle.months,6.31579);
  assert.deepEqual(outlook.pace.milestones.map(m=>[m.id,m.referenceYear,m.accelerationYear]),[
    ['agi',2046,2028],['rsi',2034,2028],['asi',2070,2028],['singularity',2062,2045]]);
  assert.deepEqual(outlook.pace.referenceInputs.accelerationGates.map(g=>g.year),[2029,2045,2036]);
  assert.equal(way(run(obs,{eventPace:{activityFit:{supported:false}}}),'singularity',sustained),2045);
  assert.equal(run({...bare,observations:[{...lab,sourceUrl:'https://metr.org/blog/unrelated'}]}).pace.cycle.ratio,null);
  assert.equal(run({...bare,observations:[{...lab,retrievedAt:'2027-01-01'}]}).pace.cycle.ratio,null);
  assert.ok(outlook.milestones.every(m=>m.scenarios.some(s=>s.label==='Stalled or never realized'&&s.year===null)));
  const previous=run(obs,{previous:outlook});
  assert.ok(previous.milestones.every(m=>m.change.includes('held steady')));
});

test('a qualified workday or workweek waypoint can delay reference forecasts while raw announcements cannot',()=>{
  const offsets=[0,32,65,99,135,170,210,245,280,315,350];
  const future='2051-03-15T15:00:00Z';
  const observations=series('2050-01-01',offsets,t=>2**((t-360)/75)*8);
  const a={...bare,checkpointAt:future,evidenceCutoff:future,observations};
  const out=run(a);
  assert.ok(out.pace.waypoints[0].estimatedDate);
  assert.equal(out.pace.waypoints[0].status,'Within tested forecast horizon');
  assert.ok(out.pace.milestones.find(m=>m.id==='agi').referenceYear>=2050);
  assert.ok(out.pace.milestones.find(m=>m.id==='singularity').referenceYear>=2066);
  const direct=run({...a,forecasts:[{id:'asi',status:'Observed',centralDate:'2040-01-01',reason:'Verified.'}]});
  assert.equal(way(direct,'agi',sustained),2040);
  assert.equal(direct.milestones.find(m=>m.id==='asi').scenarios.length,1);
  assert.equal(direct.milestones.find(m=>m.id==='agi').centralYear,2040);
});

test('longer training time, dates elapsed, or a changed set of release announcements cannot create a milestone',()=>{
  const past=run();const f={...bare,evidenceCutoff:'2071-01-01T00:00:00Z',checkpointAt:'2071-01-01T00:00:00Z'};
  assert.deepEqual(run(f).milestones.map(m=>m.centralYear),past.milestones.map(m=>m.centralYear));
  assert.equal(run(f).milestones[0].timingStatus,'Reference year passed');
  assert.deepEqual(buildPaceOutlook(f,null),null);
});
