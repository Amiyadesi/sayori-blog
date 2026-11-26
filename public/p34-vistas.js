import { atriumWings, stacksWings, loftRing, libraryWings } from './p34-wings.js?v=20261126-playable';
/* Interior lamps have a short radius; the horizon receives sky and sun instead. */
const horizonMats = new WeakMap();
function batch(T, scene, geometry, material, poses, solid = false) {
  if (scene.userData.software && material.isMeshLambertMaterial) {
    let horizon = horizonMats.get(material);
    if (!horizon) {
      horizon = material.clone(); horizon.onBeforeCompile = material.onBeforeCompile;
      horizon.defines = { ...material.defines, P34_DISTANT_STONE:1 };
      horizonMats.set(material,horizon);
    }
    material = horizon;
  }
  const regions = new Map(), partition = scene.userData.software && poses.length > 55;
  for (const p of poses) {
    const solidHere=typeof solid==='function'?solid(p):solid;
    const key = Number(solidHere)+':'+(partition ? Math.floor(p[0]/46)+','+Math.floor(p[2]/46) : '');
    if (!regions.has(key)) regions.set(key,[]);
    regions.get(key).push(p);
  }
  const pose = new T.Object3D();
  for (const [region,group] of regions) {
    const mesh = new T.InstancedMesh(geometry, material, group.length);
    group.forEach(([x, y, z, yaw = 0, sx = 1, sy = 1, sz = 1], i) => {
      pose.position.set(x, y, z); pose.rotation.y = yaw; pose.scale.set(sx, sy, sz);
      pose.updateMatrix(); mesh.setMatrixAt(i, pose.matrix);
    });
    mesh.userData.solid = region.startsWith('1:'); mesh.receiveShadow = true; mesh.userData.noShadow = true; scene.add(mesh);
  }
}

// A full spandrel, not a torus: light passes through the voussoir opening.
function arcade(T, width, spring, thickness, depth) {
  const half = width / 2, r = half - thickness, crown = spring + r + thickness * .5;
  const s = new T.Shape();
  s.moveTo(-half, 0); s.lineTo(-half, crown); s.lineTo(half, crown);
  s.lineTo(half, 0); s.lineTo(r, 0); s.lineTo(r, spring);
  s.absarc(0, spring, r, 0, Math.PI, false); s.lineTo(-r, 0); s.closePath();
  const g = new T.ExtrudeGeometry(s, { depth, curveSegments: 9, bevelEnabled: false });
  g.userData.pierced=true; g.translate(0, 0, -depth / 2);
  const { uv, position } = g.attributes;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, .5, position.getY(i) / crown);
  return g;
}

function towers(T, scene, b, placements) {
  const feet = [], openings = [], drums = [], rims = [], caps = [], finials = [];
  for (const [x,y,z,s,h] of placements) {
    feet.push([x,y-h/2,z,0,5.7*s,h,5.7*s]);
    for (let i=0;i<4;i++) {
      const a=i*Math.PI/2; openings.push([x+Math.sin(a)*2.6*s,y,z+Math.cos(a)*2.6*s,a,s,s,s]);
    }
    drums.push([x,y+6*s,z,0,3.7*s,1.4*s,3.7*s]);
    rims.push([x,y+.02*s,z,0,3.6*s,.5*s,3.6*s], [x,y+6.65*s,z,0,3.95*s,.34*s,3.95*s]);
    caps.push([x,y+6.8*s,z,0,3.7*s,2.55*s,3.7*s]);
    finials.push([x,y+9.7*s,z,0,.16*s,1.25*s,.16*s]);
  }
  batch(T,scene,new T.BoxGeometry(),b.plaster,feet);
  batch(T,scene,arcade(T,5.6,3,.6,.68),b.plaster,openings);
  batch(T,scene,new T.CylinderGeometry(1,1,1,16),b.paint,drums);
  batch(T,scene,new T.CylinderGeometry(1,1.02,1,16),b.edge,rims);
  const zinc=new T.MeshStandardMaterial({color:0x7e8d91,metalness:.12,roughness:.72});
  batch(T,scene,new T.SphereGeometry(1,20,10,0,Math.PI*2,0,Math.PI/2),zinc,caps);
  batch(T,scene,new T.CylinderGeometry(.2,1,1,8),b.metal,finials);
}

