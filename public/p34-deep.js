import { poolWings, draftWings } from './p34-wings.js?v=20261126-playable';
import { LAYER_LABELS } from './p34-journey.js?v=20261126-playable';
import { poolMirror, stepUnseenProp } from './p34-garden.js?v=20261126-playable';

const deck = (id, minX, maxX, minZ, maxZ, yStart, yEnd = yStart) =>
  ({ id, minX, maxX, minZ, maxZ, yStart, yEnd, axis: yStart === yEnd ? 'flat' : '-z', enabled: true });
const thing = (id,label,x,y,z) => ({id,kind:id,label,x,y,z,prompt:'E · 查看'});
const trace = (layer,label,x,y,z) => ({...thing('trace-'+layer,label,x,y,z),kind:'memory-trace',trace:layer});
function door(layer, targetLayer, label, x, floorY, z, direction) {
  return {id:'portal-'+layer+'-'+targetLayer,kind:'portal',targetLayer,label,prompt:'走入',x,y:floorY+1.4,floorY,z,crossing:{z,direction,halfWidth:1.35}};
}
const throat = -8.4, offset = 51;
export function deepConfig(layer, state = {}) {
  const closed = state.phase === 'closed';
  if (layer === 'poolrooms') return {
    id:layer,title:LAYER_LABELS[layer],spawn:{x:0,y:1.8,z:15.8,yaw:0,pitch:0},
    surfaces:[
      deck('upper-baths',-14,14,10,20,1.8), deck('east-loggia',3.2,14,-6,10,1.8),
      deck('west-loggia',-14,-7,0,10,1.8), deck('bathing-steps',-7,3.2,4,10,1.8,-.8),
      deck('basin',-10,9,-7.25,4,-.8), deck('cistern-neck',-1.63,1.63,-11,-7.25,-.8),
      deck('inner-neck',-1.63,1.63,-61.5,-56,-.8), deck('great-bath',-19.5,19.5,-72,-61.5,-.8),
      deck('inner-stairs',-4,4,-76,-67,-.8,2.8), deck('upper-landing',-15,15,-84,-76,2.8),
      deck('east-return-stair',12,15,-76,-66,-.8,2.8),deck('west-return-stair',-15,-12,-76,-66,-.8,2.8),
    ],
    interactables:[door(layer,'atrium','无尽回廊',0,1.8,18,1),door(layer,'stacks','悬渊书库',0,2.8,-81,-1),
      ...(closed ? [trace(layer,'水影余音',-3.8,.13,-1.4)] : [thing('pool-echo','水中的回声',-3.8,.13,-1.4),thing('pool-study','水位草图',5.1,2.76,8.5)])],
  };
  const bridge = deck('draft-flight',-1.68,1.68,-15,-3,0,3);
  bridge.enabled = closed || state.phase === 'after' || state.phase === 'loft';
  return {
    id:layer,title:LAYER_LABELS[layer],spawn:{x:0,y:0,z:13.2,yaw:0,pitch:0},
    surfaces:[deck('drawing-floor',-6.8,6.8,-3,16.8,0),deck('express-landing',6.8,12.3,6.8,15,0),
      deck('west-bench',-13.8,-6.8,2.2,7.6,0),bridge,deck('prototype-island',-6.2,6.2,-27,-15,3),
      deck('balcony-stair',-13.8,-10, -3.2,2.2,0,2.4),deck('balcony',-15.2,-8.7,-9.4,-3.2,2.4)],
    interactables:[door(layer,'stacks','悬渊书库',0,0,15.3,1),door(layer,'loft','观测阁楼',0,3,-24.8,-1),
      ...(['closed','loft','after'].includes(state.phase) || state.layers?.includes('drafts') ? [door(layer,'atrium','回廊折径',9,0,12.4,1)] : []),
      ...(closed ? [trace(layer,'留下的半张纸',-4,1.17,2.8)] : [thing('draft-note','折痕边的批注',-4,1.17,2.8),thing('prototype','未完成的试拱',0,4.3,-19.1)])],
  };
}

