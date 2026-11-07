import { STAGES, createBricks } from './p34-breakout-levels.js?v=20261107-juice';

export const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const approach = (a,b,d) => a<b?Math.min(a+d,b):Math.max(a-d,b);

export function sweepBall(x,y,dx,dy,rect,r) {
  const left=rect.x-rect.w/2-r, right=rect.x+rect.w/2+r;
  const top=rect.y-rect.h/2-r, bottom=rect.y+rect.h/2+r;
  if((dx===0&&(x<left||x>right))||(dy===0&&(y<top||y>bottom)))return null;
  const tx1=dx===0?-Infinity:(left-x)/dx, tx2=dx===0?Infinity:(right-x)/dx;
  const ty1=dy===0?-Infinity:(top-y)/dy, ty2=dy===0?Infinity:(bottom-y)/dy;
  const nearX=Math.min(tx1,tx2),nearY=Math.min(ty1,ty2),t=Math.max(nearX,nearY);
  if(t<0||t>1||t>Math.min(Math.max(tx1,tx2),Math.max(ty1,ty2)))return null;
  return {t,nx:nearX>nearY?-Math.sign(dx):0,ny:nearX>nearY?0:-Math.sign(dy)};
}

export class BreakoutGame {
  constructor({width=1200,height=750,level=STAGES[0],edition='draft',mode='campaign',workshopX=null}={}) {
    this.width=width;this.height=height;this.level=level;this.edition=edition;this.mode=mode;this.workshopX=workshopX;
    this.baseSpeed=width<800?460:595;this.maxSpeed=width<800?850:1150;
    this.stats={launches:0,returns:0,misses:0,clears:0,hits:0,perfect:0};
    this.sessionTime=0;this.events=[];this.retry();
  }
  emit(kind,extra={}) { this.events.push({kind,...extra}); }
  resize(width,height) {
    if(width===this.width&&height===this.height)return;
    const sx=width/this.width,sy=height/this.height;
    this.ball.x*=sx;this.ball.y*=sy;this.paddle.x*=sx;
    const health=new Map(this.bricks.map(b=>[b.id,b.hp]));
    this.width=width;this.height=height;this.baseSpeed=width<800?460:595;this.maxSpeed=width<800?850:1150;
    this.bricks=createBricks(this.level,width,height,this.workshopX);for(const b of this.bricks)b.hp=health.get(b.id);
    this.paddle.w=this.edition==='draft'?width<800?108:128:width<800?118:146;
    this.paddle.x=clamp(this.paddle.x,this.paddle.w/2,width-this.paddle.w/2);this.paddle.y=height-Math.max(80,height*.12);
    if(this.status==='playing')this.normalize(clamp(Math.hypot(this.ball.vx,this.ball.vy)*sx,this.baseSpeed,this.maxSpeed));
  }
  retry() {
    this.bricks=createBricks(this.level,this.width,this.height,this.workshopX);
    this.paddle={x:this.width/2,y:this.height-Math.max(80,this.height*.12),w:this.edition==='draft'?this.width<800?108:128:this.width<800?118:146,h:15,vx:0,angle:0,angularVelocity:0};
    this.ball={x:this.paddle.x,y:this.paddle.y-22,r:9,vx:0,vy:0};
    this.time=0;this.score=0;this.energy=0;this.combo=0;this.bestCombo=0;this.lives=3;this.freeze=0;
    this.lastBreak=-10;this.lastReturn=-10;this.pending=-10;this.swingCooldown=0;this.dashCooldown=0;this.dashTime=0;
    this.status='ready';this.boosted=false;this.lastOffset=0;this.emit('ready');
  }
  launch() {
    if(this.status!=='ready')return false;
    this.status='playing';this.ball.vx=this.baseSpeed*.14;this.ball.vy=-this.baseSpeed*.99;
    this.stats.launches++;this.emit('launch');return true;
  }
  swing() {
    if(this.status==='ready')return this.launch();
    if(this.status!=='playing'||this.swingCooldown>0)return false;
    this.swingCooldown=.24;
    if(this.time-this.lastReturn<=.12&&!this.boosted)this.boost(this.time-this.lastReturn<=.07);
    else this.pending=this.time+.14;
    this.emit('swing');return true;
  }
  dash() {
    if(!['ready','playing'].includes(this.status)||this.dashCooldown>0)return;
    this.dashTime=.17;this.dashCooldown=.7;this.emit('dash');
  }
  boost(perfect) {
    if(this.boosted)return;
    this.boosted=true;
    const speed=Math.min(this.maxSpeed,Math.hypot(this.ball.vx,this.ball.vy)*(perfect?1.32:1.12));
    this.normalize(speed);this.energy=Math.min(100,this.energy+(perfect?8:3));
    if(perfect)this.stats.perfect++;
    this.freeze=Math.max(this.freeze,perfect?.085:.045);this.emit('boost',{perfect});
  }
  normalize(speed) {
    const b=this.ball,n=Math.hypot(b.vx,b.vy);
    b.vx=b.vx/n*speed;b.vy=b.vy/n*speed;
    if(Math.abs(b.vy)<speed*.27){b.vy=(b.vy<0?-1:1)*speed*.27;b.vx=(b.vx<0?-1:1)*Math.sqrt(speed*speed-b.vy*b.vy);}
  }
  returnBall(offset) {
    const b=this.ball,p=this.paddle,speed=Math.max(this.baseSpeed,Math.hypot(b.vx,b.vy));
    if(this.edition==='draft') {
      b.vx+=p.vx*.48+offset*speed*.32;b.vy=-Math.abs(b.vy);this.normalize(Math.min(speed*1.025,this.maxSpeed));
    } else if(this.edition==='tuned') {
      const angle=clamp(offset,-1,1)*1.07;
      b.vx=Math.sin(angle)*speed+p.vx*.07;b.vy=-Math.cos(angle)*speed;this.normalize(speed);
    } else {
      const alive=this.bricks.filter(brick=>brick.hp>0);
      const target=alive.reduce((best,brick)=>!best||Math.hypot(brick.x-b.x,brick.y-b.y)<Math.hypot(best.x-b.x,best.y-b.y)?brick:best,null);
      b.vx=target?target.x-b.x:0;b.vy=target?target.y-b.y:-1;this.normalize(speed);
    }
    this.lastReturn=this.time;this.lastOffset=offset;this.boosted=false;this.stats.returns++;p.angularVelocity+=offset*1.4;
    if(this.pending>=this.time)this.boost(this.pending-this.time>=.07);
    this.pending=-10;this.freeze=Math.max(this.freeze,.035);this.emit('return',{offset,x:b.x,y:b.y,vx:b.vx,vy:b.vy});
  }
  damage(brick,amount) {
    if(brick.hp<=0)return;
    brick.hp=Math.max(0,brick.hp-amount);this.stats.hits++;this.score+=30;
    this.emit('hit',{id:brick.id,x:brick.x,y:brick.y,hp:brick.hp,kindOfBrick:brick.kind,vx:this.ball.vx,vy:this.ball.vy});
    this.freeze=Math.max(this.freeze,brick.hp>0?.032:.042);
    if(brick.hp>0)return;
    this.combo=this.time-this.lastBreak<2.8?this.combo+1:1;this.lastBreak=this.time;this.bestCombo=Math.max(this.bestCombo,this.combo);
    this.score+=100+Math.min(15,this.combo-1)*20;this.energy=Math.min(100,this.energy+(brick.kind==='energy'?38:5));
    this.emit('break',{id:brick.id,x:brick.x,y:brick.y,kindOfBrick:brick.kind,combo:this.combo});
    if(brick.kind==='bomb') {
      this.freeze=Math.max(this.freeze,.075);this.emit('explode',{x:brick.x,y:brick.y});
      const radius=this.width*.13;
      for(const other of this.bricks)if(other.hp>0&&Math.hypot(other.x-brick.x,(other.y-brick.y)*1.1)<radius)this.damage(other,3);
    }
    if(this.bricks.every(b=>b.hp===0)&&this.mode!=='seeking'&&this.status!=='cleared') {
      this.status='cleared';this.stats.clears++;this.emit('clear');
    }
  }
  laser() {
    if(this.energy<100||this.status!=='playing')return false;
    this.energy=0;this.emit('laser',{x:this.paddle.x});
    for(const b of this.bricks)if(b.hp>0&&Math.abs(b.x-this.paddle.x)<=b.w/2+15)this.damage(b,3);
    this.freeze=Math.max(this.freeze,.075);return true;
  }
  moveBomb(x) {
    if(this.workshopX===null||this.status!=='ready')return;
    this.workshopX=clamp(x,400,1500);
    const bomb=this.bricks.find(b=>b.movable);bomb.x=bomb.baseX=this.workshopX/1920*this.width;
    this.emit('place',{x:this.workshopX});
  }
  step(dt,{axis=0,target=null,attract=false}={}) {
    if(!['playing','ready'].includes(this.status))return;
    const p=this.paddle,b=this.ball;
    this.swingCooldown=Math.max(0,this.swingCooldown-dt);this.dashCooldown=Math.max(0,this.dashCooldown-dt);this.dashTime=Math.max(0,this.dashTime-dt);
    if(this.status==='playing') {
      this.time+=dt;this.sessionTime+=dt;
      if(this.freeze>0){this.freeze=Math.max(0,this.freeze-dt);return;}
    }
    const max=this.width*(this.dashTime>0?2.2:1.12),desired=axis?axis*max:target===null?0:clamp((target-p.x)*20,-max,max);
    p.vx=approach(p.vx,desired,this.width*9*dt);p.x=clamp(p.x+p.vx*dt,p.w/2,this.width-p.w/2);
    if(p.x===p.w/2||p.x===this.width-p.w/2)p.vx=0;
    const lean=clamp(p.vx/(this.width*.85),-1,1)*.135;
    p.angularVelocity+=((lean-p.angle)*190-p.angularVelocity*16)*dt;p.angle+=p.angularVelocity*dt;
    if(this.status==='ready'){b.x=p.x;b.y=p.y-p.h/2-b.r-2;return;}
    if(this.level.motion) {
      const m=this.level.motion;
      for(const brick of this.bricks){
        const shift=Math.sin(this.time*m.speed+(m.alternate?brick.row*Math.PI:0))*(m.axis==='x'?this.width*m.amount:m.amount);
        brick.x=brick.baseX+(m.axis==='x'?shift:0);brick.y=brick.baseY+(m.axis==='y'?shift:0);
      }
    }
    const speed=Math.hypot(b.vx,b.vy);
    if(speed>this.baseSpeed)this.normalize(Math.max(this.baseSpeed,speed-(speed-this.baseSpeed)*.48*dt));
    if(attract&&this.energy>0&&b.vy>0) {
      b.vx+=clamp((p.x-b.x)*3,-this.width,this.width)*dt;this.energy=Math.max(0,this.energy-24*dt);this.normalize(Math.hypot(b.vx,b.vy));
    }
    let left=dt;
    for(let i=0;i<8&&left>1e-7&&this.status==='playing';i++) {
      const dx=b.vx*left,dy=b.vy*left;let hit=null;
      const choose=(candidate)=>{if(candidate&&candidate.t>=0&&candidate.t<=1&&(!hit||candidate.t<hit.t))hit=candidate;};
      if(dx<0)choose({t:(b.r-b.x)/dx,nx:1,ny:0,wall:'left'});
      if(dx>0)choose({t:(this.width-b.r-b.x)/dx,nx:-1,ny:0,wall:'right'});
      if(dy<0)choose({t:(90+b.r-b.y)/dy,nx:0,ny:1,wall:'top'});
      if(dy>0&&b.y<=p.y-p.h/2-b.r) {
        const t=(p.y-p.h/2-b.r-b.y)/dy,x=b.x+dx*t;
        if(Math.abs(x-p.x)<=p.w/2+b.r*.65)choose({t,nx:0,ny:-1,paddle:true});
      }
      for(const brick of this.bricks)if(brick.hp>0){const contact=sweepBall(b.x,b.y,dx,dy,brick,b.r);if(contact)choose({...contact,brick});}
      if(!hit){b.x+=dx;b.y+=dy;break;}
      b.x+=dx*hit.t;b.y+=dy*hit.t;left*=1-hit.t;
      if(hit.wall==='right'&&this.mode==='seeking'&&b.y>this.height*.27&&b.y<this.height*.68&&this.lastOffset>.2) {
        this.status='found';this.emit('found');break;
      }
      if(hit.paddle)this.returnBall(clamp((b.x-p.x)/(p.w/2),-1,1));
      else {
        if(hit.brick)this.damage(hit.brick,1);
        const pass=hit.brick&&hit.brick.kind!=='normal';
        if(!pass){const dot=b.vx*hit.nx+b.vy*hit.ny;b.vx-=2*dot*hit.nx;b.vy-=2*dot*hit.ny;}
        if(hit.wall)this.emit('wall',{wall:hit.wall,x:b.x,y:b.y});
      }
      b.x+=b.vx*.00002;b.y+=b.vy*.00002;
    }
    if(b.y>this.height+30&&this.status==='playing') {
      this.lives--;this.stats.misses++;this.combo=0;this.status=this.lives>0?'ready':'lost';
      this.pending=-10;this.emit('miss');b.vx=b.vy=0;
    }
  }
}
