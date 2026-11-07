export const EDITIONS = {
  draft: { name: '初稿', capture: .67, turn: 1.55, guide: false, branch: true },
  tuned: { name: '落点', capture: 1, turn: 1.55, guide: true, branch: true },
  guided: { name: '直达', capture: 1, turn: 1.3, guide: true, branch: false },
};

export const MOONS = [
  { x: 0, y: 0, r: 64 },
  { x: 305, y: -180, r: 63 },
  { x: 70, y: -455, r: 60 },
  { x: 350, y: -735, r: 65 },
  { x: 95, y: -1030, r: 74 },
  { x: 570, y: -420, r: 59, double: true },
  { x: 885, y: -570, r: 70, hidden: true },
];
const TAU = Math.PI * 2;
export const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function segmentCircle(a, b, center, radius) {
  const dx = b.x - a.x, dy = b.y - a.y, x = a.x - center.x, y = a.y - center.y;
  const aa = dx * dx + dy * dy, bb = 2 * (x * dx + y * dy), cc = x * x + y * y - radius * radius;
  if (cc <= 0) return 0;
  const disc = bb * bb - 4 * aa * cc;
  if (!aa || disc < 0) return null;
  const t = (-bb - Math.sqrt(disc)) / (2 * aa);
  return t >= 0 && t <= 1 ? t : null;
}

export function segmentWall(a, b, wall) {
  const [x, y, x2, y2] = wall, length = Math.hypot(x2-x,y2-y);
  const ux=(x2-x)/length, uy=(y2-y)/length;
  const p=[(a.x-x)*ux+(a.y-y)*uy,-(a.x-x)*uy+(a.y-y)*ux];
  const d=[(b.x-a.x)*ux+(b.y-a.y)*uy,-(b.x-a.x)*uy+(b.y-a.y)*ux];
  let lo=0, hi=1;
  for(let axis=0;axis<2;axis++) {
    const min=-7, max=axis===0 ? length+7 : 7;
    if(Math.abs(d[axis])<1e-9) { if(p[axis]<min || p[axis]>max) return null; }
    else { const a=(min-p[axis])/d[axis], b=(max-p[axis])/d[axis]; lo=Math.max(lo,Math.min(a,b)); hi=Math.min(hi,Math.max(a,b)); }
  }
  return lo<=hi ? lo : null;
}

export class OrbitFlight {
  constructor({ version = 'draft', seeking = false, start = 0, workshop = null, workshopRadius = 65, level = null, resume = null } = {}) {
    if (!EDITIONS[version]) throw new Error('Unknown flight edition');
    this.version = version; this.rules = EDITIONS[version]; this.seeking = seeking;
    this.level = level;
    this.moons = (level ? level.moons : MOONS).map(m => ({ ...m }));
    this.walls = level?.walls || [];
    this.winds = (level?.winds || []).map(m => ({ ...m }));
    this.folds = level?.folds || [];
    this.keys = new Set(); this.mask = 0; this.history = []; this.windLock = -1; this.foldLock = 0;
    this.workshop = workshop;
    if (workshop) {
      this.moons = [this.moons[0], { x: workshop[0], y: workshop[1], r: workshopRadius }];
      start = 0;
    }
    this.current = start; this.angle = .2; this.held = false; this.phase = 'orbit';
    this.bird = { x: 0, y: 0, vx: 0, vy: 0 };
    this.time = 0; this.flightTime = 0; this.shots = 0; this.misses = 0; this.landings = 0;
    this.route = [start]; this.events = []; this.place();
    const points = [...this.moons,...this.winds,...this.folds.flatMap(f=>[{x:f[0],y:f[1]},{x:f[2],y:f[3]}])];
    this.bounds = { left:Math.min(...points.map(p=>p.x))-240, right:Math.max(...points.map(p=>p.x))+240, top:Math.min(...points.map(p=>p.y))-240, bottom:Math.max(...points.map(p=>p.y))+240 };
    if (resume) { this.restore(resume); this.shots=resume.shots; this.time=resume.seconds; }
  }

