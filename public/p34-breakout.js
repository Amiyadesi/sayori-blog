import { BreakoutGame, LASER_DURATION } from './p34-breakout-core.js?v=20261108-revision';
import { STAGES, SAMPLE, WORKSHOP } from './p34-breakout-levels.js?v=20261108-revision';
import { lightPoint } from './p34-light.js?v=20261108-revision';

const keys=['launches','returns','misses','clears','hits','perfect'];
export function playDelta(report, previous) {
  if(!report||!['ready','stage','launch','return','miss','clear','play','place','exit'].includes(report.kind))throw new Error('未知游戏事件');
  if(!Number.isInteger(report.elapsed)||report.elapsed<0||!report.counts)throw new Error('游戏记录格式有误');
  const current={...report.counts,seconds:report.elapsed},delta={};
  for(const key of [...keys,'seconds']){
    if(!Number.isInteger(current[key])||current[key]<(previous[key]||0))throw new Error('游戏计数发生倒退');
    delta[key]=current[key]-(previous[key]||0);
  }
  return {current,delta};
}

export function mountBreakout(shell,{state,edition='draft',mode='campaign',previous=false,motion,onEvent,onClose}) {
  const controller=new AbortController(),{signal}=controller;
  const listen=(el,type,fn,options={})=>el.addEventListener(type,fn,{signal,...options});
  const root=document.createElement('section');root.className='breakout-scene';root.tabIndex=-1;root.setAttribute('aria-label','打砖块');
  root.innerHTML=`<canvas class="breakout-canvas" tabindex="0" aria-label="打砖块游戏画面"></canvas>
    <div class="breakout-hud"><span data-stage></span><span data-lives aria-label="剩余生命"></span><output data-score aria-label="得分">0</output></div>
    <div class="breakout-power"><div class="breakout-charge-label"><span>大招</span><output data-charge>0 / 100</output></div><span class="breakout-energy" role="meter" aria-label="大招能量" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></span><button type="button" data-power aria-label="释放大招激光，快捷键 R" hidden></button></div>
    <button type="button" class="breakout-pause" data-pause aria-label="暂停游戏">暂停</button>
    <div class="breakout-start"><h2></h2><p></p></div>
    <p class="breakout-feedback" role="status" aria-live="polite"></p>
    <div class="breakout-touch"><button type="button" data-bump>击打</button></div>
    <button type="button" class="breakout-bomb-handle" aria-label="挪动中间的炸弹，拖动或左右方向键" hidden></button>
    <div class="breakout-result" hidden><h2></h2><p></p><div><button type="button" data-next></button><button type="button" data-finish>回作品</button></div></div>
    <section class="breakout-menu" aria-label="暂停菜单" hidden><h2>暂停</h2><div class="breakout-menu-actions"><button type="button" data-resume>继续</button><button type="button" data-retry>本关重来</button><button type="button" data-back>回作品</button></div>
      <label data-stage-picker>关卡 <select aria-label="选择已开放的关卡"></select></label>
      <details><summary>操作与声音</summary><p>鼠标 / ← → 移动　点击 / 空格 击打</p><p>Shift 冲刺　右键 / Ctrl 吸引　R 激光</p><p>触屏拖动挡板，快划冲刺，长按吸引</p><button type="button" data-audio></button></details>
    </section>`;
  shell.append(root);shell.dataset.experience='breakout';
  if(mode==='workshop') {
    let path='',label='';
    if(state.keepsake==='light'&&state.lightSketch){
      path=Array.from({length:65},(_,i)=>{const [x,y]=lightPoint(state.lightSketch,i/64);return `${i?'L':'M'}${x*100} ${y*60}`;}).join(' ');label='你们留下的光';
    }else if(state.keepsake==='round'&&state.keptReturn){
      const [offset,angle]=state.keptReturn;
      path=`M40 4V52L${40+Math.cos(angle)*56} ${52+Math.sin(angle)*56} M${40-(offset+1)*14} 57h28`;label='你们玩过的那次回球';
    }
    if(path)root.insertAdjacentHTML('beforeend',`<svg class="breakout-keepsake" viewBox="-20 -8 130 76" role="img" aria-label="${label}"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`);
  }
  const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d');
  if(!ctx){root.remove();delete shell.dataset.experience;throw new Error('浏览器无法打开 Canvas 2D');}
  const $=q=>root.querySelector(q),start=$('.breakout-start'),menu=$('.breakout-menu'),result=$('.breakout-result');
  const touch=matchMedia('(pointer:coarse)').matches;
  root.dataset.touch=String(touch);root.dataset.mode=mode;
  const size=()=>{const w=root.clientWidth,h=root.clientHeight,width=w<h?600:1200;return {width,height:width*h/w};};
  let stage=mode==='campaign'?state.campaign.stage:0,unlocked=state.campaign.unlocked;
  let game=new BreakoutGame({...size(),level:mode==='campaign'?STAGES[stage]:mode==='workshop'?WORKSHOP:SAMPLE,edition,mode,
    workshopX:mode==='workshop'?previous?state.workshop.kept:state.workshop.x:null});
  let totals=Object.fromEntries(keys.map(k=>[k,0])),elapsed=0,previousReport={},lastReport=0;
  let frame=0,last=0,accumulator=0,paused=false,disposed=false,target=null,attract=false,drag=null,hold=0;
  let particles=[],ripples=[],trail=[],ghosts=[],recoil=0,swing=0,shake=0,feedbackUntil=0,wallFlash=null,charged=false;
  const laserSound=motion.sustain('laser');
  const pressed=new Set(),sprites=new Map(),jolts=new Map();let scale=1,dpr=1,lastUI='';

  function report(kind,extra={}) {
    const value={kind,edition,mode,stage,score:game.score,seconds:Math.floor(game.time),elapsed:Math.floor(elapsed+game.sessionTime),
      counts:Object.fromEntries(keys.map(k=>[k,totals[k]+game.stats[k]])),...extra};
    const next=playDelta(value,previousReport);previousReport=next.current;onEvent({...value,delta:next.delta});
  }
  function feedback(text,seconds=1.2) { $('.breakout-feedback').textContent=text;feedbackUntil=text?performance.now()+seconds*1000:0; }
  function soundLabel() { $('[data-audio]').textContent=motion.sound?'声音开':'声音关';$('[data-audio]').setAttribute('aria-pressed',String(motion.sound)); }
  function ui() {
    const energy=Math.floor(game.energy),firing=game.laserTime>0,key=[stage,game.status,game.score,game.lives,energy,game.workshopX,game.laserTime.toFixed(1)].join('/');
    if(key===lastUI)return;lastUI=key;
    root.dataset.status=game.status;
    const title=mode==='campaign'?`${stage+1} / ${STAGES.length}　${game.level.name}`:mode==='trial'?({draft:'初稿',tuned:'改手感',guided:'自动瞄准'})[edition]:'工作间';
    $('[data-stage]').textContent=title;$('[data-lives]').textContent='●'.repeat(game.lives)+'○'.repeat(3-game.lives);
    $('[data-lives]').setAttribute('aria-label',`剩余 ${game.lives} 次`);$('[data-score]').textContent=game.score.toLocaleString();
    const ready=energy===100&&game.status==='playing'&&!firing,meter=$('.breakout-energy');
    const charge=firing?game.laserTime/LASER_DURATION:energy/100;
    meter.style.setProperty('--charge',charge);meter.setAttribute('aria-valuenow',String(Math.round(charge*100)));
    meter.setAttribute('aria-label',firing?'激光剩余时长':'大招能量');
    meter.setAttribute('aria-valuetext',firing?`${game.laserTime.toFixed(1)} 秒`:ready?'大招就绪':`${energy} / 100`);
    $('.breakout-charge-label span').textContent=firing?'扫射':'大招';
    $('.breakout-power').dataset.firing=String(firing);
    $('[data-charge]').textContent=firing?`${game.laserTime.toFixed(1)} s`:`${energy} / 100`;$('[data-power]').hidden=!ready;
    $('[data-power]').textContent=touch?'激光 · 点此释放':'激光　R';$('.breakout-power').dataset.ready=String(ready);
    if(ready&&!charged){feedback('大招好了',1);motion.tone(5,true);}charged=ready;
    start.hidden=game.status!=='ready';
    start.style.top=`${(Math.max(...game.bricks.map(b=>b.y+b.h/2))+game.paddle.y-game.paddle.h/2)/2/game.height*100}%`;
    start.querySelector('h2').textContent=game.stats.misses?'再来':mode==='campaign'?game.level.name:mode==='workshop'?'挪一下，再打':'';
    start.querySelector('p').textContent=game.stats.launches===0?(touch?'拖动挡板 · 点「击打」发球':'移动鼠标 · 点击发球'):touch?'点「击打」发球':'点击发球';
    if(game.status==='ready'&&mode==='workshop'&&!previous)start.querySelector('p').textContent='先挪中间的菱形，再发球';
    const bomb=$('.breakout-bomb-handle');bomb.hidden=mode!=='workshop'||game.status!=='ready'||previous;
    if(!bomb.hidden){const b=game.bricks.find(b=>b.movable);bomb.style.left=`${b.x/game.width*100}%`;bomb.style.top=`${b.y/game.height*100}%`;}
    canvas.setAttribute('aria-label',`${title}，剩余 ${game.bricks.filter(b=>b.hp>0).length} 块砖，${game.lives} 次机会`);
  }
  function finish() { report('exit');onClose(); }
  function resultPanel() {
    result.hidden=false;const cleared=game.status==='cleared';
    result.querySelector('h2').textContent=cleared?mode==='workshop'?'炸开了':stage===STAGES.length-1&&mode==='campaign'?'打完了':'清空':'差一点';
    result.querySelector('p').textContent=`${game.score.toLocaleString()} 分　${game.bestCombo} 连击　${Math.floor(game.time)} 秒`;
    $('[data-next]').textContent=cleared&&mode==='campaign'&&stage<STAGES.length-1?'下一关':'再打一局';
    if(cleared&&mode==='workshop')$('[data-finish]').textContent='回工作间';
    $('[data-next]').focus({preventScroll:true});
  }
  function pause(value) {
    paused=value;menu.hidden=!value;root.dataset.paused=String(value);pressed.clear();target=null;attract=false;clearTimeout(hold);drag=null;
    if(value)laserSound.stop();
    if(value) {
      report('play');soundLabel();const select=$('select');select.replaceChildren();
      for(let i=0;i<=unlocked;i++){const o=document.createElement('option');o.value=i;o.textContent=`${i+1}　${STAGES[i].name}`;o.selected=i===stage;select.append(o);}
      $('[data-stage-picker]').hidden=mode!=='campaign';$('[data-resume]').focus({preventScroll:true});
    } else { last=0;(result.hidden?canvas:$('[data-next]')).focus({preventScroll:true}); }
  }
  function reload(next=stage) {
    elapsed+=game.sessionTime;for(const key of keys)totals[key]+=game.stats[key];
    stage=next;game=new BreakoutGame({...size(),level:mode==='campaign'?STAGES[stage]:mode==='workshop'?WORKSHOP:SAMPLE,edition,mode,
      workshopX:mode==='workshop'?game.workshopX:null});
    laserSound.stop();trail=[];particles=[];ripples=[];ghosts=[];jolts.clear();recoil=swing=shake=0;wallFlash=null;feedback('',0);charged=false;target=null;last=0;lastReport=0;accumulator=0;result.hidden=true;pause(false);ui();report('stage');
  }
  function primary() {
    if(paused)return;
    if(['cleared','lost'].includes(game.status)){reload(game.status==='cleared'&&mode==='campaign'?Math.min(stage+1,STAGES.length-1):stage);return;}
    game.swing();
  }
  function burst(x,y,kind,count=8,angle=null) {
    const colors=kind==='bomb'?['#f5dcff','#bdabff','#ffffff']:kind==='energy'?['#edfbff','#9ceaff','#cbd5ff']:['#cff3ff','#c9b5f4','#ffffff'];
    if(motion.reduced())count=3;
    for(let i=0;i<count;i++) {const a=angle===null?Math.random()*Math.PI*2:angle+(Math.random()-.5)*Math.PI,v=(80+Math.random()*210)*(motion.reduced()?.25:1);particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.24+Math.random()*.2,color:colors[i%3],r:2+Math.random()*4});}
    if(particles.length>150)particles.splice(0,particles.length-150);
  }
  function kick(amount) { if(!motion.reduced())shake=Math.max(shake,amount); }
  function events() {
    let tones=0,bombSound=false;
    for(const e of game.events.splice(0)) {
      if(['launch','return','miss','clear','place'].includes(e.kind))report(e.kind,e);
      if(e.kind==='hit'){
        const angle=Math.atan2(e.vy,e.vx);jolts.set(e.id,{life:.22,dx:Math.cos(angle),dy:Math.sin(angle)});
        kick(e.hp?4.5:6);if(e.hp)burst(e.x,e.y,e.kindOfBrick,5,angle+Math.PI);
        if(tones++<3)motion.impact('brick',game.combo+e.hp);
      }
      if(e.kind==='break'){burst(e.x,e.y,e.kindOfBrick,e.kindOfBrick==='bomb'?24:13);if(e.combo>=3)feedback(`${e.combo} 连击`,.7);}
      if(e.kind==='explode'){if(!motion.reduced())ripples.push({x:e.x,y:e.y,r:10,life:.3});kick(12);if(!bombSound){motion.impact('bomb');bombSound=true;}}
      if(e.kind==='return'){recoil=.18;trail=[];burst(e.x,e.y,'energy',5,-Math.PI/2);kick(5);if(tones++<3)motion.impact('paddle');}
      if(e.kind==='swing'||e.kind==='launch')swing=.18;
      if(e.kind==='boost'){recoil=.2;feedback(e.perfect?'漂亮':'打到了',.7);kick(e.perfect?10:6);motion.impact('boost',e.perfect?3:0);}
      if(e.kind==='wall'){wallFlash={...e,life:.13};kick(2);if(tones++<3)motion.impact('wall');}
      if(e.kind==='laser'){recoil=.2;kick(13);motion.impact('laser');feedback('',0);}
      if(e.kind==='miss'){trail=[];feedback('',0);motion.tone(0,true);if(game.status==='lost')resultPanel();}
      if(e.kind==='clear'){unlocked=Math.max(unlocked,Math.min(STAGES.length-1,stage+1));motion.tone(5,true);resultPanel();}
      if(e.kind==='launch'&&game.level.tip&&mode==='campaign')feedback(game.level.tip,3);
    }
  }

  function sprite(b) {
    const key=`${b.kind}/${b.hp}/${b.w}/${b.h}`;if(sprites.has(key))return sprites.get(key);
    const c=document.createElement('canvas');c.width=Math.ceil(b.w+12);c.height=Math.ceil(b.h+12);const g=c.getContext('2d'),x=6,y=6,w=b.w,h=b.h;
    const fill=g.createLinearGradient(0,y,0,y+h);
    const tones=b.kind==='normal'?(b.hp===3?['#f2eaff','#b29bdc']:b.hp===2?['#ded0fa','#989cda']:['#d0f8ff','#76b9dc']):b.kind==='bomb'?['#efd6ff','#b492e2']:['#d4feff','#68bfd7'];
    fill.addColorStop(0,tones[0]);fill.addColorStop(1,tones[1]);g.fillStyle=fill;
    g.beginPath();g.moveTo(x+5,y);g.lineTo(x+w-5,y);g.lineTo(x+w,y+5);g.lineTo(x+w,y+h-5);g.lineTo(x+w-5,y+h);g.lineTo(x+5,y+h);g.lineTo(x,y+h-5);g.lineTo(x,y+5);g.closePath();g.fill();
    g.strokeStyle='#f2fcffc0';g.lineWidth=1;g.beginPath();g.moveTo(x+6,y+1.5);g.lineTo(x+w-6,y+1.5);g.stroke();
    g.strokeStyle='#436fa770';g.beginPath();g.moveTo(x+4,y+h-2);g.lineTo(x+w-4,y+h-2);g.stroke();
    g.fillStyle='#233c63';g.strokeStyle='#365580';g.lineWidth=1.4;g.translate(x+w/2,y+h/2);
    if(b.kind==='normal') {
      for(let i=0;i<b.hp;i++){g.beginPath();g.moveTo((i-(b.hp-1)/2)*9-1,-4);g.lineTo((i-(b.hp-1)/2)*9+1,4);g.stroke();}
    } else if(b.kind==='bomb') {
      g.beginPath();g.moveTo(0,-7);g.lineTo(7,0);g.lineTo(0,7);g.lineTo(-7,0);g.closePath();g.stroke();g.fillRect(-1,-1,2,2);
    } else {g.beginPath();g.arc(0,0,6,0,Math.PI*2);g.stroke();g.beginPath();g.moveTo(-2,-3);g.lineTo(2,0);g.lineTo(-2,3);g.stroke();}
    sprites.set(key,c);return c;
  }
  function draw(dt) {
    ctx.setTransform(dpr*scale,0,0,dpr*scale,0,0);ctx.clearRect(0,0,game.width,game.height);
    const reduced=motion.reduced();
    ctx.save();if(shake>0&&!reduced)ctx.translate(Math.sin(performance.now()*.105)*shake,Math.cos(performance.now()*.143)*shake*.65);
    for(const b of game.bricks)if(b.hp>0){
      const s=sprite(b),jolt=jolts.get(b.id),hit=jolt?jolt.life/.22:0;
      ctx.save();ctx.translate(b.x,b.y);
      if(hit&&!reduced){ctx.translate(jolt.dx*hit*5,jolt.dy*hit*5);ctx.rotate(jolt.dx*Math.sin(hit*Math.PI)*.1);ctx.scale(1+hit*.12,1-hit*.24);}
      ctx.drawImage(s,-s.width/2,-s.height/2);
      if(hit){ctx.fillStyle=`rgba(255,255,255,${hit*.65})`;ctx.beginPath();ctx.roundRect(-b.w/2,-b.h/2,b.w,b.h,4);ctx.fill();}
      ctx.restore();
    }
    for(const [id,jolt] of jolts){jolt.life-=dt;if(jolt.life<=0)jolts.delete(id);}
    const b=game.ball,p=game.paddle;
    if(game.status==='playing'&&!paused) {trail.push({x:b.x,y:b.y});if(trail.length>16)trail.shift();}
    for(let i=1;i<trail.length;i++) {
      ctx.strokeStyle=`rgba(172,224,255,${i/trail.length*.45})`;ctx.lineWidth=b.r*2*i/trail.length;
      ctx.beginPath();ctx.moveTo(trail[i-1].x,trail[i-1].y);ctx.lineTo(trail[i].x,trail[i].y);ctx.stroke();
    }
    if(!['lost','found'].includes(game.status)) {
      ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.vy,b.vx));
      const stretch=game.status==='playing'&&!motion.reduced()?Math.min(.4,Math.hypot(b.vx,b.vy)/game.maxSpeed*.4):0;
      ctx.scale(1+stretch,1-stretch*.5);ctx.fillStyle='#bfeaff33';ctx.beginPath();ctx.arc(0,0,b.r+5,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#f5fcff';ctx.beginPath();ctx.arc(0,0,b.r,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    if(!reduced&&game.dashTime>0&&Math.abs(p.vx)>100){ghosts.push({x:p.x,y:p.y,angle:p.angle,life:.16});if(ghosts.length>9)ghosts.shift();}
    for(const ghost of ghosts){ghost.life-=dt;if(reduced)continue;ctx.save();ctx.translate(ghost.x,ghost.y);ctx.rotate(ghost.angle);ctx.globalAlpha=Math.max(0,ghost.life)*1.7;ctx.fillStyle='#bbd8ff';ctx.beginPath();ctx.roundRect(-p.w/2,-p.h/2,p.w,p.h,6);ctx.fill();ctx.restore();}
    ghosts=ghosts.filter(g=>g.life>0);
    const hit=recoil/.2,lift=Math.sin(swing/.18*Math.PI)*9;
    ctx.save();ctx.translate(p.x,p.y+(reduced?0:hit*5-lift));if(!reduced){ctx.rotate(p.angle);ctx.scale(1+hit*.13,1-hit*.28);}
    if(attract&&game.energy>0) {
      const g=ctx.createRadialGradient(0,0,1,0,0,game.width*.23);g.addColorStop(0,'#8decff24');g.addColorStop(1,'#8decff00');ctx.fillStyle=g;ctx.fillRect(-game.width*.23,-game.width*.23,game.width*.46,game.width*.23);
    }
    ctx.fillStyle=recoil>0?'#fff5fe':'#d6efff';ctx.beginPath();ctx.roundRect(-p.w/2,-p.h/2,p.w,p.h,6);ctx.fill();
    ctx.fillStyle='#82bdf080';ctx.fillRect(-p.w/2+7,p.h/2, p.w-14,3);ctx.restore();
    for(const particle of particles){particle.life-=dt;particle.x+=particle.vx*dt;particle.y+=particle.vy*dt;particle.vy+=110*dt;
      ctx.globalAlpha=Math.max(0,Math.min(1,particle.life*3));ctx.fillStyle=particle.color;ctx.fillRect(particle.x,particle.y,particle.r,particle.r*.6);}
    ctx.globalAlpha=1;particles=particles.filter(p=>p.life>0);
    for(const ring of ripples){ring.life-=dt;ring.r+=game.width*.7*dt;ctx.globalAlpha=Math.max(0,ring.life*2);ctx.strokeStyle='#e7d8ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(ring.x,ring.y,ring.r,0,Math.PI*2);ctx.stroke();}
    ctx.globalAlpha=1;ripples=ripples.filter(r=>r.life>0);
    if(game.laserTime>0){
      ctx.globalAlpha=Math.min(1,game.laserTime/.18);ctx.fillStyle='#bddfff40';ctx.fillRect(p.x-32,90,64,p.y-90);
      ctx.fillStyle='#aadeff88';ctx.fillRect(p.x-15,90,30,p.y-90);ctx.fillStyle='#edfaff';ctx.fillRect(p.x-5,90,10,p.y-90);
      ctx.beginPath();ctx.ellipse(p.x,p.y-7,24,7,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    }
    if(wallFlash){wallFlash.life-=dt;ctx.globalAlpha=Math.max(0,wallFlash.life*5);ctx.strokeStyle='#cff4ff';ctx.lineWidth=3;ctx.beginPath();
      if(wallFlash.wall==='top'){ctx.moveTo(wallFlash.x-50,91);ctx.lineTo(wallFlash.x+50,91);}else{const x=wallFlash.wall==='left'?1:game.width-1;ctx.moveTo(x,wallFlash.y-60);ctx.lineTo(x,wallFlash.y+60);}ctx.stroke();ctx.globalAlpha=1;if(wallFlash.life<=0)wallFlash=null;}
    ctx.restore();recoil=Math.max(0,recoil-dt);swing=Math.max(0,swing-dt);shake=Math.max(0,shake-dt*55);
  }
  function resize() {
    const next=size();game.resize(next.width,next.height);dpr=Math.min(2,devicePixelRatio||1);scale=root.clientWidth/game.width;
    canvas.width=Math.round(root.clientWidth*dpr);canvas.height=Math.round(root.clientHeight*dpr);sprites.clear();trail=[];lastUI='';ui();draw(0);
  }
  function tick(now) {
    if(disposed)return;
    const dt=last?Math.min(.045,(now-last)/1000):0;last=now;
    if(!paused) {
      accumulator+=dt;const axis=(pressed.has('ArrowRight')||pressed.has('KeyD')?1:0)-(pressed.has('ArrowLeft')||pressed.has('KeyA')?1:0);
      while(accumulator>=1/120&&!disposed){game.step(1/120,{axis,target,attract:attract||pressed.has('ControlLeft')||pressed.has('ControlRight')});accumulator-=1/120;events();}
      if(disposed)return;
      if(game.sessionTime-lastReport>=8){lastReport=game.sessionTime;report('play');}
      ui();draw(dt);
      if(feedbackUntil&&now>feedbackUntil){$('.breakout-feedback').textContent='';feedbackUntil=0;}
    }
    laserSound.update(!paused&&game.laserTime>0,game.paddle.x/game.width*2-1);
    frame=requestAnimationFrame(tick);
  }
  const position=e=>(e.clientX-root.getBoundingClientRect().left)/scale;
  listen(canvas,'pointerdown',e=>{
    if(paused)return;e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);target=position(e);
    if(e.pointerType==='mouse'){if(e.button===0)primary();else if(e.button===2)attract=true;return;}
    drag={id:e.pointerId,x:e.clientX,at:performance.now(),moved:false};hold=setTimeout(()=>{attract=true;},350);
  });
  listen(canvas,'pointermove',e=>{
    if(paused)return;
    if(e.pointerType==='mouse'||drag?.id===e.pointerId)target=position(e);
    if(drag?.id===e.pointerId&&Math.abs(e.clientX-drag.x)>8){drag.moved=true;clearTimeout(hold);if(Math.abs(e.clientX-drag.x)>root.clientWidth*.18&&performance.now()-drag.at<180)game.dash();}
  });
  const endPointer=e=>{clearTimeout(hold);if(drag?.id===e.pointerId&&!drag.moved&&!attract)primary();attract=false;drag=null;};
  listen(canvas,'pointerup',endPointer);listen(canvas,'pointercancel',()=>{clearTimeout(hold);attract=false;drag=null;});listen(canvas,'lostpointercapture',()=>{clearTimeout(hold);attract=false;drag=null;});
  listen(canvas,'contextmenu',e=>e.preventDefault());
  listen(window,'keydown',e=>{
    if(e.code==='Escape'){e.preventDefault();pause(!paused);return;}
    if(e.code==='Tab'){
      const scope=paused?menu:result.hidden?root:result;
      const focusable=[...scope.querySelectorAll('button,select,summary,canvas')].filter(el=>!el.disabled&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
      const first=focusable[0],last=focusable.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      return;
    }
    if(paused||e.metaKey||e.ctrlKey&&['KeyR','KeyL','KeyW','KeyT'].includes(e.code)||e.target.closest('button,select,input,summary'))return;
    if(!['Space','ArrowLeft','ArrowRight','KeyA','KeyD','ShiftLeft','ShiftRight','ControlLeft','ControlRight','KeyR'].includes(e.code))return;
    e.preventDefault();pressed.add(e.code);
    if(!e.repeat){if(e.code==='Space')primary();if(e.code.startsWith('Shift'))game.dash();if(e.code==='KeyR')game.laser();}
    if(['KeyA','KeyD','ArrowLeft','ArrowRight'].includes(e.code))target=null;
  });
  listen(window,'keyup',e=>pressed.delete(e.code));
  listen(window,'blur',()=>{if(!disposed)pause(true);});
  listen(document,'visibilitychange',()=>{if(document.hidden)pause(true);});
  listen($('[data-pause]'),'click',()=>pause(true));listen($('[data-resume]'),'click',()=>pause(false));
  listen($('[data-retry]'),'click',()=>reload());listen($('[data-back]'),'click',finish);listen($('[data-finish]'),'click',finish);
  listen($('[data-next]'),'click',primary);listen($('[data-bump]'),'pointerdown',e=>{e.preventDefault();primary();});listen($('[data-power]'),'click',()=>{game.laser();canvas.focus({preventScroll:true});});
  listen($('[data-bump]'),'click',e=>{if(e.detail===0)primary();});
  listen($('[data-audio]'),'click',()=>{motion.setSound(!motion.sound);soundLabel();});
  listen($('select'),'change',e=>reload(Number(e.target.value)));
  const handle=$('.breakout-bomb-handle');let bombPointer=null;
  listen(handle,'pointerdown',e=>{e.preventDefault();bombPointer=e.pointerId;handle.setPointerCapture(e.pointerId);});
  listen(handle,'pointermove',e=>{if(bombPointer===e.pointerId){game.moveBomb(position(e)/game.width*1920);ui();}});
  listen(handle,'pointerup',()=>{bombPointer=null;});listen(handle,'pointercancel',()=>{bombPointer=null;});listen(handle,'lostpointercapture',()=>{bombPointer=null;});
  listen(handle,'keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();game.moveBomb(game.workshopX+(e.key==='ArrowLeft'?-35:35));events();ui();});
  const observer=new ResizeObserver(resize);observer.observe(root);resize();report('ready');soundLabel();canvas.focus({preventScroll:true});
  frame=requestAnimationFrame(tick);
  return ()=>{disposed=true;laserSound.dispose();controller.abort();observer.disconnect();clearTimeout(hold);cancelAnimationFrame(frame);root.remove();delete shell.dataset.experience;};
}
