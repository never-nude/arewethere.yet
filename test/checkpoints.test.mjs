import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { checkpointForRun, checkpointWindow } from '../site/checkpoint-schedule.js';
import { appendRecord, assertPublishedAncestry, firstMeasurementRequest, nextRecord, readArchive } from '../scripts/checkpoint-archive.mjs';

const iso = date => new Date(date).toISOString();
const schedules = ['0 0 * * *','30 9 * * *','0 16 * * *','0 6 * * *'];
const spring = '2026-03-08T13:30:00.000Z';
const summer = '2026-07-04T13:30:00.000Z';
const winter = '2026-11-25T14:30:00.000Z';
const prior = '2026-11-25T05:00:00.000Z';

test('New York checkpoints retain the original calendar and add a fourth daily slot after the schedule change', () => {
  for (const [stamp, prev, next] of [
    ['2026-03-08T07:05Z','2026-03-08T05:00Z',spring],
    ['2026-03-08T03:00Z','2026-03-07T21:00Z','2026-03-08T05:00Z'],
    [spring,spring,'2026-03-08T20:00Z'],
    ['2026-11-01T06:30Z','2026-11-01T04:00Z','2026-11-01T14:30Z'],
    ['2026-11-02T02:00Z','2026-11-01T21:00Z','2026-11-02T05:00Z'],
    [summer,summer,'2026-07-04T20:00Z'],
    ['2026-11-25T11:00Z',prior,winter],
    ['2026-11-26T10:59Z','2026-11-26T05:00Z','2026-11-26T11:00Z'],
    ['2026-11-26T11:00Z','2026-11-26T11:00Z','2026-11-26T14:30Z'],
    ['2027-03-14T09:05Z','2027-03-14T05:00Z','2027-03-14T10:00Z'],
    ['2027-11-07T07:05Z','2027-11-07T04:00Z','2027-11-07T11:00Z'],
  ]) assert.deepEqual(checkpointWindow(stamp), {previous:iso(prev),next:iso(next)});
  const slots = [];
  let time = '2027-03-12T05:00Z';
  for(let i=0;i<16;i++) { const window=checkpointWindow(time);slots.push(window.previous);time=window.next; }
  assert.equal(new Set(slots).size,16);
  assert.equal(slots.at(-1),'2027-03-15T20:00:00.000Z');
  const workflow = awaitFile => awaitFile.match(/- cron: '(.*?)'/g).map(row=>row.slice(9,-1)).sort();
  return readFile(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8').then(source=>{
    assert.deepEqual(workflow(source),[...schedules].sort());
    assert.equal(source.match(/timezone: 'America\/New_York'/g).length,4);
  });
});

test('only the original scheduled event can consume its unexpired slot, including a delayed run', () => {
  const options={event:'schedule',cron:schedules[1],createdAt:'2026-11-25T14:47Z',now:'2026-11-25T15:03Z'};
  assert.equal(checkpointForRun(options),winter);
  for(const change of [{event:'push'},{event:'workflow_dispatch'},{createdAt:null},{cron:schedules[0]},
    {now:'2026-11-25T21:02Z'},{now:'2026-11-25T13:00Z'}]) assert.equal(checkpointForRun({...options,...change}),null);
  assert.equal(checkpointForRun({...options,cron:schedules[0],createdAt:'2026-11-25T05:10Z',now:'2026-11-25T12:10Z'}),prior);
  assert.equal(checkpointForRun({...options,cron:schedules[3],createdAt:'2026-11-25T11:05Z',now:'2026-11-25T11:15Z'}),null);
  assert.equal(checkpointForRun({...options,cron:schedules[3],createdAt:'2026-11-26T11:05Z',now:'2026-11-26T11:15Z'}),iso('2026-11-26T11:00Z'));
  assert.equal(checkpointForRun({...options,cron:schedules[0],createdAt:'2026-11-26T05:05Z',now:'2026-11-26T11:15Z'}),null);
});

