// Frozen display anchors belong to the diagram. Only the current marker can carry measured coordinates.
export const fieldVersion = 'field-1.0';
export const fieldNodes = [
  {id:'agi', label:'AGI', title:'Artificial general intelligence', color:'#67e2eb', anchor:[.72,.42,.15]},
  {id:'rsi', label:'RSI', title:'Recursive self-improvement', color:'#b59be9', anchor:[.19,.43,.83]},
  {id:'asi', label:'ASI', title:'Artificial superintelligence', color:'#f1bf76', anchor:[.86,.77,.24]},
  {id:'singularity', label:'Singularity', title:'Technological singularity', color:'#f883a0', anchor:[.55,.98,.95]},
  {id:'current', label:'Current', title:'Current demonstrated position', color:'#f8f5ff', anchor:null},
];

// These ordinal stages describe qualifying evidence. The gap between stages has no physical unit.
export const fieldAxes = [
  {id:'x', label:'Breadth and generalization', stages:[['agi-breadth'],['agi-transfer']], topics:['breadth','generalization'], rule:'One stage for independently demonstrated breadth. A second requires transfer to unfamiliar tasks.'},
  {id:'y', label:'Capability relative to humans', stages:[['agi-breadth','agi-reliability'],['asi-experts']], topics:['reliability','horizon','breadth'], rule:'The first stage requires broad, reliable skilled-human performance. The second also requires superiority to leading experts.'},
  {id:'z', label:'Autonomous research and self-improvement', stages:[['rsi-contribution'],['rsi-repeat']], topics:['research-autonomy','research-acceleration'], rule:'The first stage requires an attributable improvement to a successor. The second requires a repeated cycle involving that successor.'},
];

const routes = [
  {id:'current-agi', from:'current', to:'agi', label:'Current position → AGI', kind:'possible', criteria:['agi-breadth','agi-transfer','agi-reliability'], reason:'Independent, representative evaluations of one system can establish broad human-level capability. Narrow benchmarks help identify experiments to run.'},
  {id:'current-rsi', from:'current', to:'rsi', label:'Current position → RSI', kind:'possible', criteria:['rsi-contribution','rsi-repeat'], reason:'A specialized system could contribute to better successors before attaining broad human-level capability. Crediting this route requires attributable, repeated improvements.'},
  {id:'agi-asi', from:'agi', to:'asi', label:'AGI-level capability → ASI', kind:'logical', criteria:['agi-breadth','agi-transfer','agi-reliability','asi-experts'], reason:'Broad, reliable superiority to leading experts includes the skilled-human standard. A single evaluation could establish both milestones at the same checkpoint.'},
  {id:'agi-rsi', from:'agi', to:'rsi', label:'AGI → RSI', kind:'possible', criteria:['rsi-contribution','rsi-repeat'], reason:'Broad capabilities could help a system improve a successor. Showing that the successor repeats the improvement requires a separate causal evaluation.'},
  {id:'rsi-agi', from:'rsi', to:'agi', label:'RSI → AGI', kind:'possible', criteria:['agi-breadth','agi-transfer','agi-reliability'], reason:'Repeated specialist improvements could eventually broaden capability. A representative evaluation of the resulting system would test this possibility.'},
  {id:'rsi-singularity', from:'rsi', to:'singularity', label:'Successor feedback → Singularity', kind:'logical', criteria:['singularity-feedback','singularity-acceleration','singularity-transition'], reason:'This observatory’s definition requires a self-reinforcing feedback process. A demonstrated cycle alone leaves the magnitude, persistence and wider change in technological pace open.'},
  {id:'asi-singularity', from:'asi', to:'singularity', label:'ASI alone → Singularity', kind:'unsupported', criteria:[], reason:'Expert-level comparisons establish capabilities. They supply no causal demonstration of accelerating development across generations. ASI could exist without this transition.'},
  {id:'asi-without-agi', from:'asi', to:'agi', label:'ASI with AGI-level capability absent', kind:'incompatible', criteria:[], reason:'Genuinely lacking AGI-level breadth conflicts with the ASI definition. Observing ASI before a separate AGI assessment is entirely compatible with it.'},
];

export const pathwayKinds = {
  logical:'Required by definition', supported:'Evidence supports this step', possible:'Possible route',
  unsupported:'Unsupported inference', incompatible:'Incompatible with definitions',
};

