import {deriveField, fieldAxes, pathwayKinds} from './observatory-field-model.js';
import {editionLabel} from './checkpoint-schedule.js';
import {createFieldRenderer} from './observatory-field-renderer.js';
import {pathwayExplorer} from './observatory-field-pathways.js';
export {deriveField};

const mounted=new WeakMap();
const priorView=new WeakMap();
const clock=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York',timeZoneName:'short'});
const when=record=>record?.checkpointAt ?? record?.checkpoint ?? record?.timestamp ?? record?.assessment?.checkpointAt;
const dateText=value=>Number.isFinite(Date.parse(value))?clock.format(Date.parse(value)):'Checkpoint time unavailable';
function el(tag,text,style){
  const element=document.createElement(tag);
  if(text!==undefined && text!==null)element.textContent=text;
  if(style)element.className=style;
  return element;
}
function button(text,handler,title){
  const b=el('button',text);b.type='button';b.addEventListener('click',handler);if(title)b.setAttribute('aria-label',title);return b;
}
function appendSource(list,row){
  const li=el('li'),value=Number.isFinite(row.value)?' · '+new Intl.NumberFormat('en',{maximumSignificantDigits:3}).format(row.value)+' '+(row.unit||''):'';
  const line=el('span',(row.label||row.topic)+value);li.append(line);
  let url;try{url=new URL(row.sourceUrl);}catch{/* Missing source remains visible as text. */}
  const sourceDate=row.publishedOn ?? row.measuredOn;
  if(url?.protocol==='https:'){const a=el('a',row.source||url.hostname);a.href=url.href;li.append(' · ',a);}
  if(sourceDate)li.append(' · '+sourceDate);
  if(row.limitations)li.append(el('p',row.limitations,'of-small'));
  list.append(li);
}
function gateDescription(status){return({met:'Independently met',unmet:'Tested and unmet',unknown:'Evidence pending',conflicting:'Conflicting evidence'})[status] ?? 'Evidence pending';}
function fieldFrom(assessment){return assessment.field?.version && Array.isArray(assessment.field.nodes)?assessment.field:deriveField(assessment);}
function assessmentsOf(a){return Array.isArray(a.milestones)?a.milestones:Object.values(a.milestones??{});}
function stageText(axis){
  if(!axis || axis.lower===null)return axis?.status==='conflicting'?'Conflicting evidence':'Indeterminate';
  return axis.lower===axis.upper?axis.lower+' of 2 stages':'At least '+axis.lower+' of 2 stages';
}
function scoreText(m){
  if(!m)return 'Assessment unavailable.';
  const coverage=m.coverage;
  const score=Number.isFinite(m.score)?m.score+' / 100':'Indeterminate';
  return score+(coverage ? ' · '+coverage.met+' of '+coverage.total+' criteria independently met' : '')+
    (m.confidence?' · '+m.confidence:'');
}
function comparison(current,previous){
  const a=fieldFrom(current),b=fieldFrom(previous);
  if(a.version!==b.version)return 'The field methodology changed between these checkpoints. Their coordinates require separate interpretation.';
  const moved=a.current.coordinates,before=b.current.coordinates;
  const changes=[];
  if(!moved&&!before)changes.push('The current marker remained unplaced.');
  else if(moved&&!before)changes.push('The current marker gained an evidence-based position.');
  else if(!moved)changes.push('The current marker became unplaced as comparable evidence changed.');
  else if(moved.some((v,i)=>v!==before[i])){
    changes.push('Measured coordinates changed on '+fieldAxes.filter((axis,i)=>moved[i]!==before[i]).map(axis=>axis.id.toUpperCase()).join(', ')+'. Select Current for the qualifying criteria.');
  }else changes.push('The measured coordinates held steady.');
  if(a.current.systems.join()!==b.current.systems.join())changes.push('The system supporting the position changed.');
  const different=a.pathways.filter(p=>{const old=b.pathways.find(x=>x.id===p.id);return !old||old.kind!==p.kind||p.met!==old.met;});
  if(different.length)changes.push('Pathway support changed for '+different.map(p=>p.label).join(', ')+'.');
  else changes.push('Pathway support held steady.');
  return changes.join(' ');
}

