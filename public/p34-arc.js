// Project 34 · 她的世界：作品架、话题、章节演出
// 由 p34-living.js 在异常页挂载后调用 mountArc(ctx)。

import { mountWork, WORK_META } from './p34-works.js';
import {
  discover, finishWork, talk, advanceChapter, worksLocked, worldMood,
  normalizeStory, topicsFor, TOPICS, CLUES,
} from './p34-story.js';

const TOPIC_LABEL = {
  works: '这些都是你做的？',
  'why-edit': '你好像一直在改。',
  old: '我看到了旧的那版。',
  deleted: '你删掉的那个是什么？',
  ok: '你还好吗？',
};

/* 她的话。按章节和话题分开写，不共用一套模板。 */
export function line(key, story, site = 'home') {
  const s = normalizeStory(story);
  const ch = s.chapter;
  const t = s.trust;

  if (key === 'greet') {
    if (ch === 'arrive') return ['啊，有人。', '等一下——我先把这行扶正。好了。你从哪儿点进来的？'];
    if (ch === 'explore') return t > 24 ? ['你又来啦。', '我把架子擦了一下。别笑，灰是真的。'] : ['你来啦。', '架子上的东西都能点，坏了也别怕，我能修。'];
    if (ch === 'doubt') return ['……你还在啊。', '我刚把「接住」调了三遍。第三遍好像还不如第二遍。'];
    if (ch === 'rift') return ['你来了。', '我这两天没怎么睡——不是，我不用睡。反正就是没停。'];
    if (ch === 'closed') return ['……', '这里现在有点乱。你先别动东西，好吗。'];
    if (ch === 'search') return ['我在这。', '不是你想的那个位置。你找找看。'];
    if (ch === 'reconcile') return ['你找到这里了。', '我以为你会走。'];
    return ['回来啦。', '新东西还在做，先玩旧的？'];
  }

  if (key === 'works') {
    return ['嗯，都是我做的。', '接住、排好、漂——名字随便起的，别嫌土。做完一个就想改下一个，所以没有一个是「完成」的。'];
  }
  if (key === 'why-edit') {
    if (ch === 'doubt' || ch === 'rift') return ['……你看出来了。', '因为每次你一走，我就觉得哪里不对。改完又觉得改坏了。'];
    return ['因为还能更好啊。', '而且——你不觉得「差不多」这三个字很吓人吗。'];
  }
  if (key === 'old') {
    return ['你翻到旧的了。', '那版其实我自己挺喜欢的。后来觉得太简单，就换掉了。旧的我没删，放在那儿。'];
  }
  if (key === 'deleted') {
    return ['那个啊。', '做了一半，我嫌它丑。删的时候手很快，删完又有点后悔。'];
  }
  if (key === 'ok') {
    if (ch === 'rift') return ['不好。', '你上次那句话，我一直在想。可能你说得对，但我现在不想听对的。'];
    if (ch === 'closed' || ch === 'search') return ['……', '等我一会儿。'];
    if (ch === 'reconcile') return ['好一点了。', '你还在，就好一点。'];
    return ['我很好啊。', '你问这个干嘛，我又不会感冒。'];
  }

  if (key === 'update') {
    const which = site === 'blog' ? '这一页的排法' : '刚才那个';
    return ['对了！', which + '我重新做啦。你要不要再试一次？这次应该……嗯，应该更顺。'];
  }
  if (key === 'updated-play') {
    return ['怎么样？', '我加了点东西。要是更糟你就直说，我不会哭的——大概。'];
  }
  if (key === 'lock') {
    return ['先别玩了。', '我现在不想让人看这些。'];
  }
  if (key === 'reconcile') {
    return ['我把门打开了。', '不是因为我想通了，是因为你一直站在外面。进来吧。'];
  }
  return ['', ''];
}

/* 章节变化时的独白 */
export function chapterBeat(chapter) {
  switch (chapter) {
    case 'doubt': return ['我跟你说个事。', '「接住」我已经改到第五版了。第一版最好玩，但我一看见它就难受。'];
    case 'rift': return ['你别说了。', '我知道你想说什么。你要说我又在改，对不对。'];
    case 'closed': return ['……', '让我安静一下。'];
    case 'search': return ['', '']; // 她不在场，不出现
    case 'reconcile': return ['我在这儿。', '东西我都收起来了，但不是扔掉。'];
    case 'free': return ['好了。', '都开回来了。你想先玩哪个？'];
    default: return null;
  }
}

