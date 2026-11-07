export function mountResidue(shell, { motion, signal }) {
  const root=document.createElement('div');root.className='residue-atmosphere';root.setAttribute('aria-hidden','true');root.hidden=true;
  const canvas=document.createElement('canvas');root.append(canvas);shell.prepend(root);
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('无法绘制残页背景');
  const tiles=Array.from({length:4},()=>{
    const tile=document.createElement('canvas');tile.width=tile.height=128;
    const g=tile.getContext('2d'),pixels=g.createImageData(128,128);
    for(let i=0;i<pixels.data.length;i+=4){
      const value=Math.random()<.5?30:210;
      pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;pixels.data[i+3]=255;
    }
    g.putImageData(pixels,0,0);return ctx.createPattern(tile,'repeat');
  });
  const control=document.createElement('button');control.type='button';control.className='residue-motion';control.textContent='◌';control.hidden=true;
  control.setAttribute('aria-label','暂停噪声动态');control.setAttribute('aria-pressed','false');control.title='暂停噪声动态';
  shell.querySelector('.space-tools').append(control);
  const sound=motion.sustain('static');
  let active=false,still=false,frame=0,last=0,index=0,x=.5,y=.5;
  function paint(now=0){
    frame=0;if(!active||document.hidden)return;
    const reduced=motion.reduced()||still;
    if(now-last>125||!last){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.globalAlpha=.19;ctx.fillStyle=tiles[index++%tiles.length];ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.globalAlpha=1;
      const shift=reduced?0:Math.sin(now*.00019)*canvas.height*.13;
      for(const [at,h] of [[.23,8],[.56,1],[.74,21]]){
        ctx.fillStyle=h===1?'#bcbcb922':'#03040566';ctx.fillRect(0,Math.round(canvas.height*at+shift),canvas.width,h);
      }
      last=now;
    }
    sound.update(root.dataset.quiet!=='true',x*2-1);
    if(!reduced)frame=requestAnimationFrame(paint);
  }
  function wake(){if(active&&!document.hidden&&!frame)frame=requestAnimationFrame(paint);}
  function resize(){
    cancelAnimationFrame(frame);frame=0;
    canvas.width=Math.ceil(innerWidth);canvas.height=Math.ceil(innerHeight);last=0;paint();
  }
  function stop(){cancelAnimationFrame(frame);frame=0;sound.stop();}
  control.addEventListener('click',()=>{
    still=!still;control.setAttribute('aria-pressed',String(still));control.setAttribute('aria-label',still?'恢复噪声动态':'暂停噪声动态');control.title=control.getAttribute('aria-label');
    last=0;stop();wake();
  },{signal});
  shell.addEventListener('pointermove',e=>{
    if(!active)return;x=e.clientX/innerWidth;y=e.clientY/innerHeight;
    if(!motion.reduced()&&!still){shell.style.setProperty('--residue-x',`${(x-.5)*8}px`);shell.style.setProperty('--residue-y',`${(y-.5)*5}px`);}
  },{signal,passive:true});
  shell.querySelector('[data-sound]').addEventListener('click',()=>queueMicrotask(()=>{if(active)sound.update(root.dataset.quiet!=='true',x*2-1);}),{signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else wake();},{signal});
  window.addEventListener('resize',resize,{signal});
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>{last=0;stop();wake();},{signal});
  signal.addEventListener('abort',()=>{active=false;stop();sound.dispose();root.remove();control.remove();},{once:true});
  return {
    update(phase){
      const on=phase==='closed'||phase==='found';
      root.hidden=!on;control.hidden=!on;root.dataset.quiet=String(phase==='found');
      if(phase==='found')sound.stop();
      if(on===active)return;active=on;
      if(on)resize();else{stop();shell.style.removeProperty('--residue-x');shell.style.removeProperty('--residue-y');}
    },
  };
}

