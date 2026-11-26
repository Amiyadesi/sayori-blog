import { LINES } from './p34-script.js?v=20261126-playable';
import { canEnterLayer, isSilenced } from './p34-journey.js?v=20261126-playable';

const ease = t => t*t*(3-2*t);
const clamp = n => Math.max(0, Math.min(1,n));
const near = (p,t,r) => Math.hypot(p.x-t.x,p.z-t.z)<r && Math.abs(p.y-t.y)<2;
const accents = { ivory:0xffefd1, jade:0x6fead4, gold:0xffc677 };
const voice = LINES.garden;

// The glider follows walkable space, not a line through the nearest wall. The route is
// sampled only on release; keep the best reachable landing when a door is on another level.
export function guideRoute(start,goal,physics) {
  const cell=1.15, endY=goal.floorY??goal.y;
  const estimate=p=>Math.hypot(p.x-goal.x,p.z-goal.z,(p.y-endY)*1.1);
  const startNode={x:start.x,y:start.y,z:start.z,i:0,j:0,cost:0};
  const open=[startNode], seen=new Map([['0/0/'+Math.round(start.y),0]]);
  let best=startNode;
  const directions=[[0,-1],[1,0],[0,1],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]];
  for(let work=0;open.length && work<2200;work++){
    let k=0;
    for(let i=1;i<open.length;i++) if(open[i].rank<open[k].rank)k=i;
    const at=open[k];open[k]=open[open.length-1];open.pop();
    if(estimate(at)<estimate(best))best=at;
    if(Math.hypot(at.x-goal.x,at.z-goal.z)<1.65 && Math.abs(at.y-endY)<1.25){best=at;break;}
    for(const [di,dj] of directions){
      const i=at.i+di,j=at.j+dj,x=start.x+i*cell,z=start.z+j*cell;
      const cost=at.cost+Math.hypot(di,dj)*cell;
      const mid=physics.support((at.x+x)/2,(at.z+z)/2,at.y+.48,.2);
      if(!mid || mid.y<at.y-.8 || physics.blocked((at.x+x)/2,(at.z+z)/2,mid.y+.04,1.5,.24))continue;
      const floor=physics.support(x,z,mid.y+.48,.22);
      if(!floor || floor.y<mid.y-.8 || physics.blocked(x,z,floor.y+.04,1.5,.27))continue;
      const key=i+'/'+j+'/'+Math.round(floor.y*2)/2;
      if((seen.get(key)??Infinity)<=cost)continue;
      seen.set(key,cost);
      const q={i,j,x,y:floor.y,z,cost,prev:at};
      q.rank=cost+estimate(q)*1.35;open.push(q);
    }
  }
  const route=[];
  for(let node=best;node;node=node.prev)route.push({x:node.x,y:node.y+1.45,z:node.z});
  return route.reverse();
}

