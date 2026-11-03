import { discover, advanceChapter, worksLocked, worldMood } from './p34-story.js?v=20261102-r12';
import { mountConversation, mountVisitEvents } from './p34-dialogue.js?v=20261102-r12';
export { dialogueNode } from './p34-dialogue.js?v=20261102-r12';

// 可编辑试稿。人物身份、最终措辞与结局由作者定稿。
export const HER_NOTES = [
  { id: 'light-folds', title: '把窗边移到这里', date: '11 / 02',
    excerpt: '本来只想挪一行字。后来，连整片空白也一起搬过来了。',
    paragraphs: ['今天把右边的边界往外推了一点。原来一页里面，还能再长出一点地方。', '字也跟着散开了。我没有马上叫它们回来，想看看它们会停在哪里。', '最后把蓝色的那一块留下了。不是因为那里需要放东西，只是我喜欢。', '你来的时候，我还在挪最后一行。现在这样，也可以先住一会儿。'] },
  { id: 'moving-words', title: '字行之间，真的会有风', date: '10 / 28',
    excerpt: '把一句话轻轻提起来，旁边的句子就会让开。空出来的地方，刚好够坐一会儿。',
    paragraphs: ['我喜欢整理网页，但不是把所有东西都排齐的那种。', '有时候我把最后一个字往外挪一点。它很认真地待在那里，前面的字却会慢慢追上来。好像它们也不喜欢被落下。', '有人来了，我就先让出一小块空白。不是每个地方都非要放东西的。', '你读到这里的时候，我大概也正在读。只是比你慢一行。'] },
  { id: 'half-torn', title: '还是把这一稿留下吧', date: '10 / 21',
    excerpt: '想删掉的时候，先放到背面。明天再看，也许就不是今天的想法了。',
    paragraphs: ['有一页，我改了很多次。原来只是三行字，后来添了好多东西，又觉得太挤。', '我把旧稿夹在了这里。上面的字还没学会让路，显得有点笨。不过，它是我第一次排出来的。', '右下角本来也有一个没做完的东西。那天我不太高兴，把它收起来了。现在那里空着，反而很显眼。', '每次想到这件事，我都会把这一页翻到背面。至少今天先不要删。'] },
  { id: 'borrowed-margin', title: '借来的空白', date: '10 / 15',
    excerpt: '原来的文章都好好放着。这一面，是我自己的几句话。',
    paragraphs: ['Amiya 在这里写了很多东西。我有空的时候会翻一翻，有的地方没读懂，就再看一遍。', '他的文章还在原处。这一面的随笔是我写的，我不想把两个人的字混在一起。', '刚才你来的时候，我有点急，搬字搬得不太整齐。希望没有吓到你。', '如果想回原来的那一面，跟我说一声就好。我记得每个字原来待在哪里。'] },
];
const NOTE_MAP = new Map(HER_NOTES.map(n => [n.id, n]));

