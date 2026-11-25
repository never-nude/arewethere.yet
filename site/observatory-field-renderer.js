// Meshes are lit, perspective-projected, depth-tested and alpha-blended in WebGL.
// The same camera projects labels and pointer hit zones into device-independent pixels.
const clamp=(v,l,h)=>Math.max(l,Math.min(h,v));
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const mul=(a,k)=>a.map(x=>x*k);
const norm=a=>mul(a,1/(Math.hypot(...a)||1));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const blend=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t);
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const world=p=>p.map((v,i)=>(v-.50)*[2.20,1.85,1.62][i]);
const standardCamera={yaw:-.40,pitch:.18,zoom:1};
const pathStyle={
  logical:{color:'#b9d5d9',pieces:1,duty:1},supported:{color:'#88dec5',pieces:12,duty:.83},
  possible:{color:'#a99cc7',pieces:10,duty:.55},unsupported:{color:'#908498',pieces:16,duty:.26},
  incompatible:{color:'#e699a4',pieces:8,duty:.35},
};
const vertexSource=`
attribute vec3 aPosition; attribute vec3 aNormal; attribute vec4 aColor;
attribute float aDock; uniform vec4 uCamera; uniform vec2 uScale; uniform vec2 uDock;
varying vec3 vNormal; varying vec4 vColor;
void main(){
 vec3 p=aPosition; vec3 n=aNormal;
 mat3 yaw=mat3(uCamera.x,0.,-uCamera.y, 0.,1.,0., uCamera.y,0.,uCamera.x);
 mat3 pitch=mat3(1.,0.,0., 0.,uCamera.z,uCamera.w, 0.,-uCamera.w,uCamera.z);
 mat3 rot=pitch*yaw;
 if(aDock < 0.5){p=rot*p; n=rot*n;}
 float dist=4.5-p.z;
 vec2 pos=p.xy*uScale;
 if(aDock > .5){pos+=uDock*dist;}
 gl_Position=vec4(pos,(10.8/10.)*dist-2.*.4*10.4/10.,dist);
 vNormal=n; vColor=aColor;
}`;
const fragmentSource=`
precision mediump float; varying vec3 vNormal; varying vec4 vColor;
void main(){
 vec3 n=normalize(vNormal);
 float lit=max(0.,dot(n,normalize(vec3(-.4,.7,1.))));
 float rim=pow(1.-max(0.,n.z),2.);
 float shine=pow(max(0.,dot(n,normalize(vec3(-.25,.38,1.)))),22.);
 vec3 color=vColor.rgb*(.30+.67*lit)+vec3(.18*rim+.23*shine);
 gl_FragColor=vec4(color,vColor.a);
}`;
function shaderProgram(gl) {
  const shaders=[];
  const program=gl.createProgram();
  try {
    for(const [type,source] of [[gl.VERTEX_SHADER,vertexSource],[gl.FRAGMENT_SHADER,fragmentSource]]){
      const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw Error('Shader unavailable');
      gl.attachShader(program,shader);
    }
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error('Renderer unavailable');
    return program;
  } catch(error){gl.deleteProgram(program);throw error;}
  finally { for(const shader of shaders)gl.deleteShader(shader); }
}

