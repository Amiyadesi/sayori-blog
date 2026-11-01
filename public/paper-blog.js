import { mountLivingWorld } from './p34-living.js?v=20261101-r5';
import { sayLine } from './p34-voice.js';

// 她的语气还在定稿，这两句只是占位。
const LINES = {
  first: '……你也翻到这一页了。',
  back: '这里我改过几个字。',
};

let mounted = null;

export function mountPaperBlog() {
  if (new URLSearchParams(location.search).get('paper') !== '0617') return () => {};
  if (mounted) return mounted;

  const stop = mountLivingWorld();
  const host = document.querySelector('.desk-intro, #main, .desk-shell, main') || document.body;

  let box = document.querySelector('.p34-voice');
  if (!box) {
    box = document.createElement('p');
    box.className = 'p34-voice';
    box.setAttribute('aria-live', 'polite');
    box.style.cssText = 'margin:18px 0 0;font-size:14px;line-height:1.9;letter-spacing:.02em;opacity:.9;min-height:1.9em;';
    host.insertAdjacentElement('afterbegin', box);
  }

  const seen = /p34_world_v1/.test(document.cookie) && !/v1\.none\./.test(decodeURIComponent(document.cookie));
  const timer = setTimeout(() => {
    sayLine(box, seen ? LINES.back : LINES.first, { hold: 3000 });
  }, 2400);

  mounted = () => { clearTimeout(timer); stop && stop(); mounted = null; };
  return mounted;
}