  get destinations() {
    if (this.workshop) return this.current === 0 ? [1] : [];
    if (this.level) return this.moons.map((_,i)=>i).filter(i=>i!==this.current);
    return ({ 0: [1], 1: this.rules.branch ? [2, 5] : [2], 2: [3], 3: [4], 4: [], 5: this.seeking ? [6, 3] : [3], 6: [] })[this.current];
  }
  get radius() { return this.moons[this.current].r; }
  place() {
    const m = this.moons[this.current];
    this.bird.x = m.x + Math.cos(this.angle) * m.r;
    this.bird.y = m.y + Math.sin(this.angle) * m.r;
  }
  direction() {
    if (this.version === 'guided' && !this.level) {
      const m = this.moons[this.destinations[0]];
      return Math.atan2(m.y - this.bird.y, m.x - this.bird.x);
    }
    return this.angle + Math.PI / 2;
  }
  aimAt(x,y) {
    if(this.phase!=='orbit') return;
    const m=this.moons[this.current], dx=x-m.x, dy=y-m.y, distance=Math.hypot(dx,dy);
    if(distance<=m.r+4) return;
    this.angle=Math.atan2(dy,dx)-Math.acos(m.r/distance); this.aiming=true; this.place();
  }
  rotateWind(index) {
    if(this.phase!=='orbit') return;
    this.winds[index].direction=(this.winds[index].direction+1)%4;
    this.events.push({type:'wind-set',index});
  }
  wallOpen(wall) { return wall.length>4 && Boolean(this.mask & (1<<wall[4])) !== Boolean(wall[5]); }
  checkpoint() { return {node:this.current,mask:this.mask,keys:[...this.keys],winds:this.winds.map(w=>w.direction),shots:this.shots,seconds:this.time}; }
  restore(c) {
    this.current=c.node; this.mask=c.mask; this.keys=new Set(c.keys);
    this.winds.forEach((w,i)=>w.direction=c.winds[i]); this.angle=.2; this.phase='orbit'; this.held=false;
    this.windLock=-1; this.foldLock=0; this.place();
  }
  undo() {
    if(!this.history.length) return;
    this.restore(this.history.pop()); this.events.push({type:'undo',node:this.current});
  }
  release() {
    this.held = false; this.aiming = false;
    if (this.phase !== 'orbit') return;
    this.history.push(this.checkpoint()); if(this.history.length>40) this.history.shift();
    const angle = this.direction();
    this.bird.vx = Math.cos(angle) * 420; this.bird.vy = Math.sin(angle) * 420;
    this.phase = 'flight'; this.flightTime = 0; this.shots++; this.windLock=-1; this.foldLock=0;
    this.events.push({ type: 'launch', node: this.current });
  }
  miss(reason = 'away') {
    if (this.phase !== 'flight') return;
    this.misses++; this.phase = 'return'; this.returnTime = .38;
    this.from = { x: this.bird.x, y: this.bird.y }; this.angle = .2;
    this.events.push({ type: 'miss', node: this.current, reason });
  }
  step(dt) {
    this.time += dt;
    if (this.phase === 'won' || this.phase === 'found') return;
    if (this.phase === 'orbit') {
      this.angle = (this.angle + dt * this.rules.turn * (this.held ? this.level || this.aiming ? 0 : .24 : 1)) % TAU;
      this.place(); return;
    }
    if (this.phase === 'return') {
      this.returnTime = Math.max(0, this.returnTime - dt);
      this.place(); const p = (this.returnTime / .38) ** 2;
      this.bird.x += (this.from.x - this.bird.x) * p;
      this.bird.y += (this.from.y - this.bird.y) * p;
      if (!this.returnTime) this.phase = 'orbit';
      return;
    }
    this.flightTime += dt;
    this.foldLock=Math.max(0,this.foldLock-dt);
    const end = { x: this.bird.x + this.bird.vx * dt, y: this.bird.y + this.bird.vy * dt };
    let hit = null;
    const offer = (type, id, t) => { if(t!==null && (!hit || t<hit.t)) hit={type,id,t}; };
    for(let i=0;i<this.walls.length;i++) if(!this.wallOpen(this.walls[i])) offer('wall',i,segmentWall(this.bird,end,this.walls[i]));
    for(let i=0;i<this.winds.length;i++) {
      const wind=this.winds[i];
      if(this.windLock===i && Math.hypot(this.bird.x-wind.x,this.bird.y-wind.y)>wind.r+12) this.windLock=-1;
      if(this.windLock!==i) offer('wind',i,segmentCircle(this.bird,end,wind,wind.r));
    }
    if(!this.foldLock) for(let i=0;i<this.folds.length;i++) for(let side=0;side<2;side++) {
      const fold=this.folds[i], m={x:fold[side*2],y:fold[side*2+1]};
      offer('fold',i*2+side,segmentCircle(this.bird,end,m,30));
    }
    for (const id of this.destinations) {
      const moon = this.moons[id];
      const t = segmentCircle(this.bird, end, moon, moon.r * this.rules.capture);
      offer('moon',id,t);
    }
    Object.assign(this.bird, end);
    if(hit?.type==='wall') { this.miss('wall'); return; }
    if(hit?.type==='wind') {
      const wind=this.winds[hit.id], angle=wind.direction*Math.PI/2;
      this.bird={x:wind.x,y:wind.y,vx:Math.cos(angle)*420,vy:Math.sin(angle)*420};
      this.windLock=hit.id; this.events.push({type:'wind',index:hit.id,direction:wind.direction}); return;
    }
    if(hit?.type==='fold') {
      const fold=this.folds[Math.floor(hit.id/2)], side=hit.id%2, turn=(side ? -1 : 1)*fold[4]*Math.PI/2, angle=Math.atan2(this.bird.vy,this.bird.vx)+turn;
      const target=(1-side)*2;
      const dx=this.bird.x-fold[side*2], dy=this.bird.y-fold[side*2+1];
      this.bird={x:fold[target]+dx*Math.cos(turn)-dy*Math.sin(turn)+Math.cos(angle)*72,y:fold[target+1]+dx*Math.sin(turn)+dy*Math.cos(turn)+Math.sin(angle)*72,vx:Math.cos(angle)*420,vy:Math.sin(angle)*420};
      this.foldLock=.22; this.events.push({type:'fold',index:Math.floor(hit.id/2)}); return;
    }
    if (hit) {
      this.current = hit.id; this.landings++; this.route.push(hit.id);
      const m = this.moons[hit.id]; this.angle = Math.atan2(this.bird.y - m.y, this.bird.x - m.x);
      if(m.key) this.keys.add(hit.id);
      if(m.switch!==undefined) { this.mask^=1<<m.switch; this.events.push({type:'switch',channel:m.switch}); }
      this.phase = this.level ? (hit.id===this.level.finish && this.moons.every((m,i)=>!m.key || this.keys.has(i)) ? 'won' : 'orbit') : this.seeking && hit.id === 6 ? 'found' : this.workshop || hit.id === 4 ? 'won' : 'orbit';
      this.place(); this.events.push({ type: 'land', node: hit.id });
      if(this.level && hit.id===this.level.finish && this.phase!=='won') this.events.push({type:'missing-keys'});
      if (this.phase === 'won' || this.phase === 'found') this.events.push({ type: this.phase });
    } else if (this.level ? this.flightTime>8 || this.bird.x<this.bounds.left || this.bird.x>this.bounds.right || this.bird.y<this.bounds.top || this.bird.y>this.bounds.bottom : this.flightTime > 2.6) this.miss();
  }
  report() { return { version: this.version, shots: this.shots, misses: this.misses, landings: this.landings, route: [...this.route], won: this.phase === 'won' }; }
  prediction(seconds = 1.6) {
    const g=Object.assign(Object.create(OrbitFlight.prototype),this);
    g.bird={...this.bird}; g.events=[]; g.history=[]; g.keys=new Set(this.keys); g.route=[...this.route];
    g.release(); const points=[{x:g.bird.x,y:g.bird.y}];
    for(let i=0;i<seconds*60 && g.phase==='flight';i++) { g.step(1/60); points.push({x:g.bird.x,y:g.bird.y,fold:g.events.some(e=>e.type==='fold')});g.events=[]; }
    return {points,hit:g.phase==='orbit'||g.phase==='won' ? g.current : null};
  }
}