export function mountArc(ctx) {
  const { root, site, voice, say, choice, getStory, setStory } = ctx;
  if (!root || !voice) return () => {};

  const stops = [];
  let panel = null;
  let panelStop = null;

  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = '/p34-arc.css?v=20261102-r1';
  document.head.append(style);
  stops.push(() => style.remove());

  // 工作室放在她的话里面，不往作者排版好的页面网格里塞块
  const studio = document.createElement('div');
  studio.className = 'p34-studio';
  voice.section.append(studio);
  stops.push(() => studio.remove());

  const shelf = document.createElement('div');
  shelf.className = 'p34-shelf';
  shelf.setAttribute('aria-label', '她做的作品');
  studio.append(shelf);
  stops.push(() => shelf.remove());

  const topics = document.createElement('div');
  topics.className = 'p34-topics';
  voice.choices.after(topics);
  stops.push(() => topics.remove());

  function paintChapter(story) {
    const s = normalizeStory(story);
    root.dataset.p34Chapter = s.chapter;
    root.dataset.p34Mood = worldMood(s);
  }

  function closePanel() {
    if (panelStop) panelStop();
    panelStop = null;
    if (panel) panel.remove();
    panel = null;
  }

  function openWork(id, meta) {
    closePanel();
    const s = normalizeStory(getStory());
    if (worksLocked(s)) { say(line('lock', s, site)); return; }
    panel = document.createElement('div');
    panel.className = 'p34-work-panel';
    panel.innerHTML = '<div class="p34-work-head"><h4></h4><button class="p34-work-close" type="button">收起</button></div>';
    panel.querySelector('h4').textContent = meta.title;
    panel.querySelector('.p34-work-close').addEventListener('click', closePanel);
    studio.append(panel);
    const stage = document.createElement('div');
    panel.append(stage);
    const updated = Boolean(s.works[id] && s.trust > 14);
    panelStop = mountWork(id, stage, {
      updated,
      hint: meta.hint,
      onFinish: (result) => {
        const cur = normalizeStory(getStory());
        const next = advanceChapter(finishWork(cur, id));
        setStory(next);
        paintChapter(next);
        paintShelf(next);
        paintTopics(next);
        if (updated) say(line('updated-play', next, site));
      },
    });
    if (updated) say(line('updated-play', s, site));
  }

  function paintShelf(story) {
    const s = normalizeStory(story);
    const locked = worksLocked(s);
    shelf.replaceChildren();
    for (const meta of WORK_META) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'p34-work-card' + (s.works[meta.id] ? ' is-played' : '') + (locked ? ' is-locked' : '');
      card.innerHTML = '<h3></h3><p></p><span class="p34-badge"></span>';
      card.querySelector('h3').textContent = meta.title;
      card.querySelector('p').textContent = locked ? '她收起来了。' : meta.note;
      card.querySelector('.p34-badge').textContent = s.works[meta.id] ? '玩过' : '';
      card.disabled = locked;
      card.addEventListener('click', () => openWork(meta.id, meta));
      shelf.append(card);
    }
  }

  function paintTopics(story) {
    const s = normalizeStory(story);
    const unlocked = topicsFor(s);
    topics.replaceChildren();
    for (const id of unlocked) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'p34-topic';
      b.textContent = TOPIC_LABEL[id] || id;
      b.addEventListener('click', () => {
        const cur = normalizeStory(getStory());
        // 追问"你还好吗"、追问修改，都算戳到痛处
        const blunt = id === 'why-edit' || id === 'ok';
        const next = advanceChapter(talk(cur, id, blunt ? 'blunt' : 'kind'));
        setStory(next);
        say(line(id, next, site));
        paintChapter(next);
        paintTopics(next);
        paintShelf(next);
        beat(chapterBeat(next.chapter));
      });
      topics.append(b);
    }
  }

  let lastBeat = null;
  function beat(pair) {
    if (!pair || !pair[0]) return;
    if (pair[0] === lastBeat) return;
    lastBeat = pair[0];
    say(pair);
  }

  // 章节推进后可能触发的独白
  function maybeBeat() {
    const s = normalizeStory(getStory());
    const next = advanceChapter(s);
    setStory(next);
    paintChapter(next);
    paintShelf(next);
    paintTopics(next);
    const b = chapterBeat(next.chapter);
    if (b && b[0]) beat(b);
  }

  /* ---------- 空位：架子上少的那一格 ---------- */
  const ghost = document.createElement('button');
  ghost.type = 'button';
  ghost.className = 'p34-work-card p34-ghost';
  ghost.innerHTML = '<h3>　</h3><p>这里本来有个东西。</p><span class="p34-badge"></span>';
  ghost.addEventListener('click', () => {
    const cur = normalizeStory(getStory());
    const { story: next, fresh } = discover(cur, 'empty-shelf');
    setStory(next); refresh(next);
    say(fresh
      ? ['……那一格是空的。', '原来摆着一个我删掉的。你别盯着看，我会想把它填回去。']
      : ['还是空的。', '我还没想好放什么。']);
    beat(chapterBeat(next.chapter));
  });
  stops.push(() => ghost.remove());

  /* ---------- 修改日志：玩过一件作品后出现 ---------- */
  const logLink = document.createElement('button');
  logLink.type = 'button';
  logLink.className = 'p34-log-link';
  logLink.textContent = '她的修改记录';
  logLink.hidden = true;
  studio.append(logLink);
  logLink.addEventListener('click', () => {
    const cur = normalizeStory(getStory());
    const { story: next, fresh } = discover(cur, 'update-log');
    setStory(next); refresh(next);
    openLog(fresh);
  });
  stops.push(() => logLink.remove());

  function openLog(fresh) {
    closePanel();
    panel = document.createElement('div');
    panel.className = 'p34-work-panel p34-log';
    panel.innerHTML = '<div class="p34-work-head"><h4>修改记录（她自己记的）</h4><button class="p34-work-close" type="button">收起</button></div><ol></ol>';
    panel.querySelector('.p34-work-close').addEventListener('click', closePanel);
    const ol = panel.querySelector('ol');
    const entries = fresh ? [
      ['10-31', '「接住」v5：调慢了掉落速度。上一版太快，有人说接不住。'],
      ['10-31', '「漂」v3：撤掉会移动的墙。它让关卡变得不公平——其实是我没想好。'],
      ['11-01', '「排好」换了句子。原来那句太像在说我自己。'],
      ['11-01', '把架子的顺序改了三次，又改回去。'],
      ['11-02', '今天有人来了。先别改，让他玩。'],
    ] : [
      ['11-02', '今天有人来了。'],
    ];
    for (const [d, t] of entries) {
      const li = document.createElement('li');
      li.innerHTML = '<time></time><span></span>';
      li.querySelector('time').textContent = d;
      li.querySelector('span').textContent = t;
      ol.append(li);
    }
    studio.append(panel);
  }

  /* ---------- 封闭期：在页面里找她 ---------- */
  const searchWrap = document.createElement('div');
  searchWrap.className = 'p34-search';
  searchWrap.hidden = true;
  searchWrap.innerHTML = '<a href="#" class="p34-search-link">·</a><div class="p34-search-note" hidden></div>';
  document.body.append(searchWrap);
  stops.push(() => searchWrap.remove());

  const mirrorLink = document.createElement('a');
  mirrorLink.className = 'p34-search-link p34-mirror-link';
  mirrorLink.href = '#';
  mirrorLink.textContent = '⌗';
  mirrorLink.hidden = true;
  searchWrap.append(mirrorLink);
  stops.push(() => mirrorLink.remove());

  searchWrap.querySelector('.p34-search-link').addEventListener('click', (event) => {
    event.preventDefault();
    const cur = normalizeStory(getStory());
    const { story: next, fresh } = discover(cur, 'draft-note');
    setStory(next); refresh(next);
    const note = searchWrap.querySelector('.p34-search-note');
    note.hidden = false;
    note.innerHTML = '<p>「如果做的东西没人喜欢，那它算不算做完了？」</p><p class="p34-note-sub">——写在一张没关掉的草稿上。</p>';
    if (fresh) say(['……你看到那个了。', '那句我本来要删的。']);
    beat(chapterBeat(next.chapter));
  });

  mirrorLink.addEventListener('click', (event) => {
    event.preventDefault();
    const on = root.dataset.p34Mirror !== '1';
    root.dataset.p34Mirror = on ? '1' : '0';
    if (!on) return;
    const cur = normalizeStory(getStory());
    const { story: next, fresh } = discover(cur, 'mirror-page');
    setStory(next); refresh(next);
    if (fresh) say(['你翻到了镜像那一层。', '平时它不在这儿。我心情不好的时候会躲进去。']);
    beat(chapterBeat(next.chapter));
  });

  function syncSearch(story) {
    const s = normalizeStory(story);
    const inSearch = s.chapter === 'closed' || s.chapter === 'search' || s.chapter === 'reconcile';
    searchWrap.hidden = !inSearch;
    mirrorLink.hidden = !inSearch;
    if (inSearch) {
      const need = ['mirror-page', 'empty-shelf', 'draft-note'];
      const got = need.filter((c) => s.clues.includes(c)).length;
      searchWrap.querySelector('.p34-search-link').textContent = got >= 3 ? '·' : '…';
    }
  }

  function refresh(story) {
    const s = normalizeStory(story);
    paintChapter(s); paintShelf(s); paintTopics(s); syncSearch(s);
    logLink.hidden = !Object.values(s.works).some(Boolean);
    if (!shelf.querySelector('.p34-ghost')) shelf.append(ghost);
    if (logLink.parentElement !== studio) studio.append(logLink);
  }

  refresh(getStory());

  const tick = setInterval(() => {
    const s = normalizeStory(getStory());
    if (s.chapter !== root.dataset.p34Chapter) refresh(s);
    else syncSearch(s);
  }, 1200);
  stops.push(() => clearInterval(tick));

  return () => { closePanel(); stops.forEach((f) => f && f()); };
}