export function mountField(root,{assessment,history=[],loadAssessment,compact=false}={}) {
  if(!root)return;
  mounted.get(root)?.();
  root.replaceChildren();root.classList.add('observatory-field');root.classList.toggle('of-compact',compact);
  if(!assessment){root.append(el('p','The milestone field is waiting for a validated assessment.'));return;}
  const oldView=priorView.get(root);
  let data=assessment,field=fieldFrom(data),selection='current',renderer=null,timer,playing=false,request=0,closed=false;
  let fallback;
  if(compact){
    const routes=pathwayExplorer(root,{compact:true,onSelect:id=>{selection=routes.update(field,id);}});
    const requested=new URL(location.href).searchParams.get('field') ?? oldView?.selection;
    selection=routes.update(field,requested);
    return finish();
  }
  const archive=new Map();
  for(const row of history){const timestamp=when(row);if(timestamp)archive.set(timestamp,row);}
  if(when(data))archive.set(when(data),data);
  const records=[...archive.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,row])=>row);
  const cache=new Map();if(when(data))cache.set(when(data),data);
  let index=records.findIndex(row=>when(row)===when(data));
  const intro=el('p','The four milestones have fixed reference positions. Distance in this conceptual field has no conversion to time or probability.','of-intro');
  const stage=el('div',null,'of-stage'),unavailable=el('p','Explore the milestone connections in two dimensions. Select a line or use the field selector below.','of-unavailable');
  unavailable.hidden=true;stage.append(unavailable);root.append(intro,stage);
  let viewer,picker,detail,compareText,archiveSelect,prev,next,play,compareBtn;
  const paintGraphic=()=>{renderer?.update(field,selection);fallback?.update(field,selection);};
  function failed(){
    renderer?.destroy();renderer=null;
    unavailable.hidden=false;stage.classList.add('of-no-graphics');
    fallback??=pathwayExplorer(stage,{onSelect:select});
    fallback.update(field,selection);
    if(viewer)viewer.hidden=true;
  }
  renderer=createFieldRenderer(stage,{compact,select, onUnavailable:failed});
  if(!renderer)failed();
  if(renderer && oldView?.field.version===field.version && oldView.displayedAt!==when(data)){
    renderer.update(oldView.field,oldView.selection);
  }
  viewer=el('div',null,'of-camera');viewer.setAttribute('role','group');viewer.setAttribute('aria-label','3D view controls');
  const cameraItems=[
    ['←',()=>renderer?.turn(-.24,0),'Rotate left'],['→',()=>renderer?.turn(.24,0),'Rotate right'],
    ['↑',()=>renderer?.turn(0,.20),'Tilt up'],['↓',()=>renderer?.turn(0,-.20),'Tilt down'],
    ['−',()=>renderer?.zoom(1/1.20),'Zoom out'],['+',()=>renderer?.zoom(1.20),'Zoom in'],['Reset view',()=>renderer?.reset(),'Reset view to the standard angle'],
  ];
  for(const [label,handler,title] of cameraItems){const control=button(label,handler,title);control.title=title;viewer.append(control);}
  viewer.hidden=!renderer;root.append(viewer);
  const directions=el('p','Drag to rotate or pinch to zoom. Select a sphere or a path, or choose it from the list.','of-small');
  if(renderer)root.append(directions);
  const axisLegend=el('ul',null,'of-axes');axisLegend.setAttribute('aria-label','Field axes');
  for(const axis of fieldAxes){const item=el('li');item.append(el('strong',axis.id.toUpperCase()),' · '+axis.label);axisLegend.append(item);}
  root.append(axisLegend);
  const inspect=el('label',null,'of-picker');inspect.append(el('span','Inspect the field'));
  picker=el('select');inspect.append(picker);
  const nodesGroup=el('optgroup');nodesGroup.label='Nodes';picker.append(nodesGroup);
  for(const n of field.nodes){const opt=el('option',n.title);opt.value=n.id;nodesGroup.append(opt);}
  const routeGroup=el('optgroup');routeGroup.label='Pathways';picker.append(routeGroup);
  for(const path of field.pathways){const opt=el('option',path.label);opt.value=path.id;routeGroup.append(opt);}
  picker.addEventListener('change',()=>select(picker.value));
  const candidate=new URL(location.href).searchParams.get('field') ?? oldView?.selection;
  if([...picker.options].some(o=>o.value===candidate))selection=candidate;
  picker.value=selection;root.append(inspect);
  detail=el('div',null,'of-detail');detail.setAttribute('aria-live','polite');root.append(detail);
  const key=el('details',null,'of-method');
  key.append(el('summary','How to read the axes and pathways'));
  key.append(el('p','The fixed spheres locate concepts in an illustrative reference frame. Only the white sphere is eligible for measured coordinates. Its position describes one integrated system at a time. The dashboard’s broader frontier includes observations from several organizations.'));
  for(const axis of fieldAxes)key.append(el('p',axis.id.toUpperCase()+' · '+axis.label+'. '+axis.rule));
  key.append(el('p','For each axis, divide the number of consecutive independently verified stages by two. Coordinates are ordinal evidence floors. Missing tests leave the upper stage open. Conflicting findings leave the axis unresolved. If no measured system leads across all three axes, the marker stays outside the field.'));
  const legend=el('ul',null,'of-legend');
  for(const [code,label] of Object.entries(pathwayKinds)){const item=el('li'),s=el('i',null,'of-line of-'+code);s.setAttribute('aria-hidden','true');item.append(s,label);legend.append(item);}
  key.append(legend,el('p','Arrows follow the direction named in the pathway selector. Illuminated segments reflect the share of a route’s published criteria independently met. Incoming evidence for one milestone does not establish that another milestone caused it. An incompatible route appears only when selected. Routes from an unplaced current marker remain available in the selector.'));
  root.append(key);
  const timebox=el('section',null,'of-history'),historyHead=el('h3','Checkpoint replay');timebox.append(historyHead);
  const choose=el('label',null,'of-picker');choose.append(el('span','Validated checkpoint'));archiveSelect=el('select');choose.append(archiveSelect);timebox.append(choose);
  for(const [i,row] of records.entries()){const opt=el('option',editionLabel(row)+' · '+dateText(when(row)));opt.value=String(i);archiveSelect.append(opt);}
  archiveSelect.addEventListener('change',()=>{stop();setFrame(Number(archiveSelect.value));});
  const hcontrols=el('div',null,'of-history-controls');
  prev=button('Previous',()=>{stop();setFrame(index-1);});next=button('Next',()=>{stop();setFrame(index+1);});
  play=button('Replay',async()=>{if(playing){stop();return;}playing=true;sync();if(index>=records.length-1)await setFrame(0);tick();});
  compareBtn=button('Compare with previous',async()=>{
    stop();const stamp=request;
    compareText.textContent='Loading the preceding checkpoint…';
    try{const prior=await read(index-1);if(!closed&&stamp===request)compareText.textContent='Since '+editionLabel(prior)+' · '+dateText(when(prior))+'. '+comparison(data,prior);}
    catch{if(!closed&&stamp===request)compareText.textContent='The preceding checkpoint could not be loaded.';}
  });
  hcontrols.append(prev,next,play,compareBtn);timebox.append(hcontrols);
  compareText=el('p',null,'of-small');compareText.setAttribute('role','status');timebox.append(compareText);
  if(records.length<=1)compareText.textContent='Replay and comparison become available when a second validated edition is published.';
  root.append(timebox);paintDetails();sync();paintGraphic();
  if(oldView?.historical && oldView.latest!==when(data)){
    const oldIndex=records.findIndex(row=>when(row)===oldView.displayedAt);
    if(oldIndex>=0 && oldIndex!==index)setFrame(oldIndex);
  }
  return finish();

  function select(id){selection=id;picker.value=id;paintDetails();paintGraphic();}
  function finish(){
    const destroy=()=>{
      if(closed)return;
      priorView.set(root,{field,selection,displayedAt:when(data),latest:when(assessment),historical:when(data)!==when(assessment)});
      closed=true;request++;clearTimeout(timer);renderer?.destroy();
    };
    mounted.set(root,destroy);return destroy;
  }
  function stop(){playing=false;clearTimeout(timer);sync();}
  function tick(){
    if(!playing||closed)return;
    if(index>=records.length-1){stop();return;}
    timer=setTimeout(async()=>{if(!playing||closed)return;await setFrame(index+1);tick();},1600);
  }
  async function read(i){
    const row=records[i];
    if(!row)throw Error('Checkpoint unavailable');
    const key=when(row);if(cache.has(key))return cache.get(key);
    const value=row.milestones?row:row.assessment??await loadAssessment(row);
    const result=value?.assessment??value;if(!result?.milestones || when(result)!==key)throw Error('Unexpected checkpoint');
    cache.set(key,result);return result;
  }
  async function setFrame(i){
    if(i<0||i>=records.length)return;
    const token=++request;compareText.textContent='Loading checkpoint…';
    try{
      const state=await read(i);
      if(token!==request||closed)return;const prior=data;
      index=i;data=state;field=fieldFrom(state);sync();paintDetails();paintGraphic();
      compareText.textContent=dateText(when(state))+'. '+(state===prior?'':comparison(state,prior));
    }catch{
      if(token!==request||closed)return;stop();compareText.textContent='This checkpoint could not be loaded. Showing the last successful selection.';
    }
  }
  function sync(){
    if(!archiveSelect)return;
    archiveSelect.value=String(index);archiveSelect.disabled=records.length<=1;
    prev.disabled=index<=0;next.disabled=index>=records.length-1;play.disabled=records.length<2;
    play.textContent=playing?'Pause':'Replay';compareBtn.disabled=index<=0;
  }
  function paintDetails(){
    const items=assessmentsOf(data),observations=data.observations??[],byId=new Map(observations.map(o=>[o.id,o]));
    const node=field.nodes.find(n=>n.id===selection),route=field.pathways.find(r=>r.id===selection);
    const title=el('h3',node?.title??route?.label??'Selected field item'),body=[title];
    if(selection==='current'){
      const cur=field.current;body.push(el('p',cur.reason));
      if(cur.systems.length)body.push(el('p','Qualifying system: '+cur.systems.join(', ')));
      const list=el('ul',null,'of-axes-readings');
      for(const axis of fieldAxes){const item=el('li');
        item.append(el('strong',axis.id.toUpperCase()+' · '+axis.label),el('span',stageText(cur.axes.find(a=>a.id===axis.id))));list.append(item);}
      body.push(list);
      for(const candidate of cur.candidates??[]){
        if(cur.systems.includes(candidate.system))continue;
        body.push(el('p',candidate.system+' · '+candidate.axes.map(axis=>axis.id.toUpperCase()+' '+stageText(axis)).join(' / '),'of-small'));
      }
      const details=el('details');details.append(el('summary','Measurements and limits for each axis'));
      for(const axis of fieldAxes){
        details.append(el('h4',axis.id.toUpperCase()+' · '+axis.label),el('p',axis.rule));
        const gates=items.flatMap(m=>m.criteria??[]).filter(g=>axis.stages.flat().includes(g.id));
        const qualifying=[...new Set(gates.flatMap(g=>g.evidenceIds??[]))].map(id=>byId.get(id)).filter(Boolean);
        if(qualifying.length){details.append(el('p','Evidence used to assess these stages'));const list=el('ul');for(const row of qualifying)appendSource(list,row);details.append(list);}
        const examples=axis.topics.map(topic=>observations.filter(o=>o.topic===topic && o.sourceUrl).sort((a,b)=>(b.measuredOn??'').localeCompare(a.measuredOn??''))[0]).filter(Boolean);
        if(examples.length){details.append(el('p','Related measurements on narrower tasks'));const list=el('ul');for(const row of examples)appendSource(list,row);details.append(list);}
      }
      body.push(details);
    }else if(node){
      const m=items.find(item=>item.id===node.id);
      if(m){body.push(el('p',m.definition),el('p',scoreText(m),'of-score'));
        if(m.limitations)body.push(el('p',m.limitations));
        const list=el('ul');for(const g of m.criteria??[])list.append(el('li',g.label+' · '+gateDescription(g.status)));body.push(list);
        const ids=[...new Set((m.criteria??[]).flatMap(g=>[...(g.evidenceIds??[]),...(g.relatedIds??[])]))];
        const readings=ids.map(id=>byId.get(id)).filter(Boolean);
        if(readings.length){const extra=el('details');extra.append(el('summary','Evidence behind these criteria'));const list=el('ul');for(const row of readings)appendSource(list,row);extra.append(list);body.push(extra);}
      }
    }else if(route){
      body.push(el('p',pathwayKinds[route.kind],'of-score'),el('p',route.reason));
      if(route.total){const list=el('ul');for(const g of route.criteria){list.append(el('li',g.label+' · '+gateDescription(g.status)));}body.push(list);
        body.push(el('p',route.met+' of '+route.total+' transition criteria independently met.','of-small'));}
      const ids=[...new Set(route.criteria.flatMap(g=>[...g.evidenceIds,...g.relatedIds]))];
      const relevant=ids.map(id=>byId.get(id)).filter(Boolean);
      if(relevant.length){const extra=el('details');extra.append(el('summary','Direct and contextual evidence'));const list=el('ul');for(const row of relevant)appendSource(list,row);extra.append(list);body.push(extra);}
    }
    detail.replaceChildren(...body);
  }
}
