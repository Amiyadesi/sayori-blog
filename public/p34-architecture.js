import { Box3, Matrix4, Plane, Triangle, Vector3 } from './third-party/three/three.module.min.js';

const v = () => new Vector3();
const UP = new Vector3(0, 1, 0);
const EPS = .0001;

// A vertical ray through a convex solid gives one occupied interval. Clipping the
// same ray against the side planes expanded by the player's radius gives body contact.
function hull(points, planes) {
  return { bounds: new Box3().setFromPoints(points), planes };
}
function face(a, b, c, inside) {
  const p = new Plane().setFromCoplanarPoints(a, b, c);
  if (p.distanceToPoint(inside) > 0) p.negate();
  return p;
}
function geometryHull(g) {
  const attr=g.attributes.position, points=[], planes=[], seen=new Set(), tri=new Triangle();
  for (let i=0;i<attr.count;i++) points.push(v().fromBufferAttribute(attr,i));
  const center=new Box3().setFromPoints(points).getCenter(v());
  for(let i=0,n=g.index?.count??points.length;i<n;i+=3) {
    const [a,b,c]=[i,i+1,i+2].map(j=>points[g.index?g.index.getX(j):j]);
    tri.set(a,b,c); if(tri.getArea()<1e-8)continue;
    const p=face(a,b,c,center), key=[p.normal.x,p.normal.y,p.normal.z,p.constant].map(n=>Math.round(n*10000)).join(',');
    if(!seen.has(key)){planes.push(p);seen.add(key);}
  }
  return [hull(points,planes)];
}

// An arch is concave. Its actual triangulated front cap already contains the
// opening: extrude those triangles, rather than fitting a box across the door.
function archPrisms(g) {
  g.computeBoundingBox();
  const near=g.boundingBox.min.z, far=g.boundingBox.max.z, parts=[];
  const pos=g.attributes.position, normals=g.attributes.normal, range=g.groups[0];
  for(let i=range.start;i<range.start+range.count;i+=3){
    if(normals.getZ(i)>-.99)continue;
    const [a,b,c]=[i,i+1,i+2].map(j=>v().set(pos.getX(j),pos.getY(j),near));
    const A=a.clone(); A.z=far;
    const center=a.clone().add(b).add(c).multiplyScalar(1/3);center.z=(near+far)/2;
    const faces=[new Plane(new Vector3(0,0,-1),near),new Plane(new Vector3(0,0,1),-far)];
    for(const [p,q] of [[a,b],[b,c],[c,a]]){const r=p.clone();r.z=far;faces.push(face(p,q,r,center));}
    parts.push(hull([a,b,c,A],faces));
  }
  return parts;
}

// Turned stone retains its foot, narrow shaft and flared capital. Each adjacent
// profile pair is one frustum using the same angular divisions as the render mesh.
function turned(g) {
  const {points,segments}=g.parameters, result=[];
  for(let i=1;i<points.length;i++){
    const a=points[i-1], b=points[i]; if(b.y-a.y<EPS)continue;
    const planes=[new Plane(UP.clone().negate(),a.y),new Plane(UP.clone(),-b.y)],r=Math.max(a.x,b.x);
    for(let j=0;j<segments;j++){
      const angle=(j+.5)*Math.PI*2/segments, k=Math.cos(Math.PI/segments), slope=(b.x-a.x)/(b.y-a.y);
      planes.push(new Plane(new Vector3(Math.sin(angle),-slope*k,Math.cos(angle)),k*(slope*a.y-a.x)).normalize());
    }
    result.push(hull([new Vector3(-r,a.y,-r),new Vector3(r,b.y,r)],planes));
  }
  return result;
}
// Open cylinder vaults are skins, not filled half-drums. Give each drawn facet
// its construction thickness without closing the air underneath.
function shellPrisms(g) {
  const pos=g.attributes.position,parts=[];
  for(let i=0,n=g.index?.count??pos.count;i<n;i+=3){
    const [a,b,c]=[i,i+1,i+2].map(j=>v().fromBufferAttribute(pos,g.index?g.index.getX(j):j));
    const normal=new Triangle(a,b,c).getNormal(v());if(!normal.lengthSq())continue;
    const d=normal.multiplyScalar(-.055), A=a.clone().add(d),B=b.clone().add(d),C=c.clone().add(d);
    const center=a.clone().add(b).add(c).multiplyScalar(1/3).addScaledVector(d,.5);
    parts.push(hull([a,b,c,A,B,C],[[a,b,c],[A,B,C],[a,b,B],[b,c,C],[c,a,A]].map(([a,b,c])=>face(a,b,c,center))));
  }
  return parts;
}
const cached=new WeakMap();
function partsFor(g) {
  if(!cached.has(g))cached.set(g,g.userData.pierced ? archPrisms(g) : g.type==='LatheGeometry' ? turned(g) : g.parameters?.openEnded ? shellPrisms(g) : geometryHull(g));
  return cached.get(g);
}

function transformed(part, matrix, meta) {
  const box=part.bounds.clone().applyMatrix4(matrix);
  const planes=part.planes.map(source=>{
    const p=source.clone().applyMatrix4(matrix), {x,y,z}=p.normal;
    return [x,y,z,p.constant,Math.hypot(x,z)];
  });
  return {box,planes,...meta};
}

