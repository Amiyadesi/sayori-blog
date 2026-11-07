import { JOURNEY_COOKIE, PHASES, NOTES, EDITIONS, cookieJourney, readJourney, journeyEvent, trialReady, campaignReady, availableVersions } from './p34-journey.js?v=20261107-residue';
import { BreakoutGame } from './p34-breakout-core.js?v=20261107-residue';
import { SAMPLE } from './p34-breakout-levels.js?v=20261107-residue';
import { lightPoint, INITIAL_LIGHT } from './p34-light.js?v=20261107-residue';
import { mountResidue, mountArchiveRemnants, mountNoteRemnant } from './p34-residue.js?v=20261107-residue';

export function reboundSketch(offset, edition) {
  const game=new BreakoutGame({width:960,height:600,level:SAMPLE,edition});game.launch();
  game.paddle.vx=offset*game.width*1.12;game.ball.x=640;game.ball.y=480;game.ball.vx=0;game.ball.vy=game.baseSpeed;game.returnBall(offset);
  const b=game.ball,top=(125-b.y)/b.vy,side=b.vx?((b.vx>0?956:4)-b.x)/b.vx:Infinity,t=Math.min(top,side);
  const x=b.x+b.vx*t,y=b.y+b.vy*t;
  return {path:`M640 480 L${x} ${y}`,paddleX:640-(offset+1)*game.paddle.w/2,paddleWidth:game.paddle.w,exit:side<top&&b.vx>0&&y>162&&y<408};
}