export function deepCrossing(layer, before, next) {
  if (layer !== 'poolrooms' || next.y>1.4 || next.y< -1.4 || Math.abs(next.x)>1.58) return null;
  if (before.z>throat && next.z<=throat) return {...next,z:next.z-offset};
  if (before.z<throat-offset && next.z>=throat-offset) return {...next,z:next.z+offset};
  return null;
}

// One continuous crown with solid haunches, not a collection of separate pillars and decorative hoops.
function arcade(T, span, spring, thickness, depth, cap = .4) {
  const r=span/2, e=r+thickness, top=spring+r+cap, s=new T.Shape();
  s.moveTo(-e,0); s.lineTo(-e,top); s.lineTo(e,top); s.lineTo(e,0); s.lineTo(r,0);
  s.lineTo(r,spring); s.absarc(0,spring,r,0,Math.PI,false); s.lineTo(-r,0); s.closePath();
  const g=new T.ExtrudeGeometry(s,{depth,curveSegments:12,bevelEnabled:false});
  g.userData.pierced=true;g.translate(0,0,-depth/2); return g;
}
function batch(T, parent, geometry, mat, placements) {
  const m = new T.InstancedMesh(geometry,mat,placements.length), o = new T.Object3D();
  placements.forEach(([x,y,z,ry=0,sx=1,sy=1,sz=1,rz=0],i)=>{
    o.position.set(x,y,z); o.rotation.set(0,ry,rz); o.scale.set(sx,sy,sz); o.updateMatrix(); m.setMatrixAt(i,o.matrix);
  });
  m.receiveShadow=true; m.userData.solid=true;parent.add(m);return m;
}

function tiles(T, renderer) {
  const canvas=document.createElement('canvas'); canvas.width=canvas.height=256;
  const c=canvas.getContext('2d'); c.fillStyle='#a9bcb5'; c.fillRect(0,0,256,256);
  for(let i=0;i<8;i++)for(let j=0;j<8;j++){
    c.fillStyle=['#e8eee4','#e1e8df','#e5eae1','#ebefe7'][(i*13+j*11+i*j)%4];
    c.fillRect(i*32+1,j*32+1,30.7,30.7);
    c.fillStyle='#f4f6ed';c.fillRect(i*32+1,j*32+1,30.7,1);
  }
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;
  tex.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return tex;
}

function balconies(T,parent,surfaces,mat,edgeMat,omit) {
  const slabs=[],noses=[];
  for(const s of surfaces){
    if(omit.includes(s.id))continue;
    const w=s.maxX-s.minX,d=s.maxZ-s.minZ,x=(s.maxX+s.minX)/2;
    if(s.axis==='flat'){
      slabs.push([x,s.yStart-.24,(s.maxZ+s.minZ)/2,0,w,.48,d]);
      continue;
    }
    const n=Math.ceil(Math.abs(s.yEnd-s.yStart)/.19);
    for(let i=0;i<n;i++){
      const z=s.maxZ-(i+.5)*d/n,y=s.yStart+(s.yEnd-s.yStart)*(i+.5)/n;
      slabs.push([x,y-.2,z,0,w,.4,d/n+.012]);
      noses.push([x,y-.055,z+d/n*.49,0,w,.09,.055]);
    }
  }
  const cube=new T.BoxGeometry(); const decks=batch(T,parent,cube,mat,slabs);decks.castShadow=true;
  if(noses.length)batch(T,parent,cube,edgeMat,noses);
}