export function createPlayroom({THREE:T,scene,camera,config,state,readState=()=>state,building:b,audio,say,memory,reduced}) {
  const id=config.id, quiet=isSilenced(state,id);
  const record=memory[id]??={};
  const root=new T.Group(); root.name='play-'+id; scene.add(root);
  const pearl=new T.MeshStandardMaterial({color:accents.ivory,roughness:.53,metalness:.14});
  const brass=new T.MeshStandardMaterial({color:0xb8834b,metalness:.53,roughness:.36});
  const jade=new T.MeshStandardMaterial({color:0x8cf0d2,emissive:0x36c5ad,emissiveIntensity:.72,roughness:.24,metalness:.15});
  const luminous=color=>new T.MeshBasicMaterial({color,toneMapped:false,side:T.DoubleSide});
  const soft=luminous(accents.ivory), mint=luminous(accents.jade);
  function group(parent=root,moving=false) {
    const g=new T.Group();g.userData.movingSolid=moving;parent.add(g);return g;
  }
  function mesh(g,m,x,y,z,parent=root) {
    const o=new T.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o;
  }
  function torus(radius,tube,x,y,z,mat,parent=root) {
    const m=mesh(new T.TorusGeometry(radius,tube,6,40),mat,x,y,z,parent);
    m.rotation.x=-Math.PI/2;return m;
  }
  function solidBox(name,w,h,d,x,y,z,mat,parent=root,surface='stone') {
    const m=b.box(w,h,d,x,y,z,mat,parent);
    return b.solid(m,{id:name,material:surface});
  }
  function cylinder(name,r1,r2,h,x,y,z,mat,parent=root) {
    const m=mesh(new T.CylinderGeometry(r1,r2,h,16),mat,x,y,z,parent);
    b.solid(m,{id:name,material:'stone'});return m;
  }
  function target(name,label,prompt,x,y,z) {
    const t={id:name,kind:name,label,prompt:'E · '+prompt,x,y,z};config.interactables.push(t);return t;
  }
  let time=0,block,socket,blockTarget,socketTarget,held=false,pickup=null,flight=null;
  let bridge=[],rise=record.placed?1:0,playedSegments=0,turntable,wheel;
  let turn=record.aligned?1:0,gate,open=record.bellsOpen?1:0,lastBell=-1;
  const bells=[];
  const floorY=id==='poolrooms'?-.8:0;
  const zBridge=id==='poolrooms'?-3:10.9;

  if(!quiet && (id==='poolrooms'||id==='drafts')){
    const pool=id==='poolrooms';
    const bx=pool?-7.35:8.55,bz=pool?-3:9,sx=pool?-11.1:11.15,sz=pool?-3:9.5;
    solidBox('key-stand',.96,.3,.96,bx,floorY+.15,bz,b.paint);
    block=group(root,true);block.scale.setScalar(.73);
    // A split voussoir, not a floating UI gem. Both halves carry their bevel in profile.
    const profile=new T.Shape();
    profile.moveTo(-.26,-.22);profile.lineTo(.18,-.22);profile.lineTo(.32,.16);
    profile.lineTo(.18,.26);profile.lineTo(-.21,.26);profile.lineTo(-.3,.14);profile.closePath();
    const geo=new T.ExtrudeGeometry(profile,{depth:.42,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:1,steps:1});
    geo.translate(0,0,-.21);
    const glass=jade.clone();glass.color.setHex(0x4da99b);glass.emissiveIntensity=.39;
    const stone=mesh(geo,glass,0,0,0,block);b.solid(stone,{id:'keystone',material:'glass'});
    for(const z of [-.238,.238]){
      const seam=mesh(new T.BoxGeometry(.021,.45,.012),soft,-.10,.01,z,block);seam.rotation.z=.28;
    }
    for(const z of [-.241,.241]){
      const seal=mesh(new T.TorusGeometry(.09,.012,6,5),brass,.07,-.025,z,block);seal.rotation.z=.32;
    }
    block.add(new T.PointLight(0x82f3d5,2.8,3.4,2));
    socket=group();socket.position.set(sx,floorY+(pool?.4:0),sz);
    if(pool)solidBox('socket-dais',1.48,.4,1.44,sx,floorY+.2,sz,b.floor);
    solidBox('socket-foot',1.24,.13,1.24,0,.065,0,b.metal,socket);
    const lip=torus(.44,.047,0,.145,0,jade,socket);
    lip.geometry.rotateZ(Math.PI/4);torus(.59,.016,0,.14,0,soft,socket);
    for(const side of [-1,1])solidBox('socket-jaw',.095,.21,.53,side*.28,.18,0,b.paint,socket);
    const home=record.placed?{x:sx,y:socket.position.y+.328,z:sz}:record.block??{x:bx,y:floorY+.5,z:bz};
    block.position.set(home.x,home.y,home.z);
    if(!record.placed){
      blockTarget=target('keystone','发光的拱心石','拿起',home.x,home.y,home.z);
      socketTarget=target('keystone-socket','缺了一角的石座','查看',sx,socket.position.y+.32,sz);
    }
    if(pool){
      solidBox('bell-bank',3.25,.48,4.9,-11.56,floorY-.24,zBridge,b.floor);
    }
    // Four real leaves of stone lift into the gap, each bottom edge still visible from below.
    const width=pool?1.38:1.25,first=pool?-13.16:12.25,sgn=pool?-1:1;
    for(let i=0;i<4;i++){
      const g=group(root,true);
      g.position.set(first+sgn*width*(i+.5),0,zBridge);
      solidBox('key-bridge-'+i,width+.025,.23,1.72,0,-.115,0,pearl,g);
      for(const side of [-1,1])mesh(new T.BoxGeometry(width*.88,.018,.035),mint,0,.008,side*.72,g);
      bridge.push(g);
    }
    playedSegments=record.placed?bridge.length:0;
    if(pool){
      // Shallow water below the bells, deep water below the separate retractable crossing.
      solidBox('bell-bath',7.85,.38,4.9,-22.55,-1.35,-3,b.floor);
      // A low west cloister turns the distant water horizon into a sequence of framed courtyards.
      for(const side of [-1,1]){
        const z=-3+side*3.18;
        for(const x of [-13.3,-18.65,-24]){
          b.arch(x,-.82,z,4.56,1.83,.4,.52,0,b.plaster,root);
          solidBox('bell-coping',5.37,.21,.65,x,3.49,z,b.edge);
          solidBox('bell-plinth-course',5.37,.28,.62,x,-.47,z,b.paint);
        }
        solidBox('bell-waterline',15.95,.058,.69,-18.64,-.29,z,brass);
      }
      for(const x of [-15.15,-24.8]){
        b.arch(x,-.82,-3,5.53,1.83,.39,.57,Math.PI/2,b.floor,root);
        solidBox('bell-roof',2.1,.32,6.9,x,4.21,-3,b.floor);
      }
      for(let i=0;i<5;i++){
        const x=-19.17-i*1.55,z=-3+(.5-i%2)*1.28,y=-.32+.05*(i%3);
        cylinder('water-bell-'+i,.63,.46,.98,x,y-.49,z,brass);
        const note=jade.clone();note.emissiveIntensity=.22;
        cylinder('bell-face-'+i,.615,.625,.09,x,y-.045,z,note);
        torus(.46,.016,x,y+.009,z,soft);bells.push({x,y,z,mat:note,pulse:0});
      }
      solidBox('grotto-sill',6.1,.45,4.9,-29.45,-.985,-3,b.floor);
      for(const side of [-1,1])solidBox('grotto-wall',6.1,3.55,.42,-29.45,1.05,-3+side*2.48,b.plaster);
      solidBox('grotto-back',.5,3.55,4.9,-32.25,1.05,-3,b.plaster);
      solidBox('grotto-roof',6.1,.4,5.1,-29.45,2.78,-3,b.plaster);
      b.arch(-26.6,-.68,-3,3.53,1.15,.53,.64,Math.PI/2,b.plaster,root);
      gate=group(root,true);gate.position.set(-26.63,0,-3);
      solidBox('bell-gate',.24,3.25,4.45,0,.91,0,b.paint,gate);
      const niche=mesh(new T.TorusGeometry(.84,.085,8,40,Math.PI*1.5),jade,-31.94,1.08,-3);
      niche.rotation.set(0,Math.PI/2,0);
      for(let i=0;i<5;i++){
        const h=.85+i*.20,z=-3.74+i*.36,x=-31.35+i%2*.12;
        cylinder('echo-organ',.093,.081,h,x,.06+h/2,z,brass);
        torus(.106,.024,x,h+.065,z,brass);
      }
      solidBox('organ-windchest',.66,.38,2.18,-31.39,-.12,-3,b.paint);
      for(const side of [-1,1]){
        solidBox('grotto-seat',2.15,.65,.68,-29.77,-.09,-3+side*1.87,b.floor);
        for(let i=0;i<8;i++)solidBox('grotto-flute',.075,2.38,.10,-31.65+i*.55,1.13,-3+side*2.24,b.paint);
      }
      b.arch(-31.7,-.64,-3,3.58,1.33,.23,.25,Math.PI/2,pearl,root);
      const sconce=mesh(new T.BoxGeometry(2.71,.067,.18),soft,-31.13,2.41,-3);
      sconce.rotation.y=Math.PI/2;
    }else{
      const t=target('walkway-dial','转桥石盘','转动',10.8,.89,12.8);
      cylinder('dial-pedestal',.41,.62,.88,t.x,.44,t.z,b.plaster);
      wheel=group(root,true);wheel.position.set(t.x,.95,t.z);
      cylinder('dial-stone',.55,.56,.16,0,0,0,brass,wheel);
      mesh(new T.BoxGeometry(.78,.06,.06),soft,.13,.1,0,wheel);
      turntable=group(root,true);turntable.position.set(21.18,0,zBridge);
      solidBox('turnbridge',8,.29,1.92,0,-.145,0,b.wood,turntable,'wood');
      for(const side of [-1,1])solidBox('turnbridge-stringer',8,.17,.12,0,-.31,side*.77,brass,turntable);
      for(let i=-4;i<=4;i++)mesh(new T.BoxGeometry(.028,.012,1.79),brass,i*.82,.007,0,turntable);
      for(const x of [-3.68,-2.5,-1.25,0,1.25,2.5,3.68])solidBox('turnbridge-stanchion',.067,.73,.067,x,.365,-.89,brass,turntable);
      solidBox('turnbridge-handrail',7.45,.084,.096,0,.73,-.89,pearl,turntable);
      torus(.47,.052,0,.025,0,brass,turntable);
      solidBox('prototype-annex',5.9,.74,5.5,28.04,-.37,zBridge,b.floor);
      for(let i=0;i<3;i++){
        const slab=solidBox('failed-mould',.4,.55+i*.52,.56,28+i*.64,.275+i*.26,9.7,b.paint);
        slab.rotation.z=.12*i;
      }
      b.arch(29,0,12.47,1.93,1.12,.28,.44,.16,b.plaster,root);
    }
  }

  let prank,prankTarget,slide=record.pranked?1:0;
  if(!quiet && id==='atrium'){
    prank=group(root,true);prank.position.set(30+slide*1.6,0,3);
    b.arch(0,0,0,2.12,1.87,.28,.54,0,b.paint,prank);
    b.arch(0,0,.28,2.10,1.87,.07,.08,0,pearl,prank);
    for(const side of [-1,1]){
      solidBox('arch-shoe',.48,.13,.8,side*1.22,.065,0,brass,prank);
      mesh(new T.BoxGeometry(2.19,.017,.064),brass,30.8+side*1.2,.015,3);
    }
    if(!record.pranked)prankTarget=target('wandering-arch','嵌铜的小拱','敲一下',30,1.22,3);
  }

  // Keep the bright seam exclusive to real, usable thresholds.
  const doors=config.interactables.filter(t=>t.crossing);
  const isOpen=t=>t.targetLayer==='library'||canEnterLayer(readState(),t.targetLayer);
  const signs=[];
  const doorsGroup=group(), moteCount=doors.length*9;
  const motes=new T.InstancedMesh(new T.IcosahedronGeometry(.029,0),soft,moteCount);
  motes.frustumCulled=false;doorsGroup.add(motes);
  const pose=new T.Object3D();
  for(const door of doors){
    const g=group(doorsGroup),side='x' in door.crossing;
    g.position.set(door.x,door.floorY??0,door.z);
    signs.push(g);g.visible=isOpen(door);
    g.rotation.y=side?-Math.PI/2*door.crossing.direction:door.crossing.direction===1?Math.PI:0;
    for(const sign of [-1,1]){
      mesh(new T.BoxGeometry(.045,2.16,.075),mint,sign*1.37,1.08,0,g);
      for(let i=0;i<4;i++)mesh(new T.BoxGeometry(.046,.012,.54),i%2?mint:soft,sign*(1.16-i*.17),.028,.32+i*.65,g);
    }
  }
  function animateDoors() {
    doors.forEach((door,k)=>{
      const axis='x' in door.crossing, dir=door.crossing.direction;
      const open=signs[k].visible=isOpen(door);
      for(let i=0;i<9;i++){
        const f=(i/9+time*.23)%1, z=(2.1-f*3)*-dir;
        const x=.95*Math.sin(i*21.73+.49*time);
        pose.position.set(door.x+(axis?z:x),(door.floorY??0)+.27+((i*.27+f*.42)%1.66),door.z+(axis?x:z));
        pose.scale.setScalar(open?.4+.74*Math.sin(f*Math.PI):0);pose.updateMatrix();motes.setMatrixAt(k*9+i,pose.matrix);
      }
    });
    motes.instanceMatrix.needsUpdate=true;
  }

  const paper=group(),wings=new T.BufferGeometry();
  const tip=[0,.035,-.52],keel=[0,-.118,.28];
  const folds=[[-.48,.085,.32],[-.115,-.015,.18],keel,[.115,-.015,.18],[.48,.085,.32]];
  const vertices=[],colors=[];
  for(let i=0;i<4;i++){
    vertices.push(...tip,...folds[i],...folds[i+1]);
    const c=new T.Color([0xfff2d2,0xc89c70,0xf5d6a1,0xfffaf1][i]);
    for(let j=0;j<3;j++)colors.push(c.r,c.g,c.b);
  }
  wings.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  wings.setAttribute('color',new T.Float32BufferAttribute(colors,3));wings.computeVertexNormals();
  mesh(wings,new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,toneMapped:false}),0,0,0,paper);
  paper.visible=false;
  const trailMat=new T.PointsMaterial({color:accents.gold,size:.068,transparent:true,opacity:.75,depthWrite:false});
  const trailGeo=new T.BufferGeometry(),tail=new Float32Array(14*3);
  trailGeo.setAttribute('position',new T.BufferAttribute(tail,3));
  const trail=new T.Points(trailGeo,trailMat);trail.frustumCulled=false;root.add(trail);trail.visible=false;
  let guide=null;
  const vec=new T.Vector3(),aim=new T.Vector3(),lastDir=new T.Vector3();
  function launch(player) {
    const live=readState(),active=doors.filter(isOpen);
    const goals=active.filter(t=>!live.layers?.includes(t.targetLayer) && !record.usedDoors?.includes(t.id));
    if(id==='atrium'&&!live.bridgeSolid&&live.phase!=='after')goals.push(...config.interactables.filter(t=>t.kind==='lab-link'));
    if(quiet)goals.unshift(...config.interactables.filter(t=>t.kind==='memory-trace'));
    else if(held)goals.splice(0,goals.length,socketTarget);
    else if(blockTarget && !record.placed)goals.push(blockTarget);
    if(!goals.length)goals.push(...active);
    if(!goals.length)return false;
    goals.sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z));
    const target=goals[0];
    let waypoint={...target,floorY:target.floorY??target.y-.9};
    // The cistern entrance and return share a physical throat, not world coordinates.
    if(id==='poolrooms' && (player.z< -36)!==(target.z< -36))
      waypoint={x:0,y:-.8,z:player.z< -36?-59.9:-8.1};
    const steps=guideRoute(player,waypoint,config.physics);
    const points=steps.map(p=>new T.Vector3(p.x,p.y,p.z));
    const first=new T.Vector3(-.24,-.11,-1.02).applyQuaternion(camera.quaternion).add(camera.position);
    points[0]=first;points.splice(1,0,first.clone().add(new T.Vector3(.18,.2,-.6).applyQuaternion(camera.quaternion)));
    if(Math.hypot(points.at(-1).x-waypoint.x,points.at(-1).z-waypoint.z)<2.8 && Math.abs(points.at(-1).y-(waypoint.floorY??waypoint.y)-1.4)<1.7)
      points.push(new T.Vector3(waypoint.x,(waypoint.floorY??waypoint.y)+1.38,waypoint.z));
    const curve=new T.CatmullRomCurve3(points,false,'centripetal');
    guide={curve,length:Math.max(.1,curve.getLength()),distance:0,age:0,arrived:0,target:target.id,lastZone:player.z< -36};
    paper.position.copy(first);paper.quaternion.copy(camera.quaternion);paper.visible=trail.visible=true;
    for(let j=0;j<tail.length;j+=3)first.toArray(tail,j);
    if(!quiet){
      audio.playInteraction('flip');
      say(voice.guides[{keystone:'block','keystone-socket':'socket','lab-link':'desk'}[target.kind]??(target.crossing?'door':'note')]);
    }
    return true;
  }
  function fly(dt,player) {
    if(!guide)return;
    if(id==='poolrooms' && guide.lastZone!==(player.z< -36)){launch(player);return;}
    guide.age+=dt;
    const wait=Math.hypot(player.x-paper.position.x,player.z-paper.position.z)>9.5;
    if(!wait)guide.distance=Math.min(guide.length,guide.distance+dt*(2+Math.min(guide.age*1.6,3)));
    const f=guide.distance/guide.length;
    guide.curve.getPointAt(f,vec);guide.curve.getTangentAt(f,aim);
    const bob=reduced()?0:Math.sin(guide.age*3.15)*.085;
    paper.position.copy(vec);paper.position.y+=bob;
    paper.rotation.set(Math.asin(Math.max(-.9,Math.min(.9,aim.y))),Math.atan2(-aim.x,-aim.z),
      reduced()?0:Math.max(-.39,Math.min(.39,(lastDir.x*aim.z-lastDir.z*aim.x)*5))+.055*Math.sin(guide.age*2.3),'YXZ');
    lastDir.copy(aim);
    // A chain of following sparks remains smooth even on a slow renderer.
    for(let i=tail.length-3;i>=3;i-=3)for(let a=0;a<3;a++)tail[i+a]+=(tail[i-3+a]-tail[i+a])*(1-Math.exp(-dt*14));
    paper.position.toArray(tail,0);trailGeo.attributes.position.needsUpdate=true;
    if(f===1 && !wait && (guide.arrived+=dt)>3.2){guide=null;paper.visible=trail.visible=false;}
  }

  const net=group(), netMat=new T.MeshBasicMaterial({color:0xa8eece,transparent:true,opacity:.49,depthWrite:false,side:T.DoubleSide});
  const leafMesh=new T.BoxGeometry(.73,.055,2.25),leaves=[];
  const stitch=new T.LineBasicMaterial({color:0xe5fff4,transparent:true,opacity:.79});
  for(let i=0;i<4;i++){
    const leaf=mesh(leafMesh,netMat,(i-1.5)*.72,0,0,net);
    const seam=new T.BufferGeometry();
    const edge=i%2?-.35:.35;
    seam.setFromPoints([[-edge,.032,-1.1],[edge,.032,0],[-edge,.032,1.1]].map(v=>new T.Vector3(...v)));
    leaf.add(new T.Line(seam,stitch));leaves.push(leaf);
  }
  const hoops=[torus(1.03,.026,0,.018,0,mint,net),torus(1.37,.016,0,-.08,0,soft,net)];
  net.visible=false;
  let catchTime=0,settling=0;
  function catchStart(player){
    catchTime=0;settling=0;net.visible=true;
    net.position.set(player.x,player.y-.09,player.z);
    if(!quiet){audio.playInteraction('catch');const n=memory.catches??0;say(voice.catch[n%voice.catch.length]);memory.catches=n+1;}
  }
  function catchEnd(){if(net.visible)settling=.3;}
  function catchFrame(dt,p) {
    if(!net.visible)return;
    catchTime+=dt;
    const spread=ease(clamp(catchTime/.28));
    for(let i=0;i<4;i++){
      leaves[i].position.x=(i-1.5)*.72*(.1+.90*spread);
      leaves[i].rotation.z=(i%2?1:-1)*(1-spread)*1.3;
    }
    for(let i=0;i<hoops.length;i++){hoops[i].scale.setScalar(.82+spread*(.2+i*.09));hoops[i].position.y=-.05-i*.08;}
    if(!settling)net.position.set(p.x,p.y-.095,p.z);
    else {settling=Math.max(0,settling-dt);net.scale.setScalar(ease(settling/.3));if(!settling){net.visible=false;net.scale.setScalar(1);}}
  }

  let taps=[],wetSteps=[],spokenAt=-Infinity;
  function aside(line){
    if(!quiet && time-spokenAt>5){spokenAt=time;say(line);}
  }
  function step(p,kind,sprint){
    audio.playFootstep(kind,sprint);
    if(kind==='water'){
      wetSteps=wetSteps.filter(t=>time-t<5);wetSteps.push(time);
      if(wetSteps.length===6)aside(voice.wetFeet);
    }
  }
  function land(p,kind,speed){
    audio.playLanding(kind,speed);
    const atop=t=>Math.hypot(p.x-t.x,p.z-t.z)<1.28 && p.y>(t.floorY??0)+.58 && p.y<t.y+.42;
    if(config.interactables.some(t=>t.kind==='garden-sundial' && atop(t)))aside(voice.dialFeet);
    else if(config.interactables.some(t=>['lab-link','blog-desk','book','cocreate'].includes(t.kind) && atop(t)))aside(voice.tableFeet);
  }
  const drop={id:'drop-keystone',kind:'drop-keystone',label:'拱心石',prompt:'E · 放下'};
  function carryTarget(p) {
    if(!held)return null;
    return near(p,socket.position,1.85)?{...socketTarget,prompt:'E · 嵌入'}:drop;
  }
  function removeTarget(t){const i=config.interactables.indexOf(t);if(i>=0)config.interactables.splice(i,1);}
  function interact(t,p) {
    if(t?.crossing){
      if(isOpen(t) && !record.usedDoors?.includes(t.id))(record.usedDoors??=[]).push(t.id);
      return false;
    }
    if(t && ['glb-fork','corridor-chimes'].includes(t.kind)){
      taps=taps.filter(s=>time-s<3);taps.push(time);
      if(taps.length===4)aside(voice.ringing);
    }
    if(held){
      const seat=near(p,socket.position,1.85);
      let dest;
      if(seat){
        dest=new T.Vector3(socket.position.x,socket.position.y+.328,socket.position.z);
        record.placed=true;removeTarget(socketTarget);say(voice.socket);
      }else{
        const x=p.x-Math.sin(p.yaw)*1.05,z=p.z-Math.cos(p.yaw)*1.05;
        const floor=config.physics.support(x,z,p.y+.48,.28);
        if(!floor || config.physics.blocked(x,z,floor.y+.015,.54,.34))return true;
        dest=new T.Vector3(x,floor.y+.20,z);
      }
      held=false;pickup=null;
      flight={from:block.position.clone(),rotation:block.quaternion.clone(),to:dest,t:0};
      if(!seat){record.block={x:dest.x,y:dest.y,z:dest.z};}
      audio.playInteraction(seat?'harmonic':'paper',0);return true;
    }
    if(!t)return false;
    if(t.id==='keystone' && !record.placed && !flight){
      held=true;pickup={from:block.position.clone(),rotation:block.quaternion.clone(),t:0};
      block.userData.collisionDisabled=true;removeTarget(blockTarget);audio.playInteraction('lamp');return true;
    }
    if(t.id==='keystone-socket' && !record.placed){aside(voice.guides.block);return true;}
    if(t.id==='walkway-dial'){record.aligned=!record.aligned;audio.playInteraction('pillar');return true;}
    if(t.id==='wandering-arch' && !record.pranked){
      record.pranked=true;removeTarget(prankTarget);audio.playInteraction('shelf');say(voice.sidestep);return true;
    }
    return false;
  }
  function poseBridge(){
    bridge.forEach((g,i)=>{
      const f=clamp((rise-i*.15)/.55),up=ease(f);
      g.visible=f>0;g.position.y=floorY-2.7*(1-up);g.rotation.z=(1-up)*.19;
      if(f>.25 && playedSegments<=i){audio.playInteraction('bridge-segment',i);playedSegments=i+1;}
    });
    if(turntable){turntable.rotation.y=(1-ease(turn))*Math.PI/2;wheel.rotation.y=turntable.rotation.y;}
    if(gate)gate.position.y=ease(open)*3.55;
  }
  if(bridge.length)poseBridge();
  const identity=new T.Quaternion(),carryTurn=new T.Quaternion().setFromEuler(new T.Euler(-.24,-.64,.08)),handRotation=new T.Quaternion();
  function update(dt,p){
    time+=dt;animateDoors();fly(dt,p);catchFrame(dt,p);
    if(prank && record.pranked && slide<1){slide=Math.min(1,slide+dt/1.0);prank.position.x=30+1.6*ease(slide);}
    if(!block)return;
    if(held){
      vec.set(.40+(!reduced()?Math.sin(time*3.1)*.014:0),-.24,-1.24).applyQuaternion(camera.quaternion);
      // Pull the stone closer to the player's chest before the hand crosses masonry.
      const hand=vec.clone().add(camera.position);
      if(config.physics.blocked(hand.x,hand.z,hand.y-.23,.48,.27))vec.multiplyScalar(.74);
      vec.add(camera.position);handRotation.copy(camera.quaternion).multiply(carryTurn);
      if(pickup){
        pickup.t=Math.min(1,pickup.t+dt/.23);
        block.position.lerpVectors(pickup.from,vec,ease(pickup.t));
        block.quaternion.slerpQuaternions(pickup.rotation,handRotation,ease(pickup.t));
        if(pickup.t===1)pickup=null;
      }else{block.position.copy(vec);block.quaternion.copy(handRotation);}
    }else if(flight){
      flight.t=Math.min(1,flight.t+dt/.32);
      block.position.lerpVectors(flight.from,flight.to,ease(flight.t));
      block.quaternion.slerpQuaternions(flight.rotation,identity,ease(flight.t));
      if(flight.t===1){
        block.userData.collisionDisabled=false;flight=null;
        if(!record.placed)blockTarget=target('keystone','发光的拱心石','拿起',block.position.x,block.position.y,block.position.z);
      }
    }
    if(record.placed&&!flight)rise=Math.min(1,rise+dt/1.42);
    if(turntable)turn=clamp(turn+dt/.98*(record.aligned?1:-1));
    if(bells.length){
      const at=p.grounded?bells.findIndex(bell=>Math.abs(p.y-bell.y)<.1 && Math.hypot(p.x-bell.x,p.z-bell.z)<.74):-1;
      if(at>=0 && at!==lastBell){
        bells[at].pulse=1;record.notes=(record.notes??0)|(1<<at);audio.playInteraction('water-bell',at);
        if(record.notes===31 && !record.bellsOpen){record.bellsOpen=true;audio.playInteraction('shelf');say(voice.bellsOpen);}
      }
      lastBell=at;
      for(let i=0;i<bells.length;i++){
        const bell=bells[i];bell.pulse=Math.max(0,bell.pulse-dt*1.22);
        const played=((record.notes??0)&(1<<i))!==0;
        bell.mat.emissiveIntensity=.19+(played?.48:0)+bell.pulse*1.15;
      }
      if(record.bellsOpen)open=Math.min(1,open+dt/1.4);
      if(open===1 && p.x < -28 && p.x > -32 && Math.abs(p.z+3)<2 && !record.echo){
        record.echo=true;audio.playInteraction('chime',2);
      }
    }
    poseBridge();
  }
  return {update,guide:launch,interact,target:carryTarget,step,land,catchStart,catchEnd,
    snapshot:()=>({held,placed:Boolean(record.placed),block:block?.position.toArray(),bridge:rise,
      aligned:Boolean(record.aligned),bridgeAngle:turntable?.rotation.y,bells:record.notes??0,grottoOpen:Boolean(record.bellsOpen),
      prank:slide,catchVisible:net.visible,catchAge:catchTime,glider:guide?.target??null,gliderPosition:guide?paper.position.toArray():null})};
}