function axesFor(gates) {
  return fieldAxes.map(axis => {
    let lower = 0, upper = 0, stopLower = false, stopUpper = false, measured = false, conflict = false;
    for (const [index,stage] of axis.stages.entries()) {
      const results = stage.map(id => gates.get(id)?.status ?? 'unknown');
      if (results.includes('conflicting')) conflict = true;
      if (stopUpper && results.every(state => state === 'met')) conflict = true;
      if (results.includes('unmet')) { stopUpper = true; if (index === 0) measured = true; }
      if (!results.every(state => state === 'met')) stopLower = true;
      if (!stopLower) { lower++; measured = true; }
      if (!stopUpper) upper++;
    }
    return {id:axis.id, lower:measured && !conflict ? lower : null, upper:measured && !conflict ? upper : null,
      status:conflict ? 'conflicting' : !measured ? 'unknown' : lower === upper ? 'assessed' : 'lower bound'};
  });
}

function mergeGate(gates, gate) {
  const prior = gates.get(gate.id);
  if (!prior || prior.status === 'unknown') gates.set(gate.id, gate);
  else if (gate.status !== 'unknown' && gate.status !== prior.status) {
    gates.set(gate.id, {...gate,status:'conflicting',evidenceIds:[...new Set([...(prior.evidenceIds || []), ...(gate.evidenceIds || [])])]});
  }
}

function currentPosition(milestones, observations) {
  const systems = new Map();
  for (const milestone of milestones) {
    for (const gate of milestone.criteria ?? []) {
      const evidence = (gate.evidenceIds ?? []).map(id=>observations.get(id));
      // A named, integrated system must support its own placement. Global or laboratory aggregates stay contextual.
      const system = gate.system || milestone.system;
      if (typeof system !== 'string' || !system.trim() || !evidence.length || !['met','unmet','conflicting'].includes(gate.status)) continue;
      if (!evidence.every(row=>row?.system === system && row.classification === 'Independent evaluation')) continue;
      if (!systems.has(system)) systems.set(system, new Map());
      mergeGate(systems.get(system),gate);
    }
  }
  const candidates = [...systems].map(([system,gates])=>({system,axes:axesFor(gates)}));
  const complete = candidates.filter(row=>row.axes.every(axis=>axis.lower !== null));
  const frontier = complete.filter(row=>complete.every(other=>other.axes.every((axis,i)=>row.axes[i].lower >= axis.lower)));
  if (frontier.length) {
    const axes = frontier[0].axes;
    return {coordinates:axes.map(axis=>axis.lower/2),systems:frontier.map(row=>row.system).sort(),axes,candidates,
      reason:'The white sphere marks the independently documented floors for a single named system on all three axes. Each coordinate is the number of consecutive verified stages divided by two.'};
  }
  return {coordinates:null,systems:[],axes:axesFor(new Map()),candidates,reason:complete.length
    ? 'The assessed systems have different strengths. No single system leads across all three axes, so the current marker is unplaced.'
    : 'No single named system has qualifying measurements on all three axes. The white sphere is parked outside the field until those measurements exist.'};
}

export function deriveField(assessment={}) {
  const milestones = Array.isArray(assessment.milestones) ? assessment.milestones : Object.values(assessment.milestones ?? {});
  const observations = new Map((assessment.observations ?? []).map(row=>[row.id,row]));
  const current = currentPosition(milestones,observations);
  const pathways = routes.map(route=>{
    const milestone = milestones.find(row=>row.id===route.to);
    const criteria = route.criteria.map(id=>{
      const criterion = milestone?.criteria?.find(g=>g.id===id);
      return {id,label:criterion?.label ?? id,status:criterion?.status ?? 'unknown',evidenceIds:criterion?.evidenceIds ?? [],relatedIds:criterion?.relatedIds ?? []};
    });
    const met = criteria.filter(c=>c.status==='met').length;
    // For a route from the current state, evidence can support specific steps. Reaching a downstream
    // milestone alone never establishes a causal link between two different milestones.
    const kind = route.from==='current' && met ? 'supported' : route.kind;
    return {...route,kind,criteria,met,total:criteria.length};
  });
  return {version:fieldVersion, geometry:'Conceptual reference locations; ordinal evidence stages for an eligible current system.',
    nodes:fieldNodes.map(node=>({...node,coordinates:node.id==='current'?current.coordinates:node.anchor})),
    current,pathways};
}