function viaduct(T,scene,b,x,y,z,angle,width,bays,storeys,mat=b.plaster,k=1){
  const arch=[],ledge=[],feet=[];
  for(let j=-bays;j<=bays;j++){
    const px=x+j*width*Math.cos(angle),pz=z-j*width*Math.sin(angle);
    const dx=Math.cos(angle)*width*.49,dz=-Math.sin(angle)*width*.49;
    for(let i=0;i<storeys;i++){
      const py=y+i*6.9*k;
      arch.push([px,py,pz,angle,width/8,k,1.55]);
      ledge.push([px,py+6.82*k,pz,angle,width,.31,2.45]);
    }
    feet.push([px+dx,y-7,pz+dz,angle,1.35,14,1.85]);
  }
  batch(T,scene,arcade(T,8,2.95,.65,1.12),mat,arch);
  batch(T,scene,new T.BoxGeometry(),b.edge,ledge);
  batch(T,scene,new T.BoxGeometry(),mat,feet);
}

export function atriumVista(T, scene, b) {
  atriumWings(T,scene,b,arcade);
  const arches=[], coping=[], pillars=[], footings=[];
  // Terraced aqueducts: near spans sit below the bridge; a higher one crosses behind it.
  for (const [z,y,w,n,shift] of [[-82,1.3,12,9,-4],[-110,-3,12,13,6],[-146,5,14,10,-2],[83,-6,10,10,-3]]) {
    for(let j=-n;j<=n;j++) {
      const x=j*w+shift,k=w/9;
      arches.push([x,y,z,0,k,k,1.3]);
      coping.push([x,y+7.55*k,z,0,w,.27,2.4],[x,y+7.92*k,z,0,w,.17,2.1]);
      pillars.push([x-w/2,y-7,z,0,1.26,14,1.77]); footings.push([x-w/2,y+.09,z,0,1.8,.32,2.22]);
    }
  }
  // West and east courts continue past the architecture the visitor can reach.
  for (const x of [-79,88]) for (let j=-11;j<=9;j++) {
    const z=j*9, y=x===-67?1.8:-4.2;
    arches.push([x,y,z,Math.PI/2,1,1,1]);coping.push([x,y+7.57,z,0,1.9,.25,9]);
  }
  batch(T,scene,arcade(T,9,3.7,.86,1.45),b.plaster,arches);
  batch(T,scene,new T.BoxGeometry(),b.edge,coping);batch(T,scene,new T.BoxGeometry(),b.paint,pillars);
  batch(T,scene,new T.BoxGeometry(),b.edge,footings);
  viaduct(T,scene,b,5,4,-74,-.53,10,9,2,b.paint,.9);
  towers(T,scene,b,[[-9,16,-84,1.8,37],[22,6,-113,2.8,39],[-29,5,-77,1.35,24],[37,11,-76,1.6,31],[72,3,-112,2.2,35],[-76,6,-98,2,38],[-72,2,51,1.3,22],[68,1,44,1.8,26]]);
  b.box(312,.3,295,0,-17.5,-41,b.paint).userData.solid=false;
  // The loop has a 6m bay and a 24m period. Offset sunlight would reveal the seam;
  // the repeated clerestory and warm insets supply the light inside this wing.
  const bays=[], sideBays=[], floor=[], cornice=[], panels=[], lights=[];
  const tube = new T.MeshStandardMaterial({color:0xffe6aa,emissive:0xe8ce91,emissiveIntensity:.45});
  for(let z=0;z>=-54;z-=6) {
    bays.push([21,0,z]);floor.push([21,-.13,z-3,0,5.4,.26,6]);
    for(const x of [18.4,23.6]){
      sideBays.push([x,-.2,z-3,Math.PI/2,1,.72,.85]);
      cornice.push([x,4.03,z-3,0,.45,.29,6]);
      if(z<=-12 && z!==-30 && z!==-36) {
        panels.push([x,1.85,z-3,0,.32,3.7,6]);
        panels.push([x,4.66,z-3,0,.35,1.18,6]);
      }
    }
    // Curved vaults leave the high openings transparent from the side.
    lights.push([21,5.07,z-2.9,0,.19,.07,2.2]);
  }
  batch(T,scene,arcade(T,5.8,2.46,.37,.5),b.plaster,bays,true);
  batch(T,scene,arcade(T,6,2.8,.34,.45),b.paint,sideBays,true);
  batch(T,scene,new T.BoxGeometry(),b.floor,floor,true);batch(T,scene,new T.BoxGeometry(),b.edge,cornice,true);
  batch(T,scene,new T.BoxGeometry(),b.plaster,panels,true);batch(T,scene,new T.BoxGeometry(),tube,lights);
  b.box(5.85,.25,60,21,5.32,-30,b.ceiling);
  b.wall(5.8,5.2,.4,21,0,-60);
  // North-facing side stairs open onto the tower aqueduct and close a real circuit.
  for(let i=0;i<24;i++)b.box(3.5,.22,.49,25.55,(i+1)/6-.11,-18.1-i*.48,b.floor);
  b.box(8,.32,4.8,24.9,3.84,-31.4,b.floor);
  b.box(4,.31,9,24.95,-.155,-15.1,b.floor);
  b.box(5,.28,3.8,25.23,-.14,-9.7,b.floor);
  // The sundial's sibling is turned after one circuit; it stands back at the junction.
  const index=b.lathe([[0,0],[.49,0],[.49,.15],[.23,.3],[.22,.98],[.42,1.08],[0,1.08]],17,0,-6,b.paint);
  const leaf=new T.Mesh(new T.ConeGeometry(.39,.72,3),b.metal);leaf.position.y=1.44;leaf.scale.z=.18;index.add(leaf);
  return index;
}

