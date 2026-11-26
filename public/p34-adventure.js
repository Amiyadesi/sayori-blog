import { LINES, CHOICES } from './p34-script.js?v=20261126-playable';
import { mountGuestbook } from './p34-guestbook.js?v=20261126-playable';
import {
  JOURNEY_COOKIE,
  LAYERS,
  LAYER_LABELS,
  NOTES,
  CLUE_INFO,
  TRACES, RESPONSES, canEnterLayer, isSilenced, startingSculpture,
  cookieJourney,
  readJourney,
  journeyEvent,
  blueprintSketch,
  identityClueCount,
} from './p34-journey.js?v=20261126-playable';
import { mountWorld3D } from './p34-world3d.js?v=20261126-playable';
import { isPoolEntry } from './p34-garden.js?v=20261126-playable';

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
  posts,
  openPost,
  motion,
  speak,
  dialogue,
  quiet,
  go,
  getRoom,
  getSketches,
  getLightNodes,
  mountFoldDesk,
  leave,
  cookie,
  signal,
}) {
  const loaded = cookieJourney(document.cookie);
  let state = loaded.state;
  const resumeLayer = isPoolEntry(location.href) ? 'atrium' : state.currentLayer;
  let viewLayer = layerFromURL(location.href, resumeLayer);
  if (!canEnterLayer(state, viewLayer)) viewLayer = state.currentLayer;
  const visited = new Set(state.layers);
  if (site === 'home') visited.add(viewLayer);
  let shelfMoved = state.shelfMoved;
  let storageError = loaded.error;
  let world3d = null;
  let worldMounting = null;
  let stopDiagram = null;
  let smallTalk = 0;
  let guestbook = null;

  const listen = (el, type, fn, options = {}) => el.addEventListener(type, fn, { signal, ...options });
  const say = (text, options = {}) => speak(text, { note: '', ...options });
  const homeURL = 'https://sayori.org/?paper=0617';
  const blogURL = 'https://blog.sayori.org/?paper=0617&from=stacks';
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
    shell.dataset.layer = site === 'blog' ? 'library' : viewLayer;
    shell.dataset.silence = String(isSilenced(state, shell.dataset.layer));
    shell.dataset.reunion = String(state.phase === 'after');
    const silent = shell.dataset.silence === 'true';
    shell.querySelectorAll('.space-lab :is(button,input), .space-guestbook form').forEach(el => { el.inert = silent; });
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
    state = { ...state, layers: [...new Set([...state.layers, ...visited])], currentLayer: viewLayer, shelfMoved: state.shelfMoved || shelfMoved };
    return state;
  }

  function record(type, value) {
    const snapshot = current();
    // Walking changes only this tab. Commit its chapter and location with the next intentional action.
    const atLayer = site === 'home' && viewLayer !== 'loft' ? journeyEvent(snapshot, 'enter-layer', viewLayer) : snapshot;
    state = journeyEvent(atLayer, type, value);
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
              [CHOICES.pullLight, () => (site === 'home' && getRoom() === 'home' ? openFoldDesk() : site === 'home' ? go('lab') : location.assign(homeURL + '&room=lab'))],
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
    const canStacks = state.layers.includes('stacks');
    const text = LINES.atrium.readyForStacks;
    const items = [];
    if (canStacks) {
      items.push([CHOICES.goStacks, () => { quiet(); enterLayer('stacks'); }]);
    }
    items.push([CHOICES.openLab, openFoldDesk]);
    for (const [question, answer] of [[CHOICES.askWhere, LINES.atrium.answerPlace], [CHOICES.askSafe, LINES.atrium.answerSafe], [CHOICES.askSelf, LINES.atrium.answerSelf]]) {
      items.push([question, () => dialogue(answer, [[CHOICES.next, talkInAtrium], [CHOICES.wander, quiet]])]);
    }
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
    if (state.layers.includes('loft') || state.legacyLoft || state.phase === 'after') {
      items.push([CHOICES.goLoft, () => { quiet(); enterLayer('loft'); }]);
    } else if (state.diagram && !state.stacksUnlocked) {
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
    if (state.phase === 'closed' && state.traces.length === TRACES.length) {
      record('reunion');
      world3d.refresh();
      dialogue(LINES.loft.reunion, [[CHOICES.next, quiet]]);
      return;
    }
    const foundCount = identityClueCount(state);
    if (foundCount >= 2) {
      const finishIdentityTalk = () => {
        quiet();
        if (state.legacyLoft && !state.response && state.phase !== 'after') { record('finish-legacy-loft'); world3d.refresh(); }
        say(LINES.loft.working);
      };
      dialogue(LINES.loft.askIdentity, [
        [CHOICES.askWho, () => lines(LINES.loft.answerWho, finishIdentityTalk)],
        [CHOICES.askAuthor, () => lines(LINES.loft.answerAuthor, finishIdentityTalk)],
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
    if (isSilenced(state, site === 'blog' ? 'library' : viewLayer)) {
      if (site !== 'blog' && viewLayer === 'loft' && state.traces.length === TRACES.length) talkInLoft();
      else say(echoHint(), { mood: 'thought' });
      return true;
    }
    if (site === 'blog') { freeTime(); return true; }
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
    if (viewLayer === 'poolrooms' || viewLayer === 'drafts') {
      dialogue(LINES[viewLayer].enter, [[CHOICES.wander, quiet]]);
      return true;
    }
    talkInAtrium();
    return true;
  }

  function enterLayer(layerId, { push = true, fromWorld = false } = {}) {
    current();
    if (site !== 'home') {
      location.assign(`${homeURL}&layer=${layerId}`);
      return false;
    }
    if (!canEnterLayer(state, layerId)) return false;
    viewLayer = layerId;
    visited.add(layerId);
    current(); atmosphere(); renderAtlas();
    if (push) {
      const url = new URL(location.href);
      url.searchParams.set('paper', '0617');
      url.searchParams.delete('room');
      url.searchParams.delete('spot');
      url.searchParams.delete('from');
      url.searchParams.set('layer', layerId);
      history.pushState({ ...history.state, p34Space: true, p34Room: 'home', p34Layer: layerId }, '', url.pathname + url.search);
    }
    if (getRoom() !== 'home') {
      go('home');
    } else if (!fromWorld) {
      world3d?.refresh();
    }
    if (isSilenced(state, layerId)) say(echoHint(), { mood: 'thought' });
    else if (layerId === 'atrium') say(LINES.spatial.atriumEnter);
    else if (layerId === 'poolrooms' || layerId === 'drafts') say(LINES[layerId].enter);
    else if (layerId === 'stacks') say(LINES.spatial.stacksEnter, { mood: 'thought' });
    else if (layerId === 'loft') say(LINES.spatial.loftEnter, { mood: 'bright' });
    return true;
  }

  function openFoldDesk() {
    if (isSilenced(current(), viewLayer)) return;
    quiet();
    if (getRoom() !== 'home') { go('lab'); return; }
    void ensureWorld3D().then(world => world?.openFoldDesk());
  }

  function echoHint() {
    const missing = TRACES.find(id => !state.traces.includes(id));
    return LINES.echoes[{ atrium: 'findAtrium', poolrooms: 'findPool', drafts: 'findDraft' }[missing] || 'complete'];
  }

  function inspectPrototype() {
    if (state.phase === 'after') { say(LINES.after.visit); return; }
    dialogue(LINES.drafts.prototype, RESPONSES.map(choice => [CHOICES.disagreement[choice], () => {
      // Her frustration is independent of which answer the player gives.
      dialogue(LINES.drafts.heard[choice], [[CHOICES.next, () => dialogue(LINES.drafts.retreat, [
        [CHOICES.leaveRuler, () => {
          quiet(); record('disagreement', choice); world3d.refresh(); say(echoHint(), { mood: 'thought' });
        }],
      ])]]);
    }]));
  }

  function mountCreationDesk(body, preview, close) {
    if (state.phase !== 'after') record('reunion');
    const original = startingSculpture(state), shape = { ...original };
    const memory = state.response === 'critique' ? 'rememberFlaw' : state.garden.chime !== null ? 'rememberChime'
      : state.clues.includes('pool-echo') ? 'rememberWater' : 'working';
    body.innerHTML = `<p class="creation-remark" role="status"></p>
      ${[['height','拱顶'],['span','跨度'],['tone','音管']].map(([id,title]) =>
        `<label class="creation-control"><span>${title}</span><input data-sculpture="${id}" type="range" min="0" max="2" step="1" value="${shape[id]}"><output></output></label>`).join('')}
      <div class="creation-actions"><button type="button" data-partner>换你调</button><button type="button" data-finish-sculpture disabled>留在这里</button></div>`;
    const remark = body.querySelector('.creation-remark'), finish = body.querySelector('[data-finish-sculpture]');
    const names = { height: ['低','中','高'], span: ['收','平','展'], tone: ['铜管','玻璃','低铜片'] };
    let participated = false, saved = false;
    const render = () => {
      for (const input of body.querySelectorAll('[data-sculpture]')) {
        const key = input.dataset.sculpture;
        input.value = shape[key];
        const name = names[key][shape[key]];
        input.setAttribute('aria-valuetext', name);
        input.nextElementSibling.textContent = name;
      }
      preview(shape);
    };
    remark.textContent = LINES.loft[memory]; render();
    body.querySelectorAll('input').forEach(input => input.addEventListener('input', () => {
      const key = input.dataset.sculpture;
      shape[key] = Number(input.value);
      participated = true; finish.disabled = false;
      remark.textContent = LINES.loft.shaping[key][shape[key]]; render();
    }));
    body.querySelector('[data-partner]').addEventListener('click', () => {
      const open = shape.span < 2;
      shape.span += open ? 1 : -1;
      remark.textContent = open ? LINES.loft.partner : LINES.loft.partnerNarrow; render();
    });
    finish.addEventListener('click', () => {
      if (!participated) return;
      record('complete-loft', shape); saved = true;
      close(()=>{world3d.refresh();dialogue(LINES.loft.finished, [[CHOICES.keepBusy, quiet]]);});
    });
    return () => { if (!saved) preview(original); };
  }

  function ensureWorld3D() {
    if (world3d) return Promise.resolve(world3d);
    return worldMounting ||= createWorld3D();
  }

  async function createWorld3D() {
    const host = shell.querySelector('[data-world3d-host]');
    try {
      world3d = await mountWorld3D(host, {
        getState: () => current(),
        getLightNodes: () => getLightNodes?.() || state.lightSketch,
        motion,
        signal,
        library: site === 'blog' ? {
          posts, canRead,
          onRead: slug => openPost(posts.find(p => p.slug === slug), true),
          onClose: () => openPost(null, true),
        } : null,
        onShelfMoved() {
          if (!state.shelfMoved) {
            shelfMoved = true;
            if (!isSilenced(state, viewLayer)) say(LINES.spatial.shelfMoved, { mood: 'bright' });
          }
        },
        onGardenComment(text) {
          if (!isSilenced(state, viewLayer) && shell.dataset.talking !== 'true') say(text, { mood: 'thought' });
        },
        mountFoldDesk, mountCreationDesk,
        onLayerChange(nextLayer, { push = true } = {}) {
          enterLayer(nextLayer, { push, fromWorld: true });
        },
        onOpenRoom(roomName) {
          if (site === 'blog') {
            location.assign(homeURL + '&layer=stacks&from=blog');
          } else if (roomName === 'blog') {
            location.assign(blogURL);
          } else {
            go(roomName);
          }
        },
        onLeaveSite() {
          leave();
        },
        onArrivalReveal() {
          if (state.phase === 'arrive' && getRoom() === 'home' && shell.dataset.talking !== 'true') {
            say(LINES.spatial.arrivalReassure, { mood: 'thought' });
          }
        },
        onInteract(kind, payload) {
          if (kind === 'memory-trace') {
            if (state.traces.includes(payload)) { say(echoHint()); return; }
            record(kind, payload);
            world3d.refresh();
            say(LINES.echoes[payload] + '\n' + echoHint(), { mood: 'thought' });
          } else if (kind === 'prototype') {
            inspectPrototype();
          } else if (['pool-echo', 'pool-study', 'draft-note'].includes(kind)) {
            record('clue', kind);
            if(kind==='pool-echo')dialogue(LINES.poolrooms.echo, [[CHOICES.wander, quiet]]);
          } else if (kind === 'garden-sky') {
            record(kind, payload);
            say(LINES.garden.skies[payload], { mood: 'bright' });
          } else if (kind === 'garden-chime') {
            const first = state.garden.chime === null;
            record(kind, payload);
            if (first) dialogue(LINES.garden.askChime, [
              ...CHOICES.chimes.map((label, tone) => [label, () => { record('garden-chime', tone); quiet(); world3d.ringChime(tone); say(LINES.garden.chimes[tone]); }]),
              [CHOICES.wander, quiet],
            ]);
            else say(LINES.garden.chimes[payload]);
          } else if (kind === 'talk-arrival') {
            talk();
          } else if (kind === 'lab-link') {
            say(state.bridgeSolid ? LINES.spatial.bridgeSolid : LINES.spatial.bridgeHint);
          } else if (kind === 'glb-lamp') {
            record('touch');
            say(LINES.spatial.lampTouched, { mood: 'bright' });
          } else if (kind === 'glb-fork') {
            record('touch');
            say(LINES.spatial.forkTouched);
          } else if (kind === 'terminal') {
            say(LINES.spatial.terminalOpen);
          } else if (kind === 'portal-locked-loft') {
            const hint = isSilenced(state, viewLayer) ? echoHint() : payload?.targetLayer === 'loft'
              ? LINES.drafts.enter : payload?.targetLayer === 'poolrooms' ? LINES.spatial.bridgeHint : LINES.stacks.locked;
            say(hint, { mood: 'thought' });
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
      return world3d;
    } catch (e) {
      console.error('3D world failed to initialize', e);
      shell.dataset.worldError = 'true';
      shell.dataset.article = 'false';
      error('空间没有载入，可刷新重试或返回原页');
      throw e;
    }
  }

  function closeScene() {
    world3d?.setActive(false);
  }

  function heading(name) {
    if (name === 'home') {
      if (state.phase === 'after') return LINES.home.after;
      if (isSilenced(state, viewLayer)) return LINES.home.closed;
      if (['poolrooms', 'drafts'].includes(viewLayer)) return LINES.layers[viewLayer];
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
    atlas.innerHTML = `<h2>去过的地方</h2><div class="layer-atlas-cards">${(state.phase === 'after' ? LAYERS : state.layers).map(id => `
      <button type="button" data-enter-layer="${id}">${LAYER_LABELS[id].replace(/^第.层 · /, '')}</button>
    `).join('')}</div><button type="button" data-goto-room="archive">档案</button>`;
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
    board.innerHTML = `<h2>留下的记录</h2><ul class="clue-list">${state.clues.map(id => {
      const info = CLUE_INFO[id];
      return `<li class="clue-item"><h3>${info.title}</h3><p>${info.summary}</p></li>`;
    }).join('')}</ul>`;
  }

  function room(name, announce = true) {
    current();
    const urlLayer = layerFromURL(location.href, history.state?.p34Layer || resumeLayer);
    if (site === 'home' && name === 'home' && canEnterLayer(state, urlLayer)) {
      viewLayer = urlLayer;
      visited.add(urlLayer);
      current();
    }
    atmosphere();
    if (name === 'guestbook' && !isSilenced(state, viewLayer)) void guestbook?.open();
    if (!storageError) notice.hidden = true;
    renderAtlas();
    renderClueArchive();
    if (announce && name !== 'home' && site !== 'blog') say(heading(name));
    if (isSilenced(state, site === 'blog' ? 'library' : viewLayer) && (site === 'blog' || !['home', 'archive'].includes(name))) {
      say(echoHint(), { mood: 'thought' });
    }
    shell.querySelector('[data-talk]').hidden = false;
    shell.querySelector('[data-return]').hidden = false;
    saves.hidden = name !== 'archive' && site !== 'blog';

    if (site === 'blog' || name === 'home') {
      const reentering = Boolean(world3d);
      void ensureWorld3D().then(() => {
        if (reentering) world3d.refresh();
        world3d?.setActive(getRoom() === (site === 'blog' ? 'blog' : 'home'));
      }).catch(() => {}); // The visible notice above retains the exit path.
    }
  }

  function canRead(slug) {
    current();
    if (isSilenced(state, 'library')) return false;
    if (slug === 'landing-notes') {
      return state.layers.includes('stacks') || state.westAligned || state.bridgeSolid || state.phase === 'after';
    }
    if (slug === 'tomorrow-again') {
      return state.layers.includes('loft') || state.phase === 'after';
    }
    return true;
  }

  function opened(slug, intentional) {
    stopDiagram?.();
    stopDiagram = null;
    if (intentional && NOTES.includes(slug) && !state.opened.includes(slug)) record('opened', slug);
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

    const update = event => {
      const trace = reboundSketch(Number(input.value) / 100);
      if (ink) ink.setAttribute('d', trace.path);
      if (pad) {
        pad.setAttribute('x', String(trace.paddleX));
        pad.setAttribute('width', String(trace.paddleWidth));
      }
      if (trace.exit) {
        if (event && !state.diagram) {
          if (!state.opened.includes(slug)) record('opened', slug);
          record('diagram');
        }
        if (link) {
          link.hidden = false;
          link.href = 'https://sayori.org/?paper=0617&layer=stacks&from=blog';
          link.textContent = '回到书库';
        }
        if (edge) edge.style.opacity = '1';
        noteBox.textContent = '页缝 · 上层 · 窗沿的雨';
      } else {
        noteBox.textContent = '';

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
    const snapshot = current();
    if (snapshot.light === 2 && !snapshot.lightSketch) snapshot.lightSketch = memorySketch();
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }));
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
    viewLayer = state.currentLayer; visited.clear(); state.layers.forEach(id => visited.add(id)); shelfMoved = state.shelfMoved;
    const url = new URL(location.href);
    if (site === 'home') {
      url.searchParams.set('layer', viewLayer);
      history.replaceState({ ...history.state, p34Layer: viewLayer }, '', url);
    }
    storageError = '';
    notice.hidden = true;
    world3d?.refresh();
    room(getRoom());
  });

  listen(window, 'focus', () => {
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
    getLayer: () => viewLayer,
    record: (type, value) => {
      const next = record(type, value);
      if (type === 'light-saved') world3d?.refreshBridge();
      else if (type !== 'light-moved') world3d?.refresh();
      return next;
    },
    getWorld3D: () => world3d,
    presentDialogue(text, buttons) {
      if (world3d && (site === 'blog' || getRoom() === 'home')) void world3d.setDialogue(text, buttons);
    },
    async readBook(post, element) {
      const world = await ensureWorld3D();
      if (!signal.aborted) world.readBook(post, element);
    },
  };
}
