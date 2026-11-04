const passages = new WeakMap();
export function cancelPassage(shell) { passages.get(shell)?.(); }

export function capturePage() {
  const words = [...document.querySelectorAll('h1, .entry-title, .letter-title, h2 a, nav a')].flatMap(el => {
    const rect = el.getBoundingClientRect(), text = el.textContent.trim();
    if (!text || !rect.width || rect.bottom < 0 || rect.top > innerHeight) return [];
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden') return [];
    return [{ el, text: text.slice(0, 40), x: rect.x, y: rect.y, width: rect.width, font: style.font, color: style.color, spacing: style.letterSpacing }];
  }).slice(0, 8);
  const surface = [...document.querySelectorAll('main'), document.body, document.documentElement]
    .map(el => getComputedStyle(el).backgroundColor).find(color => color !== 'rgba(0, 0, 0, 0)');
  return { words, color: surface || '#e8ecf3', width: innerWidth, height: innerHeight };
}

export async function playPassage(shell, page, motion, entering) {
  cancelPassage(shell);
  if (motion.reduced() || document.hidden) return;
  const anchors = [...shell.querySelectorAll('.space-voice, .space-path[data-visible="true"]')];
  const rects = anchors.map(el => el.getBoundingClientRect());
  const layer = document.createElement('div');
  layer.className = 'space-passage'; layer.inert = true; layer.setAttribute('aria-hidden', 'true');
  const veil = document.createElement('div'), sweep = document.createElement('div');
  veil.className = 'space-passage-veil'; veil.style.background = page.color;
  sweep.className = 'space-passage-sweep'; layer.append(veil, sweep); shell.append(layer);
  const cancel = () => {
    for (const el of [layer, ...anchors]) el.getAnimations({ subtree: el === layer }).forEach(a => a.cancel());
    layer.remove();
    if (passages.get(shell) === cancel) passages.delete(shell);
  };
  passages.set(shell, cancel);
  const jobs = [
    motion.animate(veil, entering ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }], { duration: entering ? 820 : 760, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' }),
    motion.animate(sweep, [
      { transform: `translateX(${entering ? '-110' : '170'}vw) rotate(-20deg)`, opacity: 0 },
      { opacity: .7, offset: .25 },
      { transform: `translateX(${entering ? '170' : '-110'}vw) rotate(-20deg)`, opacity: 0 },
    ], { duration: 1100, easing: 'cubic-bezier(.3,0,.2,1)' }),
  ];
  page.words.forEach((word, i) => {
    const target = rects[i % rects.length], ghost = document.createElement('span');
    ghost.className = 'space-transit-word'; ghost.textContent = word.text;
    Object.assign(ghost.style, { left: `${word.x * innerWidth / page.width}px`, top: `${word.y * innerHeight / page.height}px`, width: `${word.width}px`, font: word.font, color: word.color, letterSpacing: word.spacing });
    layer.append(ghost);
    const dx = target.x - word.x * innerWidth / page.width, dy = target.y - word.y * innerHeight / page.height;
    const frames = [
      { transform: 'translate3d(0,0,0) rotate(0deg) scale(1)', opacity: 1 },
      { transform: `translate3d(${dx * .5 + (i % 2 ? -32 : 32)}px,${dy * .5 - 45}px,0) rotate(${i % 2 ? -12 : 10}deg) scale(.8)`, opacity: .65, color: '#ddf2ff', offset: .52 },
      { transform: `translate3d(${dx}px,${dy}px,0) rotate(0deg) scale(.2)`, opacity: 0 },
    ];
    jobs.push(motion.animate(ghost, frames, { duration: entering ? 850 : 650, delay: i * 22, direction: entering ? 'normal' : 'reverse', fill: 'both' }));
  });
  anchors.forEach((el, i) => {
    const from = page.words.length ? page.words[i % page.words.length] : null;
    const dx = from ? from.x - rects[i].x : innerWidth * .12;
    const dy = from ? from.y - rects[i].y : innerHeight * .1;
    jobs.push(motion.animate(el, [
      { translate: `${dx * .55}px ${dy * .55}px`, scale: '.86', opacity: 0 },
      { translate: '0px 0px', scale: '1', opacity: 1 },
    ], { duration: entering ? 1000 : 560, delay: entering ? 130 + i * 45 : i * 24, direction: entering ? 'normal' : 'reverse', fill: entering ? 'backwards' : 'both' }));
  });
  await Promise.all(jobs);
  layer.remove();
  if (passages.get(shell) === cancel) passages.delete(shell);
}
