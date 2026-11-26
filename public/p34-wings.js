import { solid } from './p34-architecture.js?v=20261126-playable';

export function stamp(T,scene,geometry,mat,poses,material='stone'){
  if(!poses.length)return;
  const mesh=new T.InstancedMesh(geometry,mat,poses.length), o=new T.Object3D();
  poses.forEach(([x,y,z,ry=0,sx=1,sy=1,sz=1],i)=>{
    o.position.set(x,y,z);o.rotation.y=ry;o.scale.set(sx,sy,sz);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);
  });
  mesh.receiveShadow=true;mesh.castShadow=true;scene.add(solid(mesh,{material}));return mesh;
}

// True step blocks, including the last tread at the landing height. The same
// instance matrices are indexed by the body solver; no second ramp to maintain.
function stairs(T,scene,b,x,z,y,yEnd,run,width,dir=0,mat=b.floor){
  const count=Math.ceil(Math.abs(yEnd-y)/.17),d=run/count,steps=[];
  for(let i=0;i<count;i++){
    const along=(i+.5)*d,h=y+(i+1)*(yEnd-y)/count;
    steps.push([x-Math.sin(dir)*along,h-.14,z-Math.cos(dir)*along,dir,width,.28,d+.008]);
  }
  return stamp(T,scene,new T.BoxGeometry(),mat,steps);
}
function deck(b,id,x1,x2,z1,z2,h,mat=b.floor,depth=.46){
  const floor=b.box(x2-x1,depth,z2-z1,(x1+x2)/2,h-depth/2,(z1+z2)/2,mat);
  floor.userData.solidId=id;return floor;
}

export function atriumWings(T,scene,b,arcade){
  const deckAt=(id,x1,x2,z1,z2,h)=>deck(b,id,x1,x2,z1,z2,h);
  const bays=[],course=[],posts=[],pots=[],trees=[];
  for(const s of [-1,1]){
    const a=s<0?-44:23.95,c=s<0?-23.95:44;
    deckAt('garden-court',a,c,-29,25,0);
    deckAt('south-promenade',s<0?-44:16,s<0?-16:44,24.95,40,0);
    deckAt('tower-landing',s<0?-44:27,s<0?-27:44,-35,-26.9,4);
    deckAt('upper-loggia',s<0?-44:39,s<0?-39:44,-27,24,4);
    // Arcaded west and east walks enclose the two asymmetrical courtyards.
    for(let i=0;i<7;i++){
      const z=-23+i*7;
      bays.push([s*40.1,0,z,Math.PI/2]);
      course.push([s*40.1,4.72,z,0,.91,.28,7.02]);
      posts.push([s*43.72,4.5,z,0,.48,1,.48]);
    }
    b.box(.29,.89,51,s*43.84,4.445,-1.5,b.plaster);
    b.box(.39,.13,51,s*43.84,4.94,-1.5,b.edge);
    stairs(T,scene,b,s*34,-13,0,4,14,4.4);
    stairs(T,scene,b,s*40.7,24,0,4,12,3.45,0);
    // The little belvedere is visible first from below, then from the other tower.
    stairs(T,scene,b,s*37.5,-28.9,4,8,11,3.8);
    deckAt('roof-overlook',s<0?-44:30,s<0?-30:44,-47,-39.85,8);
    for(const x of [s*43.1,s*31])for(const z of [-46.5,-40.7])
      b.column(.65,3.2,.65,x,8,z);
    b.arch(s*37,10.8,-46.4,11.2,.02,.38,.6,0,b.edge);
    b.box(14,.85,.34,s*37,8.425,-46.8,b.plaster);
    b.box(14.15,.12,.52,s*37,8.91,-46.8,b.edge);
    b.desk(s*33.4,8,-43.8,1.7,.65,.55);
    for(const [x,z] of [[28,-10],[29,16],[35,18],[27,20],[30,-7]]){
      pots.push([s*x,.24,z,0,1.05,.48,1.05]);trees.push([s*x,1.56,z,0,.73,2.32,.73]);
    }
  }
  deckAt('tower-aqueduct',-29,29,-34.2,-28.95,4);
  deckAt('east-underpass',21,34,-32.8,-28.7,0);
  deckAt('east-court-return',31,34,-29,-16,0);
  // A short flight makes the repeating wing's clerestory roof a real upper walk.
  stairs(T,scene,b,27,-31.6,4,5.445,3.5,2.3,Math.PI/2);
  deckAt('wing-roof-landing',22,23.7,-32.8,-30.4,5.445);
  for(let x=-25;x<=25;x+=10){
    bays.push([x,-1.85,-31,0,10/7,1.21,1.85]);
    course.push([x,4.15,-33.95,0,10,.3,.32]);
  }
  for(const x of [-14,14])stairs(T,scene,b,x,20,0,-1.2,5,3.8,Math.PI);
  deckAt('sunken-court',-16,16,24.95,40,-1.2);
  for(const s of [-1,1]){
    stairs(T,scene,b,s*12,31,-1.2,0,4.1,3.7,-s*Math.PI/2);
    for(const z of [27,35])b.arch(s*11.5,-1.2,z,4,1.7,.42,.8);
  }
  b.box(88,.92,.5,0,-.75,40,b.plaster);
  stamp(T,scene,arcade(T,7,1.25,.48,.91),b.plaster,bays);
  stamp(T,scene,new T.BoxGeometry(),b.edge,course);
  stamp(T,scene,new T.BoxGeometry(),b.paint,posts);
  stamp(T,scene,new T.CylinderGeometry(.94,.74,1,12),b.paint,pots);
  stamp(T,scene,new T.ConeGeometry(1,1,9),new T.MeshStandardMaterial({color:0x80917a,roughness:.93}),trees);
}