export function stacksVista(T,scene,b) {
  stacksWings(T,scene,b,arcade);
  // Readers occupy the broken lip of a much larger circular shaft.
  const arch=[], ledge=[], shelves=[], pilasters=[], trim=[], farBays=[];
  for (const [radius,count,start,end] of [[33,20,-3,3],[64,32,-4,4],[96,40,-3,4]]) {
    const dz=-31,w=2*radius*Math.sin(Math.PI/count),k=w/9;
    for(let layer=start;layer<=end;layer++) for(let j=0;j<count;j++){
      const a=j*2*Math.PI/count,x=Math.sin(a)*radius,z=dz+Math.cos(a)*radius;
      // Broken gallery mouths expose the farther rings.
      if((radius===33 && z>-8 && Math.abs(x)<14) || ((j+3*layer+80)%13===0))continue;
      const y=layer*8-4, yaw=a;
      if(scene.userData.software && (radius>=64 || Math.abs(layer)>1)) {
        // At these distances the book bands are smaller than a software pixel.
        // Stamp the pierced bay and its shelves on the ring; keep the solid floor.
        farBays.push([x,y+3.7,z,a,w,7.4,1]);
        if (radius===33 || Math.abs(layer)<=1) ledge.push([x,y+7.36,z,yaw,w+.3,.54,3.8]);
        continue;
      }
      arch.push([x,y,z,yaw,k,1,1]);
      ledge.push([x,y+7.36,z,yaw,w+.3,.54,3.8]);
      trim.push([x-Math.sin(a)*1.7,y+7.66,z-Math.cos(a)*1.7,yaw,w+.2,.16,.33]);
      if((j+layer+12)%4!==0) for(let row=0;row<3;row++) {
        shelves.push([x+Math.sin(a)*.55,y+1.25+row*1.35,z+Math.cos(a)*.55,yaw,w*.7,.53,.66]);
      }
      pilasters.push([x+w*.44*Math.cos(a),y+3.6,z-w*.44*Math.sin(a),yaw,.4,7.2,1.7]);
    }
  }
  const nearRing=([x,y,z])=>Math.hypot(x,z+31)<40;
  batch(T,scene,arcade(T,9,3.36,.96,.99),b.plaster,arch,nearRing);
  batch(T,scene,new T.BoxGeometry(),b.paint,ledge,nearRing);batch(T,scene,new T.BoxGeometry(),b.edge,trim,nearRing);
  batch(T,scene,new T.BoxGeometry(),b.wood,shelves,nearRing);batch(T,scene,new T.BoxGeometry(),b.metal,pilasters,nearRing);
  if(farBays.length) {
    const canvas=document.createElement('canvas'); canvas.width=128;canvas.height=112;
    const c=canvas.getContext('2d');
    c.fillStyle='#edf1ee';c.fillRect(0,0,128,112);
    c.globalCompositeOperation='destination-out';
    c.beginPath();c.moveTo(17,112);c.lineTo(17,59);c.arc(64,59,47,Math.PI,0);c.lineTo(111,112);c.closePath();c.fill();
    c.globalCompositeOperation='source-over';c.fillStyle='#89999c';c.fillRect(0,0,128,6);c.fillStyle='#606b70';
    for(const y of [71,88,105])c.fillRect(13,y,102,4);
    const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;
    const facade=new T.MeshLambertMaterial({color:b.plaster.color,map:tex,alphaTest:.42,side:T.DoubleSide});
    facade.onBeforeCompile=b.plaster.onBeforeCompile;
    batch(T,scene,new T.PlaneGeometry(),facade,farBays);
  }
  // Massive piers, copper index marks and spiral access flights break the even rings.
  const steps=[], landings=[], shafts=[], bands=[], ink=[];
  for (const [cx,cz,r,base,h] of [[-15,-29,3.6,-34,58],[21,-42,4.2,-39,71],[-32,-63,4.6,-36,65]]) {
    shafts.push([cx,base+h/2,cz,0,r,h,r]);
    const stepStride = scene.userData.software && r>4 ? 2 : 1;
    for(let j=0;j<105;j+=stepStride){
      const a=j*.147,y=base+j*.40,x=cx+Math.cos(a)*(r+.93),z=cz+Math.sin(a)*(r+.93);
      steps.push([x,y,z,-a,2.06,.16,.87*stepStride]);
      if(j%15===0)landings.push([x,y-.18,z,-a,2.7,.4,2.6]);
    }
    for(let j=0;j<Math.floor(h/5);j++) {
      bands.push([cx,base+5*j+1,cz,0,r*1.05,.28,r*1.05]);
      const marks = scene.userData.software ? 4 : 9;
      for(let k=0;k<marks;k++) {const a=k*(Math.PI*2/marks)+Math.floor(j/4)*.4;
        ink.push([cx+r*Math.cos(a),base+j*5+2.7,cz+r*Math.sin(a),Math.PI/2-a,.3,2,.36]);}
    }
  }
  const sides=scene.userData.software ? 12 : 24;
  batch(T,scene,new T.CylinderGeometry(1,1.07,1,sides),b.paint,shafts,true);
  batch(T,scene,new T.CylinderGeometry(1.03,1,1,sides),b.edge,bands,true);
  batch(T,scene,new T.BoxGeometry(),b.metal,steps,true);batch(T,scene,new T.BoxGeometry(),b.plaster,landings,true);
  batch(T,scene,new T.BoxGeometry(),b.wood,ink);
  const dark=new T.MeshStandardMaterial({color:0x273e4a,roughness:.85});
  b.box(236,.5,230,0,-47,-22,dark).userData.solid=false;
  // A thin detached staircase and a book hoist silhouette the opposite lip.
  for(const [x,z,s] of [[-16,-55,1.7],[29,-79,2.6],[-55,-100,2.4]]) {
    b.arch(x,-23,z,7*s,13*s,1.1*s,2*s,0,b.paint);
    b.slab(9*s,.7*s,3*s,x,-23+17.3*s,z,b.metal);
  }
}

