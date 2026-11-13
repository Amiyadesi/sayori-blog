import { LINES, CHOICES } from './p34-script.js?v=20261113-3d';
import { mountGuestbook } from './p34-guestbook.js?v=20261113-3d';
import {
  JOURNEY_COOKIE,
  LAYERS,
  LAYER_LABELS,
  NOTES,
  CLUES,
  CLUE_INFO,
  PILLAR_OPTIONS,
  TARGET_PILLARS,
  cookieJourney,
  readJourney,
  journeyEvent,
  blueprintSketch,
  identityClueCount,
} from './p34-journey.js?v=20261113-3d';
import { mountWorld3D } from './p34-world3d.js?v=20261113-3d';

export function reboundSketch(offset) {
  const sketch = blueprintSketch(offset);
  return {
    ...sketch,
    path: sketch.rayPath,
    paddleX: Math.round(sketch.foldX - 64),
    paddleWidth: 128,
    exit: sketch.aligned,
  };
}

export function layerFromURL(href, fallback = 'atrium') {
  try {
    const url = new URL(href, 'https://sayori.org/');
    const l = url.searchParams.get('layer');
    return LAYERS.includes(l) ? l : fallback;
  } catch {
    return fallback;
  }
}

export function mountAdventure({
  shell,
  site,
  motion,
  speak,
  dialogue,
  quiet,
  go,
  getRoom,
  getSketches,
  getLightNodes,
  leave,
  cookie,
  signal,
}) {
  const loaded = cookieJourney(document.cookie);
  let state = loaded.state;
  let storageError = loaded.error;
  let world3d = null;
  let worldMounting = false;
  let stopDiagram = null;
  let smallTalk = 0;
  let guestbook = null;

  const listen = (el, type, fn, options = {}) => el.addEventListener(type, fn, { signal, ...options });
  const say = (text, options = {}) => speak(text, { note: '', ...options });
  const homeURL = 'https://sayori.org/?paper=0617';
  const blogURL = 'https://blog.sayori.org/notes/long-way/?paper=0617';
  const memorySketch = () => state.lightSketch || getSketches().at(-1)?.nodes || null;

  const notice = document.createElement('p');
  notice.className = 'journey-notice';
  notice.hidden = true;
  notice.setAttribute('role', 'status');
  shell.append(notice);

  function error(text) {
    notice.textContent = text;
    notice.hidden = false;
  }
  if (storageError) error(storageError);

  function atmosphere() {
    shell.dataset.journey = state.phase;
    shell.dataset.layer = state.currentLayer || 'atrium';
    shell.dataset.silence = 'false';
    shell.dataset.reunion = 'false';
  }

  function current() {
    if (!storageError) {
      const latest = cookieJourney(document.cookie);
      if (latest.error) {
        storageError = latest.error;
        error(storageError);
      } else {
        state = latest.state;
      }
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
        if (JSON.stringify(cookieJourney(document.cookie).state) !== raw) {
          throw new Error('浏览器未允许保存');
        }
      } catch (e) {
        storageError = `${e.message}，当前进度可用「带走存档」保存`;
        error(storageError);
      }
    }
    atmosphere();
    renderAtlas();
    renderClueArchive();
    return state;
  }

  function lines(texts, done) {
    const next = i => (i === texts.length ? done?.() : dialogue(texts[i], [[CHOICES.next, () => next(i + 1)]]));
    next(0);
  }

  function freeTime() {
    const n = smallTalk++ % 3;
    if (n === 0) {
      dialogue(LINES.chat.sound, [
        [
          CHOICES.noisy,
          () =>
            dialogue(LINES.chat.door, [
              [
                CHOICES.now,
                () =>
                  dialogue(LINES.chat.trySound, [
                    [CHOICES.explore3d, () => { quiet(); go('home'); }],
                    [CHOICES.wander, quiet],
                  ]),
              ],
              [CHOICES.keepBusy, quiet],
            ]),
        ],
        [CHOICES.explore, quiet],
        [CHOICES.leave, leave],
      ]);
    } else if (n === 1) {
      dialogue(LINES.chat.water, [
        [
          CHOICES.thatCurve,
          () =>
            dialogue(LINES.chat.curve, [
              [CHOICES.pullLight, () => (site === 'home' ? go('lab') : location.assign(homeURL + '&room=lab'))],
              [CHOICES.leaveLight, quiet],
            ]),
        ],
        [CHOICES.youWork, quiet],
      ]);
    } else {
      dialogue(LINES.chat.rain, [
        [
          CHOICES.keepRain,
          () =>
            dialogue(LINES.chat.car, [
              [CHOICES.read, () => location.assign('https://blog.sayori.org/notes/rain-folder/?paper=0617')],
              [CHOICES.wander, quiet],
            ]),
        ],
        [CHOICES.quiet, quiet],
      ]);
    }
  }

  function talkInAtrium() {
    const canStacks = state.westAligned || state.bridgeSolid || state.layers.includes('stacks');
    const text = canStacks ? LINES.atrium.readyForStacks : LINES.atrium.explore;
    const items = [];
    if (canStacks) {
      items.push([CHOICES.goStacks, () => { quiet(); enterLayer('stacks'); }]);
    }
    items.push([CHOICES.openLab, () => { quiet(); go('lab'); }]);
    items.push([CHOICES.busy, freeTime]);
    items.push([CHOICES.wander, quiet]);
    dialogue(text, items);
  }

  function talkInStacks() {
    const text = state.stacksUnlocked
      ? LINES.stacks.unlocked
      : state.diagram
        ? LINES.stacks.diagramReady
        : LINES.stacks.locked;
    const items = [];
    if (state.stacksUnlocked) {
      items.push([CHOICES.goLoft, () => { quiet(); enterLayer('loft'); }]);
    } else if (state.diagram) {
      items.push([
        CHOICES.syncPillars,
        () => {
          record('sync-pillars');
          world3d?.refresh();
          say(LINES.spatial.stacksUnlocked, { mood: 'bright' });
          quiet();
        },
      ]);
    }
    items.push([CHOICES.openBlog, () => location.assign(blogURL)]);
    items.push([CHOICES.goAtrium, () => { quiet(); enterLayer('atrium'); }]);
    items.push([CHOICES.wander, quiet]);
    dialogue(text, items);
  }

  function talkInLoft() {
    const foundCount = identityClueCount(state);
    if (foundCount >= 2) {
      dialogue(LINES.loft.askIdentity, [
        [
          CHOICES.askWho,
          () =>
            lines(LINES.loft.answerWho, () => {
              if (state.phase !== 'after') record('complete-loft');
              quiet();
              say(LINES.after.visit, { mood: 'bright' });
            }),
        ],
        [
          CHOICES.askAuthor,
          () =>
            lines(LINES.loft.answerAuthor, () => {
              if (state.phase !== 'after') record('complete-loft');
              quiet();
              say(LINES.after.visit, { mood: 'thought' });
            }),
        ],
        [CHOICES.openArchive, () => { quiet(); go('archive'); }],
        [CHOICES.wander, quiet],
      ]);
      return;
    }
    dialogue(LINES.loft.welcome, [
      [CHOICES.openArchive, () => { quiet(); go('archive'); }],
      [CHOICES.busy, freeTime],
      [CHOICES.wander, quiet],
    ]);
  }

  function talk() {
    current();
    if (state.phase === 'arrive') {
      record('hello');
      lines(LINES.arrival, () => talkInAtrium());
      return true;
    }
    if (state.phase === 'after' && state.currentLayer !== 'loft') {
      dialogue(state.leftLetter ? LINES.after.letter : LINES.after.visit, [
        [CHOICES.goLoft, () => { quiet(); enterLayer('loft'); }],
        [CHOICES.openMap, () => { quiet(); go('works'); }],
        [CHOICES.chat, freeTime],
        [CHOICES.leave, leave],
      ]);
      return true;
    }
    if (state.currentLayer === 'loft') {
      talkInLoft();
      return true;
    }
    if (state.currentLayer === 'stacks') {
      talkInStacks();
      return true;
    }
    talkInAtrium();
    return true;
  }

  function enterLayer(layerId, { push = true } = {}) {
    current();
    if (site !== 'home') {
      location.assign(`${homeURL}&layer=${layerId}`);
      return false;
    }
    try {
      record('enter-layer', layerId);
    } catch (e) {
      say(e.message, { mood: 'thought' });
      return false;
    }
    if (push) {
      const url = new URL(location.href);
      url.searchParams.set('paper', '0617');
      url.searchParams.delete('room');
      if (layerId === 'atrium') url.searchParams.delete('layer');
      else url.searchParams.set('layer', layerId);
      history.pushState({ ...history.state, p34Space: true, p34Room: 'home', p34Layer: layerId }, '', url.pathname + url.search);
    }
    if (getRoom() !== 'home') {
      go('home');
    } else {
      world3d?.refresh();
    }
    if (layerId === 'atrium') say(LINES.spatial.atriumEnter);
    else if (layerId === 'stacks') say(LINES.spatial.stacksEnter, { mood: 'thought' });
    else if (layerId === 'loft') say(LINES.spatial.loftEnter, { mood: 'bright' });
    return true;
  }

  async function ensureWorld3D() {
    if (site !== 'home' || world3d || worldMounting) return;
    const homePanel = shell.querySelector('.space-home');
    if (!homePanel) return;
    let host = homePanel.querySelector('[data-world3d-host]');
    if (!host) {
      host = document.createElement('div');
      host.className = 'world3d-host';
      host.dataset.world3dHost = '';
      homePanel.prepend(host);
    }
    worldMounting = true;
    try {
      world3d = await mountWorld3D(host, {
        getState: () => current(),
        getLightNodes: () => getLightNodes?.() || state.lightSketch,
        motion,
        signal,
        onLoopWalked() {
          record('loop-walked');
          say(state.loopCount <= 1 ? LINES.spatial.loopFirst : LINES.spatial.loopRepeat, { mood: 'thought' });
        },
        onSightlineAligned() {
          if (!state.westAligned) {
            record('align-west');
            motion?.tone?.(4, true);
            say(LINES.spatial.westAligned, { mood: 'bright' });
          }
        },
        onShelfMoved() {
          if (!state.shelfMoved) {
            record('shelf-moved');
            say(LINES.spatial.shelfMoved, { mood: 'bright' });
          }
        },
        onLayerChange(nextLayer, { push = true } = {}) {
          enterLayer(nextLayer, { push });
        },
        onOpenRoom(roomName) {
          if (roomName === 'blog') {
            location.assign(blogURL);
          } else {
            go(roomName);
          }
        },
        onLeaveSite() {
          leave();
        },
        onInteract(kind, payload) {
          if (kind === 'lab-link') {
            say(state.bridgeSolid ? LINES.spatial.bridgeSolid : LINES.spatial.bridgeHint);
          } else if (kind === 'glb-lamp') {
            record('touch');
            say(LINES.spatial.lampTouched, { mood: 'bright' });
          } else if (kind === 'glb-fork') {
            record('touch');
            say(LINES.spatial.forkTouched);
          } else if (kind === 'terminal') {
            say(LINES.spatial.terminalOpen);
          } else if (kind === 'portal-locked-stacks') {
            say(LINES.spatial.loopRepeat, { mood: 'thought' });
          } else if (kind === 'portal-locked-loft') {
            say(LINES.spatial.pillarTurned, { mood: 'thought' });
          } else if (kind === 'blog-blueprint') {
            if (!state.opened.includes('long-way')) record('opened', 'long-way');
            if (!state.diagram) record('diagram');
            say(LINES.spatial.blogSynced, { mood: 'bright' });
          } else if (kind === 'sync-pillars') {
            record('sync-pillars');
            say(LINES.spatial.stacksUnlocked, { mood: 'bright' });
          } else if (kind === 'projector-hint') {
            say(LINES.spatial.pillarTurned);
          } else if (kind === 'rotate-pillar') {
            const wasUnlocked = state.stacksUnlocked;
            record('rotate-pillar', payload);
            if (!wasUnlocked && state.stacksUnlocked) {
              motion?.tone?.(5, true);
              say(LINES.spatial.stacksUnlocked, { mood: 'bright' });
            } else {
              say(LINES.spatial.pillarTurned);
            }
          } else if (kind === 'clue') {
            const clueId = payload;
            record('clue', clueId);
            if (clueId === 'atrium-survey') say(LINES.spatial.surveyFound, { mood: 'bright' });
            else if (clueId === 'retired-relic') say(LINES.spatial.relicFound);
            else if (clueId === 'slot-34-log') say(LINES.spatial.clueSlot34, { mood: 'thought' });
            else if (clueId === 'dual-handwriting') say(LINES.spatial.clueHandwriting, { mood: 'bright' });
            else if (clueId === 'rain-origin-trace') say(LINES.spatial.clueRainOrigin, { mood: 'thought' });
          } else if (kind === 'talk-bench') {
            talkInLoft();
          }
        },
      });
    } catch (e) {
      console.error('3D world failed to initialize', e);
      error(`三维空间初始化受限：${e.message}`);
    } finally {
      worldMounting = false;
    }
  }

  function closeScene() {
    // Keep 3D world alive when switching panels, or refresh it when returning
  }

  function heading(name) {
    if (name === 'home') {
      if (state.phase === 'after') return LINES.home.after;
      if (state.currentLayer === 'loft') return LINES.home.loft;
      if (state.currentLayer === 'stacks') return LINES.home.stacks;
      return state.phase === 'arrive' ? LINES.home.arrive : LINES.home.shared;
    }
    return LINES.rooms[name] || LINES.home.shared;
  }

  function renderAtlas() {
    if (site !== 'home') return;
    const panel = shell.querySelector('.space-works');
    if (!panel) return;
    let atlas = panel.querySelector('[data-layer-atlas]');
    if (!atlas) {
      panel.replaceChildren();
      atlas = document.createElement('div');
      atlas.className = 'layer-atlas';
      atlas.dataset.layerAtlas = '';
      panel.append(atlas);
    }
    const canStacks = state.westAligned || state.bridgeSolid || state.layers.includes('stacks');
    const canLoft = state.stacksUnlocked || state.layers.includes('loft');
    const p = state.pillars;

    atlas.innerHTML = `
      <header class="layer-atlas-header">
        <h2>页背层级航标 · 3D 空间拓扑</h2>
        <p>从网页正面掀起纸角后，你可以在以下三层立体空间与 2D 页面之间自由穿行。</p>
      </header>
      <div class="layer-atlas-cards">
        <article class="layer-card" data-layer-card="atrium" data-unlocked="true">
          <span class="layer-card-badge">LAYER 01</span>
          <h3>${LAYER_LABELS.atrium}</h3>
          <p>网页视口背面的第一层建筑。包含西侧错位回廊与取景框、中庭动态光带、东侧 GLB 模型展台与后台终端。</p>
          <ul class="layer-card-status">
            <li>西廊视线阶梯：<strong>${state.westAligned ? '✓ 已对齐展开' : '未校准（可在西廊蓝圈内对齐）'}</strong></li>
            <li>2D ⇄ 3D 实验室光桥：<strong>${state.bridgeSolid ? '✓ 已凝实成桥' : '垂落半空（可在 2D 实验室拱起保存）'}</strong></li>
          </ul>
          <div class="layer-card-actions">
            <button type="button" data-enter-layer="atrium">进入第一层 · 页背回廊</button>
            <button type="button" data-goto-room="lab">去 2D 实验室拉光</button>
          </div>
        </article>

        <article class="layer-card" data-layer-card="stacks" data-unlocked="${canStacks}">
          <span class="layer-card-badge">LAYER 02</span>
          <h3>${LAYER_LABELS.stacks}</h3>
          <p>沉没在站点索引之外的巨型垂直书库。结合她在 2D 博客《走廊拐弯的时候》留下的草图，校准三座空间基准柱。</p>
          <ul class="layer-card-status">
            <li>2D 博客草图信号：<strong>${state.diagram ? '✓ 已拉直折线并接通投影仪' : '待校准'}</strong></li>
            <li>三座空间基准柱：<strong>[${p.west} / ${p.center} / ${p.east}] ${state.stacksUnlocked ? '✓ 北门已开启' : ''}</strong></li>
          </ul>
          <div class="layer-card-actions">
            <button type="button" data-enter-layer="stacks" ${canStacks ? '' : 'disabled'}>
              ${canStacks ? '进入第二层 · 索引外书库' : '需先展开第一层阶梯或光桥'}
            </button>
            <a class="layer-card-link" href="${blogURL}">前往 2D 博客草图</a>
          </div>
        </article>

        <article class="layer-card" data-layer-card="loft" data-unlocked="${canLoft}">
          <span class="layer-card-badge">LAYER 03</span>
          <h3>${LAYER_LABELS.loft}</h3>
          <p>悬在夜雨声中的温暖阁楼与第 34 号残档。调查三处关于她真实身份的异常证据，与她面对面交谈。</p>
          <ul class="layer-card-status">
            <li>阁楼身份证据：<strong>已发现 ${identityClueCount(state)} / 3 处</strong></li>
            <li>主线状态：<strong>${state.phase === 'after' ? '✓ 已完成首章重逢，全层级自由开放' : '调查进行中'}</strong></li>
          </ul>
          <div class="layer-card-actions">
            <button type="button" data-enter-layer="loft" ${canLoft ? '' : 'disabled'}>
              ${canLoft ? '进入第三层 · 她的阁楼' : '需先解开第二层书库北门'}
            </button>
            <button type="button" data-goto-room="archive">查看线索档案 (${state.clues.length}/5)</button>
          </div>
        </article>
      </div>
    `;
  }

  function renderClueArchive() {
    if (site !== 'home') return;
    const panel = shell.querySelector('.space-archive');
    if (!panel) return;
    let board = panel.querySelector('[data-clue-dossier]');
    if (!board) {
      board = document.createElement('section');
      board.className = 'clue-dossier';
      board.dataset.clueDossier = '';
      panel.prepend(board);
    }
    const items = CLUES.map(id => {
      const found = state.clues.includes(id);
      const info = CLUE_INFO[id];
      return `
        <li class="clue-item" data-clue-id="${id}" data-found="${found}">
          <div class="clue-item-head">
            <strong>${found ? info.title : '未发现的空间档案'}</strong>
            <span>${LAYER_LABELS[info.layer]}</span>
          </div>
          <p>${found ? info.summary : '在对应的 3D 层级中探索并靠近调查点即可记录此证据。'}</p>
        </li>
      `;
    }).join('');

    board.innerHTML = `
      <header class="clue-dossier-head">
        <h2>身份调查档案 · 「她究竟是谁？」 (${state.clues.length} / ${CLUES.length})</h2>
        <p>记录你在页背回廊、索引外书库与她的阁楼中发现的异常证据。</p>
      </header>
      <ul class="clue-list">${items}</ul>
    `;
  }

  function room(name, announce = true) {
    current();
    const urlLayer = layerFromURL(location.href, null);
    if (site === 'home' && name === 'home' && urlLayer && urlLayer !== state.currentLayer) {
      try {
        record('enter-layer', urlLayer);
      } catch {
        // Keep current unlocked layer if URL points to a locked layer
      }
    }
    atmosphere();
    if (name === 'guestbook') void guestbook?.open();
    if (!storageError) notice.hidden = true;
    renderAtlas();
    renderClueArchive();
    filterNotes();
    if (announce) say(heading(name));
    shell.querySelector('[data-talk]').hidden = false;
    shell.querySelector('[data-return]').hidden = site !== 'blog' && shell.dataset.map !== 'true';
    saves.hidden = name !== 'archive' && site !== 'blog';

    if (site === 'home' && name === 'home') {
      void ensureWorld3D().then(() => world3d?.refresh());
    }
  }

  function canRead(slug) {
    current();
    if (slug === 'landing-notes') {
      return state.layers.includes('stacks') || state.westAligned || state.bridgeSolid || state.phase === 'after';
    }
    if (slug === 'tomorrow-again') {
      return state.layers.includes('loft') || state.phase === 'after';
    }
    return true;
  }

  function filterNotes() {
    if (site === 'blog') {
      shell.querySelectorAll('[data-post]').forEach(a => {
        a.parentElement.hidden = !canRead(a.dataset.post);
      });
    }
  }

  function opened(slug) {
    stopDiagram?.();
    stopDiagram = null;
    if (NOTES.includes(slug)) record('opened', slug);
    const diagram = shell.querySelector('[data-return-diagram]');
    if (!diagram) return;

    const input = diagram.querySelector('input');
    const ink = diagram.querySelector('[data-return-ink]');
    const pad = diagram.querySelector('[data-return-pad]');
    const link = diagram.querySelector('a');
    const edge = diagram.querySelector('[data-edge]');
    let noteBox = diagram.querySelector('[data-blueprint-note]');
    if (!noteBox) {
      noteBox = document.createElement('div');
      noteBox.className = 'blueprint-calibration-note';
      noteBox.dataset.blueprintNote = '';
      diagram.append(noteBox);
    }

    const update = () => {
      const trace = reboundSketch(Number(input.value) / 100);
      if (ink) ink.setAttribute('d', trace.path);
      if (pad) {
        pad.setAttribute('x', String(trace.paddleX));
        pad.setAttribute('width', String(trace.paddleWidth));
      }
      if (trace.exit) {
        if (!state.diagram) record('diagram');
        if (link) {
          link.hidden = false;
          link.href = 'https://sayori.org/?paper=0617&layer=stacks';
          link.textContent = '潜回 3D 索引外书库（折页基准已接通）';
        }
        if (edge) edge.style.opacity = '1';
        noteBox.innerHTML = `
          <strong>✓ 折页基准线已对齐（信号已同步至 3D 书库投影仪）：</strong>
          <ul>
            <li>西基准柱（视口折向）：<strong>朝向正门页缝（北）</strong></li>
            <li>中基准柱（楼层标高）：<strong>二层天桥 +3.2m</strong></li>
            <li>东基准柱（留存声轨）：<strong>雨夜倒车的窗沿</strong></li>
          </ul>
        `;
      } else {
        noteBox.innerHTML = '<span>向右拖动滑块，将 2D 折页基准线拉直以显影 3D 书库的三柱相位。</span>';
      }
    };

    const control = new AbortController();
    input?.addEventListener('input', update, { signal: control.signal });
    stopDiagram = () => control.abort();
    if (state.diagram && input) input.value = '85';
    update();
  }

  if (site === 'home') {
    guestbook = mountGuestbook(shell.querySelector('.space-guestbook'), {
      signal,
      onSent() {
        record('letter');
        if (getRoom() === 'guestbook') say(LINES.letterSaved);
      },
    });

    listen(shell, 'click', e => {
      const enterBtn = e.target.closest('[data-enter-layer]');
      if (enterBtn && !enterBtn.disabled) {
        enterLayer(enterBtn.dataset.enterLayer);
        return;
      }
      const roomBtn = e.target.closest('[data-goto-room]');
      if (roomBtn) {
        go(roomBtn.dataset.gotoRoom);
      }
    });
  }

  const saves = document.createElement('div');
  saves.className = 'journey-save-actions';
  saves.innerHTML =
    '<button type="button" data-export>带走存档</button><button type="button" data-import>读入存档</button><input type="file" accept="application/json,.json" hidden>';
  shell.append(saves);

  listen(saves.querySelector('[data-export]'), 'click', () => {
    if (current().light === 2 && !state.lightSketch && memorySketch()) record('light-saved', memorySketch());
    const url = URL.createObjectURL(new Blob([JSON.stringify(current(), null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project-34-journey.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  listen(saves.querySelector('[data-import]'), 'click', () => saves.querySelector('input').click());
  listen(saves.querySelector('input'), 'change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > 8000) {
      error('文件过大，未更改当前存档');
      return;
    }
    let parsed;
    try {
      parsed = readJourney(await file.text());
    } catch {
      error('没能读取文件，当前存档未更改');
      return;
    }
    if (parsed.error) {
      error(parsed.error);
      return;
    }
    if (!confirm('读入会替换这段旅程，原有光稿不变，继续？')) return;
    quiet();
    cookie(JOURNEY_COOKIE, JSON.stringify(parsed.state));
    if (JSON.stringify(cookieJourney(document.cookie).state) !== JSON.stringify(parsed.state)) {
      error('浏览器未允许读入存档');
      return;
    }
    state = parsed.state;
    storageError = '';
    notice.hidden = true;
    world3d?.refresh();
    room(getRoom());
  });

  listen(window, 'focus', () => {
    current();
    world3d?.refresh();
    room(getRoom(), false);
  });

  signal.addEventListener(
    'abort',
    () => {
      world3d?.dispose();
      stopDiagram?.();
    },
    { once: true }
  );

  return {
    talk,
    room,
    closeScene,
    heading,
    opened,
    canRead,
    record: (type, value) => {
      const next = record(type, value);
      world3d?.refresh();
      return next;
    },
    getWorld3D: () => world3d,
  };
}