export function stacksWings(T,scene,b,arcade){
  const bays=[];
  for(const s of [-1,1]){
    deck(b,'archive-crosswalk',s<0?-18:11.95,s<0?-11.95:18,7.7,10.15,0);
    deck(b,'archive-sidewalk',s<0?-21:16,s<0?-16:21,-12,10.15,0);
    stairs(T,scene,b,s*18.5,-7,0,2.4,7,4);
    deck(b,'reading-balcony',s<0?-21:14,s<0?-14:21,-20,-13.9,2.4);
    for(const z of [-8,-1,6])bays.push([s*20.65,0,z,Math.PI/2,1,1,1]);
  }
  deck(b,'perimeter-walk',-16,16,-19.75,-16.65,2.4);
  stairs(T,scene,b,20.9,-18.3,2.4,3.63,5.1,2.8,-Math.PI/2);
  deck(b,'shaft-ring-entry',25.95,31.7,-19.7,-16.9,3.63,b.wood);
  deck(b,'spiral-entry',-19.6,-17.3,-29.8,-19.5,2.4,b.wood);
  // Under the archive gallery, the reader can slip behind the case to a lamp and a seat.
  b.box(.32,2.6,5,-16.4,3.7,-17.5,b.wood);
  b.slab(2.4,.17,.87,-19.1,2.88,-18.7,b.wood);
  b.box(1.85,.43,.52,-19.1,2.615,-18.7,b.paint);b.fixture(-19.65,4.96,-18.7);
  stamp(T,scene,arcade(T,7,2.85,.54,.75),b.paint,bays);
}