const returnFragment='<svg viewBox="0 0 260 200" preserveAspectRatio="none" aria-hidden="true"><path d="M6 8 254 0 249 48 237 64 244 114 238 188 15 200 7 118 0 100 9 82Z" fill="#9e9e9e38"/><path d="M0 100 153 37 247 49" fill="none" stroke="#e9e9e9" stroke-width="2" vector-effect="non-scaling-stroke"/><path d="M72 157h50M161 147h31M183 137h20" stroke="#c2c2c247" stroke-width="9"/></svg>';

export function mountNoteRemnant(diagram,{homeURL,onCollect}) {
  const root=document.createElement('div');root.className='residue-writing';
  root.innerHTML=`<svg class="writing-fall" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
    <path d="M60 28 800 0 742 209 473 227 464 212 251 244 41 211Z" fill="#a4a4a429"/>
    <path d="M152 73h237M152 93h319M152 113h147" stroke="#d3d3d33d" stroke-width="2"/>
    <path d="M251 149v54l477-83M217 211h66" fill="none" stroke="#e2e2e2" stroke-width="2"/>
    <path d="M1000 314 267 294 251 399 223 422 266 434 247 561 710 520 725 542 1000 491Z" fill="#bcbcbc16"/>
    <path d="M331 345h274M331 362h231M331 383h145" stroke="#d0d0d032" stroke-width="2"/>
    <path d="M807 357 434 473 663 545M434 473 620 357" fill="none" stroke="#dedede80" stroke-width="1.5"/>
    <path d="M58 603 317 621 311 653 308 671 41 656Z" fill="#d0d0d012"/>
    <path d="M673 551 782 618 546 807" fill="none" stroke="#dedede6b" stroke-width="1.5"/>
  </svg><a class="writing-corner" href="${homeURL}" aria-label="带回断线残页">${returnFragment}<span>旧稿</span></a>`;
  diagram.append(root);
  const link=root.querySelector('a');link.addEventListener('click',onCollect);
  return ()=>{link.removeEventListener('click',onCollect);root.remove();};
}

