import { OrbitFlight, EDITIONS } from './p34-orbit-core.js?v=20261107-journey';
import { FLIGHT_LEVELS } from './p34-flight-levels.js?v=20261107-journey';

export function mountOrbit(host, { motion, version = 'draft', seeking = false, start = 0, workshop = null, workshopRadius = 65, campaign = null, onCampaignSave, onEvent, onClose }) {
  const controller = new AbortController(), { signal } = controller;
  let data = campaign ? structuredClone(campaign) : null, levelId = data?.selected || 0;
  let game, raf = 0, last = 0, accumulator = 0, paused = false, pointer = null, disposed = false;
  let w = 0, h = 0, scale = 1, camera = { x:0,y:0 }, initialized = false, overview = false, manualView = null, pinch = null;
  const touches = new Map();
  let trail = [], sparks = [], hintTime = 0, atlasOpen = false, arrows = 0, dragged = false;
  const root = document.createElement('section'); root.className = 'orbit-scene'; root.tabIndex = -1;
  root.setAttribute('aria-label', '绕远路，拖纸燕瞄准，松手起飞；空白处拖动看图；空格按住、左右调方向');
  root.innerHTML = `<canvas aria-hidden="true"></canvas>
    <span class="orbit-bird" aria-hidden="true"><svg viewBox="0 0 40 32"><path d="M38 16 2 2 12 16 2 30Z"/><path d="M12 16H38"/></svg></span>
    <div class="orbit-intro"><h2></h2><span></span></div>
    <div class="orbit-progress" aria-live="polite"></div><div class="orbit-winds"></div>
    <div class="orbit-controls"><button type="button" data-back>回去</button><button type="button" data-atlas ${data ? '' : 'hidden'}>航图</button><button type="button" data-overview ${data ? '' : 'hidden'}>全景</button><button type="button" data-undo ${data ? '' : 'hidden'}>撤回</button><button type="button" data-audio aria-label="声音" aria-pressed="${motion.sound}">♪</button><button type="button" data-pause>暂停</button></div>
    <div class="orbit-launch"><button type="button" data-release aria-label="按住瞄准，松手起飞"><svg viewBox="0 0 40 32" aria-hidden="true"><path d="M38 16 2 2 12 16 2 30Z"/></svg></button><p data-hint></p></div>
    <div class="orbit-result" hidden><h2></h2><p></p><div></div></div>
    <section class="orbit-atlas" hidden aria-label="航图"></section>
    <span class="space-sr-only" role="status" data-orbit-status></span>`;
  host.append(root); host.dataset.experience = 'flight';
  const canvas = root.querySelector('canvas'), ctx = canvas.getContext('2d');
  if (!ctx) { root.remove(); delete host.dataset.experience; throw new Error('Canvas 2D unavailable'); }
  const bird = root.querySelector('.orbit-bird'), result = root.querySelector('.orbit-result'), atlas = root.querySelector('.orbit-atlas');
  const hint = root.querySelector('[data-hint]'), releaseButton = root.querySelector('[data-release]');
  const listen = (el,name,fn,options={}) => el.addEventListener(name,fn,{signal,...options});
  const screen = p => ({ x:w/2+(p.x-camera.x)*scale, y:h*.49+(p.y-camera.y)*scale });
  const world = (x,y) => ({x:camera.x+(x-w/2)/scale,y:camera.y+(y-h*.49)/scale});
  function announce(text) { root.querySelector('[data-orbit-status]').textContent=text; }
  function setHint(text,seconds=5) { hint.textContent=text; hintTime=game.time+seconds; }
  function save() {
    if(!data) return;
    if(game.phase!=='won') { data.selected=levelId; data.checkpoint={level:levelId,...game.checkpoint(),seconds:Math.round(game.time)}; }
    onCampaignSave(structuredClone(data));
  }
  function close() { save(); onClose(); }
  function loadLevel(id,resume=null) {
    levelId=id;
    game=new OrbitFlight({version:data?'tuned':version,seeking,start,workshop,workshopRadius,level:data?FLIGHT_LEVELS[id]:null,resume});
    initialized=false; overview=false; manualView=null; trail=[];sparks=[];paused=false;atlasOpen=false;accumulator=0;pointer=null;pinch=null;touches.clear();
    root.dataset.campaign=String(Boolean(data));root.dataset.level=String(id);
    result.hidden=true;atlas.hidden=true;delete root.dataset.atlas;
    root.querySelector('[data-pause]').textContent='暂停';root.querySelector('[data-overview]').textContent='全景';
    const intro=root.querySelector('.orbit-intro');intro.hidden=false;
    intro.querySelector('h2').textContent=data?game.level.title:workshop?'试飞':seeking?'那条岔路':'双月亮';
    intro.querySelector('span').textContent=data?game.level.region:EDITIONS[version].name;
    const winds=root.querySelector('.orbit-winds');winds.replaceChildren();
    game.winds.forEach((_,i)=>{
      const b=document.createElement('button');b.type='button';b.dataset.wind=String(i);
      b.innerHTML='<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="30"/><path d="M20 40H59m-16-15 16 15-16 15"/></svg>';
      winds.append(b);
    });
    if(data) {data.selected=id;save();}
    setHint(data?({0:'拖纸燕瞄准，松手起飞',3:'空白处拖动看图。风箭头可以转。',6:'菱形月亮，管菱形门。',10:'同形折口，相连。'})[id]||'':seeking?'双月亮，在右边。':'按住放慢，拖动也能瞄准',12);
    releaseButton.focus({preventScroll:true});
  }
  function resize() {
    w=root.clientWidth;h=root.clientHeight;
    const dpr=Math.min(devicePixelRatio||1,1.5);
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function panel(title,description,actions) {
    result.hidden=false;result.querySelector('h2').textContent=title;result.querySelector('p').textContent=description;
    const row=result.querySelector('div');row.replaceChildren();
    for(const [label,action] of actions) {const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=action;row.append(b);}
    row.firstElementChild.focus({preventScroll:true});
  }
  function pause(value) {
    if(atlasOpen || ['won','found'].includes(game.phase)) return;
    paused=value;game.held=false;pointer=null;pinch=null;touches.clear();arrows=0;accumulator=0;
    root.querySelector('[data-pause]').textContent=value?'继续':'暂停';
    if(value) panel('歇一下？','',[['继续',()=>pause(false)],...(data?[['一点提示',()=>{pause(false);setHint(game.level.hint,20);}],['重走这片',()=>loadLevel(levelId)]]:[]),['回去',close]]);
    else {result.hidden=true;releaseButton.focus({preventScroll:true});}
  }
  function showAtlas() {
    save();paused=true;atlasOpen=true;game.held=false;pointer=null;pinch=null;touches.clear();result.hidden=true;root.dataset.atlas='true';atlas.hidden=false;
    atlas.innerHTML='<h2>绕远路</h2><button type="button" data-atlas-close>继续这片</button><div class="orbit-chart"></div>';
    const chart=atlas.querySelector('.orbit-chart'); let region='';
    FLIGHT_LEVELS.forEach((l,i)=>{
      if(l.region!==region) {region=l.region;const h=document.createElement('h3');h.textContent=region;chart.append(h);}
      const b=document.createElement('button');b.type='button';b.dataset.levelSelect=String(i);b.style.setProperty('--island-x',`${[0,18,7,27][i%4]}%`);
      b.setAttribute('aria-current',String(i===levelId));b.className=data.records[i]?'is-complete':'';
      b.innerHTML='<i aria-hidden="true"></i><span></span><small></small>';
      b.querySelector('span').textContent=l.title;b.querySelector('small').textContent=data.records[i]?`${data.records[i].shots} 次起飞`:'';chart.append(b);
    });
    atlas.querySelector('[data-atlas-close]').focus({preventScroll:true});
  }
  function burst(m,count,warm=false) {
    if(motion.reduced())return;
    for(let i=0;i<count;i++){const a=i*2.399,speed=45+i%7*15;sparks.push({x:m.x,y:m.y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:.7,age:0,warm});}
    sparks=sparks.slice(-90);
  }
  function events() {
    for(const e of game.events.splice(0)) {
      onEvent(e,game.report());
      if(e.type==='launch'){motion.tone(1,true);root.querySelector('.orbit-intro').hidden=true;setHint('',0);announce('已起飞');save();}
      if(e.type==='miss'){motion.tone(0,true);setHint(e.reason==='wall'?'纸缝挡住了。换个角度。':'落点还在，再试一次。');announce('回到上一个月亮');save();}
      if(e.type==='land') {
        const moon=game.moons[e.node];burst(moon,moon.double?30:18,moon.key||moon.double);motion.tone(e.node%6);
        announce(moon.key?'羽片带上了':moon.double?'到了双月岔路':'已停靠');
        if(moon.double)setHint(seeking?'前面还有一个。':'你也绕到这里了。');
        save();
      }
      if(e.type==='switch'){motion.tone(3);setHint('门换边了。');}
      if(e.type==='wind' || e.type==='fold'){motion.tone(e.type==='fold'?5:2,true);trail=[];}
      if(e.type==='wind-set'){motion.tone(2,true);save();}
      if(e.type==='undo'){trail=[];sparks=[];result.hidden=true;setHint('回到刚才。');save();}
      if(e.type==='missing-keys')setHint('还有羽片没带回来。',8);
      if(e.type==='won') {
        burst(game.moons[game.current],60,true);motion.tone(5);
        if(data) {
          const old=data.records[levelId],record={shots:game.shots,seconds:Math.round(game.time)};
          if(!old || record.shots<old.shots || record.shots===old.shots && record.seconds<old.seconds)data.records[levelId]=record;
          data.checkpoint=null;data.selected=Math.min(FLIGHT_LEVELS.length-1,levelId+1);onCampaignSave(structuredClone(data));
          const all=Object.keys(data.records).length===FLIGHT_LEVELS.length;
          panel(all?'整张图，都飞过了。':'带回来了。',`${game.shots} 次起飞`,[
            ...(levelId<FLIGHT_LEVELS.length-1?[['下一片',()=>loadLevel(levelId+1)]]:[]),
            ['换条路线再飞',()=>loadLevel(levelId)],['航图',showAtlas],['回去找她',close],
          ]);
        } else panel(workshop?'落下来了。':'绕到了。',workshop?'':`${game.shots} 次起飞 · ${game.misses} 次迷路`,workshop?[['回工作间',close]]:[['再绕一圈',()=>loadLevel(0)],['回去找她',close]]);
      }
      if(e.type==='found'){burst(game.moons[game.current],45,true);panel('原来，在这里。','',[['走近一点',close]]);}
    }
  }
  function draw(dt) {
    const current=game.moons[game.current];
    let target;
    if(data) {
      const remaining=game.moons.filter((m,i)=>i!==game.current && (m.key&&!game.keys.has(i) || i===game.level.finish));
      target=remaining.sort((a,b)=>Math.hypot(a.x-current.x,a.y-current.y)-Math.hypot(b.x-current.x,b.y-current.y))[0] || current;
    } else target=game.moons[game.destinations[0]] || current;
    let desired={x:current.x+(target.x-current.x)*.3,y:current.y+(target.y-current.y)*.3};
    scale=Math.min(1.2,w/650,h/720);
    if(manualView) { desired=manualView;scale=manualView.scale; }
    else if(overview) {
      const b=game.bounds;desired={x:(b.left+b.right)/2,y:(b.top+b.bottom)/2};
      scale=Math.min((w-60)/(b.right-b.left-200),(h*.67)/(b.bottom-b.top-170));
    } else if(game.phase==='flight')desired={x:game.bird.x*.68+desired.x*.32,y:game.bird.y*.68+desired.y*.32};
    const k=manualView||!initialized||motion.reduced()?1:game.held&&pointer?0:1-Math.exp(-dt*6);
    camera.x+=(desired.x-camera.x)*k;camera.y+=(desired.y-camera.y)*k;initialized=true;
    ctx.clearRect(0,0,w,h);
    for(const wall of game.walls) {
      const a=screen({x:wall[0],y:wall[1]}),b=screen({x:wall[2],y:wall[3]}),open=game.wallOpen(wall);
      ctx.strokeStyle=wall.length>4?(wall[4]===0?'#f6d5a1':'#d9bfff'):'#183955';ctx.lineWidth=(open?1:9)*scale;
      ctx.globalAlpha=open?.25:.9;ctx.setLineDash(open?[5,12]:[]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
      if(wall.length>4){const x=(a.x+b.x)/2,y=(a.y+b.y)/2;ctx.strokeStyle=wall[4]===0?'#ffe1bd':'#dcc2ff';ctx.lineWidth=1.5;ctx.beginPath();
        if(wall[4]===0){ctx.moveTo(x,y-9);ctx.lineTo(x+7,y);ctx.lineTo(x,y+9);ctx.lineTo(x-7,y);ctx.closePath();}else ctx.arc(x,y,7,0,Math.PI*2);ctx.stroke();}
    }
    game.folds.forEach((f,i)=>{for(let side=0;side<2;side++){
      const p=screen({x:f[side*2],y:f[side*2+1]}),r=30*scale;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate((side?f[4]:0)*Math.PI/2);ctx.strokeStyle=i%2?'#ffe1bd':'#d9c2ff';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(-r*.7,-r);ctx.lineTo(r*.7,-r*.6);ctx.lineTo(r*.7,r);ctx.lineTo(-r*.7,r*.6);ctx.closePath();ctx.stroke();
      if(i%2){ctx.beginPath();ctx.moveTo(-r*.9,-r*.8);ctx.lineTo(-r*.9,r*.8);ctx.lineTo(r*.5,r*1.2);ctx.stroke();}
      ctx.globalAlpha=.18;ctx.fillStyle=ctx.strokeStyle;ctx.fill();ctx.globalAlpha=1;ctx.beginPath();ctx.moveTo(-r*.45,0);ctx.lineTo(r*.35,0);ctx.lineTo(0,-r*.35);ctx.stroke();ctx.restore();
    }});
    game.winds.forEach((wind,i)=>{
      const p=screen(wind),b=root.querySelector(`[data-wind="${i}"]`),size=Math.max(48,wind.r*2*scale);
      b.style.transform=`translate3d(${p.x}px,${p.y}px,0)`;b.style.width=b.style.height=`${size}px`;b.querySelector('svg').style.rotate=`${wind.direction*90}deg`;
      b.setAttribute('aria-label',`风 ${i+1}，向${['右','下','左','上'][wind.direction]}，点击旋转`);b.setAttribute('aria-disabled',String(game.phase!=='orbit'||paused));
    });
    const destinations=game.destinations;
    for(let i=0;i<game.moons.length;i++) {
      const m=game.moons[i];if(m.hidden&&!(seeking&&game.current===5||game.current===6))continue;if(m.double&&!game.rules.branch)continue;
      const p=screen(m),r=m.r*scale,active=i===game.current,next=destinations.includes(i);
      if(p.x<-r||p.x>w+r||p.y<-r||p.y>h+r)continue;
      ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=active?1:next?.85:.23;
      const halo=ctx.createRadialGradient(0,0,0,0,0,r*1.6);halo.addColorStop(0,m.double?'#ded0ff2a':'#c4f2ff21');halo.addColorStop(1,'#b2f1ff00');
      ctx.fillStyle=halo;ctx.beginPath();ctx.arc(0,0,r*1.6,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=active?'#def8ffbb':'#c5d9f777';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();
      if(data&&i===game.level.finish) {
        ctx.strokeStyle=game.keys.size===game.moons.filter(m=>m.key).length?'#ffe1bd':'#edf6ff99';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r*.62,0,Math.PI*2);ctx.stroke();
        ctx.beginPath();ctx.arc(0,0,r*.45,0,Math.PI*1.7);ctx.stroke();
      } else {
        ctx.save();ctx.rotate(-.65+i*.35);ctx.fillStyle=m.double?'#ded2ff':'#d9f4ff';
        const crescent=()=>{ctx.beginPath();ctx.arc(0,0,r*.43,.6,5.3);ctx.quadraticCurveTo(-r*.29,0,Math.cos(.6)*r*.43,Math.sin(.6)*r*.43);ctx.fill();};
        crescent();if(m.double){ctx.translate(r*.42,-r*.23);ctx.scale(.64,.64);crescent();}ctx.restore();
      }
      if(m.key&&!game.keys.has(i)){ctx.fillStyle='#ffe1bd';ctx.beginPath();ctx.moveTo(0,-r-25);ctx.quadraticCurveTo(23,-r-18,0,-r-8);ctx.quadraticCurveTo(-14,-r-17,0,-r-25);ctx.fill();}
      if(m.switch!==undefined){ctx.strokeStyle=m.switch===0?'#ffe1bd':'#ddc4ff';ctx.lineWidth=2;ctx.beginPath();if(m.switch===0){ctx.moveTo(0,-14);ctx.lineTo(11,0);ctx.lineTo(0,14);ctx.lineTo(-11,0);ctx.closePath();}else ctx.arc(0,0,13,0,Math.PI*2);ctx.stroke();}
      ctx.restore();
    }
    if(game.phase==='orbit'&&game.held) {
      const predicted=game.prediction(data?2.7:game.rules.guide?1.3:.3);ctx.lineWidth=1.5;ctx.setLineDash([3,7]);ctx.strokeStyle='#ffe1bdd9';ctx.beginPath();
      predicted.points.forEach((v,i)=>{const p=screen(v);if(!i||v.fold)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});ctx.stroke();ctx.setLineDash([]);
      if(predicted.hit!==null){const p=screen(game.moons[predicted.hit]);ctx.strokeStyle='#ffe1bd';ctx.beginPath();ctx.arc(p.x,p.y,game.moons[predicted.hit].r*scale+6,0,Math.PI*2);ctx.stroke();}
    }
    if(!motion.reduced()) {
      if(!paused&&(game.phase==='flight'||game.phase==='orbit')){trail.push({x:game.bird.x,y:game.bird.y});if(trail.length>35)trail.shift();}
      for(let i=1;i<trail.length;i++){const a=screen(trail[i-1]),b=screen(trail[i]);ctx.strokeStyle=`rgba(199,240,255,${i/trail.length*.55})`;ctx.lineWidth=i/trail.length*2.4;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
    }
    for(const p of sparks){if(!paused){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}const q=screen(p);ctx.globalAlpha=Math.max(0,1-p.age/p.life);ctx.fillStyle=p.warm?'#ffe1bd':'#c4f2ff';ctx.fillRect(q.x,q.y,3,1.5);}
    ctx.globalAlpha=1;sparks=sparks.filter(p=>p.age<p.life);
    const p=screen(game.bird),heading=game.phase==='orbit'?game.direction():Math.atan2(game.bird.vy,game.bird.vx);
    bird.style.transform=`translate3d(${p.x}px,${p.y}px,0) rotate(${heading}rad)`;
    Object.assign(bird.dataset,{angle:String(heading),worldX:String(game.bird.x),worldY:String(game.bird.y)});
    Object.assign(root.dataset,{node:String(game.current),phase:game.phase,held:String(game.held),paused:String(paused),cameraX:String(camera.x),cameraY:String(camera.y),scale:String(scale),mask:String(game.mask)});
    releaseButton.setAttribute('aria-disabled',String(paused||game.phase!=='orbit'));
    root.querySelector('[data-undo]').disabled=!game.history.length;
    if(data){const progress=root.querySelector('.orbit-progress'),text=`${levelId+1} / ${FLIGHT_LEVELS.length}　羽 ${game.keys.size} / ${game.moons.filter(m=>m.key).length}`;if(progress.textContent!==text)progress.textContent=text;}
    if(game.time>hintTime&&game.shots>0)hint.textContent='';
  }
  function loop(now) {
    const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
    if(!paused&&!document.hidden){
      if(arrows&&game.phase==='orbit'){game.held=true;game.angle+=arrows*dt*1.3;game.place();}
      accumulator+=dt;while(accumulator>=1/120){game.step(1/120);accumulator-=1/120;}events();
    }
    if(!atlasOpen)draw(paused?0:dt);raf=requestAnimationFrame(loop);
  }
  function toggleView() {
    if(manualView){manualView=null;overview=false;}else overview=!overview;
    root.querySelector('[data-overview]').textContent=overview?'跟随':'全景';
  }
  function zoomAt(x,y,nextScale) {
    const anchor=world(x,y), s=Math.max(.18,Math.min(2,nextScale));
    manualView={x:anchor.x-(x-w/2)/s,y:anchor.y-(y-h*.49)/s,scale:s};
    root.querySelector('[data-overview]').textContent='跟随';
  }
  listen(root,'wheel',e=>{
    if(!data||paused||e.target.closest('.orbit-atlas,.orbit-result'))return;
    e.preventDefault();zoomAt(e.clientX,e.clientY,scale*Math.exp(-e.deltaY*.001));
  },{passive:false});
  listen(root,'pointerdown',e=>{
    if(e.button!==0||paused||game.phase!=='orbit'||e.target.closest('button:not([data-release]),.orbit-result,.orbit-atlas'))return;
    e.preventDefault();root.setPointerCapture(e.pointerId);
    if(data&&e.pointerType==='touch'){
      touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(touches.size===2){const [a,b]=[...touches.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),scale};pointer=null;game.held=true;return;}
    }
    const p=screen(game.bird), kind=data&&!e.target.closest('[data-release]')&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>48?'pan':'aim';
    game.held=true;pointer={id:e.pointerId,x:e.clientX,y:e.clientY,kind,camera:{...camera}};dragged=false;releaseButton.focus({preventScroll:true});
  });
  listen(root,'pointermove',e=>{
    if(touches.has(e.pointerId))touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pinch){const [a,b]=[...touches.values()];zoomAt((a.x+b.x)/2,(a.y+b.y)/2,pinch.scale*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance));return;}
    if(!pointer||e.pointerId!==pointer.id)return;
    if(Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>7)dragged=true;
    if(dragged&&pointer.kind==='pan'){manualView={x:pointer.camera.x-(e.clientX-pointer.x)/scale,y:pointer.camera.y-(e.clientY-pointer.y)/scale,scale};root.querySelector('[data-overview]').textContent='跟随';}
    else if(dragged){const p=world(e.clientX,e.clientY);game.aimAt(p.x,p.y);}
  });
  listen(root,'pointerup',e=>{
    touches.delete(e.pointerId);
    if(pinch){pinch=null;pointer=null;touches.clear();game.held=false;}
    if(pointer?.id===e.pointerId){const launch=pointer.kind==='aim';pointer=null;game.held=false;if(launch)game.release();}
    if(root.hasPointerCapture(e.pointerId))root.releasePointerCapture(e.pointerId);
  });
  const cancel=()=>{game.held=false;pointer=null;pinch=null;touches.clear();arrows=0;};listen(root,'pointercancel',cancel);listen(root,'lostpointercapture',cancel);
  listen(window,'keydown',e=>{
    if(!root.contains(document.activeElement)||e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;if(atlasOpen){atlas.hidden=true;atlasOpen=false;paused=false;delete root.dataset.atlas;releaseButton.focus();}else pause(!paused);return;}
    if(paused)return;
    if(e.code==='Space'&&(e.target===root||e.target===releaseButton)){e.preventDefault();if(game.phase==='orbit')game.held=true;}
    if(['ArrowLeft','ArrowRight'].includes(e.code)&&(e.target===root||e.target===releaseButton)){e.preventDefault();arrows=e.code==='ArrowLeft'?-1:1;}
    if(e.code==='KeyR'&&!e.repeat)game.miss();
    if(e.code==='KeyZ'&&!e.repeat&&data)game.undo();
    if(e.code==='KeyM'&&!e.repeat&&data)toggleView();
  },{capture:true});
  listen(window,'keyup',e=>{if(['ArrowLeft','ArrowRight'].includes(e.code))arrows=0;if(e.code==='Space'&&game.held){e.preventDefault();game.release();}});
  listen(root,'click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.matches('[data-back]'))close();
    if(b.matches('[data-pause]'))pause(!paused);
    if(b.matches('[data-atlas]'))showAtlas();
    if(b.matches('[data-overview]'))toggleView();
    if(b.matches('[data-undo]')&&!paused)game.undo();
    if(b.matches('[data-wind]')&&!paused)game.rotateWind(Number(b.dataset.wind));
    if(b.matches('[data-audio]')){motion.setSound(!motion.sound);b.setAttribute('aria-pressed',String(motion.sound));}
    if(b.matches('[data-release]')&&e.detail===0&&!paused)game.release();
    if(b.matches('[data-atlas-close]')){atlas.hidden=true;atlasOpen=false;paused=false;delete root.dataset.atlas;releaseButton.focus();}
    if(b.matches('[data-level-select]')){
      const id=Number(b.dataset.levelSelect);
      if(id!==levelId&&game.phase!=='won'&&(game.current!==0||game.keys.size)&&!confirm('换片后，这一片从起点再来。已完成的记录保留。换片？'))return;
      if(id===levelId&&game.phase!=='won'){atlas.hidden=true;atlasOpen=false;paused=false;delete root.dataset.atlas;releaseButton.focus();}
      else loadLevel(id);
    }
  });
  listen(window,'blur',()=>pause(true));listen(document,'visibilitychange',()=>{if(document.hidden){save();pause(true);}});
  const observer=new ResizeObserver(resize);observer.observe(root);resize();
  loadLevel(levelId,data?.checkpoint?.level===levelId?data.checkpoint:null);raf=requestAnimationFrame(loop);
  return()=>{if(disposed)return;disposed=true;save();controller.abort();observer.disconnect();cancelAnimationFrame(raf);root.remove();delete host.dataset.experience;};
}
