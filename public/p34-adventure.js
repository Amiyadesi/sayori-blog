import { LINES, CHOICES } from './p34-script.js?v=20261113-library';
import { mountGuestbook } from './p34-guestbook.js?v=20261113-library';
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
} from './p34-journey.js?v=20261113-library';
import { mountWorld3D } from './p34-world3d.js?v=20261113-library';

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
  leave,
  cookie,
  signal,
}) {
  const loaded = cookieJourney(document.cookie);
  let state = loaded.state;
  let storageError = loaded.error;
  let world3d = null;
  let worldMounting = null;
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
    const canStacks = state.layers.includes('stacks');
    const text = LINES.atrium.readyForStacks;
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
            record('shelf-moved');
            say(LINES.spatial.shelfMoved, { mood: 'bright' });
          }
        },
        onLayerChange(nextLayer, { push = true } = {}) {
          enterLayer(nextLayer, { push });
        },
        onOpenRoom(roomName) {
          if (site === 'blog') {
            location.assign(homeURL + (state.layers.includes('stacks') ? '&layer=stacks' : ''));
          } else if (roomName === 'blog') {
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
          } else if (kind === 'portal-locked-loft') {
            say(LINES.spatial.pillarTurned, { mood: 'thought' });
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
    atlas.innerHTML = `<h2>去过的地方</h2><div class="layer-atlas-cards">${state.layers.map(id => `
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
    const urlLayer = layerFromURL(location.href, state.currentLayer);
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
    if (announce && name !== 'home' && site !== 'blog') say(heading(name));
    shell.querySelector('[data-talk]').hidden = false;
    shell.querySelector('[data-return]').hidden = false;
    saves.hidden = name !== 'archive' && site !== 'blog';

    if (site === 'blog' || name === 'home') {
      void ensureWorld3D().then(() => {
        world3d?.refresh();
        world3d?.setActive(getRoom() === (site === 'blog' ? 'blog' : 'home'));
      }).catch(() => {}); // The visible notice above retains the exit path.
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
    presentDialogue(text, buttons) {
      if (world3d && (site === 'blog' || getRoom() === 'home')) void world3d.setDialogue(text, buttons);
    },
    async readBook(post, element) {
      const world = await ensureWorld3D();
      if (!signal.aborted) world.readBook(post, element);
    },
  };
}
