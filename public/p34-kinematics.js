// Feet are in metres. Run the controller at 120 Hz, independently of rendering.
export const TICK = 1 / 120, RADIUS = .34, HEIGHT = 1.72, STEP = .48;
export function createBody(spawn) {
  return { ...spawn, vx:0, vy:0, vz:0, grounded:false, grace:0, buffer:0, fallTime:0,
    safe:{x:spawn.x,y:spawn.y,z:spawn.z}, rescue:null, footing:null, dip:0, stairOffset:0 };
}
export function queueJump(body) { body.buffer = .12; }

function nearestLedge(p, world) {
  let best = p.safe, distance = Math.hypot(best.x-p.x, best.z-p.z, best.y-p.y);
  // Land a whole foot inside a ledge, not on its last millimetre.
  for (let r=.65; r<=Math.min(11,distance+.8); r+=.65) for(let i=0;i<16;i++){
    const x=p.x+r*Math.cos(i*Math.PI/8), z=p.z+r*Math.sin(i*Math.PI/8);
    const s=world.support(x,z,Math.max(p.safe.y,p.y)+STEP,0);
    if(!s || s.y<p.y || world.blocked(x,z,s.y+.01,HEIGHT,RADIUS)) continue;
    if(![[RADIUS,0],[-RADIUS,0],[0,RADIUS],[0,-RADIUS]].every(([dx,dz])=>{
      const edge=world.support(x+dx,z+dz,s.y+.1,0);
      return edge && Math.abs(edge.y-s.y)<.22;
    })) continue;
    const d=Math.hypot(r,s.y-p.y);
    if(d<distance){best={x,y:s.y,z};distance=d;}
  }
  return {...best};
}
const ease=t=>t*t*(3-2*t);
export function advanceBody(p, world, desiredX, desiredZ, dt = TICK) {
  const event = {};
  p.dip *= Math.exp(-dt*10); p.stairOffset *= Math.exp(-dt*19);
  if(p.rescue){
    const c=p.rescue, lastY=p.y;
    c.time+=dt;
    const t=Math.min(1,c.time/.65), h=ease(Math.min(1,t/.82));
    // First brake the fall. Rise outside the lip before easing horizontally onto it.
    const reach=ease(Math.max(0,(t-.54)/.46));
    p.x=c.x+(c.to.x-c.x)*reach; p.z=c.z+(c.to.z-c.z)*reach;
    p.y=c.y+(c.to.y-c.y)*h+c.vy*.65*t*(1-t)**4 + .24*Math.sin(Math.PI*t)**2;
    p.vy=(p.y-lastY)/dt;
    if(t===1){ Object.assign(p,c.to);p.grounded=true; p.vy=0; p.rescue=null; p.safe={...c.to}; p.fallTime=0; event.rescued=true; }
    return event;
  }
  const wasGrounded=p.grounded;
  if(wasGrounded)p.grace=.12;
  const jumped=p.buffer>0 && p.grace>0;
  if(jumped){ p.vy=6.75; p.grounded=false; p.buffer=p.grace=0; event.jump=true; }
  const acceleration=(p.grounded ? (desiredX || desiredZ ? 42 : 57) : 14)*dt;
  const dx=desiredX-p.vx,dz=desiredZ-p.vz,ratio=Math.min(1,acceleration/(Math.hypot(dx,dz)||1));
  p.vx+=dx*ratio;p.vz+=dz*ratio;
  for(const [axis,v] of [['x','vx'],['z','vz']]){
    if(!p[v])continue;
    const next=p[axis]+p[v]*dt, x=axis==='x'?next:p.x, z=axis==='z'?next:p.z;
    const step=p.grounded ? world.support(x,z,p.y+STEP,RADIUS) : null;
    const at=step && step.y>p.y ? step.y : p.y;
    if(world.blocked(x,z,at+.004,HEIGHT,RADIUS) ||
       (at>p.y && world.ceiling(p.x,p.z,p.y+HEIGHT,at+HEIGHT,RADIUS)<at+HEIGHT)){ p[v]=0; continue; }
    p[axis]=next;
    if(at>p.y){p.stairOffset+=p.y-at; p.y=at;}
  }
  p.vy-=18*dt;
  let y=p.y+p.vy*dt;
  if(p.vy>0){
    const roof=world.ceiling(p.x,p.z,p.y+HEIGHT,y+HEIGHT,RADIUS);
    if(roof<=y+HEIGHT){ y=roof-HEIGHT-.001; p.vy=0; }
  }
  const floor=world.support(p.x,p.z,p.y+.003,RADIUS), impact=-p.vy;
  p.grounded=Boolean(p.vy<=0 && floor && y<=floor.y+.001);
  if(p.grounded){
    y=floor.y;p.vy=0;p.fallTime=0;p.footing=floor;
    const center=world.support(p.x,p.z,y+.02,0);
    if(center && Math.abs(center.y-y)<.1)p.safe={x:p.x,y,z:p.z};
    if(!wasGrounded && impact>1.5){event.landed=impact;p.dip=Math.min(.11,impact*.009);}
  }else{ p.footing=null; p.fallTime=p.vy<0 ? p.fallTime+dt : 0; }
  p.y=y;
  const plunge=!floor || (p.safe.y-floor.y>4.5 && p.y-floor.y>2.4);
  if(plunge && p.fallTime>=.45 && p.y<p.safe.y-1){
    p.rescue={x:p.x,y:p.y,z:p.z,vy:p.vy,to:nearestLedge(p,world),time:0};
    p.vx=p.vz=0;event.catch=true;
  }
  p.buffer=Math.max(0,p.buffer-dt);p.grace=Math.max(0,p.grace-dt);
  return event;
}
