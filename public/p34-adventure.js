import { JOURNEY_COOKIE, PHASES, NOTES, cookieJourney, readJourney, journeyEvent, trialReady, campaignReady, availableVersions } from './p34-journey.js?v=20261107-journey';
import { EDITIONS, MOONS } from './p34-orbit-core.js?v=20261107-journey';

export function mountAdventure({ shell, site, motion, speak, dialogue, quiet, go, getRoom, getSketches, leave, cookie, signal }) {
  let loaded = cookieJourney(document.cookie), state = loaded.state, storageError = loaded.error;
  let stopScene = null, stopDiagram = null, sceneRequest = 0, smallTalk = 0;
  const listen = (el, type, fn, options = {}) => el.addEventListener(type, fn, { signal, ...options });
  const say = (text, options = {}) => speak(text, { note: '', ...options });
  const homeURL = 'https://sayori.org/?paper=0617';
  const blogURL = 'https://blog.sayori.org/notes/long-way/?paper=0617';
  const memorySketch = () => state.lightSketch || getSketches().at(-1)?.nodes;
  const notice = document.createElement('p'); notice.className = 'journey-notice'; notice.hidden = true; notice.setAttribute('role', 'status'); shell.append(notice);
  function error(text) { notice.textContent = text; notice.hidden = false; }
  if (storageError) error(storageError);
  function current() {
    if (!storageError) {
      const latest = cookieJourney(document.cookie);
      if (latest.error) { storageError = latest.error; error(storageError); }
      else state = latest.state;
    }
    return state;
  }
  function record(type, value) {
    state = journeyEvent(current(), type, value);
    if (!storageError) {
      const raw = JSON.stringify(state);
      try {
        if (encodeURIComponent(raw).length > 3800) throw new Error('存档空间不足');
        cookie(JOURNEY_COOKIE, raw);
        if (JSON.stringify(cookieJourney(document.cookie).state) !== raw) throw new Error('浏览器未允许保存');
      } catch (e) { storageError = `${e.message}。这次进度只留在当前页，可用「带走存档」保存。`; error(storageError); }
    }
    shell.dataset.journey = state.phase;
    return state;
  }
  function lines(texts, done) {
    const next = i => i === texts.length ? done() : dialogue(texts[i], [['听下去', () => next(i + 1)]]);
    next(0);
  }
  function freeTime() {
    if (smallTalk++ % 3 === 1) {
      dialogue('我给月亮画了拒收章。', [['盖上会怎样？', () => dialogue('纸燕会被退回来。\n所以暂时没盖。', [['明智。', quiet], ['你还是想试，对吧？', () => dialogue('先把章留着。\n万一呢。', [['那你忙。', quiet]])]])], ['我自己逛逛。', quiet], ['回原来的网页。', leave]]);
      return;
    }
    if (smallTalk % 3 === 0) {
      dialogue('刚才那束光，\n我想拿来做书签。', [['会不会太长？', () => dialogue('会。\n但可以夹住一整场雨。', [['这个理由通过。', quiet]])], ['我去拉一条。', () => site === 'home' ? go('lab') : location.assign(homeURL + '&room=lab')], ['回原来的网页。', leave]]);
      return;
    }
    dialogue('我在给雨分文件夹。', [
      ['雨也要整理？', () => dialogue('要。\n有一场特别吵，我想单独放。', [['我去看看。', () => location.assign('https://blog.sayori.org/notes/rain-folder/?paper=0617')], ['那你忙。', quiet]])],
      ['我自己逛逛。', quiet], ['送我回原来的网页。', leave],
    ]);
  }
  function offer(version) {
    dialogue(version === 'draft' ? '纸燕折好了。\n敢不敢绕远一点？' : version === 'tuned' ? '落点放宽了。\n岔路没动。' : '这次，方向也替它选好了。', [
      ['我来试试。', () => { if (site === 'blog') location.assign(homeURL + '&room=works'); else { go('works'); void fly(version, { campaign: version === 'draft' }); } }],
      ['你还在忙什么？', freeTime], ['我先逛逛。', quiet], ['回原来的网页。', leave],
    ]);
  }
  function feedback(version) {
    const draft = version === 'draft';
    const visitedDouble = state.flights.draft.detour || state.campaign.records[2] || state.campaign.checkpoint?.level === 2 && state.campaign.checkpoint.keys.includes(5);
    dialogue(draft ? (visitedDouble ? '你也去了双月亮那儿！' : state.flights.draft.misses ? '那几次擦边，我看见了。' : '怎么样，飞起来了吧？') : '这次落点宽了。\n你觉得呢？', [
      ['我喜欢自己找方向。', () => revise(version, 'free')],
      [draft ? '落点有点难判断。' : '这样更容易控制。', () => revise(version, 'clear')],
      ['还没想好。', () => revise(version, 'unsure')], ['再玩一会儿。', () => void fly(version, { campaign: version === 'draft' })],
    ]);
  }
  function oldTrial() {
    dialogue('双月亮那片，\n我还留着最早的试稿。', [
      ['试试最早那份。', () => void fly('draft')], ['我再玩一会儿航图。', () => void fly('draft', { campaign: true })], ['先放着。', quiet],
    ]);
  }
  function revise(version, value) {
    record('feedback', { version, value }); refreshWorks();
    if (version === 'draft') {
      const line = value === 'free' ? '岔路留着。\n完整航图里，我只放宽了落点。' : '对，我也遇到了。\n完整航图用的是放宽后的落点。';
      lines([line], () => offer('tuned'));
    } else lines(['这次确实能落住了。', '可我又看着那几次飞偏。\n忍不住做了一份直达版。'], () => offer('guided'));
  }
  function decide() {
    dialogue('三份都能玩。\n可我想只留一份。', [
      ['我想留下绕路。', () => choose('free')], ['我更喜欢直达。', () => choose('clear')],
      ['为什么不能都留着？', () => choose('both')], ['我还不能替你选。', () => choose('unsure')],
    ]);
  }
  function choose(value) { record('opinion', value); conflict(); }
  function conflict() {
    const first = {
      free: '我也喜欢。\n可一直飞不过去的人怎么办？',
      clear: '直达确实省心。\n可我做的只剩校正了吗？',
      both: '也可以。\n可我已经分不清自己想改哪份了。',
      unsure: '嗯，你不用替我选。\n我自己也没有答案。',
    }[state.opinion];
    lines([first, '落点修好了，又去改方向。\n现在连最早想做什么都记不清。', '我知道你在认真说。\n我现在听什么都像没做好。', '今天先关掉吧。'], () => {
      record('withdraw'); quiet(); closeScene(); go('home'); room('home');
    });
  }
  function talk() {
    current();
    if (state.phase === 'closed') { say('暂时不打开。'); return true; }
    if (state.phase === 'found') { reunion(); return true; }
    if (state.phase === 'making') { desk(); return true; }
    if (state.phase === 'after') {
      dialogue(state.leftLetter ? '你留的话还在。\n我也还在改。' : '来啦。\n我又挪了一点。', [['去工作间。', desk], ['再玩一遍。', () => { go('works'); quiet(); }], ['聊别的。', freeTime], ['回原来的网页。', leave]]); return true;
    }
    if (state.phase === 'choice') { conflict(); return true; }
    if (state.phase === 'arrive') {
      record('hello'); lines(['诶？你看得见？', '我在给一只纸燕找落脚处。\n它老是不肯直着飞。'], () => offer('draft')); return true;
    }
    const version = state.phase === 'guided' ? 'guided' : state.phase === 'tuned' ? 'tuned' : 'draft';
    if (trialReady(state, version)) version === 'guided' ? decide() : feedback(version);
    else if (version === 'draft' && campaignReady(state)) oldTrial();
    else offer(version);
    return true;
  }

  function closeScene() {
    sceneRequest++; stopScene?.(); stopScene = null; delete shell.dataset.experience;
    const sound = shell.querySelector('[data-sound]');
    sound.setAttribute('aria-pressed', String(motion.sound));
    sound.setAttribute('aria-label', motion.sound ? '关闭声音' : '开启声音');
  }
  async function fly(version, { seeking = false, workshop = false, campaign = false, previous = false } = {}) {
    current();
    if (site !== 'home') { location.assign(homeURL + '&room=works'); return; }
    if (!workshop && (!availableVersions(state).includes(version) || state.phase === 'closed' && !(seeking && state.difference && state.diagram))) return;
    quiet(); closeScene(); const request = ++sceneRequest;
    try {
      const { mountOrbit } = await import('./p34-orbit.js?v=20261107-journey');
      if (signal.aborted || request !== sceneRequest) return;
      stopScene = mountOrbit(shell, { motion, version, seeking, start: seeking ? 1 : 0, workshop: workshop ? previous ? state.keptPosition : state.position : null,
        campaign: campaign ? state.campaign : null, onCampaignSave: value => record('campaign-save', value),
        workshopRadius: state.opinion === 'clear' || state.attempts >= 2 ? 85 : 65,
        onEvent(e, report) {
          if (campaign) return;
          if (workshop) {
            if (state.phase === 'making' && (e.type === 'miss' || e.type === 'won')) record('test', e.type === 'won');
          } else if (['launch', 'land', 'miss', 'won'].includes(e.type)) record(e.type === 'won' ? 'win' : e.type, { version, node: e.node, first:report.shots === 1 });
        },
        onClose() {
          closeScene(); refreshWorks();
          if (seeking && state.phase === 'found') reunion();
          else if (workshop) desk();
          else if (state.phase !== 'closed') {
            if (trialReady(state, version) && (state.phase === 'shared' && version === 'draft' || state.phase === 'tuned' && version === 'tuned')) feedback(version);
            else if (campaign && state.phase === 'shared' && campaignReady(state)) oldTrial();
            else if (state.phase === 'guided' && version === 'guided' && trialReady(state, version)) decide();
            else say('落点还在。\n想玩就再来。');
          }
        },
      });
    } catch (e) { delete shell.dataset.experience; error(`没能打开作品：${e.message}。可以再试一次。`); console.error(e); }
  }
  function refreshWorks() {
    if (site !== 'home') return;
    const panel = shell.querySelector('.space-works'), versions = panel.querySelector('.journey-editions');
    versions.replaceChildren();
    const closed = ['closed', 'found', 'making'].includes(state.phase);
    panel.querySelectorAll('[data-campaign]').forEach(button => { button.disabled = closed; });
    for (const v of availableVersions(state)) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.flight = v; b.textContent = `双月 · ${EDITIONS[v].name}`; b.disabled = closed;
      versions.append(b);
    }
    panel.querySelector('[data-desk]').hidden = !['found', 'making', 'after'].includes(state.phase);
    const compare = shell.querySelector('[data-route-compare]'); compare.hidden = PHASES.indexOf(state.phase) < 2;
  }
  function heading(roomName) {
    if (state.phase === 'closed') return roomName === 'archive' ? '关掉的，\n没有都消失。' : roomName === 'blog' ? '她留下的字。' : '暂时不打开。';
    if (roomName === 'home') {
      if (state.phase === 'after') return '来啦。\n我还在改。';
      if (['found', 'making'].includes(state.phase)) return '我在里面。';
      if (state.phase === 'choice') return '有点乱。';
      if (state.phase === 'guided') return '又改了一份。';
      if (state.phase === 'tuned') return '落点修好了。';
      return state.phase === 'arrive' ? '诶？\n先别碰——' : '来啦。\n光还给你留着。';
    }
    return ({ works: '想往哪边飞？', lab: '拉一下。', archive: '先留着。', blog: '写在这里。', guestbook: '留点什么？' })[roomName];
  }
  function room(name, announce = true) {
    current(); shell.dataset.journey = state.phase; shell.dataset.silence = String(state.phase === 'closed');
    if (!storageError) notice.hidden = true;
    refreshWorks(); filterNotes();
    if (announce) say(heading(name));
    shell.querySelector('[data-talk]').hidden = state.phase === 'closed';
    shell.querySelector('[data-return]').hidden = state.phase !== 'closed' && shell.dataset.map !== 'true';
    const touch = shell.querySelector('[data-touch-light]');
    if (touch) touch.hidden = state.phase === 'closed';
    saves.hidden = name !== 'archive' && site !== 'blog';
    if (state.phase === 'closed' && name === 'home') {
      shell.querySelectorAll('[data-room-link]').forEach(a => { const visible = ['archive', 'blog'].includes(a.dataset.roomLink); a.dataset.visible = String(visible); a.inert = !visible; });
    }
  }

  function compare() {
    quiet(); closeScene(); shell.dataset.experience = 'trace';
    const scene = new AbortController(), sceneSignal = scene.signal;
    const root = document.createElement('section'); root.className = 'trace-scene';
    root.innerHTML = `<h2>${state.difference ? '双月亮，不见了。' : '把两份叠起来。'}</h2>
      <div class="trace-map"><svg viewBox="0 0 700 600" aria-hidden="true"><g fill="none" stroke-width="2"><path d="M100 500 300 360 160 210 330 70" stroke="#c8edff"/><g data-old><path d="M300 360 535 260 330 70" stroke="#d9bfff"/><path d="M515 242a23 23 0 1 0 0 38a29 29 0 0 1 0-38m35-12a19 19 0 1 0 0 32a24 24 0 0 1 0-32" fill="#d9bfff" stroke="none"/></g><g fill="#d6f3ff" stroke="none"><circle cx="100" cy="500" r="15"/><circle cx="300" cy="360" r="19"/><circle cx="160" cy="210" r="16"/><circle cx="330" cy="70" r="20"/></g></g></svg>
      <button data-trace-point="same" style="--tx:43%;--ty:60%" aria-label="中央的月亮"></button>
      <button data-trace-point="same" style="--tx:23%;--ty:35%" aria-label="左边的月亮"></button>
      <button data-trace-point="double" style="--tx:76%;--ty:43%" aria-label="双月的位置"></button></div>
      <label class="trace-slider"><span>落点</span><input type="range" min="0" max="100" value="0" aria-label="叠合两个版本"><span>直达</span></label>
      <div class="trace-actions"><button type="button" data-trace-back>回旧稿</button><a href="${blogURL}" data-trace-blog ${state.difference ? '' : 'hidden'}>她写过这条岔路</a><button type="button" data-retrace ${state.difference && state.diagram ? '' : 'hidden'}>重走那条岔路</button></div>
      <p role="status" class="trace-status"></p>`;
    shell.append(root);
    root.querySelector('input').addEventListener('input', e => { root.querySelector('[data-old]').style.opacity = String(1 - Number(e.target.value) / 100); }, { signal: sceneSignal });
    root.addEventListener('click', e => {
      if (e.target.closest('[data-trace-back]')) { closeScene(); room('archive'); shell.querySelector('[data-route-compare]').focus(); }
      if (e.target.closest('[data-retrace]')) void fly('tuned', { seeking: true });
      const hit = e.target.closest('[data-trace-point]');
      if (!hit) return;
      if (hit.dataset.tracePoint !== 'double') { root.querySelector('.trace-status').textContent = '这一处，两份里都有。'; return; }
      root.querySelector('h2').textContent = '双月亮，不见了。';
      root.querySelector('.trace-status').textContent = '';
      if (state.phase === 'closed') record('difference');
      root.querySelector('[data-trace-blog]').hidden = false;
      root.querySelector('[data-retrace]').hidden = !(state.phase === 'closed' && state.diagram);
      motion.tone(3);
    }, { signal: sceneSignal });
    root.querySelector('input').focus({ preventScroll: true });
    stopScene = () => { scene.abort(); root.remove(); delete shell.dataset.experience; };
  }
  function reunion() {
    closeScene(); shell.dataset.silence = 'false'; shell.querySelector('[data-talk]').hidden = false;
    lines(['……你还真绕过来了。', '删掉那条岔路的时候，\n我还挺痛快。', '总算少一个要修的地方。\n然后，连想试的东西都没了。'], () => {
      const items = [['把刚才那段路拿给她看。', () => keep('route')]];
      if (state.light === 2 && memorySketch()) items.push(['把留下的光拿给她看。', () => keep('light')]);
      items.push(['先陪她坐一会儿。', () => keep('empty')]);
      dialogue('你带了什么？', items);
    });
  }
  function keep(what) {
    record('keepsake', what);
    const text = what === 'light' ? '光还是歪的。\n你还留着。' : what === 'route' ? '原来你是这样飞过来的。' : '空着也行。\n先借我一小块地方。';
    const choice = state.opinion === 'clear' ? '你喜欢直达。\n可我还是想留一个能飞偏的地方。' : '擦边能落下来，要留下。\n那条岔路，我也想留下。';
    lines([text, choice, '你挪一个落点。\n我再试试怎么接住它。'], () => { record('make'); desk(); });
  }
  function desk() {
    if (site !== 'home') { location.assign(homeURL + '&room=works'); return; }
    quiet(); closeScene(); shell.dataset.experience = 'desk';
    const scene = new AbortController(), sceneSignal = scene.signal;
    const after = state.phase === 'after', root = document.createElement('section'); root.className = 'making-scene';
    root.innerHTML = `<h2>${after ? '还差一点。' : state.landed ? '落下来了。' : state.attempts ? '再挪一点试试。' : '这个落点，\n你挪挪看。'}</h2>
      <svg class="making-thread" viewBox="0 0 600 500" preserveAspectRatio="none" aria-hidden="true"><path d="M155 350Q185 120 420 230"/></svg>
      <span class="making-origin" aria-hidden="true">☾</span><button type="button" class="making-moon" aria-label="移动落点，拖动或方向键调整"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46"/><path d="M64 22a30 30 0 1 0 0 56a37 37 0 0 1 0-56"/></svg></button>
      <span class="making-pointer" aria-hidden="true" ${after ? '' : 'hidden'}>⌁</span>
      <div class="making-actions"><button type="button" data-test ${state.placed ? '' : 'disabled'}>${after ? '试飞新稿' : '试飞'}</button><button type="button" data-kept ${after && state.keptPosition ? '' : 'hidden'}>试试上一份</button><button type="button" data-hear ${!after && (state.landed || state.attempts >= 3) ? '' : 'hidden'}>听她说</button><button type="button" data-desk-back>回外面</button></div>`;
    shell.append(root);
    const moon = root.querySelector('.making-moon'); let position = [...state.position], drag = null;
    const update = () => {
      const x = 48 + (position[0] - 200) / 240 * 28, y = 36 + (position[1] + 340) / 220 * 22;
      moon.style.left = `${x}%`; moon.style.top = `${y}%`;
      root.querySelector('.making-pointer').style.left = `${x + 6}%`; root.querySelector('.making-pointer').style.top = `${y + 5}%`;
      root.querySelector('path').setAttribute('d', `M155 350 Q185 120 ${x * 6} ${y * 5}`);
    };
    const savePosition = () => { record('place', position); root.querySelector('[data-test]').disabled = false; };
    moon.addEventListener('pointerdown', e => { if (e.button !== 0) return; e.preventDefault(); drag = { id: e.pointerId, x: e.clientX, y: e.clientY, pos: [...position], moved: false }; moon.setPointerCapture(e.pointerId); }, { signal: sceneSignal });
    moon.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 5) drag.moved = true;
      position = [Math.max(200, Math.min(440, drag.pos[0] + dx * 240 / (root.clientWidth * .28))), Math.max(-340, Math.min(-120, drag.pos[1] + dy * 220 / (root.clientHeight * .22)))]; update();
    }, { signal: sceneSignal });
    const end = e => { if (!drag || e.pointerId !== drag.id) return; const changed = drag.moved; drag = null; if (changed) savePosition(); };
    moon.addEventListener('pointerup', end, { signal: sceneSignal }); moon.addEventListener('pointercancel', end, { signal: sceneSignal });
    moon.addEventListener('keydown', e => {
      const delta = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] }[e.key];
      if (!delta) return; e.preventDefault(); position = [Math.max(200, Math.min(440, position[0] + delta[0])), Math.max(-340, Math.min(-120, position[1] + delta[1]))]; update(); savePosition();
    }, { signal: sceneSignal });
    root.addEventListener('click', e => {
      if (e.target.closest('[data-test]')) void fly('tuned', { workshop: true });
      if (e.target.closest('[data-kept]')) void fly('tuned', { workshop: true, previous: true });
      if (e.target.closest('[data-desk-back]')) { closeScene(); room(getRoom()); }
      if (e.target.closest('[data-hear]')) {
        closeScene();
        lines([state.landed ? '这个弯，能用。\n但我还是觉得有点别扭。' : '三次都没飞好。\n可我还想把那个落点挪一下。', '先不删了。\n另存一份。'], () => {
          record('continue'); refreshWorks();
          lines(['……还差一点。\n我再试一次。'], desk);
        });
      }
    }, { signal: sceneSignal });
    if (state.keepsake === 'light' && memorySketch()) {
      const nodes = memorySketch();
      const drawing = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); drawing.setAttribute('viewBox', '0 0 100 100'); drawing.classList.add('making-keepsake');
      const line = document.createElementNS(drawing.namespaceURI, 'polyline'); line.setAttribute('points', nodes.map(p => `${p[0] * 100},${p[1] * 100}`).join(' ')); drawing.append(line); root.append(drawing);
    }
    if (state.keepsake === 'route') {
      const drawing=document.createElementNS('http://www.w3.org/2000/svg','svg');drawing.setAttribute('viewBox','0 -1100 1000 1200');drawing.classList.add('making-keepsake');
      const line=document.createElementNS(drawing.namespaceURI,'polyline');line.setAttribute('points',state.flights.tuned.path.map(n=>`${MOONS[n].x},${MOONS[n].y}`).join(' '));line.style.strokeWidth='7';drawing.append(line);root.append(drawing);
    }
    update(); moon.focus({ preventScroll: true });
    if (after && !motion.reduced()) {
      void motion.animate(moon, [{ translate: '-14px 8px' }, { translate: '0 0' }], { duration: 1600, delay: 500 });
      void motion.animate(root.querySelector('.making-pointer'), [{ opacity: 0, translate: '-50px 35px' }, { opacity: 1, translate: '0 0' }], { duration: 1100 });
    }
    stopScene = () => { scene.abort(); root.remove(); delete shell.dataset.experience; };
  }

  function canRead(slug) {
    current();
    if (slug === 'landing-notes') return PHASES.indexOf(state.phase) >= 3;
    if (slug === 'tomorrow-again') return state.phase === 'after';
    return true;
  }
  function filterNotes() {
    if (site !== 'blog') return;
    shell.querySelectorAll('[data-post]').forEach(a => { a.parentElement.hidden = !canRead(a.dataset.post); });
  }
  function opened(slug) {
    stopDiagram?.(); stopDiagram = null;
    if (NOTES.includes(slug)) record('opened', slug);
    const diagram = shell.querySelector('[data-route-diagram]');
    if (diagram) {
      const button=diagram.querySelector('button'), svg=diagram.querySelector('svg'), path=svg.querySelector('[data-route-ink]'), length=path.getTotalLength();
      let progress=state.diagram?1:0, pointer=null;
      const update=()=>{
        const point=path.getPointAtLength(length*progress);
        button.style.left=`${point.x/660*100}%`;button.style.top=`${point.y/370*svg.getBoundingClientRect().height}px`;
        button.setAttribute('aria-valuenow',String(Math.round(progress*100)));
        diagram.querySelector('a').hidden=progress<1;
        if(progress===1&&!state.diagram){record('diagram');motion.tone(3);button.setAttribute('aria-label','已描到纸外；路线留在旧稿');}
      };
      button.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();pointer=e.pointerId;button.setPointerCapture(pointer);};
      button.onpointermove=e=>{
        if(pointer!==e.pointerId)return;
        const r=svg.getBoundingClientRect(), x=(e.clientX-r.left)/r.width*660, y=(e.clientY-r.top)/r.height*370;
        let best=progress, distance=Infinity;
        for(let i=0;i<=50;i++){const p=path.getPointAtLength(length*i/50),d=Math.hypot(x-p.x,y-p.y);if(d<distance){distance=d;best=i/50;}}
        if(distance<65&&Math.abs(best-progress)<.25){progress=best>.96?1:best;update();}
      };
      button.onpointerup=button.onpointercancel=()=>{pointer=null;};
      button.onkeydown=e=>{if(!['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();progress=Math.max(0,Math.min(1,progress+(['ArrowRight','ArrowUp'].includes(e.key)?.1:-.1)));if(progress>.96)progress=1;update();};
      const resize = new ResizeObserver(update); resize.observe(svg);
      stopDiagram = () => resize.disconnect();
      update();
    }
  }
  if (site === 'home') {
    const panel = shell.querySelector('.space-works');
    panel.querySelector('.space-work-caption').innerHTML = '<h2>绕远路</h2><button type="button" class="journey-play" data-campaign>继续航行</button><div class="journey-editions" aria-label="双月亮的修订对照"></div><button type="button" data-desk hidden>工作间</button>';
    const enter = panel.querySelector('.space-work-light'); enter.removeAttribute('data-go'); enter.dataset.campaign = ''; enter.setAttribute('aria-label', '玩绕远路，十八片航图');
    enter.innerHTML = '<svg class="journey-work-mark" viewBox="0 0 500 360" aria-hidden="true"><g fill="none" stroke="#d6f3ff"><ellipse cx="265" cy="195" rx="109" ry="109" stroke-opacity=".45"/><path d="M175 247Q76 317 25 169" stroke-opacity=".4"/></g><path d="M290 130a70 70 0 1 0 0 130a85 85 0 0 1 0-130" fill="#d6f3ff"/><path d="m168 239-38-7 15 16-4 16Z" fill="#fff5e1"/></svg>';
    const compareButton = document.createElement('button'); compareButton.className = 'journey-archive-launch'; compareButton.type = 'button'; compareButton.dataset.routeCompare = ''; compareButton.textContent = '两份路线'; shell.querySelector('.space-archive').append(compareButton);
    const form = shell.querySelector('.space-guest-form'), submit = form.querySelector('button'); submit.disabled = false; submit.textContent = '留在这里';
    const message = form.querySelector('textarea'), name = form.querySelector('input');
    const note = document.createElement('p'); note.className = 'journey-letter-status'; note.setAttribute('role', 'status'); note.textContent = '只留在这台设备'; form.append(note);
    try { const saved = localStorage.getItem('p34-local-letter'); if (saved) { const item = JSON.parse(saved); if (typeof item.name !== 'string' || typeof item.text !== 'string' || item.name.length > 40 || item.text.length > 1000) throw new Error('旧留言格式有误'); name.value = item.name; message.value = item.text; } } catch (e) { note.textContent = e.message; }
    listen(form, 'submit', e => {
      e.preventDefault(); if (!message.value.trim()) { note.textContent = '先写一点。'; message.focus(); return; }
      try { localStorage.setItem('p34-local-letter', JSON.stringify({ name: name.value.slice(0, 40), text: message.value.slice(0, 1000) })); record('letter'); note.textContent = '留好了'; if (state.phase !== 'closed') say('好。\n就放在这儿。'); } catch { note.textContent = '没能保存，文字还在。可以先复制下来。'; }
    });
  }
  const saves = document.createElement('div'); saves.className = 'journey-save-actions';
  saves.innerHTML = '<button type="button" data-export>带走存档</button><button type="button" data-import>读入存档</button><input type="file" accept="application/json,.json" hidden>';
  shell.append(saves);
  listen(saves.querySelector('[data-export]'), 'click', () => {
    if (current().light === 2 && !state.lightSketch && memorySketch()) record('light-saved', memorySketch());
    const url = URL.createObjectURL(new Blob([JSON.stringify(current(), null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'project-34-journey.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  listen(saves.querySelector('[data-import]'), 'click', () => saves.querySelector('input').click());
  listen(saves.querySelector('input'), 'change', async e => {
    const file = e.target.files[0]; if (!file) return;
    e.target.value = '';
    if (file.size > 8000) { error('文件过大，未更改当前存档。'); return; }
    const parsed = readJourney(await file.text()); if (parsed.error) { error(parsed.error); return; }
    if (!confirm('读入会替换这段旅程。原有光稿不变。继续？')) return;
    closeScene(); quiet();
    cookie(JOURNEY_COOKIE, JSON.stringify(parsed.state));
    if (JSON.stringify(cookieJourney(document.cookie).state) !== JSON.stringify(parsed.state)) { error('浏览器未允许读入存档。'); return; }
    state = parsed.state; storageError = ''; notice.hidden = true; room(getRoom());
  });
  listen(shell, 'click', e => {
    const target = e.target.closest('button'); if (!target || target.disabled) return;
    if (target.matches('[data-flight]')) void fly(target.dataset.flight);
    if (target.matches('[data-campaign]')) void fly('draft', { campaign: true });
    if (target.matches('[data-route-compare]')) compare();
    if (target.matches('[data-desk]')) state.phase === 'found' ? reunion() : desk();
  });
  listen(window, 'focus', () => { current(); if (!stopScene) room(getRoom(), false); });
  signal.addEventListener('abort', () => { closeScene(); stopDiagram?.(); }, { once: true });
  return { talk, room, closeScene, heading, opened, canRead, record };
}