function interval(s,x,z,r) {
  if(x<s.box.min.x-r||x>s.box.max.x+r||z<s.box.min.z-r||z>s.box.max.z+r)return null;
  let lo=-Infinity,hi=Infinity,slope=0;
  for(const [a,b,c,d,n] of s.planes) {
    const h=r*n-a*x-c*z-d;
    if(Math.abs(b)<1e-6){if(h< -EPS)return null;}
    else if(b<0)lo=Math.max(lo,h/b);
    else if(h/b<hi){hi=h/b;slope=b;}
    if(lo-hi>EPS)return null;
  }
  lo=Math.max(lo,s.box.min.y);hi=Math.min(hi,s.box.max.y);
  return lo<=hi+EPS ? {lo,hi,slope} : null;
}
const cellSize=5, key=(x,z)=>Math.floor(x/cellSize)*100003+Math.floor(z/cellSize);
export function createArchitectureIndex() {
  const cells=new Map(), movers=[], live=[], tmp=new Matrix4();
  function addStatic(s){
    // The character/guide query uses a footprint under one metre.
    const b=s.box;
    for(let x=Math.floor((b.min.x-1)/cellSize);x<=Math.floor((b.max.x+1)/cellSize);x++)
      for(let z=Math.floor((b.min.z-1)/cellSize);z<=Math.floor((b.max.z+1)/cellSize);z++){
        const k=x*100003+z; if(!cells.has(k))cells.set(k,[]);cells.get(k).push(s);
      }
  }
  function active(node) {
    for(let p=node;p;p=p.parent)if(!p.visible||p.userData.collisionDisabled)return false;
    return true;
  }
  function add(root) {
    root.updateWorldMatrix(true,true);
    root.traverse(mesh=>{
      if(!mesh.isMesh||!mesh.userData.solid)return;
      for(let n=mesh;n;n=n.parent)if(n.userData.presentation)return;
      let dynamic=false, id,material;
      for(let n=mesh;n;n=n.parent){dynamic ||= !!n.userData.movingSolid;id ||= n.userData.solidId;material ||= n.userData.stepMaterial;}
      const meta={id:id||mesh.name||'masonry', material:material||'stone',
        bevel:!mesh.geometry.userData.pierced && mesh.geometry.parameters?.options?.bevelEnabled
          ? mesh.geometry.parameters.options.bevelThickness : 0};
      const parts=partsFor(mesh.geometry), poses=[];
      if(mesh.isInstancedMesh){for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,tmp);poses.push(tmp.clone());}}
      else poses.push(new Matrix4());
      if(dynamic){
        movers.push({mesh,poses,parts,meta,wasActive:false,previous:null,world:[]});
      } else if(active(mesh)){
        for(const pose of poses){tmp.multiplyMatrices(mesh.matrixWorld,pose);for(const p of parts)addStatic(transformed(p,tmp,meta));}
      }
    });
    update();
  }
  function update(){
    live.length=0;
    for(const m of movers){
      const visible=active(m.mesh);
      if(visible){
        m.mesh.updateWorldMatrix(true,false);
        if(!m.wasActive||!m.previous?.equals(m.mesh.matrixWorld)){
          m.previous=m.mesh.matrixWorld.clone();m.world=[];
          for(const p of m.poses){
            tmp.multiplyMatrices(m.mesh.matrixWorld,p);
            for(const part of m.parts)m.world.push(transformed(part,tmp,m.meta));
          }
        }
        for(const s of m.world)live.push(s);
      }
      m.wasActive=visible;
    }
  }
  const empty=[];
  function query(x,z,r,test) {
    for(const list of [cells.get(key(x,z))||empty,live])for(const s of list){
      const span=interval(s,x,z,r);
      if(span&&test(span,s))return true;
    }
    return false;
  }
  function support(x,z,ceiling,r=.32) {
    let best=null;
    query(x,z,r,({hi,slope},s)=>{
      // A rounded tread nose can be steep for its first few millimetres. It is
      // still a step when its flat crown is within the controller's step reach.
      const treadLip=s.bevel && s.box.max.y-hi<=s.bevel+EPS && s.box.max.y<=ceiling+EPS;
      if((slope>.58 || treadLip) && hi<=ceiling+EPS && (!best || hi>best.y))best={y:hi,id:s.id,material:s.material};
    });
    return best;
  }
  function blocked(x,z,feet,height=1.65,r=.36) {
    return query(x,z,r,({lo,hi})=>hi>feet+.005&&lo<feet+height-.005);
  }
  function ceiling(x,z,headFrom,headTo,r=.36){
    let best=Infinity;query(x,z,r,({lo})=>{if(lo>=headFrom-.006&&lo<=headTo)best=Math.min(best,lo);});return best;
  }
  return {add,update,support,blocked,ceiling};
}

export function solid(mesh,{id,material}={}) {
  mesh.userData.solid=true;
  if(id)mesh.userData.solidId=id;
  if(material)mesh.userData.stepMaterial=material;
  return mesh;
}
