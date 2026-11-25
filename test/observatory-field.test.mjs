import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveField,fieldVersion} from '../site/observatory-field-model.js';
import {assessMilestones} from '../site/observatory-criteria.js';

const ids=['agi-breadth','agi-transfer','agi-reliability','asi-experts','rsi-contribution','rsi-repeat'];
const groups={agi:ids.slice(0,3),asi:ids.slice(0,4),rsi:ids.slice(4),singularity:[]};
function fixture(system='Test A',states={}) {
  const obs={id:system+'-e',system,source:'Independent lab',sourceUrl:'https://example.org/test',classification:'Independent evaluation'};
  return {observations:[obs],milestones:Object.entries(groups).map(([id,gates])=>({id,system,criteria:gates.map(g=>({
    id:g,status:states[g]??'unknown',evidenceIds:[obs.id],relatedIds:[],
  }))}))};
}

test('reference locations stay fixed and missing measurements produce a parked marker',()=>{
  const a=deriveField(), b=deriveField({milestones:assessMilestones([],[],new Date().toISOString()),observations:[],
    xFactors:[{impact:'negative'}],forecasts:[{central:'2040'}]});
  assert.equal(a.version,fieldVersion); assert.equal(a.nodes.length,5);
  assert.deepEqual(a.nodes,b.nodes);assert.deepEqual(a.current,b.current);assert.equal(a.current.coordinates,null);
  const branches=new Map(a.pathways.map(r=>[r.id,r]));
  assert.equal(branches.get('agi-asi').kind,'logical');assert.equal(branches.get('agi-rsi').kind,'possible');
  assert.equal(branches.get('asi-without-agi').kind,'incompatible');assert.equal(branches.get('asi-singularity').kind,'unsupported');
  assert.equal(branches.get('rsi-agi').kind,'possible');
});
test('ordinal positions include explicit zero and bound versus unknown',()=>{
  const a=deriveField(fixture('A',{'agi-breadth':'met','agi-reliability':'met','rsi-contribution':'unmet'}));
  assert.deepEqual(a.current.coordinates,[.5,.5,0]);assert.equal(a.current.axes[0].upper,2);
  assert.equal(a.current.axes[2].upper,0);assert.equal(a.pathways.find(r=>r.id==='current-agi').kind,'supported');
  assert.equal(a.pathways.find(r=>r.id==='agi-rsi').kind,'possible');
  const b=deriveField(fixture('A',{'agi-breadth':'met','rsi-contribution':'unmet'}));assert.equal(b.current.coordinates,null);
});
test('confirmed successors never imply singularity; corrected or contradictory evidence reverses a placement',()=>{
  const data=fixture('A',Object.fromEntries(ids.map(id=>[id,'met'])));
  const a=deriveField(data);assert.deepEqual(a.current.coordinates,[1,1,1]);
  assert.equal(a.pathways.find(r=>r.id==='rsi-singularity').met,0);
  data.milestones.find(m=>m.id==='rsi').criteria[1].status='unmet';
  assert.deepEqual(deriveField(data).current.coordinates,[1,1,.5]);
  data.milestones.find(m=>m.id==='rsi').criteria[1].status='conflicting';
  assert.equal(deriveField(data).current.coordinates,null);
});
test('an untested lower stage is not rendered as demonstrated zero and inverted stages conflict',()=>{
  const partial=fixture('A',{'agi-breadth':'met','agi-reliability':'met','rsi-repeat':'unmet'});
  assert.equal(deriveField(partial).current.coordinates,null);
  const inverted=fixture('A',{'agi-breadth':'met','agi-reliability':'met','rsi-contribution':'unmet','rsi-repeat':'met'});
  assert.equal(deriveField(inverted).current.coordinates,null);
});
test('indicators or complementary systems cannot be fused into a current position',()=>{
  const one=fixture('A',{'agi-breadth':'met','agi-reliability':'met','agi-transfer':'met','asi-experts':'met'});
  const two=fixture('B',{'rsi-contribution':'met','rsi-repeat':'met'});
  assert.equal(deriveField({observations:[...one.observations,...two.observations],milestones:[...one.milestones,...two.milestones]}).current.coordinates,null);
  const raw={observations:[{topic:'breadth',value:199},{topic:'research-autonomy',value:100},{topic:'compute',value:1e28}]};
  const empty=deriveField();assert.deepEqual(deriveField(raw).current,empty.current);
});
test('first-party, missing and unidentified sources cannot place a supposedly reviewed system',()=>{
  for(const invalid of [
    row=>({...row,classification:'First-party claim'}),
    row=>({...row,system:null}),
    row=>({...row,id:'unrelated observation'}),
  ]){
    const all=fixture('A',Object.fromEntries(ids.map(id=>[id,'met'])));
    all.observations=all.observations.map(invalid);
    assert.equal(deriveField(all).current.coordinates,null);
  }
});
test('an archived field serializes deterministically and does not depend on wall-clock time',()=>{
  const sample=fixture('A',Object.fromEntries(ids.map(id=>[id,'met'])));
  assert.deepEqual(JSON.parse(JSON.stringify(deriveField(sample))),deriveField(sample));
});