async function temp(t) {
  const root=await mkdtemp(path.join(os.tmpdir(),'observatory-ledger-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  return root;
}
function makeRecord(checkpointAt,kind,previousSha256=null) {
  const validatedAt=iso(Date.parse(checkpointAt)+9000);
  const ids=['agi','rsi','asi','singularity'];
  return {schemaVersion:2,kind,sourceRevision:'a'.repeat(40),previousSha256,
    assessment:{kind,checkpointAt,validatedAt,methodologyVersion:'test',modelVersion:'test',
      field:{nodes:[...ids,'current'].map(id=>({id,coordinates:id==='current'?null:[0,0,0]}))},
      milestones:ids.map(id=>({id,score:null,coverage:{met:0,assessed:0,total:1}})),
      forecasts:ids.map(id=>({id,status:'Not reliably estimable',centralDate:null,range:null}))},
    signals:{checkedAt:checkpointAt,metrics:[{id:'reliability',status:'live',value:1}],sources:[]},companion:{}};
}
test('one commissioning edition survives static code pushes; official slots append once with retained original bytes',async t=>{
  const root=await temp(t);
  assert.deepEqual(nextRecord([],null),{kind:'commissioning',checkpointAt:null});
  const baseline=makeRecord('2026-11-25T02:51:00.000Z','commissioning');
  await appendRecord(root,baseline);
  const after=await readArchive(root);
  assert.equal(nextRecord(after,null),null);
  assert.deepEqual(nextRecord(after,prior),{kind:'official',checkpointAt:prior});
  const first=makeRecord(prior,'official',after[0].sha256);
  const race=await Promise.allSettled([appendRecord(root,first),appendRecord(root,first)]);
  assert.equal(race.filter(item=>item.status==='fulfilled').length,1);
  const records=await readArchive(root);
  assert.deepEqual(records.map(row=>row.kind),['commissioning','official']);
  assert.equal(nextRecord(records,prior),null);
  assert.equal(nextRecord(records,'2026-11-24T21:00:00.000Z'),null);
  assert.deepEqual(JSON.parse(await readFile(records[0].file,'utf8')),baseline);
  await assert.rejects(appendRecord(root,{...first,companion:{edited:true}}));
});
test('the explicit first measurement uses the original dispatch window and the actual capture time, exactly once', async t => {
  const root = await temp(t);
  const input = {event:'workflow_dispatch', enabled:'true', ref:'refs/heads/main',
    createdAt:'2026-11-25T03:01:00Z', actor:'owner', runId:'1234'};
  const request = firstMeasurementRequest(input);
  const capturedAt = '2026-11-25T03:03:03.000Z';
  assert.deepEqual(request, {type:'initial-measurement', label:'Launch test', requestedAt:iso(input.createdAt), actor:'owner', runId:'1234'});
  for (const change of [{event:'push'}, {event:'schedule'}, {enabled:'false'}, {enabled:undefined}]) {
    assert.equal(firstMeasurementRequest({...input, ...change}), null);
  }
  for (const change of [{ref:'refs/heads/preview'}, {createdAt:null}, {actor:''}, {runId:'x'}]) {
    assert.throws(() => firstMeasurementRequest({...input, ...change}));
  }
  assert.throws(() => nextRecord([], null, request, capturedAt), /launch baseline/);
  const baseline = makeRecord('2026-11-25T02:07:00.000Z', 'commissioning');
  await appendRecord(root, baseline);
  const initial = await readArchive(root);
  assert.deepEqual(nextRecord(initial, null, request, capturedAt), {kind:'official', checkpointAt:null, trigger:request});
  assert.throws(() => nextRecord(initial, null, request, '2026-11-25T03:00:00Z'), /outside/);
  assert.throws(() => nextRecord(initial, null, request, prior), /outside/);
  const record = makeRecord(capturedAt, 'official', initial[0].sha256);
  record.assessment.trigger = request;
  for (const modify of [
    row => {row.assessment.validatedAt = prior;},
    row => {row.assessment.checkpointAt = iso(input.createdAt);},
    row => {row.assessment.trigger.requestedAt = prior;},
    row => {row.assessment.trigger.type = 'unscheduled';},
    row => {row.signals.metrics[0].status = 'snapshot';},
  ]) {
    const invalid = structuredClone(record);
    modify(invalid);
    await assert.rejects(appendRecord(root, invalid));
  }
  const another = makeRecord('2026-11-25T03:03:06.000Z', 'official', initial[0].sha256);
  another.assessment.trigger = request;
  const race = await Promise.allSettled([appendRecord(root, record), appendRecord(root, another)]);
  assert.equal(race.filter(item => item.status === 'fulfilled').length, 1);
  const rows = await readArchive(root);
  assert.deepEqual(rows.map(row => row.kind), ['commissioning', 'official']);
  assert.deepEqual(JSON.parse(await readFile(rows[0].file, 'utf8')), baseline);
  assert.deepEqual(rows[1].trigger, request);
  assert.equal(nextRecord(rows, null, request, prior), null);
  assert.equal(nextRecord(rows, null, {...request, runId:'5678'}, prior), null);
  await assert.rejects(appendRecord(root, another));
  assert.deepEqual(nextRecord(rows, prior), {kind:'official', checkpointAt:prior});
  await appendRecord(root, makeRecord(prior, 'official', rows[1].sha256));
  const final = await readArchive(root);
  assert.deepEqual(final.map(row => row.kind), ['commissioning', 'official', 'official']);
  assert.equal(nextRecord(final, null, request, winter), null);
});
test('failed verification and incomplete cached sources leave the last validated record intact',async t=>{
  const root=await temp(t);
  await appendRecord(root,makeRecord(prior,'official'));
  const [before]=await readArchive(root);
  for(const modify of [
    row=>row.signals.metrics[0].status='snapshot', row=>row.signals.metrics[0].value=null,
    row=>row.assessment.field=null, row=>row.assessment.milestones[0].score=100,
    row=>row.assessment.forecasts[0].centralDate='2031-01-01', row=>row.assessment.field.nodes[0].coordinates=[NaN,0,0], row=>row.signals.checkedAt='2026-11-26T00:00:00.000Z',
    row=>row.assessment.checkpointAt='2026-11-25T14:31:00.000Z',
  ]) {
    const invalid=makeRecord(winter,'official',before.sha256);
    modify(invalid);
    await assert.rejects(appendRecord(root,invalid));
  }
  assert.deepEqual(await readArchive(root),[before]);
  assert.doesNotThrow(()=>assertPublishedAncestry([before],before.sha256));
  assert.throws(()=>assertPublishedAncestry([] ,before.sha256),/replace history/);
});
test('tampered bytes, damaged folders and a missing predecessor cannot produce a deployment',async t=>{
  const root=await temp(t);
  await appendRecord(root,makeRecord(prior,'official'));
  const [first]=await readArchive(root);
  await appendRecord(root,makeRecord(winter,'official',first.sha256));
  const bytes=await readFile(first.file);
  await writeFile(first.file,Buffer.concat([bytes,Buffer.from(' ')]));
  await assert.rejects(readArchive(root),/checksum/);
  await writeFile(first.file,bytes);
  const damaged=path.join(root,'checkpoints','broken');await mkdir(damaged);
  await assert.rejects(readArchive(root),/Incomplete/);
  await rm(damaged,{recursive:true});
  await rm(path.dirname(first.file),{recursive:true});
  await assert.rejects(readArchive(root),/incomplete or out of order/);
});

test('discovery retains dated source reports only; future captures and candidate forecast or capability scores cannot enter', async ()=>{
  const {pendingEvidence}=await import('../scripts/candidate-observations.mjs');
  const scan={schemaVersion:1,checkedAt:'2026-11-25T09:00:00Z',milestones:[{id:'agi',score:100}],events:[
    {source:'A lab',title:'A published report',date:'2026-11-25',url:'https://example.org/report'},
    {source:'A lab',title:'Future report',date:'2026-11-26',url:'https://example.org/future'}],
    incidents:[{id:'provider:123',source:'Provider',url:'https://example.org/status',startedAt:'2026-11-25T06:45:00Z'}]};
  const result=pendingEvidence([scan,{...scan,checkedAt:'2026-11-25T16:00:00Z'}],prior,winter);
  assert.equal(result.scans.length,1);assert.equal(result.events.length,1);assert.equal(result.incidents.length,1);
  assert.equal(result.milestones,undefined);assert.equal(result.events[0].retrievedAt,scan.checkedAt);
});

test('archive publishing restores even an unborn checkout and refuses deletion, changed records or a competing advance',async t=>{
  const {execFileSync}=await import('node:child_process');
  const {fileURLToPath}=await import('node:url');
  const root=await temp(t);
  const code=fileURLToPath(new URL('../scripts/',import.meta.url));
  const remote=path.join(root,'remote.git');
  execFileSync('git',['init','--bare','--quiet',remote]);
  const bin=path.join(root,'bin');await mkdir(bin);
  await writeFile(path.join(bin,'gh'),'#!/bin/sh\ncase "$1" in auth) exit 0;; api) echo aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;; *) exit 1;; esac\n',{mode:0o755});
  await writeFile(path.join(bin,'curl'),'#!/bin/sh\necho 404\n',{mode:0o755});
  const env={...process.env,PATH:bin+path.delimiter+process.env.PATH,GITHUB_REPOSITORY:'fixture/observatory',GITHUB_RUN_ID:'42',
    GH_TOKEN:'test',GITHUB_ENV:path.join(root,'actions-env'),GIT_ALLOW_PROTOCOL:'file',
    GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'url.file://'+remote+'.insteadOf',GIT_CONFIG_VALUE_0:'https://github.com/fixture/observatory.git'};
  const shell=(script,dir)=>execFileSync('bash',[path.join(code,script)],{env:{...env,OBSERVATORY_ARCHIVE_DIR:dir},stdio:'pipe'});
  const a=path.join(root,'a');shell('prepare-archive.sh',a);
  const filename='record.json';await writeFile(path.join(a,filename),'first');shell('persist-archive.sh',a);
  const b=path.join(root,'b');shell('prepare-archive.sh',b);
  assert.equal(await readFile(path.join(b,filename),'utf8'),'first');
  await writeFile(path.join(b,filename),'replacement');assert.throws(()=>shell('persist-archive.sh',b));
  await rm(path.join(b,filename));assert.throws(()=>shell('persist-archive.sh',b));
  const c=path.join(root,'c');shell('prepare-archive.sh',c);
  await writeFile(path.join(a,'second.json'),'second');shell('persist-archive.sh',a);
  await writeFile(path.join(c,'third.json'),'third');assert.throws(()=>shell('persist-archive.sh',c));
  const d=path.join(root,'d');shell('prepare-archive.sh',d);
  assert.equal(await readFile(path.join(d,'second.json'),'utf8'),'second');
});