export function mountAdventure({ shell, site, motion, speak, dialogue, quiet, go, getRoom, getSketches, leave, cookie, signal }) {
  const loaded=cookieJourney(document.cookie);
  let state=loaded.state,storageError=loaded.error,stopScene=null,stopDiagram=null,sceneRequest=0,smallTalk=0;
  const listen=(el,type,fn,options={})=>el.addEventListener(type,fn,{signal,...options});
  const say=(text,options={})=>speak(text,{note:'',...options});
  const homeURL='https://sayori.org/?paper=0617',blogURL='https://blog.sayori.org/notes/long-way/?paper=0617';
  const memorySketch=()=>state.lightSketch||getSketches().at(-1)?.nodes;
  const residue=mountResidue(shell,{motion,signal});
  const remnants=document.createElement('section');remnants.className='residue-remnants';remnants.hidden=true;remnants.setAttribute('aria-label','残存的页面');shell.append(remnants);
  const lightRemnant=document.createElement('div');lightRemnant.className='residue-light-page';lightRemnant.hidden=true;
  lightRemnant.innerHTML='<svg viewBox="0 0 280 180" role="img" aria-label="光的残影"><path fill="none" stroke="currentColor" stroke-width=".7"/></svg>';shell.append(lightRemnant);
  const back=document.createElement('a');back.className='residue-back';back.textContent='残页';back.hidden=true;
  back.href=site==='home'?'/?paper=0617':homeURL;if(site==='home')back.dataset.go='home';shell.append(back);
  function atmosphere(){
    shell.dataset.journey=state.phase;shell.dataset.silence=String(state.phase==='closed');shell.dataset.reunion=String(state.phase==='found');
    residue.update(state.phase);
    if(state.phase!=='closed'){remnants.hidden=true;lightRemnant.hidden=true;back.hidden=true;}
  }
  const notice=document.createElement('p');notice.className='journey-notice';notice.hidden=true;notice.setAttribute('role','status');shell.append(notice);
  function error(text){notice.textContent=text;notice.hidden=false;}
  if(storageError)error(storageError);
  function current(){
    if(!storageError){const latest=cookieJourney(document.cookie);if(latest.error){storageError=latest.error;error(storageError);}else state=latest.state;}
    return state;
  }
  function record(type,value){
    state=journeyEvent(current(),type,value);
    if(!storageError){
      const raw=JSON.stringify(state);
      try{if(encodeURIComponent(raw).length>3800)throw new Error('存档空间不足');cookie(JOURNEY_COOKIE,raw);if(JSON.stringify(cookieJourney(document.cookie).state)!==raw)throw new Error('浏览器未允许保存');}
      catch(e){storageError=`${e.message}，当前进度可用「带走存档」保存`;error(storageError);}
    }
    atmosphere();return state;
  }
  function lines(texts,done){const next=i=>i===texts.length?done():dialogue(texts[i],[['嗯',()=>next(i+1)]]);next(0);}
  function freeTime(){
    const n=smallTalk++%3;
    if(n===0)dialogue('我刚把爆炸声换掉了',[
      ['原来那个很吵？',()=>dialogue('不是，太像关门了\n炸一次就以为有人走了',[['现在呢？',()=>dialogue('你开声音打一局就知道了',[['去试试',()=>void play('draft',{mode:'campaign'})],['待会儿',quiet]])],['那你接着忙',quiet]])],
      ['我自己逛逛',quiet],['回原来的网页',leave],
    ]);
    else if(n===1)dialogue('昨天想做水波\n最后一晚上都在调那个弯',[
      ['就是实验室那条？',()=>dialogue('对\n没做成水波，但这条我也挺喜欢',[['我去拉一下',()=>site==='home'?go('lab'):location.assign(homeURL+'&room=lab')],['先别动它了',quiet]])],['那你忙',quiet],
    ]);
    else dialogue('我在听昨天录的雨\n中间有辆车一直倒不出去',[
      ['你连这个也留着？',()=>dialogue('留着啊\n每次都以为它这次该出去了',[['看看你写的',()=>location.assign('https://blog.sayori.org/notes/rain-folder/?paper=0617')],['我先逛逛',quiet]])],['不打扰了',quiet],
    ]);
  }
  function offer(version){
    const first=version==='draft';
    dialogue(first?'我做了个打砖块\n试试？':version==='tuned'?'这份宽了一点\n砖还是那一组':'这次会自己瞄准\n你再打几球看看',[
      ['玩',()=>void play(version,{mode:first&&!campaignReady(state)?'campaign':'trial'})],['你还在忙什么？',freeTime],['我先逛逛',quiet],
    ]);
  }
  function oldTrial(){dialogue('我把同一组砖留了三份\n先试一下最早的回球',[['试初稿',()=>void play('draft')],['我先把这关打完',()=>void play('draft',{mode:'campaign'})],['待会儿',quiet]]);}
  function feedback(version){
    const first=version==='draft';
    dialogue(first?(state.trials.draft.misses?'刚才那几球\n挡板过去又滑了一点':'我喜欢横着抽那一下\n但确实不太好停'):'现在好接多了\n你还会想横着抽吗？',[
      [first?'惯性挺有意思':'会，原来能甩得更开',()=>revise(version,'free')],
      [first?'容易滑过头':'现在舒服多了',()=>revise(version,'clear')],
      ['我还没拿准',()=>revise(version,'unsure')],['再打几球',()=>void play(version)],
    ]);
  }
  function revise(version,value){
    record('feedback',{version,value});refreshWorks();
    if(version==='draft')lines([value==='free'?'那个手感我也舍不得\n不过我还是做了另一份':'嗯，我也总滑过去\n所以改了另一份','挡板宽了一点\n回弹方向改成看接球的位置'],()=>offer('tuned'));
    else lines(['这两处我想先留着','我还试了个自动瞄准\n一直打不到最后一块，挺烦的'],()=>offer('guided'));
  }
  function decide(){dialogue('我想把三份收成一个版本\n结果改一处，又想改回去',[
    ['我更喜欢能自己甩球',()=>choose('free')],['自动瞄准也挺好',()=>choose('clear')],['先把三份都留着呢？',()=>choose('both')],['我也还没想清楚',()=>choose('unsure')],
  ]);}
  function choose(value){record('opinion',value);conflict();}
  function conflict(){
    const first={free:'我也喜欢那一下\n可昨天还在改它',clear:'是省心了\n可我又想把它关掉',both:'都留着呢\n我已经不想点开了',unsure:'我也是\n昨天还觉得改好了'}[state.opinion];
    lines([first,'今天又改回去了\n我都不知道昨天在忙什么','先关了吧'],()=>{quiet();closeScene();record('withdraw');go('home');});
  }
  function talk(){
    current();
    if(state.phase==='closed')return true;
    if(state.phase==='found'){reunion();return true;}
    if(state.phase==='making'){desk();return true;}
    if(state.phase==='after'){dialogue(state.leftLetter?'留言我留着了\n先等我打完这局':'来啦\n我又挪了一点',[['去工作间',desk],['再打几关',()=>void play('draft',{mode:'campaign'})],['聊别的',freeTime],['回原来的网页',leave]]);return true;}
    if(state.phase==='choice'){conflict();return true;}
    if(state.phase==='arrive'){record('hello');lines(['等下，球还没停\n……你能看见啊？','那正好\n我自己打都快打习惯了'],()=>offer('draft'));return true;}
    const version=state.phase==='guided'?'guided':state.phase==='tuned'?'tuned':'draft';
    if(trialReady(state,version))version==='guided'?decide():feedback(version);
    else if(version==='draft'&&campaignReady(state))oldTrial();else offer(version);
    return true;
  }
  function closeScene(){
    sceneRequest++;stopScene?.();stopScene=null;delete shell.dataset.experience;
    const sound=shell.querySelector('[data-sound]');sound.setAttribute('aria-pressed',String(motion.sound));sound.setAttribute('aria-label',motion.sound?'关闭声音':'开启声音');
  }
  async function play(edition,{mode='trial',previous=false}={}){
    current();if(site!=='home'){location.assign(homeURL+'&room=works');return;}
    if(!availableVersions(state).includes(edition))return;
    if(state.phase==='closed')return;
    quiet();closeScene();const request=++sceneRequest;
    try{
      const {mountBreakout}=await import('./p34-breakout.js?v=20261107-residue');
      if(signal.aborted||request!==sceneRequest)return;
      stopScene=mountBreakout(shell,{state,edition,mode,previous,motion,onEvent(value){
        if(current().phase==='closed'){closeScene();room(getRoom());return;}
        record('play',value);
      },onClose(){
        closeScene();refreshWorks();
        if(mode==='workshop')workshopReturn();
        else if(state.phase!=='closed'){
          if(mode==='trial'&&trialReady(state,edition)){
            if(state.phase==='shared'&&edition==='draft'||state.phase==='tuned'&&edition==='tuned')feedback(edition);
            else if(state.phase==='guided'&&edition==='guided')decide();else room(getRoom());
          }else if(mode==='campaign'&&state.phase==='shared'&&campaignReady(state))oldTrial();
          else room(getRoom());
        }else room(getRoom());
      }});
    }catch(e){stopScene?.();stopScene=null;delete shell.dataset.experience;error(`没能打开作品：${e.message}`);console.error(e);}
  }
  function refreshWorks(){
    if(site!=='home')return;
    const panel=shell.querySelector('.space-works'),select=panel.querySelector('[data-edition]');select.replaceChildren();
    const closed=['closed','found','making'].includes(state.phase);
    const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='试稿对照';select.append(placeholder);
    for(const v of availableVersions(state)){const o=document.createElement('option');o.value=v;o.textContent=EDITIONS[v];select.append(o);}
    panel.querySelector('[data-campaign]').disabled=closed;select.disabled=closed;
    select.hidden=!campaignReady(state)&&PHASES.indexOf(state.phase)<2;
    panel.querySelector('[data-desk]').hidden=!['found','making','after'].includes(state.phase);
    shell.querySelector('[data-rebound-compare]').hidden=PHASES.indexOf(state.phase)<2;
  }
  function heading(name){
    if(state.phase==='closed')return '';
    if(name==='home')return state.phase==='after'?'来啦\n我还在改':['found','making'].includes(state.phase)?'我在里面':state.phase==='choice'?'有点乱':state.phase==='guided'?'又改了一份':state.phase==='tuned'?'这次好接一点':state.phase==='arrive'?'诶？\n先别碰——':'回来了？';
    return {works:'试试这个',lab:'拉一下',archive:'先留着',blog:'写在这里',guestbook:'留点什么？'}[name];
  }
  function room(name,announce=true){
    current();atmosphere();
    if(state.phase==='closed'&&site==='home'&&['works','guestbook'].includes(name)){go('home');return;}
    if(!storageError)notice.hidden=true;refreshWorks();filterNotes();if(announce)say(heading(name));
    shell.querySelector('[data-talk]').hidden=state.phase==='closed';
    shell.querySelector('[data-return]').hidden=site!=='blog'&&state.phase!=='closed'&&shell.dataset.map!=='true';
    const touch=shell.querySelector('[data-touch-light]');if(touch)touch.hidden=state.phase==='closed';
    saves.hidden=name!=='archive'&&site!=='blog';
    remnants.hidden=state.phase!=='closed'||name!=='home'||site!=='home';
    lightRemnant.hidden=state.phase!=='closed'||name!=='lab'||site!=='home';
    back.hidden=state.phase!=='closed'||name==='home';
    if(!remnants.hidden||!lightRemnant.hidden){
      const nodes=memorySketch()||INITIAL_LIGHT;
      const path=Array.from({length:65},(_,i)=>{const [x,y]=lightPoint(nodes,i/64);return `${i?'L':'M'}${x*280} ${y*180}`;}).join(' ');
      remnants.querySelector('[data-residue-light]').setAttribute('d',path);
      lightRemnant.querySelector('path').setAttribute('d',path);
    }
    if(state.phase==='closed'&&name==='home')shell.querySelectorAll('[data-room-link]').forEach(a=>{const visible=['archive','blog'].includes(a.dataset.roomLink);a.dataset.visible=String(visible);a.inert=!visible;});
    if(state.phase==='closed'&&site==='home'&&name==='archive')compare();
  }

  const sketchBricks=new BreakoutGame({width:960,height:600,level:SAMPLE}).bricks.map(b=>`<rect x="${b.x-b.w/2}" y="${b.y-b.h/2}" width="${b.w}" height="${b.h}" rx="3"/>`).join('');
  function compare(){
    quiet();closeScene();
    if(state.phase==='closed'){
      stopScene=mountArchiveRemnants(shell,{state,blogURL,motion,onUncover:()=>record('difference'),onFound(){record('found');reunion();}});
      return;
    }
    shell.dataset.experience='trace';
    const scene=new AbortController(),root=document.createElement('section');root.className='trace-scene';
    root.setAttribute('aria-label','两份回球，挪动挡板对照出射方向');
    root.innerHTML=`<div class="trace-versions"><button data-trace-version="draft" aria-pressed="false">初稿</button><button data-trace-version="guided" aria-pressed="true">自动瞄准</button></div>
      <div class="trace-map"><svg viewBox="0 0 960 600" role="img" aria-label="同一处接球，两份修订的出射线"><g fill="#d0d1c344">${sketchBricks}</g><path d="M640 200V480" stroke="#bfc0b455" stroke-dasharray="4 9"/><path data-ghost fill="none" stroke="#a7a89a55" stroke-width="2" stroke-dasharray="5 9"/><path data-ray fill="none" stroke="#eeeedd" stroke-width="3"/><rect data-pad y="488" width="144" height="12" rx="5" fill="#e8e8df"/><circle cx="640" cy="480" r="8" fill="#eeeedd"/><path d="M940 162h16v246h-16" fill="none" stroke="#cfcfb66b" stroke-width="2" stroke-dasharray="3 7"/></svg>
      <a class="trace-source" data-source href="${blogURL}" hidden>回球笔记</a></div>
      <div class="trace-controls"><label class="trace-slider"><input type="range" min="-90" max="90" value="0" aria-label="挪动接球位置"></label>
      <div class="trace-actions"><button data-trace-back>回旧稿</button></div></div>`;
    shell.append(root);const input=root.querySelector('input');
    let edition='guided';
    const update=()=>{
      const offset=Number(input.value)/100,trace=reboundSketch(offset,edition);
      root.querySelector('[data-ray]').setAttribute('d',trace.path);
      root.querySelector('[data-ghost]').setAttribute('d',reboundSketch(offset,edition==='draft'?'guided':'draft').path);
      const pad=root.querySelector('[data-pad]');pad.setAttribute('x',String(trace.paddleX));pad.setAttribute('width',String(trace.paddleWidth));
      root.querySelectorAll('[data-trace-version]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.traceVersion===edition)));
      root.querySelector('[data-source]').hidden=!trace.exit;
    };
    input.addEventListener('input',update,{signal:scene.signal});
    root.addEventListener('click',e=>{
      if(e.target.closest('[data-trace-back]')){closeScene();room('archive');}
      const version=e.target.closest('[data-trace-version]');if(version){edition=version.dataset.traceVersion;update();}
    },{signal:scene.signal});
    update();input.focus({preventScroll:true});
    stopScene=()=>{scene.abort();root.remove();delete shell.dataset.experience;};
  }
  function reunion(){
    closeScene();atmosphere();shell.querySelector('[data-talk]').hidden=false;
    lines(['……是你啊','先别开灯'],()=>{
      const items=[];
      if(state.plays.draft.returns>0&&state.lastReturn)items.push(['聊起之前那次回球',()=>keep('round')]);
      if(state.light===2&&memorySketch())items.push(['把留下的光拿给她看',()=>keep('light')]);
      items.push(['先陪她待一会儿',()=>keep('empty')]);dialogue('你坐这儿',items);
    });
  }
  function keep(what){
    if(what==='light'&&!state.lightSketch)record('light-saved',memorySketch());
    record('keepsake',what);
    const text=what==='light'?'这个弯你还留着\n我当时还嫌它歪':what==='round'?'这一下我记得\n我当时只顾着看砖碎没碎':'好\n我先把这些挪开';
    lines([text,state.opinion==='clear'?'你喜欢自动瞄准，我知道\n但这次我想自己控制':'我还是想试那种横着打的手感','这两堆砖接不上\n你帮我挪一下中间的炸弹？'],()=>{record('make');desk();});
  }
  function desk(){void play('tuned',{mode:'workshop'});}
  function workshopReturn(){
    if(state.phase==='after'){
      dialogue('这份先放这儿\n我还想试试别的位置',[['继续改这份',desk],...(state.workshop.kept!==null?[['打打上一份',()=>void play('tuned',{mode:'workshop',previous:true})]]:[]),['去外面逛逛',()=>room(getRoom())]]);return;
    }
    if(state.workshop.placed&&(state.workshop.cleared||state.workshop.attempts>=2)){
      lines([state.workshop.cleared?'炸开了\n不过右边还有点挤':'还是没连上\n右边再往里一点呢','这份先留着\n我另开一份'],()=>{
        record('continue');refreshWorks();
        lines(['别关\n我再挪一下'],desk);
      });
    }else dialogue(state.workshop.placed?'打几球看看\n光摆着我也看不出来':'中间那块还没挪\n先试试靠哪边',[['再试',desk],['先回外面',()=>room(getRoom())]]);
  }
  function canRead(slug){current();if(slug==='landing-notes')return PHASES.indexOf(state.phase)>=3;if(slug==='tomorrow-again')return state.phase==='after';return true;}
  function filterNotes(){if(site==='blog')shell.querySelectorAll('[data-post]').forEach(a=>{a.parentElement.hidden=!canRead(a.dataset.post);});}
  function opened(slug){
    stopDiagram?.();stopDiagram=null;if(NOTES.includes(slug))record('opened',slug);
    const diagram=shell.querySelector('[data-return-diagram]');if(!diagram)return;
    if(state.phase==='closed'){
      stopDiagram=mountNoteRemnant(diagram,{homeURL:homeURL+'&room=archive',onCollect(){if(!state.diagram)record('diagram');}});
      return;
    }
    diagram.querySelector('[data-return-bricks]').innerHTML=sketchBricks;
    const input=diagram.querySelector('input'),ink=diagram.querySelector('[data-return-ink]'),pad=diagram.querySelector('[data-return-pad]');
    const update=()=>{
      const trace=reboundSketch(Number(input.value)/100,'draft');ink.setAttribute('d',trace.path);pad.setAttribute('x',String(trace.paddleX));pad.setAttribute('width',String(trace.paddleWidth));
      if(trace.exit){if(!state.diagram)record('diagram');diagram.querySelector('a').hidden=false;diagram.querySelector('[data-edge]').style.opacity='1';}
    };
    const control=new AbortController();input.addEventListener('input',update,{signal:control.signal});stopDiagram=()=>control.abort();if(state.diagram)input.value='90';update();
  }

  if(site==='home'){
    remnants.innerHTML=`<svg class="residue-echo" viewBox="0 0 800 850" aria-hidden="true"><path d="M800 100C120 320 620 760 250 780M720 20C130 280 570 760 40 840M730 54C190 330 550 790 52 825" fill="none" stroke="#c4c4b9" stroke-width="1"/></svg>
      <a class="residue-fragment residue-drafts" data-go="archive" href="/?paper=0617&room=archive" aria-label="旧稿"><svg viewBox="0 0 560 320" aria-hidden="true"><path d="M0 12 560 0 545 290 8 320Z" fill="#777a7533"/><g fill="#d8d9cc99"><path d="M55 70h66v20H55zM134 70h66v20h-66zM213 70h66v20h-66zM370 70h66v20h-66zM449 70h66v20h-66zM55 108h66v20H55zM134 108h66v20h-66zM370 108h66v20h-66zM449 108h66v20h-66z"/></g><path d="M355 140v121L541 180" fill="none" stroke="#eeeedb" stroke-width="2"/><path d="M354 260 416 133" fill="none" stroke="#eeeedb66" stroke-dasharray="4 8"/><path d="M306 268h88" stroke="#dddccd" stroke-width="7"/></svg><span>旧稿</span></a>
      <a class="residue-fragment residue-note" href="${blogURL}" aria-label="球甩到右边去了"><svg viewBox="0 0 230 265" aria-hidden="true"><path d="M6 0h220v260H0Z" fill="#c1c3b899"/><path d="M31 29h133M31 39h100M31 73h70M31 82h152" stroke="#11151277" stroke-width="2"/><path d="M68 120v98l150-92M215 112h10v57h-10" fill="none" stroke="#20231c" stroke-width="2"/><path d="M43 226h53" stroke="#20231c" stroke-width="5"/><path d="M0 98 172 105 0 110M230 191 141 196 230 202" fill="#08090a"/></svg><span>球甩到右边去了</span></a>
      <a class="residue-fragment residue-light" data-go="lab" href="/?paper=0617&room=lab" aria-label="拉住一束光"><svg viewBox="0 0 280 180" aria-hidden="true"><path data-residue-light fill="none" stroke="#d1d2c2" stroke-width="1.4"/></svg><span>拉住一束光</span></a>`;
    const panel=shell.querySelector('.space-works');
    panel.querySelector('.space-work-caption').innerHTML='<h2>打砖块</h2><select data-edition aria-label="试玩不同修订"></select><button type="button" data-desk hidden>工作间</button>';
    const enter=panel.querySelector('.space-work-light');enter.dataset.campaign='';enter.setAttribute('aria-label','玩打砖块');
    enter.innerHTML='<svg class="journey-work-mark" viewBox="0 0 600 380" aria-hidden="true"><defs><linearGradient id="work-sky" x2=".8" y2="1"><stop stop-color="#1b355d"/><stop offset="1" stop-color="#92b9e6"/></linearGradient><linearGradient id="work-brick" x2="0" y2="1"><stop stop-color="#edfbff"/><stop offset="1" stop-color="#97d8e9"/></linearGradient></defs><rect x="1" y="1" width="598" height="378" rx="8" fill="url(#work-sky)"/><g fill="url(#work-brick)"><path d="M87 70h78v25H87zM181 70h78v25h-78zM337 70h78v25h-78zM431 70h78v25h-78zM70 110h78v25H70zM164 110h78v25h-78zM258 110h78v25h-78zM352 110h78v25h-78zM446 110h78v25h-78z"/></g><g fill="#d8c1ef"><path d="M144 150h78v25h-78zM238 150h78v25h-78zM332 150h78v25h-78z"/></g><path d="M323 303 403 232 354 168" fill="none" stroke="#e7faffaa" stroke-width="3"/><circle cx="403" cy="232" r="7" fill="#fff"/><rect x="267" y="305" width="96" height="9" rx="4" fill="#eefbff"/><circle cx="534" cy="317" r="23" fill="none" stroke="#e7f7ff"/><path d="m528 307 16 10-16 10Z" fill="#edfaff"/></svg>';
    const experiment=document.createElement('a');experiment.className='space-work-experiment';experiment.href='/?paper=0617&room=lab';experiment.dataset.go='lab';experiment.innerHTML='<svg viewBox="0 0 280 180" aria-hidden="true"><path d="M17 123C89 150 63 6 143 81S213 170 266 35" fill="none" stroke="#cbd5ff" stroke-width="3"/><path d="M17 125C89 148 65 15 144 85S210 156 266 35" fill="none" stroke="#a5e8ff" stroke-width="1"/><g fill="#eafaff"><circle cx="17" cy="123" r="3"/><circle cx="86" cy="71" r="3"/><circle cx="190" cy="119" r="3"/><circle cx="266" cy="35" r="3"/></g></svg><span>拉住一束光</span>';panel.append(experiment);
    listen(panel.querySelector('select'),'change',e=>{const v=e.target.value;if(v){e.target.value='';void play(v);}});
    const compareButton=document.createElement('button');compareButton.className='journey-archive-launch';compareButton.type='button';compareButton.dataset.reboundCompare='';compareButton.setAttribute('aria-label','两份回球');compareButton.innerHTML='<svg viewBox="0 0 600 240" aria-hidden="true"><path d="M195 38v155L555 45" fill="none" stroke="currentColor" stroke-width="2"/><path d="M195 193 288 39" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="6 9" opacity=".4"/><path d="M146 202h98" stroke="currentColor" stroke-width="8"/><circle cx="195" cy="193" r="5" fill="currentColor"/></svg><span>两份回球</span>';shell.querySelector('.space-archive').append(compareButton);
    const form=shell.querySelector('.space-guest-form'),submit=form.querySelector('button');submit.disabled=false;submit.textContent='留在这里';
    const message=form.querySelector('textarea'),name=form.querySelector('input');
    const note=document.createElement('p');note.className='journey-letter-status';note.setAttribute('role','status');note.textContent='只留在这台设备';form.append(note);
    try{const saved=localStorage.getItem('p34-local-letter');if(saved){const item=JSON.parse(saved);if(typeof item.name!=='string'||typeof item.text!=='string'||item.name.length>40||item.text.length>1000)throw new Error('旧留言格式有误');name.value=item.name;message.value=item.text;}}
    catch(e){note.textContent=e.message;}
    listen(form,'submit',e=>{e.preventDefault();if(!message.value.trim()){note.textContent='先写一点';message.focus();return;}
      try{localStorage.setItem('p34-local-letter',JSON.stringify({name:name.value.slice(0,40),text:message.value.slice(0,1000)}));record('letter');note.textContent='留好了';if(state.phase!=='closed')say('好\n就放在这儿');}catch{note.textContent='没能保存，文字还在，可以先复制下来';}
    });
  }
  const saves=document.createElement('div');saves.className='journey-save-actions';saves.innerHTML='<button type="button" data-export>带走存档</button><button type="button" data-import>读入存档</button><input type="file" accept="application/json,.json" hidden>';shell.append(saves);
  listen(saves.querySelector('[data-export]'),'click',()=>{
    if(current().light===2&&!state.lightSketch&&memorySketch())record('light-saved',memorySketch());
    const url=URL.createObjectURL(new Blob([JSON.stringify(current(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='project-34-journey.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  listen(saves.querySelector('[data-import]'),'click',()=>saves.querySelector('input').click());
  listen(saves.querySelector('input'),'change',async e=>{
    const file=e.target.files[0];if(!file)return;e.target.value='';
    if(file.size>8000){error('文件过大，未更改当前存档');return;}
    let parsed;try{parsed=readJourney(await file.text());}catch{error('没能读取文件，当前存档未更改');return;}
    if(parsed.error){error(parsed.error);return;}
    if(!confirm('读入会替换这段旅程，原有光稿不变，继续？'))return;
    closeScene();quiet();cookie(JOURNEY_COOKIE,JSON.stringify(parsed.state));
    if(JSON.stringify(cookieJourney(document.cookie).state)!==JSON.stringify(parsed.state)){error('浏览器未允许读入存档');return;}
    state=parsed.state;storageError='';notice.hidden=true;room(getRoom());
  });
  listen(shell,'click',e=>{const target=e.target.closest('button');if(!target||target.disabled)return;
    if(target.matches('[data-campaign]'))void play('draft',{mode:'campaign'});
    if(target.matches('[data-rebound-compare]'))compare();
    if(target.matches('[data-desk]'))state.phase==='found'?reunion():desk();
  });
  listen(window,'focus',()=>{const phase=state.phase;current();if(phase!==state.phase)closeScene();if(!stopScene)room(getRoom(),false);});
  signal.addEventListener('abort',()=>{closeScene();stopDiagram?.();},{once:true});
  return {talk,room,closeScene,heading,opened,canRead,record};
}