// World-space ceramic glaze keeps the grout the same size on a stair and a 16m arcade.
function glaze(T,map,color,software=false) {
  const mat=software ? new T.MeshLambertMaterial({color,map}) : new T.MeshStandardMaterial({color,map,roughness:.43,metalness:.05});
  mat.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 tilePoint; varying vec3 tileNormal;')
      .replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
        vec4 tileWorld=vec4(transformed,1.);
        vec3 tileN=objectNormal;
        #ifdef USE_INSTANCING
        tileWorld=instanceMatrix*tileWorld;tileN=mat3(instanceMatrix)*tileN;
        #endif
        tilePoint=(modelMatrix*tileWorld).xyz;tileNormal=normalize(mat3(modelMatrix)*tileN);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 tilePoint; varying vec3 tileNormal;')
      .replace('#include <map_fragment>',`vec3 n=abs(normalize(tileNormal));vec2 ceramic=n.y>.65?tilePoint.xz:(n.x>n.z?tilePoint.zy:tilePoint.xy);
        diffuseColor *= texture2D(map,ceramic*.47);`);
  };
  return mat;
}
function skylight(T,scene,pool,software) {
  const fog=pool?0xb5d6ce:0xc9aa9a;
  scene.background=new T.Color(fog);scene.fog=new T.FogExp2(fog,pool?.0097:.012);
  scene.environmentIntensity=pool?.34:.30;
  scene.add(new T.HemisphereLight(pool?0xe1f9fa:0xf1e6df,pool?0x7eaaa5:0x9f94a1,pool?1.58:1.35));
  const sun=new T.DirectionalLight(pool?0xfff6d4:0xffddba,pool?2.35:2.8);
  sun.position.set(pool?-24:-29,pool?32:19,pool?12:17);scene.add(sun,sun.target);
  sun.castShadow=true; sun.shadow.mapSize.setScalar(software?768:1536);
  Object.assign(sun.shadow.camera,{left:-48,right:48,top:45,bottom:-45,near:.1,far:132});sun.shadow.bias=-.0004;
  sun.shadow.normalBias=.05;sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;
  // The sky should grow lighter toward the opening without a fog card cutting off the architecture.
  const sky=new T.Mesh(new T.SphereGeometry(214,24,12),new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,fog:false,uniforms:{horizon:{value:new T.Color(fog)},zenith:{value:new T.Color(pool?0x739da6:0x9b8694)}},
    vertexShader:'varying vec3 ray;void main(){ray=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 ray;uniform vec3 horizon;uniform vec3 zenith;
      void main(){float h=normalize(ray).y;gl_FragColor=vec4(mix(horizon,zenith,smoothstep(0.,.75,h)),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`}));
  sky.renderOrder=-10;scene.add(sky);
  return sun;
}

function baths({THREE:T,scene,renderer,software,config,building,reduced}) {
  const outer=new T.Group(),inner=new T.Group();scene.add(outer,inner);
  const sun=skylight(T,scene,true,software);
  const map=tiles(T,renderer),white=glaze(T,map,0xe4eee0,software),celadon=glaze(T,map,0x87b2aa,software);
  const blue=glaze(T,map,0x527f83,software),limestone=new T.MeshStandardMaterial({color:0xdcddc8,roughness:.86});
  const bronze=new T.MeshStandardMaterial({color:0x9a7353,roughness:.46,metalness:.44});
  const foam=new T.MeshStandardMaterial({color:0xe6f0d8,emissive:0xb9e4d7,emissiveIntensity:.44});
  const cube=new T.BoxGeometry(), great=arcade(T,12.4,3.4,1.8,2.0,.85);
  const front=config.surfaces.filter(s=>s.maxZ>-40), rear=config.surfaces.filter(s=>s.maxZ<-40);
  balconies(T,outer,front,white,blue,[]);balconies(T,inner,rear,white,blue,[]);
  poolWings(T,outer,inner,building,white,celadon,arcade);
  const pool=poolMirror(T,77,150,software,0x71b4a8);
  pool.position.set(0,-.43,-47);scene.add(pool);
  const ring=(parent,x,y,z,r,tube,mat)=>{
    const m=new T.Mesh(new T.TorusGeometry(r,tube,8,64),mat);m.rotation.x=-Math.PI/2;m.position.set(x,y,z);parent.add(m);return m;
  };
  function portal(parent,x,y,z,span,spring) {
    building.arch(x,y,z,span,spring,.32,1,0,white,parent);
    building.arch(x,y,z+.55,span+.1,spring,.10,.17,0,blue,parent);
  }
  function neck(parent,z){
    // Identical wet ceramic lining on both sides of the impossible cut.
    for(const x of [-1.87,1.87])building.box(.47,3.55,3.8,x,.89,z,celadon,parent);
    for(const dz of [-1.72,0,1.72])building.arch(0,-.8,z+dz,3.26,1.73,.31,1.28,0,white,parent);
    building.box(4.18,.43,4.05,0,2.96,z,white,parent);
    for (const x of [-1.62,1.62])building.box(.1,.12,3.8,x,.03,z,blue,parent);
  }
  neck(outer,throat);neck(inner,throat-offset);
  portal(outer,0,1.8,18,3.2,1.85);portal(inner,0,2.8,-81,3.2,1.85);
  const terraces=[],caps=[],piers=[],outerArc=[];
  // Cross-courts of warm glazed concrete, with low water cutting beneath the second gallery.
  for(const side of [-1,1]){
    for(let i=-1;i<=3;i++){
      const z=6-i*16,x=side*20;
      const at=-1.8+(side===1 && i>1?3.7:0),h=side===-1 && i<2?.88:1;
      if(side===-1 && i>=0 && i<=1)continue; // Leave the western bell court and grotto entrance open.
      outerArc.push([x,at,z,Math.PI/2,1,h,1]);
      terraces.push([x,-.65,z,0,7.8,1.02,16.03]);caps.push([x,at+10.45*h+.15,z,0,4.5,.32,16]);
      if(i%2===0)outerArc.push([side*44,3.3,z-5,Math.PI/2]);
    }
    for(let j=0;j<2;j++){
      const z=-33-j*27;
      for(let i=-2;i<=2;i++) {
        if(j===0 && i===0)continue;
        if(side===-1)outerArc.push([i*16+6,-2+(j%2)*4,z,0,1,1+(j%2)*.22,1]);
      }
      piers.push([side*(41+j*6),4.5+j*1.2,z+7,0,4,19+j*2,6]);
    }
  }
  batch(T,outer,great,white,outerArc).castShadow=true;
  batch(T,outer,cube,limestone,terraces).castShadow=true;
  batch(T,outer,cube,celadon,caps);batch(T,outer,cube,celadon,piers);
  // Offset diving tower: two walk-in openings and a cantilever reflected against the long west arcade.
  batch(T,outer,arcade(T,6.4,4.1,1.3,4,.75),celadon,[[10,-1.1,-17,.2],[10,7.25,-17,.2,1,.76,1]]);
  batch(T,outer,cube,white,[[10,13.62,-17,.2,10,.42,6.3],[7,7.25,-15,.2,13,.35,4]]);
  // The reservoir's daylight drum: a curved crest behind the low entry court, with a visible open oculus.
  const drum=new T.Group();drum.position.set(-18,1.85,-52);outer.add(drum);
  const drumR=10, bays=12, facets=[];
  for(let i=0;i<bays;i++){
    const a=i*Math.PI*2/bays;
    facets.push([Math.sin(a)*drumR,0,Math.cos(a)*drumR,a]);
  }
  batch(T,drum,arcade(T,4.1,6.6,.57,.91,2),white,facets).castShadow=true;
  const crown=(radius,y,h,mat)=>{
    const m=new T.Mesh(new T.CylinderGeometry(radius,radius,h,48,1,true),mat);
    m.position.y=y;drum.add(m);
  };
  crown(10.86,10.66,.68,limestone);crown(10.59,11.14,.29,blue);
  const domeMat=new T.MeshStandardMaterial({color:0xa2b9ab,roughness:.58,metalness:.17,side:T.DoubleSide});
  const shell=new T.Mesh(new T.SphereGeometry(10.66,48,20,0,Math.PI*2,.27,1.29),domeMat);
  shell.scale.y=.71;shell.position.y=10.9;drum.add(shell);
  for(const a of [0,1,2,3,4,5,6,7]){
    const path=[];for(let j=0;j<18;j++){
      const phi=.27+j/17*1.29;path.push(new T.Vector3(Math.sin(phi)*Math.cos(a*Math.PI/4)*10.72,10.91+Math.cos(phi)*7.61,Math.sin(phi)*Math.sin(a*Math.PI/4)*10.72));
    }
    const rib=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(path),16,.065,5,false),limestone);drum.add(rib);
  }
  for(const [r,y,t] of [[10.79,11.32,.14],[2.86,18.23,.16]])ring(drum,0,y,0,r,t,white);
  const drums=[];for(const side of [-1,1])for(let bay=0;bay<5;bay++){
    drums.push([side*8.6,1.45,8.6-bay*5.2,Math.PI/2,1,.96,1]);
  }
  // A roofed walk sits on the far bank, below the domed water tower.
  batch(T,outer,arcade(T,4.6,1.8,.30,.9,.48),white,drums.filter(a=>a[0]<0 && a[2]<2).map(a=>[a[0]-.5,-.7,a[2],...a.slice(3)]));
  batch(T,outer,cube,blue,[[10,5.99,-18,.2,8.7,.22,4.45],[10,10.70,-18,.2,9.32,.19,4.62]]);
  for(const x of [-1.38,1.38])building.box(.085,.13,3.26,x,.05,throat,blue,outer);
  // The study is ink on a folded ceramic tile, held just above the upper bath.
  building.slab(1.6,.12,.8,5.1,2.67,8.5,white,outer);
  for(const x of [4.6,5.6])building.slab(.19,.81,.64,x,2.205,8.5,celadon,outer);
  building.box(.85,.04,.54,5.07,2.752,8.5,bronze,outer);
  building.box(.76,.016,.46,5.07,2.781,8.5,limestone,outer);
  for(let i=0;i<3;i++)building.box(.48-i*.07,.009,.017,5.06,2.794,8.4+i*.08,blue,outer);
  const watermark=ring(outer,-3.8,-.405,-1.4,.51,.026,foam);
  const tuning=new T.Mesh(new T.TorusGeometry(.29,.031,7,40,Math.PI*1.6),bronze);
  tuning.rotation.set(.64,.42,.51);tuning.position.set(-3.8,-.22,-1.4);outer.add(tuning);
  const float=new T.Group();outer.add(float);float.position.set(6.2,-.77,-2.6);
  building.arch(0,0,0,1.65,.74,.28,.66,0,celadon,float);building.box(2.48,.34,1.35,0,.15,0,blue,float);
  float.userData.movingSolid=true;
  const prop={x:6.2,z:-2.6,variant:0,phase:'unseen'};
  // The inner reservoir opens in both axes: wide vaults overhead, three storeys of arcades across the water.
  const innerRows=[],outerRows=[],ribs=[],barrels=[], clerestories=[];
  for(let row=-1;row<=5;row++){
    const z=-66-row*10;
    if(row>=0){innerRows.push([0,-1.3,z,0]);ribs.push([0,-1.28,z+.84,0,1.025,.998,.19]);
      barrels.push([0,5.2,z-5,0]);clerestories.push([8.07,4.6,z-5,Math.PI/2],[-8.07,4.6,z-5,Math.PI/2]);}
    for(const side of [-1,1])for(let bay=0;bay<4;bay++){
      const x=side*(23+16*bay);
      outerRows.push([x,-1.9,z,0]);if(row%2===0)outerRows.push([x,9.5,z,0,1,.61,.9]);
    }
  }
  const vault=arcade(T,13.35,6.5,2.68,1.65,1.65);
  batch(T,inner,vault,white,innerRows).castShadow=true;batch(T,inner,vault,celadon,ribs);
  batch(T,inner,great,celadon,outerRows);
  // Short lengths of a barrel roof leave real slots for daylight and turn the caustic hall into a vaulted interior.
  const barrelMat=glaze(T,map,0xbcd0c2,software);barrelMat.side=T.DoubleSide;
  const barrel=new T.CylinderGeometry(6.8,6.8,7.65,32,1,true,-Math.PI/2,Math.PI);
  barrel.rotateX(-Math.PI/2);batch(T,inner,barrel,barrelMat,barrels).castShadow=true;
  batch(T,inner,arcade(T,8.1,.45,.94,.98,1.0),white,clerestories);
  const cisternCoping=[];
  for(const sign of [-1,1])for(let i=0;i<5;i++){
    cisternCoping.push([sign*16.6,-.13,-67-i*10,0,4.2,.36,9.82]);
  }
  batch(T,inner,cube,blue,cisternCoping);

  // Skylight strips terminate the vault on one side; gaps throw broad bands of light, not emissive outlines.
  for(const side of [-1,1]){
    batch(T,inner,cube,celadon,[[-8.8*side,-.39,-76,0,1.7,.95,38],[side*9.35,13.8,-84,0,2.7,1.2,47]]);
  }
  let elapsed=0, inside=false,shift=0;
  return {update(dt,p){
    if(inside!==(p.z<-55)){
      inside=p.z<-55;sun.target.position.z=inside?-68:0;sun.position.z=sun.target.position.z+7;sun.shadow.needsUpdate=true;
    }
    stepUnseenProp(prop,p);
    if(prop.variant){
      shift=Math.min(1,shift+dt*1.55);const k=shift*shift*(3-2*shift);
      float.position.x=6.2+1.2*k;float.rotation.y=Math.PI/2*k;
    }
    if(!reduced()){elapsed+=dt;pool.material.uniforms.clock.value=elapsed;watermark.scale.setScalar(1+.1*Math.sin(elapsed*1.9));}
  },snapshot:()=>({cistern:inside,prop:prop.phase}),dispose(){pool.dispose();}};
}

// Seen from the raised drafting bench the two out-of-register flights become one ink stroke.
export function stepDraftFlight(flight, p) {
  if (flight.open) return false;
  const dx=-p.x,dz=3-p.z,d=Math.hypot(dx,dz);
  const gaze=(-Math.sin(p.yaw)*dx-Math.cos(p.yaw)*dz)/Math.max(.01,d);
  if(d<13 && gaze>.7 && !flight.seen)flight.seen={x:p.x,z:p.z};
  if(!flight.seen || d>15)return false;
  const from=flight.seen;
  const crossedFlank = Math.abs(p.x)>2.2 && p.z<4.7 &&
    Math.hypot(p.x-from.x,p.z-from.z)>2.5;
  if(!crossedFlank && gaze>-.3)return false;
  flight.open=true;return true;
}
function drafts({THREE:T,scene,software,config,building,reduced}) {
  const sun=skylight(T,scene,false,software);
  draftWings(T,scene,building);
  const matte=(color,roughness,metalness=0,side=T.FrontSide)=>software ? new T.MeshLambertMaterial({color,side}) : new T.MeshStandardMaterial({color,roughness,metalness,side});
  const canvas=matte(0xe4c5ae,.87), ink=matte(0x474652,.74,.17), oxide=matte(0xa0503c,.71),
    edge=matte(0xf2d7b9,.69), slate=matte(0x726679,.92), paper=matte(0xffe6bb,.95,0,T.DoubleSide);
  const cube=new T.BoxGeometry(),rock=new T.IcosahedronGeometry(1,0);
  // Drafting board, not an unmarked primitive: scattered fibres and the faint ruled edge of real sheets.
  const board=document.createElement('canvas');board.width=board.height=256;
  const brush=board.getContext('2d');brush.fillStyle='#f8f4e7';brush.fillRect(0,0,256,256);
  for(let i=0;i<620;i++){
    const x=(i*181+i*i*3)%256,y=(i*73+i*i*7)%256;
    brush.fillStyle=i%3?'#bcab9352':'#fff9ed77';brush.fillRect(x,y,1+(i%5),1.15);
  }
  brush.strokeStyle='#bda78d';brush.lineWidth=.78;
  brush.beginPath();brush.moveTo(0,80);brush.lineTo(73,79);brush.lineTo(103,80);brush.stroke();
  brush.beginPath();brush.moveTo(97,62);brush.lineTo(97,92);brush.stroke();
  const map=new T.CanvasTexture(board);map.wrapS=map.wrapT=T.RepeatWrapping;map.colorSpace=T.SRGBColorSpace;
  const boardMat=glaze(T,map,0xe5d6c2,software);
  if(!software){boardMat.roughness=.96;boardMat.metalness=0;}
  balconies(T,scene,config.surfaces,boardMat,oxide,['draft-flight']);
  // She kept the offcuts underneath the islands: blade-like hanging counterweights, strata and gussets.
  const footings=[],lamina=[],girders=[];
  for(const [x,z,w,d,h] of [[0,6.9,13.6,19.8,0],[0,-21,12.4,12,3],[-11.96,-6.3,6.4,6.2,2.4],
    [-10.3,5,7,5.3,0],[9.4,10.9,5.4,8.2,0]]){
    lamina.push([x,h-.66,z,0,w*.985,.35,d*.96],[x+.15,h-1.07,z-.15,0,w*.88,.27,d*.91]);
    for(const s of [-1,1]){
      footings.push([x+s*w*.24,h-6.9,z+.4, .18+s*.14,w*.25,5.1,d*.3,s*.12]);
      girders.push([x+s*w*.34,h-1.45,z,0,.36,1.5,d*.92]);
    }
  }
  batch(T,scene,cube,oxide,lamina);batch(T,scene,cube,ink,girders);batch(T,scene,rock,slate,footings);
  const frames=[],redFrames=[],islands=[],shards=[],bones=[],notes=[];
  for (let i=0;i<46;i++){
    const a=i*2.399+.23,r=27+((i*31)%117);
    const x=Math.cos(a)*r, z=-16+Math.sin(a)*r, level=-4+(i*17%30)-i%3*6;
    const w=6+(i*9%19),d=4+(i*7%12),ry=i*.83;
    islands.push([x,level-1.5,z,ry,w,2.6,d], [x,level-3.55,z,ry,w*.85,1.25,d*.83]);
    if(i%3===0){bones.push([x,level-12,z,ry,.9,22,d*.56]);}
    else {shards.push([x,level-7,z,ry,w*.49,7.6+i%6,d*.5,-.13+i%4*.065]);}
    const sc=w*.115+.29;
    (i%4===0?redFrames:frames).push([x,level-.1,z,ry,sc,sc*(1+i%4*.32),sc,-.23+i%7*.071]);
    if(i%5===0) notes.push([x-.8,level+9,z+1.3,ry,2.4,.10,4.2,.26]);
  }
  const arch=arcade(T,4.15,3.1,.78,.94,.65);
  batch(T,scene,cube,canvas,islands);batch(T,scene,rock,slate,shards);
  batch(T,scene,cube,ink,bones);batch(T,scene,arch,edge,frames);batch(T,scene,arch,oxide,redFrames);batch(T,scene,cube,paper,notes);
  // One unfinished aqueduct disappears below the clouds. Its missing middle bay is visible from the game's bridge.
  const aqueduct=[];for(let j=-6;j<=7;j++)if(j!==0 && j!==1)aqueduct.push([8+j*9,-14.5,-34-j*.95,.11,1.82,2.34,1.7]);
  batch(T,scene,arch,oxide,aqueduct);
  // Folded full-scale study on a remote island. The paired creases read as paper even in silhouette.
  const study=new T.Group();study.position.set(-14,3.8,-30);study.rotation.y=-.42;scene.add(study);
  const fan=[];
  function leaf(vertices,material){
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices.flat(),3));geo.computeVertexNormals();
    const mesh=new T.Mesh(geo,material);mesh.castShadow=true;mesh.receiveShadow=true;study.add(mesh);
  }
  const paperShade=matte(0xbc987d,.94,0,T.DoubleSide);
  const crease=new T.MeshStandardMaterial({color:0x524956,roughness:.86});
  for(let i=0;i<7;i++){
    const x=-6+i*1.8,h=[6.4,9.0,12.6,14.8,13.3,10.5,7.7][i],z=Math.sin(i*.53)*1.3;
    const base=[x-2,-.2,z-.2],foot=[x+.8,-.1,z+2.3],ridge=[x+.64,h,z-1.0],wing=[x+3.4,h*.72,z-3.3];
    leaf([base,foot,ridge],paper);leaf([foot,wing,ridge],paperShade);
    const p1=new T.Vector3(...foot),p2=new T.Vector3(...ridge),length=p1.distanceTo(p2);
    const spine=new T.Mesh(new T.CylinderGeometry(.035,.045,length,5),crease);
    spine.position.copy(p1).lerp(p2,.5);spine.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),p2.sub(p1).normalize());study.add(spine);
    fan.push([x*.92,-.44,0,0,1.88,.62,6.7,0]);
  }
  batch(T,study,cube,edge,fan);
  batch(T,study,cube,slate,[[0,-4.84,0,0,15.8,8.15,5.92]]);
  const openFrame=(x,y,z,width,height,mat,yaw=0)=>building.arch(x,y,z,width,height,.36,.82,yaw,mat);
  openFrame(0,0,15.3,3.15,1.65,canvas);
  if(config.interactables.some(t=>t.targetLayer==='atrium'))openFrame(9,0,12.4,3.1,1.6,oxide);
  else {
    building.box(.4,2.8,.7,7.42,1.4,12.4,oxide);building.box(.4,1.48,.7,10.58,.74,12.4,oxide);
  }
  openFrame(0,3,-24.8,3.2,2.25,canvas);
  // Central study: two cut steel blades, held apart by a pale crown and lined on the inside.
  for(const s of [-1,1]){
    building.box(.72,5.35,1.55,s*1.5,2.675,3,oxide);
    building.box(.105,5.26,1.60,s*1.74,2.63,3,edge);
    for(const y of [1.3,2.65,4.02])building.box(.50,.036,.045,s*1.5,y,3.786,edge);
    building.box(.095,5.23,1.48,s*1.105,2.61,3,ink);
    building.box(.94,.19,1.73,s*1.5,.095,3,slate);
  }
  const skeleton=building.arch(0,0,3,2.29,4.67,.15,1.35,0,edge);
  skeleton.castShadow=true;
  building.box(4.35,.76,1.67,-.32,5.53,3,oxide);
  building.box(4.8,.15,1.87,-.54,5.97,3,edge);
  building.box(3.65,.12,1.50,-.88,6.13,2.9,paper);
  building.box(.27,1.47,1.67,-2.02,5.03,3,oxide);
  const sheet=building.box(1.15,.023,.65,-4,.956,2.8,paper);
  sheet.rotation.y=-.11;building.desk(-4,0,2.8,1.49,.85,.93,ink,oxide);
  for(let i=0;i<4;i++)building.box(.72-i*.12,.008,.016,-4,.977,2.6+i*.086,oxide);
  // Fixed tracing pins beside both versions; the carved model is half an arch short of meeting.
  building.desk(0,3,-19.1,2.15,.96,.96,ink,oxide);
  const proto1=building.arch(-.2,3.96,-19.1,.9,.32,.08,.18,.12,paper);
  const proto2=building.arch(.08,3.96,-19.38,1.08,.44,.07,.12,-.38,oxide);
  proto1.rotation.z=-.08;proto2.rotation.z=.15;
  const flight=config.surfaces.find(s=>s.id==='draft-flight'),run=new T.Group();scene.add(run);
  const stairs=[];
  const rise=3/18,going=12/18;
  for(let half=0;half<2;half++){
    const beam=new T.Group();beam.userData.movingSolid=true;run.add(beam);stairs.push(beam);
    const treads=[];
    for(let j=0;j<9;j++) treads.push([0,(j+.5)*rise-.12,-(j+.5)*going,0,3.36,.24,going+.015]);
    batch(T,beam,cube,edge,treads).castShadow=true;
    batch(T,beam,cube,ink,[-1,1].map(sign=>[sign*1.12,.33,-3,0,.19,.98,6]));
  }
  const move={open:flight.enabled,seen:null};let t=move.open?1:0;
  const place=()=>{
    const k=t*t*(3-2*t);
    stairs.forEach((beam,i)=>{
      const side=i?1:-1;
      beam.position.set(side*(1-k)*3.1,i*1.5+(1-k)*(i?.8:-1.6),-3-i*6);
      beam.rotation.set((1-k)*side*.2,(1-k)*side*.57,(1-k)*side*.4);
    });
  };
  place();
  return {update(dt,p){
    stepDraftFlight(move,p);
    if(move.open && t<1){
      t=reduced()?1:Math.min(1,t+dt*.9);place();
      sun.shadow.needsUpdate=true;
      if(t===1)flight.enabled=true;
    }
  },snapshot:()=>({bridgeAligned:flight.enabled,monolithSeen:Boolean(move.seen)}), dispose(){}};
}

export function populateDeep(options) {
  return options.layer==='poolrooms'?baths(options):drafts(options);
}
