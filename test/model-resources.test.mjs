import test from 'node:test';
import assert from 'node:assert/strict';
import { captureResources, collectModelResources } from '../scripts/model-resources.mjs';
import { modelTrainingCost, resourcesFor, scoredResources } from '../site/observatory-investment.js';

const header='Model,Publication date,Training compute cost (2023 USD),Training compute (FLOP),Training time (hours),Confidence';
const csv=[header,'Model,2026-03-02,1000,2e10,80,Likely','Model,2026-04-03,6000,2e11,160,Likely','Model mini,2026-05-01,,3e8,,Confident','Future,2030-01-01,999,10,1,Likely'].join('\n');
const now='2026-11-25T20:00:00.000Z';

test('resource matching preserves distinct versions, missing values, and the release cutoff',()=>{
  const source=captureResources(csv,[{label:'Model',date:'2026-04-03'},{label:'Model mini',date:'2026-05-01'},{label:'Future',date:'2030-01-01'},{label:'Model max',date:'2026-01-01'}],now);
  assert.equal(modelTrainingCost({modelResources:source},'Model'),6000);
  assert.equal(modelTrainingCost({modelResources:source},'Model mini'),null);
  assert.deepEqual(source.models.map(r=>r.model),['Model','Model mini']);
  assert.equal(captureResources(csv,[{label:'Model',date:'2026-04-04'}],now).models.length,0);
  assert.ok(source.sha256.match(/^[a-f0-9]{64}$/));
});

test('failed resource checks preserve the last successful date, and supplements cannot leak into archive replay',async()=>{
  const snapshot=captureResources(csv,[{label:'Model mini',date:'2026-05-01'}],now);
  const carried=await collectModelResources([],now,{...snapshot,forEdition:now},async()=>{throw Error('unavailable')});
  assert.equal(carried.status,'last verified');
  assert.equal(carried.checkedAt,snapshot.checkedAt);
  assert.equal(carried.forEdition,undefined);
  const failure = async()=>{throw Error('unavailable');};
  const absent=await collectModelResources([],now,null,failure);
  assert.equal((await collectModelResources([],now,absent,failure)).status,'unavailable');
  const original={checkpointAt:'2026-11-25T14:30:00.000Z'};
  assert.ok(resourcesFor(original));assert.equal(resourcesFor(original,{archived:true}),null);
  assert.equal(resourcesFor({checkpointAt:'2040-01-01'}),null);
});

test('resource scatter includes scored models with unknown access or unknown cost and uses their own score',()=>{
  const inputs={models:[{model:'Alpha',cost:30}]};
  const make=(system,weightAccess,value)=>({system,weightAccess,value,unit:'ECI',topic:'breadth',source:'Epoch AI',referenceOn:'2026-03-10', datasetUrl:'https://epoch.ai/data/eci_scores.csv',classification:'Independent evaluation',referenceDateBasis:'Model release date'});
  const rows=scoredResources({evidenceCutoff:now,observations:[make('Alpha','Open weights',21),make('Beta',null,29)]},inputs);
  assert.deepEqual(rows.map(r=>[r.model,r.cost??null,r.access,r.score]),[['Beta',null,'other',29],['Alpha',30,'open',21]]);
});