function buildScene(field,selected,position) {
  const opaque=[],transparent=[],parked=[],nodes=new Map(),paths=new Map();
  const put=(target,p,n,color,dock=false)=>target.push(...p,...n,...color,Number(dock));
  function sphere(center,radius,tint,dock=false) {
    const point=(lat,lon)=>[Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon)];
    const rings=19, sides=32;
    for(let j=0;j<rings;j++)for(let i=0;i<sides;i++) {
      const a=(j/rings-.5)*Math.PI,b=((j+1)/rings-.5)*Math.PI,c=i/sides*2*Math.PI,d=(i+1)/sides*2*Math.PI;
      const quad=[point(a,c),point(b,c),point(b,d),point(a,d)];
      for(const k of [0,1,2,0,2,3])put(dock?parked:transparent,add(center,mul(quad[k],radius)),quad[k],tint,dock);
    }
  }
  function tube(a,b,r1,r2,color,density=6) {
    const v=norm(sub(b,a)), u=norm(cross(v,Math.abs(v[1])>.88?[1,0,0]:[0,1,0])), w=cross(v,u);
    for(let i=0;i<density;i++) {
      const radial=index=>add(mul(u,Math.cos(index*2*Math.PI/density)),mul(w,Math.sin(index*2*Math.PI/density)));
      const n=radial(i),m=radial(i+1);
      const q=[[add(a,mul(n,r1)),n],[add(b,mul(n,r2)),n],[add(b,mul(m,r2)),m],[add(a,mul(m,r1)),m]];
      for(const k of [0,1,2,0,2,3])put(opaque,q[k][0],q[k][1],color);
    }
  }
  const origin=world([0,0,0]); const axes=[];
  for(let dim=0;dim<3;dim++){
    const p=[0,0,0];p[dim]=1;const end=world(p);axes.push(end);
    tube(origin,end,.006,.006,[.48,.47,.58,1]);
    for(const t of [.5,1]){
      const tick=blend(origin,end,t);const span=[.026,.026,.026];span[dim]=0;
      tube(sub(tick,span),add(tick,span),.006,.006,[.46,.45,.54,1]);
    }
  }
  for(const node of field.nodes){
    const coordinates=node.id==='current'?position:node.coordinates;
    const dock=!coordinates;const c=coordinates?world(coordinates):[0,0,0];
    const r=node.id==='current'?.085:node.id==='singularity'?.137:.116;
    nodes.set(node.id,{p:c,r,dock});
    const tint=rgb(node.color);sphere(c,r,[...tint,selected===node.id?.98:.91],dock);
  }
  for(const route of field.pathways){
    if(route.kind==='incompatible' && selected!==route.id) continue;
    const a=nodes.get(route.from),b=nodes.get(route.to);
    if(!a || !b || a.dock || b.dock)continue;
    const active=selected===route.id,style=pathStyle[route.kind],color=rgb(style.color);
    const bend=route.id==='agi-rsi'?.17:route.id==='rsi-agi'?-.13:route.id==='asi-without-agi'?-.18:0;
    const curve=t=>add(blend(a.p,b.p,t),[0,Math.sin(t*Math.PI)*bend,0]);
    const length=Math.hypot(...sub(b.p,a.p));if(length < a.r+b.r+.065)continue;
    const t0=a.r/length,t1=1-b.r/length-.014;
    const start=t=>t0+t*(t1-t0);
    const point=t=>curve(start(t));
    const samples=Array.from({length:13},(_,i)=>point(i/12));paths.set(route.id,samples);
    const step=route.kind==='logical'?5:style.pieces;
    const bright=route.total?route.met/route.total:0;
    const tint=t=>[...(active?[.98,.96,1]:t<=bright?[.57,.90,.76]:color),1];
    const radius=active?.012:route.kind==='logical'?.008:.007;
    for(let i=0;i<step;i++){const s=i/step,e=(i+style.duty)/step;tube(point(s),point(e),radius,radius,tint((s+e)/2));}
    tube(point(.85),point(1),active?.041:.029,0,tint(1),10);
  }
  return {opaque:new Float32Array(opaque),transparent:new Float32Array(transparent),parked:new Float32Array(parked),nodes,paths,axes};
}