export function libraryVista(T,scene,b) {
  libraryWings(T,scene,b,arcade);
  const path=[], caps=[], lower=[], arches=[];
  for(let i=0;i<11;i++) {
    const z=-25.5-i*7;
    for(const x of [-7.3,7.3]) {
      arches.push([x,1.8,z,Math.PI/2]); caps.push([x,8.53,z,0,1.08,.31,7]);
      if(i===4 || i===12)path.push([0,2,z]);
    }
    lower.push([0,1.53,z,0,16,.36,7]);
    for(const x of [-49,52]) {
      arches.push([x,-3,z,Math.PI/2,1.02,1.4,2]);caps.push([x,6.4,z,0,2,.5,7]);
    }
  }
  batch(T,scene,arcade(T,7,3.4,.46,.69),b.plaster,arches,true);
  batch(T,scene,arcade(T,15,2.25,1.04,1.1),b.paint,path,true);
  batch(T,scene,new T.BoxGeometry(),b.edge,caps,true);batch(T,scene,new T.BoxGeometry(),b.floor,lower,true);
  viaduct(T,scene,b,-65,-5,-112,-.61,9.6,8,3,b.paint,1.06);
  viaduct(T,scene,b,37,-2,-136,.48,12.2,8,3,b.plaster,1.15);
  towers(T,scene,b,[[-41,13,-83,1.42,24],[34,10,-98,2.02,31],[-27,4,-47,1.3,24],[33,7,-72,1.8,37],[-51,-1,-101,2.6,36],[65,7,22,1.85,25]]);
}