export function libraryWings(T,scene,b,arcade){
  const bays=[];
  for(const s of [-1,1]){
    // The original steps open into two upper aisles behind the shelving.
    deck(b,'book-crosswalk',s<0?-21:11.45,s<0?-11.45:21,8.3,11.3,0);
    deck(b,'outer-reading-aisle',s<0?-22:17,s<0?-17:22,-18,11.3,0);
    stairs(T,scene,b,s*19,-14,0,1.8,6.3,4.7);
    deck(b,'terrace-crosswalk',s<0?-22:6,s<0?-6:22,-25,-20.2,1.8);
    for(const z of [-11,-4,3,10])bays.push([s*21.7,0,z,Math.PI/2]);
  }
  deck(b,'hidden-reading-nook',10.5,16.9,-2,4,.12);
  deck(b,'reading-nook-threshold',15.9,17.2,-.6,1.5,.12);
  b.arch(16.85,.12,.34,2.3,1.23,.29,.5,Math.PI/2);
  b.box(.36,2.5,6,10.7,1.37,1,b.wood);
  b.slab(1.05,.18,2.1,11.8,.68,1,b.wood);b.box(.68,.44,1.82,11.8,.34,1,b.paint);
  b.desk(14.6,.12,-.8,1.5,.9,.85);b.fixture(14.5,3.15,-.8,true);
  stamp(T,scene,arcade(T,7,2.75,.43,.82),b.plaster,bays);
}

export function loftRing(T,scene,b){
  const floor=new T.CylinderGeometry(12.98,12.7,.46,12,1,false,0);
  const disc=new T.Mesh(floor,b.floor);disc.position.y=-.245;scene.add(solid(disc,{material:'wood',id:'observatory-ring'}));
}

export function poolWings(T,outer,inner,b,mat,trim,arcade){
  // Off the main stair a dry dogleg overlooks two shallow hipped vaults. They
  // share three thresholds so the player can double back without the cistern door.
  const pc=(id,x1,x2,z1,z2,h,m=mat)=>deck(b,id,x1,x2,z1,z2,h,m);
  pc('upper-east-link',13.95,26,-3,12,1.8);pc('dry-viaduct',24,30,-29,12,1.8);
  stairs(T,outer,b,26.8,-26,1.8,-.8,7,5.9,0,mat);
  pc('sunken-east-hall',9,23.9,-22,4,-.8);
  for(const x of [-24.35,-15.65,15.65,24.35])b.box(1.08,.29,3.9,x,-.61,-37.9,trim,outer);
  pc('long-wet-hall',-18,28,-43,-32.9,-.8);pc('east-wet-link',16,22,-33,-21,-.8);
  pc('reservoir-walk',-25,-14,-47,-32.9,-.8);
  stairs(T,outer,b,-17.5,-38,-.8,1.85,8,5.3,0,mat);
  pc('oculus-gallery',-26,-10,-59,-45.9,1.85);
  pc('lower-curved-aisle',-13,13,-39,-35,-.8);
  const bays=[],lintels=[];
  for(const z of [-18,-9,0])for(const x of [15,23.5])bays.push([x,-.8,z,Math.PI/2]);
  for(const x of [-11,-2,7])for(const z of [-42.3,-33.5])bays.push([x,-.8,z,0]);
  for(const z of [-9,-18])lintels.push([19,5.13,z,0,9.4,.38,8.8]);
  for(const z of [-6.8,-13.9,-21])b.arch(26.8,1.8,z,5,1.91,.42,.74,0,trim,outer);
  stamp(T,outer,arcade(T,7.7,1.35,.65,1.04,.3),mat,bays);
  stamp(T,outer,new T.BoxGeometry(),trim,lintels);
  // Extend both wet aisles to the full length of the cistern, then fold them into a return ambulatory.
  for(const s of [-1,1]){
    pc('cistern-side-aisle',s<0?-19.5:10,s<0?-10:19.5,-118,-68,-.8);
    pc('cistern-ambulatory',s<0?-17:0,s<0?0:17,-117,-111,-.8);
  }
}

export function draftWings(T,scene,b){
  // Terraced offcuts form short jumpable gaps to the paper fan seen from the entry.
  for(const [x,z,w,d,h] of [[-12,-12.1,4.3,4.45,2.53],[-13.3,-17,4.8,3.8,2.75],[-14.6,-21.8,5.1,4,3.04],[-15.2,-26.3,5.8,3.55,3.32]]){
    deck(b,'offcut-island',x-w/2,x+w/2,z-d/2,z+d/2,h,b.floor,.5);
    b.box(w*.78,.32,d*.9,x+.11,h-.66,z,b.paint);
  }
}