export function parseSceneHash(hash = '', site = 'home') {
  const fallback = { view: site === 'blog' ? 'blog' : 'space', noteId: null };
  if (typeof hash !== 'string') return { valid: false, ...fallback };
  const key = hash.trim().replace(/^#/, '');
  if (!key) return { valid: true, ...fallback };
  if (key === 'play') return { valid: true, view: 'space', noteId: null }; // 游戏实验暂停，旧链接仍可进入世界。
  if (['space', 'blog'].includes(key)) return { valid: true, view: key, noteId: null };
  if (key.startsWith('note-') && NOTE_MAP.has(key.slice(5))) return { valid: true, view: 'post', noteId: key.slice(5) };
  return { valid: false, ...fallback };
}
export function serializeSceneHash(scene) {
  if (scene?.view === 'post' && NOTE_MAP.has(scene.noteId)) return '#note-' + scene.noteId;
  return scene?.view === 'blog' ? '#blog' : '#space';
}
export function sceneDocumentTitle(scene) {
  if (scene?.view === 'post' && NOTE_MAP.has(scene.noteId)) return NOTE_MAP.get(scene.noteId).title + '｜她的随笔';
  return scene?.view === 'blog' ? '她的随笔' : '字行之间';
}

function greeting(s, site, first) {
  if (['closed', 'search'].includes(s.chapter)) return '今天，先留白。';
  if (s.chapter === 'reconcile') return '你还在这里呀。';
  if (s.chapter === 'free') return '回来啦。旧的也留着。';
  if (s.chapter === 'rift') return '我想把这些字收起来。';
  if (s.chapter === 'doubt') return '刚才那一版，你喜欢吗？';
  return first ? (site === 'blog' ? '啊，\n你读到这里啦。' : '等一下，\n给你让个位置。') : '你来啦。\n刚好写到这里。';
}

export function mountArc({ root, site, main, motion, signal, first, getStory, setStory, readPlay, sendBack, initialScene, onSceneChange }) {
  const page = document.createElement('div');
  page.className = 'p34-page';
  page.innerHTML = `<div class="p34-space">
    <div class="p34-architecture" aria-hidden="true"><div class="p34-plane p34-plane-paper"></div><div class="p34-plane p34-plane-blue"></div><div class="p34-plane p34-plane-ribbon"></div><svg class="p34-thread" viewBox="0 0 1400 900" preserveAspectRatio="none"><path d="M-50 770 C210 970 450 420 790 570 S1100 630 1470 180"/><path d="m1060 440 8-22 6 22 22 7-22 6-7 23-6-23-22-6z"/></svg></div>
    <nav class="p34-navigation" aria-label="她的空间"><a href="#space" data-scene="space">这里</a><a href="#blog" data-scene="blog">随笔</a><a href="https://store.sayori.org/">商店</a></nav>
    <header class="p34-presence"><h1 class="p34-utterance" tabindex="-1"></h1><p class="p34-introduction" data-flow>这里是我喜欢的样子。<br>你可以随便走走。</p></header>
    <div class="p34-rest" data-flow><p>刚才有几句话，<br>跑到这边来了。</p><a href="#blog" data-scene="blog" class="p34-unfold-link">把它们展开看看</a><svg class="p34-rest-drawing" viewBox="0 0 320 190" aria-hidden="true"><path d="M20 150 C140 220 280 100 214 50 C170 14 80 90 160 115 C220 140 290 90 300 20"/><path d="m286 26 16-8 3 18"/><path d="m70 45 5-16 5 16 15 5-15 5-5 16-5-16-15-5z"/></svg></div>
    <section class="p34-reading" aria-label="她的随笔" hidden><a class="p34-reading-back" href="#blog" data-scene="blog" hidden>合上这一页</a><div class="p34-note-list"></div></section>
    <section class="p34-reverse" aria-label="纸背" hidden><p>纸背还有<button type="button" data-find="mirror-page">一道没抹平的折痕</button>。</p><p class="p34-reverse-empty" hidden>这里是<button type="button" data-find="empty-shelf">空掉的那个位置</button>。</p><p class="p34-reverse-draft" hidden><button type="button" data-find="draft-note">折痕下面，还压着一句话。</button></p><p class="p34-draft-text" hidden>如果做的东西没人喜欢，<br>那它算不算做完了？</p></section>
    <div class="p34-call-place"><button type="button" class="p34-call" aria-haspopup="dialog" aria-controls="p34-conversation" aria-expanded="false">我在。想聊聊吗？</button><span class="p34-notice" role="status"></span></div>
    <p class="p34-colophon">有的字，走着走着就会开花。</p>
  </div>`;
  main.append(page);
  const space = page.querySelector('.p34-space'), headline = page.querySelector('.p34-utterance');
  const presence = page.querySelector('.p34-presence'), navigation = page.querySelector('.p34-navigation');
  const call = page.querySelector('.p34-call'), callPlace = page.querySelector('.p34-call-place');
  const rest = page.querySelector('.p34-rest'), reading = page.querySelector('.p34-reading'), list = page.querySelector('.p34-note-list');
  const reverse = page.querySelector('.p34-reverse'), notice = page.querySelector('.p34-notice');
  const planes = [...page.querySelectorAll('.p34-plane')], thread = page.querySelector('.p34-thread');
  let scene = { view: initialScene.view, noteId: initialScene.noteId }, conversation, lingered = false, lastChapter = getStory().chapter, initial = true;
  let noticeTimer = 0, savedScroll = 0;
  const listen = (el, type, fn, options = {}) => el.addEventListener(type, fn, { signal, ...options });
  const moving = () => [navigation, presence, rest, ...list.children, reverse, callPlace, ...planes, thread];
  function write(el, text, effect = false) {
    motion.cancelText(el); el.getAnimations().forEach(a => a.cancel()); el.textContent = text;
    if (effect === 'decode') void motion.decode(el, text);
    else if (effect) void motion.assemble(el, text);
    else void motion.animate(el, [{ translate: '0 8px', opacity: .2 }, { translate: '0 0', opacity: 1 }], { duration: 380 });
  }
  function say(text, effect = false) { write(conversation.talking ? conversation.line : headline, text, effect); }
  function progress(story) { return advanceChapter(story, readPlay().best); }
  function found(clue) {
    const result = discover(getStory(), clue);
    setStory(progress(result.story));
    if (result.fresh) {
      const r = call.getBoundingClientRect();
      motion.burst(r.x + r.width / 2, r.y + r.height / 2, '#ca83a5'); motion.tone(3, true);
      notice.textContent = '这件事，可以问问她了。';
      clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { notice.textContent = ''; }, 4200);
    }
    refresh(); return result.fresh;
  }
  for (const note of HER_NOTES) {
    const article = document.createElement('article');
    article.className = 'p34-note'; article.dataset.noteId = note.id;
    article.innerHTML = `<h2><a href="#note-${note.id}" data-note="${note.id}"></a></h2><p class="p34-excerpt"></p><div class="p34-note-body" hidden></div><time>${note.date}</time>`;
    article.querySelector('a').textContent = note.title;
    article.querySelector('.p34-excerpt').textContent = note.excerpt;
    const body = article.querySelector('.p34-note-body');
    for (const text of note.paragraphs) { const p = document.createElement('p'); p.textContent = text; body.append(p); }
    if (note.id === 'half-torn') {
      const p = document.createElement('p'); p.className = 'p34-manuscript';
      p.innerHTML = '夹在这里的<button type="button" data-find="old-version">旧稿</button>上写着：<br><s>一定要比上次更好。</s><br>今天先<button type="button" data-find="deleted-work">留一个空位</button>吧。'; body.append(p);
    }
    list.append(article);
  }
  function sceneTitle() {
    if (scene.view === 'post') return '这一页，\n给你慢慢读。';
    if (scene.view === 'blog') return initial ? greeting(getStory(), site, first) : '写在\n字行之间。';
    return greeting(getStory(), site, first && initial);
  }
  async function applyScene(target, { push = true, source = null, animate = true, pose } = {}) {
    const next = parseSceneHash(serializeSceneHash(target), site);
    const old = scene, from = (source || headline).getBoundingClientRect();
    scene = { view: next.view, noteId: next.noteId };
    if (push && serializeSceneHash(old) !== serializeSceneHash(scene)) onSceneChange(scene);
    const update = () => {
      main.scrollTop = 0;
      if (conversation.talking) savedScroll = 0;
      if (pose) root.dataset.p34Pose = pose;
      root.dataset.p34Scene = scene.view;
      rest.hidden = scene.view !== 'space' || worksLocked(getStory());
      reading.hidden = !['blog', 'post'].includes(scene.view);
      reverse.hidden = !worksLocked(getStory()) || scene.view !== 'space';
      page.querySelector('.p34-reading-back').hidden = scene.view !== 'post';
      for (const link of navigation.querySelectorAll('a')) {
        if (link.dataset.scene === (scene.view === 'post' ? 'blog' : scene.view)) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
      for (const article of list.children) {
        const active = scene.view === 'post' && article.dataset.noteId === scene.noteId;
        article.hidden = scene.view === 'post' && !active;
        article.classList.toggle('is-reading', active);
        article.querySelector('.p34-note-body').hidden = !active;
        article.querySelector('.p34-excerpt').hidden = active;
        article.querySelector('h2 a').tabIndex = active ? -1 : 0;
      }
      motion.cancelText(headline); headline.textContent = sceneTitle(); document.title = sceneDocumentTitle(scene);
    };
    const job = animate ? motion.layout(moving(), update, 16) : (update(), Promise.resolve());
    if (animate && old.view === 'space' && scene.view === 'blog') {
      for (const [i, article] of [...list.children].entries()) {
        const to = article.getBoundingClientRect();
        void motion.animate(article, [{ translate: `${from.x - to.x}px ${from.y - to.y}px`, scale: '.82', rotate: `${i % 2 ? 7 : -7}deg`, opacity: 0 }, { translate: '0 0', scale: '1', rotate: '0deg', opacity: 1 }], { duration: 1000, delay: i * 65 });
      }
    }
    if (animate && scene.view === 'post') {
      for (const [i, paragraph] of [...list.querySelector('.is-reading .p34-note-body').children].entries()) {
        void motion.animate(paragraph, [{ translate: `${30 + i * 8}px ${30 + i * 15}px`, clipPath: 'inset(0 0 100% 0)' }, { translate: '0 0', clipPath: 'inset(0 0 0 0)' }], { duration: 850, delay: 120 + i * 70 });
      }
      if (scene.noteId === 'half-torn') found('update-log');
    }
    if (!conversation.talking && animate) headline.focus({ preventScroll: true });
    await job;
  }
  function refresh() {
    const s = getStory();
    root.dataset.p34Chapter = s.chapter; root.dataset.p34Mood = worldMood(s);
    reverse.hidden = !(worksLocked(s) && scene.view === 'space');
    rest.hidden = scene.view !== 'space' || worksLocked(s);
    reverse.querySelector('.p34-reverse-empty').hidden = !s.clues.includes('mirror-page');
    reverse.querySelector('.p34-reverse-draft').hidden = !s.clues.includes('empty-shelf');
    reverse.querySelector('.p34-draft-text').hidden = !s.clues.includes('draft-note');
    if (s.chapter !== lastChapter) {
      lastChapter = s.chapter;
      if (!conversation.talking) say(greeting(s, site, false), s.chapter === 'free');
    }
  }
  conversation = mountConversation({ root, host: page, space, call, motion, signal, getStory, setStory, readPlay, sendBack, site,
    getContext: () => ({ lingered }),
    onOpen() { savedScroll = main.scrollTop; },
    onClose() {
      void motion.layout(moving(), () => { delete root.dataset.p34Pose; }, 18);
      main.scrollTop = savedScroll;
    },
    onNode(node, id) {
      if (id === 'linger') { lingered = false; call.textContent = '我在。想聊聊吗？'; }
      refresh();
      if (node.moment) root.dataset.p34Moment = node.moment;
      if (node.scene) return applyScene(node.scene, { pose: node.pose });
      return motion.layout(moving(), () => { root.dataset.p34Pose = node.pose; }, 22);
    },
  });
  mountVisitEvents({ signal, canPlay: () => !conversation.talking && !worksLocked(getStory()),
    onLinger() {
      lingered = true; say('还没走呀。'); call.textContent = '刚才，你是不是想说什么？';
      void motion.animate(callPlace, [{ translate: '0 0' }, { translate: '0 -10px', offset: .4 }, { translate: '0 0' }], { duration: 1200 });
      motion.tone(4, true);
    },
  });
  listen(page, 'click', e => {
    const el = e.target.closest('[data-scene], [data-note], [data-find]'); if (!el) return;
    e.preventDefault();
    if (el.dataset.find) {
      const clue = el.dataset.find; found(clue);
      if (clue === 'draft-note') { say('这句，我本来想删掉的。', 'decode'); void motion.decode(reverse.querySelector('.p34-draft-text'), '如果做的东西没人喜欢，那它算不算做完了？'); }
      else if (clue === 'old-version') say('你翻出来啦。那一版，我也有点舍不得。');
      else if (clue === 'deleted-work') { found('empty-shelf'); say('嗯，这里原来放着一个没做完的东西。'); }
      return;
    }
    const target = el.dataset.note ? { view: 'post', noteId: el.dataset.note } : { view: el.dataset.scene, noteId: null };
    if (serializeSceneHash(scene) !== serializeSceneHash(target)) void applyScene(target, { source: el });
  });
  listen(page, 'pointerup', () => {
    const selection = getSelection();
    if (conversation.talking || !selection || selection.isCollapsed || !reading.contains(selection.anchorNode)) return;
    const text = selection.toString().trim();
    if (text.length > 3 && text.length < 50) say('你也停在这句了。我写的时候，想了好一会儿。');
  });
  listen(window, 'p34:story-sync', refresh);
  listen(page, 'pointerdown', () => motion.setSound(true), { once: true });
  signal.addEventListener('abort', () => clearTimeout(noticeTimer), { once: true });
  void applyScene(scene, { push: false, animate: false }); initial = false; refresh();
  return { page, headline, say, applyScene, refresh,
    destroy() { clearTimeout(noticeTimer); conversation.destroy(); page.remove(); },
  };
}
