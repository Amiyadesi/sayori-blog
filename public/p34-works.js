import { WALK_LEVELS, makeWalker, stepWalker } from './p34-typewalk.js?v=20261102-r10';
export const WORK_META = [{ id: 'typewalk', title: '字间旅行' }];

export function mountWork(id, host, opts) {
  if (id !== 'typewalk') throw new RangeError('Unknown creation');
  const { motion } = opts;
  const controller = new AbortController(), { signal } = controller;
  const wrap = document.createElement('div'); wrap.className = 'p34-typewalk';
  wrap.innerHTML = `<p class="p34-walk-line" aria-live="polite"></p>
    <div class="p34-walk-viewport" tabindex="0" aria-label="字间旅行：左右移动，空格跳跃"><div class="p34-walk-world"><div class="p34-walk-words"></div><span class="p34-walk-star" aria-label="可选的星点">✳</span><span class="p34-caret" aria-label="你操纵的光标"></span></div><canvas aria-hidden="true"></canvas></div>
    <p class="p34-walk-hint"></p><p class="p34-walk-status" role="status"></p>
    <div class="p34-walk-touch" aria-label="触屏操作"><div><button type="button" data-hold="left" aria-label="向左走">←</button><button type="button" data-hold="right" aria-label="向右走">→</button></div><button type="button" data-hold="jump" aria-label="跳跃">↑</button></div>
    <p class="p34-walk-after"><button type="button" data-action="restart">从这一句重来</button><button type="button" data-action="old">看看旧稿</button><button type="button" data-action="previous" hidden>上一段</button><button type="button" data-action="next" hidden>再往下一行</button></p>`;
  host.append(wrap);
  const viewport = wrap.querySelector('.p34-walk-viewport'), world = wrap.querySelector('.p34-walk-world');
  const words = wrap.querySelector('.p34-walk-words'), caret = wrap.querySelector('.p34-caret'), star = wrap.querySelector('.p34-walk-star');
  const canvas = wrap.querySelector('canvas'), ctx = canvas.getContext('2d'), next = wrap.querySelector('[data-action=next]');
  const status = wrap.querySelector('.p34-walk-status');
  let best = opts.progress.best, stars = opts.progress.stars, index = Math.min(best, 3), edition = 2;
  let platforms, p, level, checkpoint, active = false, scale = 1, camera = 0, cameraTarget = 0;
  let raf = 0, time = 0, accumulator = 0, complete = false, starTaken = false, failures = 0, portalWait = 0;
  let drag = null, jumpPressed = false, keyHeld = new Set(), touchHeld = new Map(), trail = [], motes = [], lastTrail = 0;
  let wordEvents = new AbortController(), wordEls = new Map();
  const listen = (el, type, fn, options = {}) => el.addEventListener(type, fn, { signal, ...options });
  function held(key) { return keyHeld.has(key) || [...touchHeld.values()].includes(key); }
  function bounds() { return { w: viewport.clientWidth, h: viewport.clientHeight }; }
  function placeWord(w) {
    const el = wordEls.get(w.id); el.style.left = w.x + 'px'; el.style.top = w.y + 'px'; el.style.width = w.w + 'px';
  }
  function burst(x, y, color = '#7665ad', amount = 14) {
    for (let i = 0; i < amount; i++) {
      const a = i * 2.399, speed = 36 + i % 5 * 22;
      motes.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 40, life: .65, max: .65, color, shape: i % 3 });
    }
    motion.tone(amount % 6, true);
  }
  function load(i, old = edition === 1) {
    wordEvents.abort(); wordEvents = new AbortController();
    index = i; edition = old ? 1 : 2; level = WALK_LEVELS[index];
    platforms = level.words.map(([id,text,x,y,w,kind='static']) => ({id,text,x,y,w,kind}));
    if (old) platforms = WALK_LEVELS[0].words.map(([id,text,x,,w]) => ({ id, text, x, y: 350, w, kind: 'static' }));
    if (old) level = { ...WALK_LEVELS[0], star: [760,260] };
    wordEls.clear(); words.replaceChildren();
    for (const w of platforms) {
      const el = document.createElement(w.kind === 'drag' ? 'button' : 'span');
      el.className = 'p34-walk-word is-' + w.kind; el.dataset.word = w.id;
      if (w.kind === 'drag') { el.type = 'button'; el.setAttribute('aria-label', w.text + '，可拖动；Shift加方向键挪动'); }
      el.textContent = w.text; words.append(el); wordEls.set(w.id, el); placeWord(w);
      if (w.kind === 'drag') {
        el.addEventListener('pointerdown', e => {
          if (!active || e.button !== 0) return;
          e.preventDefault(); el.setPointerCapture(e.pointerId);
          drag = { id: e.pointerId, w, x: e.clientX, y: e.clientY, ox: w.x, oy: w.y };
          el.classList.add('is-held');
        }, { signal: wordEvents.signal });
        el.addEventListener('keydown', e => {
          if (!e.shiftKey || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
          e.preventDefault(); e.stopPropagation();
          moveWord(w, w.x + (e.key === 'ArrowLeft' ? -18 : e.key === 'ArrowRight' ? 18 : 0), w.y + (e.key === 'ArrowUp' ? -18 : e.key === 'ArrowDown' ? 18 : 0));
        }, { signal: wordEvents.signal });
      }
    }
    p = makeWalker(platforms[0]); checkpoint = platforms[0];
    complete = false; failures = 0; camera = 0; portalWait = 0; starTaken = !old && !!(stars & (1 << index));
    trail = []; motes = []; next.hidden = true; star.hidden = starTaken;
    star.style.left = level.star[0] + 'px'; star.style.top = level.star[1] + 'px';
    wrap.querySelector('.p34-walk-line').textContent = old ? '旧稿。那时的字还排得很整齐。' : ['第一段，','第二段，','第三段，','最后一段，'][index] + level.name;
    wrap.querySelector('.p34-walk-hint').textContent = old ? '那时还没有拖字和括号。左右走，空格跳。' : level.hint;
    wrap.querySelector('[data-action=old]').textContent = old ? '回到现在这一稿' : '看看旧稿';
    wrap.querySelector('[data-action=previous]').hidden = old || index === 0;
    status.textContent = '';
    render();
  }
  function moveWord(w, x, y) {
    const [minX,maxX,minY,maxY] = level.bounds;
    const nx = Math.max(minX, Math.min(maxX, x)), ny = Math.max(minY, Math.min(maxY, y));
    if (p.ground === w.id) { p.x += nx - w.x; p.y += ny - w.y; }
    w.x = nx; w.y = ny; placeWord(w);
  }
  listen(window, 'pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    e.preventDefault(); moveWord(drag.w, drag.ox + (e.clientX - drag.x) / scale, drag.oy + (e.clientY - drag.y) / scale);
  }, { passive: false });
  function release(e) {
    touchHeld.delete(e.pointerId);
    if (drag && drag.id === e.pointerId) {
      wordEls.get(drag.w.id).classList.remove('is-held');
      motion.tone(1, true); drag = null;
    }
  }
  listen(window, 'pointerup', release); listen(window, 'pointercancel', release);
  for (const button of wrap.querySelectorAll('[data-hold]')) {
    listen(button, 'pointerdown', e => {
      if (!active) return;
      e.preventDefault(); button.setPointerCapture(e.pointerId);
      touchHeld.set(e.pointerId, button.dataset.hold); if (button.dataset.hold === 'jump') jumpPressed = true;
    });
    listen(button, 'contextmenu', e => e.preventDefault());
  }
  function clearKeys() { keyHeld.clear(); touchHeld.clear(); jumpPressed = false; }
  listen(window, 'blur', clearKeys);
  listen(document, 'visibilitychange', () => { clearKeys(); });
  listen(window, 'keydown', e => {
    if (!active || e.isComposing || e.target.closest('input,textarea,[contenteditable="true"]') || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
    const action = ({ ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump' })[e.code];
    if (!action) return;
    if (e.code === 'Space' && e.target.closest('button,a')) return;
    e.preventDefault();
    if (action === 'jump' && !e.repeat && !held('jump')) jumpPressed = true;
    keyHeld.add(action);
  });
  listen(window, 'keyup', e => {
    const action = ({ ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump' })[e.code];
    if (action) keyHeld.delete(action);
  });
  listen(wrap, 'click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'restart') { load(index); viewport.focus({ preventScroll: true }); }
    if (action === 'old') {
      const old = edition !== 1;
      if (old) opts.onDiscover('old-version');
      load(old ? 0 : Math.min(best, 3), old); viewport.focus({ preventScroll: true });
    }
    if (action === 'previous') { load(index - 1, false); viewport.focus({ preventScroll: true }); }
    if (action === 'next') {
      load(index === 3 ? 0 : index + 1, false); viewport.focus({ preventScroll: true });
      reveal(wrap.querySelector('.p34-walk-line').getBoundingClientRect());
    }
  });
  function respawn() {
    failures++; p = makeWalker(checkpoint); trail = [];
    burst(p.x, p.y, '#319eaa', 9);
    status.textContent = failures === 1 ? '没关系，接住了。从刚才那句继续。' : failures === 3 ? '我把落脚的地方放宽一点。再试试？' : '还在。慢慢来。';
    if (failures === 3) {
      const w = platforms.find(w => w.x > checkpoint.x && w.kind !== 'drag');
      if (w) {
        const before = wordEls.get(w.id).getBoundingClientRect(); w.x -= 26; w.w += 26; placeWord(w);
        const after = wordEls.get(w.id).getBoundingClientRect();
        void motion.animate(wordEls.get(w.id), [{ translate: `${(before.x-after.x)/scale}px 0` }, { translate: '0 0' }], { duration: 800 });
      }
    }
  }
  function update(dt) {
    if (complete) return;
    const events = stepWalker(p, { axis: Number(held('right')) - Number(held('left')), jumpPressed, jumpHeld: held('jump') }, platforms, dt);
    jumpPressed = false; p.x = Math.max(8, Math.min(level.width - 8, p.x));
    portalWait = Math.max(0, portalWait - dt);
    if (events.includes('jump')) { burst(p.x, p.y, '#319eaa', 5); }
    const landed = p.ground && platforms.find(w => w.id === p.ground);
    if (events.includes('land') || events.includes('bounce')) {
      const w = platforms.find(w => Math.abs(w.y - p.y) < 1 && p.x >= w.x - 7 && p.x <= w.x + w.w + 7);
      if (w) void motion.animate(wordEls.get(w.id), [{ translate: '0 0', scale: '1' }, { translate: '0 5px', scale: '1.04 .86', offset: .2 }, { translate: '0 -2px', scale: '.99 1.02', offset: .65 }, { translate: '0 0', scale: '1' }], { duration: events.includes('bounce') ? 620 : 380 });
      burst(p.x, p.y, events.includes('bounce') ? '#c56587' : '#319eaa', events.includes('bounce') ? 20 : 7);
      if (events.includes('bounce')) status.textContent = '哇，弹起来了。';
    }
    if (landed && !['drag','spring','portal'].includes(landed.kind)) checkpoint = landed;
    if (!starTaken && Math.hypot(p.x-level.star[0], p.y-14-level.star[1]) < 30) {
      starTaken = true; star.hidden = true; burst(level.star[0],level.star[1],'#d5aa47',28);
      status.textContent = '这颗小星是绕路才看得到的。给你。';
      if (edition === 2) { stars |= 1 << index; opts.onFinish(best, stars); }
    }
    if (landed && level.portal && landed.id === level.portal[0] && portalWait === 0) {
      const arrival = platforms.find(w => w.id === level.portal[1]);
      burst(p.x,p.y,'#7665ad',22);
      p.x = arrival.x + 30; p.y = arrival.y; p.vy = 0; p.ground = arrival.id; checkpoint = arrival; portalWait = 1;
      burst(p.x,p.y,'#7665ad',22); status.textContent = '括号里面，是另一行。';
      void motion.animate(caret, [{ opacity: 0, scale: '.2 2' }, { opacity: 1, scale: '1' }], { duration: 550 });
    }
    if (landed?.id === level.goal) {
      complete = true; burst(p.x,p.y,'#d5aa47',40); motion.tone(5);
      status.textContent = edition === 1 ? '这一稿到这里。那时我还不敢把字挪远。' : index === 3 ? '你真的走完了。最后这个句号，留给你。' : '走到了。再给你写一段？';
      if (edition === 2) {
        best = Math.max(best,index+1); opts.onFinish(best,stars);
        next.hidden = false; next.textContent = index === 3 ? '从第一句再走一遍' : '再往下一行';
      }
    }
    if (events.includes('fall')) respawn();
  }
  function render() {
    scale = viewport.clientHeight / 450;
    const { w } = bounds();
    cameraTarget = Math.max(0, Math.min(level.width - w/scale, p.x - w/scale * .38));
    camera += (cameraTarget-camera) * .11;
    world.style.transform = `translateX(${-camera*scale}px) scale(${scale})`;
    caret.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-100%) rotate(${Math.max(-11,Math.min(11,p.vx*.035))}deg)`;
    caret.classList.toggle('is-grounded', !!p.ground);
    const dpr = Math.min(devicePixelRatio, 2), { w: width,h: height } = bounds();
    if (canvas.width !== Math.round(width*dpr) || canvas.height !== Math.round(height*dpr)) { canvas.width = Math.round(width*dpr); canvas.height = Math.round(height*dpr); }
    ctx.setTransform(dpr*scale,0,0,dpr*scale,-camera*scale*dpr,0); ctx.clearRect(camera,0,width/scale,height/scale);
    if (!motion.reduced()) {
      ctx.lineCap = 'round';
      for (let i=1;i<trail.length;i++) {
        ctx.beginPath(); ctx.strokeStyle = `rgba(49,158,170,${i/trail.length*.22})`; ctx.lineWidth = i/trail.length*3;
        ctx.moveTo(trail[i-1].x,trail[i-1].y); ctx.lineTo(trail[i].x,trail[i].y); ctx.stroke();
      }
      for (const m of motes) {
        ctx.globalAlpha = m.life/m.max; ctx.fillStyle = m.color;
        if (m.shape === 0) { ctx.fillRect(m.x-1,m.y-4,2,8); ctx.fillRect(m.x-4,m.y-1,8,2); }
        else { ctx.beginPath(); ctx.arc(m.x,m.y, m.shape===1?2:1,0,Math.PI*2); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
    }
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.045,(now-(time||now))/1000); time = now;
    if (!active || document.hidden) { accumulator = 0; return; }
    accumulator += dt;
    while (accumulator >= 1/120) { update(1/120); accumulator -= 1/120; }
    if (now-lastTrail>25) { trail.push({x:p.x,y:p.y-9}); if(trail.length>16)trail.shift(); lastTrail=now; }
    for (const m of motes) { m.life-=dt; m.x+=m.vx*dt; m.y+=m.vy*dt; m.vy+=180*dt; }
    motes=motes.filter(m=>m.life>0);
    render();
  }
  function reveal(from) {
    platforms.forEach((w,i) => {
      const el = wordEls.get(w.id), to=el.getBoundingClientRect();
      if (to.x>innerWidth || to.right<0) return;
      void motion.animate(el,[{translate:`${(from.x-to.x)/scale}px ${(from.y-to.y)/scale}px`,rotate:`${i%2?8:-8}deg`,opacity:0},{translate:'0 0',rotate:'0deg',opacity:1}],{duration:1000,delay:i*50});
    });
  }
  load(index); raf=requestAnimationFrame(frame);
  const observer = new ResizeObserver(() => { if (!host.hidden) render(); }); observer.observe(viewport);
  const destroy = () => { controller.abort(); wordEvents.abort(); cancelAnimationFrame(raf); observer.disconnect(); wrap.remove(); };
  opts.signal.addEventListener('abort',destroy,{once:true});
  return { reveal, setActive(value) {
    active=value;
    if(!value) {
      clearKeys();
      if (drag) { wordEls.get(drag.w.id).classList.remove('is-held'); drag=null; }
    } else { time=0; render(); }
  }, destroy };
}