export function createFieldRenderer(stage,{compact,select,onUnavailable}) {
  const canvas=document.createElement('canvas'),labels=document.createElement('div');
  canvas.setAttribute('aria-hidden', 'true');labels.className='of-labels';labels.setAttribute('aria-hidden','true');
  stage.append(canvas,labels);
  let gl,program,buffer;
  try {
    gl=canvas.getContext('webgl',{alpha:true,antialias:true,powerPreference:'low-power'});
    if(!gl)throw Error('No WebGL');
    program=shaderProgram(gl);buffer=gl.createBuffer();
  } catch {canvas.remove();labels.remove();return null;}
  const a={};
  for(const name of ['Position','Normal','Color','Dock'])a[name]=gl.getAttribLocation(program,'a'+name);
  const u={};
  for(const name of ['Camera','Scale','Dock'])u[name]=gl.getUniformLocation(program,'u'+name);
  let camera={...standardCamera},field=null,selection='current',scene,vertices,opaqueCount=0,width=0,height=0;
  let pointers=new Map(),moved=false,paintFrame=0,animFrame=0,lastPosition=null,position=null,destroyed=false;
  let hitNodes=[],hitPaths=[];
  const labelMap=new Map();
  function schedule(){ if(!paintFrame && !destroyed)paintFrame=requestAnimationFrame(()=>{paintFrame=0;paint();}); }
  function geometry(){
    if(!field)return;
    scene=buildScene(field,selection,position);
    vertices=new Float32Array(scene.opaque.length+scene.transparent.length+scene.parked.length);
    vertices.set(scene.opaque);vertices.set(scene.transparent,scene.opaque.length);vertices.set(scene.parked,scene.opaque.length+scene.transparent.length);opaqueCount=scene.opaque.length/11;
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.DYNAMIC_DRAW);
  }
  function paint() {
    if(!scene||destroyed||gl.isContextLost())return;
    width=stage.clientWidth;height=stage.clientHeight;if(!width||!height)return;
    const pixelRatio=Math.min(window.devicePixelRatio||1,2);
    const w=Math.round(width*pixelRatio),h=Math.round(height*pixelRatio);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    for(const [name,count,offset] of [['Position',3,0],['Normal',3,3],['Color',4,6],['Dock',1,10]]){
      gl.enableVertexAttribArray(a[name]);gl.vertexAttribPointer(a[name],count,gl.FLOAT,false,44,offset*4);
    }
    const cy=Math.cos(camera.yaw),sy=Math.sin(camera.yaw),cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch);
    const shelf=scene.parked.length?(compact?31:37):0,plotHeight=height-shelf;
    stage.style.setProperty('--of-shelf',shelf+'px');stage.classList.toggle('of-parked',Boolean(shelf));
    const scale=Math.min(width*(compact?.31:.33),plotHeight*(compact?.37:.39))*camera.zoom;
    const sx=2*scale*4.5/width,syScale=2*scale*4.5/plotHeight;
    const dock=[(20/width)*2-1,shelf/height-1];
    gl.uniform4f(u.Camera,cy,sy,cp,sp);gl.uniform2f(u.Scale,sx,syScale);gl.uniform2f(u.Dock,...dock);
    gl.viewport(0,Math.round(shelf*pixelRatio),w,h-Math.round(shelf*pixelRatio));
    gl.drawArrays(gl.TRIANGLES,0,opaqueCount);
    gl.drawArrays(gl.TRIANGLES,opaqueCount,scene.transparent.length/11);
    if(shelf){
      gl.viewport(0,0,w,h);gl.uniform2f(u.Scale,2*4.5*92/width,2*4.5*92/height);
      gl.drawArrays(gl.TRIANGLES,opaqueCount+scene.transparent.length/11,scene.parked.length/11);
    }
    function project(p,park=false){
      const x=cy*p[0]+sy*p[2],z=-sy*p[0]+cy*p[2],y=cp*p[1]-sp*z,zz=sp*p[1]+cp*z;
      const magnify=4.5/(4.5-zz)*scale;
      return park?[20,height-shelf/2,2,92]:[width/2+x*magnify,plotHeight/2-y*magnify,zz,magnify];
    }
    hitNodes=[];hitPaths=[];
    const currentKeys=new Set(),rects=[];
    const layoutLabel=(id,caption,x,y,className)=>{
      currentKeys.add(id);let el=labelMap.get(id);
      if(!el){el=document.createElement('span');labels.append(el);labelMap.set(id,el);}
      el.textContent=caption;el.className=className;
      const ew=el.offsetWidth,eh=el.offsetHeight;
      const left=clamp(x,5,width-ew-5);let top=clamp(y,2,height-eh-2);
      for(let n=0;n<6 && rects.some(r=>left<r[2]+3&&left+ew>r[0]-3&&top<r[3]+2&&top+eh>r[1]-2);n++){
        top=clamp(y+(n%2===0?1:-1)*(Math.floor(n/2)+1)*(eh+2),2,height-eh-2);
      }
      rects.push([left,top,left+ew,top+eh]);el.style.transform='translate('+left+'px,'+top+'px)';
      return [left,top,left+ew,top+eh];
    };
    for(const node of field.nodes){
      const item=scene.nodes.get(node.id),[x,y,z,s]=project(item.p,item.dock);
      const label=layoutLabel(node.id,item.dock?'Current position · unplaced':node.label,x+item.r*s+5,y-9,'of-node-label');
      hitNodes.push({id:node.id,x,y,z,r:Math.max(12,item.r*s+4),label});
    }
    for(const [i,p] of scene.axes.entries()){
      const [x,y]=project(p);layoutLabel('axis'+i,['X','Y','Z'][i],x-13,y+5,'of-axis-label');
    }
    for(const [id,points] of scene.paths)hitPaths.push({id,points:points.map(p=>project(p))});
    for(const [id,el] of labelMap)if(!currentKeys.has(id)){el.remove();labelMap.delete(id);}
  }
  function hit(x,y){
    const direct=hitNodes.filter(n=>Math.hypot(n.x-x,n.y-y)<=n.r).sort((a,b)=>b.z-a.z)[0];
    if(direct)return direct.id;
    const text=hitNodes.find(n=>x>=n.label[0]&&x<=n.label[2]&&y>=n.label[1]&&y<=n.label[3]);
    if(text)return text.id;
    let distance=9,best=null;
    for(const {id,points} of hitPaths)for(let i=1;i<points.length;i++){
      const [a,b]=[points[i-1],points[i]],dx=b[0]-a[0],dy=b[1]-a[1];
      const t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1),0,1);
      const d=Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);if(d<distance){distance=d;best=id;}
    }
    return best;
  }
  function turn(yaw,pitch){camera.yaw+=yaw;camera.pitch+=pitch;schedule();}
  function zoom(mult){camera.zoom=clamp(camera.zoom*mult,.68,2.05);schedule();}
  const abort=new AbortController();const options={signal:abort.signal};
  if(!compact){
    canvas.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;if(!pointers.size)moved=false;else moved=true;
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY});canvas.setPointerCapture(e.pointerId);
    },options);
    canvas.addEventListener('pointermove',e=>{
      const p=pointers.get(e.pointerId);if(!p)return;
      const oldDistance=pointers.size===2?Math.hypot(...pairDelta(pointers)):0;
      const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
      moved ||= Math.hypot(p.x-p.startX,p.y-p.startY)>4;
      if(oldDistance>3){zoom(Math.hypot(...pairDelta(pointers))/oldDistance);}
      else if(moved)turn(dx*.009,-dy*.009);
    },options);
    canvas.addEventListener('pointerup',e=>{
      if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);
      if(!moved){const r=canvas.getBoundingClientRect();const id=hit(e.clientX-r.left,e.clientY-r.top);if(id)select(id);}
    },options);
    canvas.addEventListener('pointercancel',e=>pointers.delete(e.pointerId),options);
    canvas.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();zoom(Math.exp(-e.deltaY*.008));},{...options,passive:false});
  }
  const ro=new ResizeObserver(schedule);ro.observe(stage);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();onUnavailable();},options);
  return {
    update(next,selected='current'){
      const newPosition=next.current.coordinates;
      const changed=field!==next;
      field=next;selection=selected;
      if(changed){
        cancelAnimationFrame(animFrame);
        const old=position;
        position=newPosition;lastPosition=newPosition;
        if(old && newPosition && old.some((v,i)=>v!==newPosition[i]) && !matchMedia('(prefers-reduced-motion: reduce)').matches){
          const start=performance.now();
          const animate=now=>{const t=clamp((now-start)/270,0,1);position=blend(old,newPosition,t);geometry();schedule();if(t<1)animFrame=requestAnimationFrame(animate);};
          animFrame=requestAnimationFrame(animate);
        }
      }else if(!animFrame)position=lastPosition;
      geometry();schedule();
    },
    turn,zoom,reset(){camera={...standardCamera};schedule();},
    destroy(){destroyed=true;abort.abort();ro.disconnect();cancelAnimationFrame(animFrame);cancelAnimationFrame(paintFrame);
      gl.deleteBuffer(buffer);gl.deleteProgram(program);canvas.remove();labels.remove();}
  };
}
function pairDelta(pointers){const [a,b]=[...pointers.values()];return[a.x-b.x,a.y-b.y];}