export function loftVista(T,scene,b) {
  loftRing(T,scene,b);
  // Twelve open arches carry the dome ribs; no wall or opaque glass behind them.
  const windows=[],sills=[],radius=12.7;
  for(let i=0;i<12;i++) {
    const a=(i+.5)*Math.PI/6;
    windows.push([Math.sin(a)*radius,0,Math.cos(a)*radius,a]);
    sills.push([Math.sin(a)*radius,.35,Math.cos(a)*radius,a,6.7,.7,.49]);
    const points=[];
    for(let j=0;j<=18;j++){const t=j/18*1.46,r=radius*Math.cos(t);points.push(new T.Vector3(Math.sin(a-Math.PI/12)*r,7.68+5.8*Math.sin(t), Math.cos(a-Math.PI/12)*r));}
    const tube=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),20,.105,6,false),b.metal);scene.add(tube);
  }
  batch(T,scene,arcade(T,6.7,4.65,.56,.63),b.plaster,windows,true);
  batch(T,scene,new T.BoxGeometry(),b.paint,sills,true);
  for (const [r,y,w] of [[13.02,7.67,.23],[12.96,7.95,.11],[9.6,11.62,.09],[1.43,13.43,.17]]) {
    const ring=new T.Mesh(new T.TorusGeometry(r,w,7,72),b.metal);ring.rotation.x=Math.PI/2;ring.position.y=y;scene.add(ring);
  }
  const arches=[],edges=[];
  for(const [z,y,count] of [[-44,-12,12],[-76,-15,14],[39,-14,12],[-118,-17,16]])for(let j=-count;j<=count;j++){
    arches.push([j*9,y,z]);edges.push([j*9,y+7.4,z,0,9,.4,2.9]);
  }
  batch(T,scene,arcade(T,9,3.45,.84,1.4),b.plaster,arches);batch(T,scene,new T.BoxGeometry(),b.edge,edges);
  const blueStone=new T.MeshStandardMaterial({color:0x74939e,roughness:.82});
  viaduct(T,scene,b,-11,-9.1,-30,-.55,8.3,7,2,blueStone,.91);
  viaduct(T,scene,b,1,-10,-73,.43,10.5,9,3,b.plaster,1.17);
  towers(T,scene,b,[[-16,-1.6,-41,1.35,26],[24,2,-55,1.6,29],[-43,-4,-64,1.9,34],[45,1,-88,2.3,45],[-86,-6,-100,2.9,40],[91,-7,17,1.9,37],[15,-7,49,1.5,25],[-33,-7,45,1.39,32]]);
  const baths=new T.MeshStandardMaterial({color:0x7eaea9,metalness:.22,roughness:.38});
  b.box(72,.25,63,-12,-8,-48,baths).userData.solid=false;
  // The next observatory is still being built: its open iron drum contrasts with the plaster domes.
  const drums=[],ribs=[];
  for(const [x,y,z,r] of [[8,-2,-61,7.5],[-38,2,-93,12]]){
    for(let j=0;j<14;j++){
      const a=2*Math.PI*j/14;
      for(let n=0;n<3;n++)drums.push([x+r*Math.sin(a),y+n*4.4,z+r*Math.cos(a),a,2*r*Math.sin(Math.PI/14)/5.4,.8,.8]);
      ribs.push([x+r*Math.sin(a),y+6.4,z+r*Math.cos(a),a,.16,13,.24]);
    }
    for(let n=0;n<3;n++){
      const ring=new T.Mesh(new T.TorusGeometry(r,.21,6,36),blueStone);ring.rotation.x=Math.PI/2;ring.position.set(x,y+4.4*(n+1),z);scene.add(ring);
    }
  }
  batch(T,scene,arcade(T,5.4,2.7,.43,1),blueStone,drums);batch(T,scene,new T.BoxGeometry(),b.metal,ribs);
  const stars = new Float32Array(180*3);
  for(let i=0;i<180;i++) {const a=i*2.39996,t=(i+.5)/180,r=Math.sqrt(1-t*t)*162;stars.set([Math.cos(a)*r,162*t,Math.sin(a)*r],i*3);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(stars,3));
  scene.add(new T.Points(g,new T.PointsMaterial({color:0xe4dbc8,size:.145,transparent:true,opacity:.53,fog:false,depthWrite:false})));
}

// The gradient belongs to the sky, not a wall at the end of the map.
export function skyDome(T,scene,zenith) {
  const mat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,depthTest:false,
    uniforms:{haze:{value:scene.fog.color},zenith:{value:new T.Color(zenith)}},
    vertexShader:`varying vec3 ray; void main(){ray=position;gl_Position=projectionMatrix*vec4(mat3(viewMatrix)*position,1.);gl_Position.z=gl_Position.w;}`,
    fragmentShader:`varying vec3 ray;uniform vec3 haze;uniform vec3 zenith;void main(){float y=normalize(ray).y;vec3 c=mix(haze*.55,haze,smoothstep(-.55,0.,y));c=mix(c,zenith,smoothstep(-.02,.69,y));gl_FragColor=vec4(c,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
  const sky=new T.Mesh(new T.SphereGeometry(1,26,14),mat);sky.renderOrder=-100;sky.frustumCulled=false;scene.add(sky);
  return mat;
}