export function mountArchiveRemnants(shell,{state,blogURL,motion,onUncover,onFound}) {
  const controller=new AbortController(),{signal}=controller;
  const root=document.createElement('section');root.className='residue-archive';root.setAttribute('aria-label','旧稿残骸');
  root.dataset.exposed=String(state.difference);root.dataset.linked=String(state.diagram);
  root.innerHTML=`<svg class="ruin-bed" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
    <path d="M78 337 529 358 540 464 526 481 540 490 531 518 542 591 102 675 62 599Z" fill="#62645b24"/>
    <g fill="#c4c5b574"><path d="m130 403 84-6 2 17-84 8zM235 404l41 1-2 18-38-2zM325 387h85v20h-85zM428 411h83v19h-83zM154 440l49-3 3 20-49 2zM250 446l75 4-3 19-73-6zM354 447h78v19h-78zM459 453h40v18h-40z"/></g>
    <path d="M184 513V636L540 490" fill="none" stroke="#e5e5d6" stroke-width="2" vector-effect="non-scaling-stroke"/>
    <path d="M139 645h85M184 636l45-221" fill="none" stroke="#d5d5c866" stroke-width="2" vector-effect="non-scaling-stroke"/>
    <path d="m538 468-7 10 9 12-8 15 6 12" fill="none" stroke="#e5e5d6" stroke-width="1" vector-effect="non-scaling-stroke"/>
    <path d="m718 790 84-3 1 14-79 2zM834 733h35v13h-35zM702 821l50 3-3 9-51-3z" fill="#adae9f22"/>
  </svg>
  <span class="ruin-draft-label">初稿</span>
  <button type="button" class="ruin-cover" aria-label="挪开自动瞄准稿，拖动或方向键移动">
    <svg viewBox="0 0 500 300" preserveAspectRatio="none" aria-hidden="true"><path d="M9 0 493 17 500 270 384 266 375 279 0 300Z" fill="#484a47f0"/><g fill="#9fa19a70"><path d="M64 48h77v17H64zM160 51h77v17h-77zM283 53h77v17h-77zM80 84h77v17H80zM185 85h77v17h-77zM312 88h77v17h-77z"/></g><path d="M266 221 312 108M228 234h70" fill="none" stroke="#b5b8af" stroke-width="2"/></svg><span>自动瞄准</span>
  </button>
  <a class="ruin-note" href="${blogURL}" aria-label="残页：球甩到右边去了"><svg viewBox="0 0 200 220" aria-hidden="true"><path d="M12 0 197 12 183 216 64 204 59 192 0 208Z" fill="#bdbeb180"/><path d="M32 31h110M30 44h73M31 71h126M66 102v70l102-80M44 183h43" fill="none" stroke="#25291f" stroke-width="2"/></svg><span>…右边</span></a>
  <i class="ruin-seam" aria-hidden="true"></i>
  <div class="ruin-bridge">${returnFragment}<i class="ruin-join" aria-hidden="true"></i><button type="button" class="ruin-handle" aria-label="接合断线残页，拖动或方向键移动"></button><button type="button" class="ruin-opening" aria-label="穿过残页的裂缝" hidden><span></span></button></div>`;
  shell.append(root);shell.dataset.experience='ruins';
  const cover=root.querySelector('.ruin-cover'),bridge=root.querySelector('.ruin-bridge'),opening=root.querySelector('.ruin-opening');
  let exposed=state.difference,joined=false;
  function drag(handle,piece,changed){
    let x=0,y=0,held=null;
    function shift(dx,dy,drop=false){
      const rect=piece.getBoundingClientRect();
      x+=Math.max(30-rect.right,Math.min(innerWidth-30-rect.left,dx));
      y+=Math.max(30-rect.bottom,Math.min(innerHeight-90-rect.top,dy));
      piece.style.translate=`${x}px ${y}px`;changed(drop,x,y);
    }
    handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();held={id:e.pointerId,x:e.clientX,y:e.clientY};handle.setPointerCapture(e.pointerId);},{signal});
    handle.addEventListener('pointermove',e=>{if(!held||held.id!==e.pointerId)return;const dx=e.clientX-held.x,dy=e.clientY-held.y;held.x=e.clientX;held.y=e.clientY;shift(dx,dy);},{signal});
    handle.addEventListener('pointerup',e=>{if(!held||held.id!==e.pointerId)return;held=null;changed(true,x,y);if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);},{signal});
    handle.addEventListener('pointercancel',()=>{held=null;},{signal});
    handle.addEventListener('lostpointercapture',()=>{held=null;},{signal});
    handle.addEventListener('keydown',e=>{const d={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];if(!d)return;e.preventDefault();shift(...d,true);},{signal});
  }
  if(exposed)cover.classList.add('ruin-discarded');
  drag(cover,cover,()=>{
    const rect=cover.getBoundingClientRect(),seam=root.querySelector('.ruin-seam').getBoundingClientRect();
    const covered=seam.x>rect.left&&seam.x<rect.right&&seam.y>rect.top&&seam.y<rect.bottom;
    if(!exposed&&!covered){exposed=true;root.dataset.exposed='true';onUncover();}
  });
  drag(root.querySelector('.ruin-handle'),bridge,drop=>{
    if(joined)return;
    const seam=root.querySelector('.ruin-seam').getBoundingClientRect(),join=root.querySelector('.ruin-join').getBoundingClientRect();
    const near=Math.hypot(seam.x-join.x,seam.y-join.y)<Math.max(18,Math.min(innerWidth,innerHeight)*.035);
    root.dataset.near=String(near);
    if(!drop||!near)return;
    joined=true;root.dataset.joined='true';bridge.style.translate='0px';
    root.querySelector('.ruin-handle').hidden=true;opening.hidden=false;opening.focus({preventScroll:true});motion.tone(1,true);
  });
  opening.addEventListener('click',()=>{if(joined)onFound();},{signal});
  return ()=>{controller.abort();root.remove();delete shell.dataset.experience;};
}
