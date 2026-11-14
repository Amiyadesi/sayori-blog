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
  const layer = document.createElement('div');
  layer.className = 'space-passage'; layer.inert = true; layer.setAttribute('aria-hidden', 'true');
  const wings = [-1, 1].map(side => {
    const wing = document.createElement('div');
    wing.className = 'space-passage-wall';
    Object.assign(wing.style, { background: page.color, left: side < 0 ? '0' : '50%', transformOrigin: side < 0 ? 'left center' : 'right center' });
    layer.append(wing);
    return [wing, side];
  });
  shell.append(layer);
  const cancel = () => {
    layer.getAnimations({ subtree: true }).forEach(a => a.cancel());
    layer.remove();
    if (passages.get(shell) === cancel) passages.delete(shell);
  };
  passages.set(shell, cancel);
  await Promise.all(wings.map(([wing, side]) => motion.animate(wing, [
    { transform: 'translateX(0) rotateY(0deg)', filter: 'brightness(1)' },
    { transform: `translateX(${side * 36}%) rotateY(${side * -14}deg)`, filter: 'brightness(.7)', offset: .45 },
    { transform: `translateX(${side * 110}%) rotateY(${side * -22}deg)`, filter: 'brightness(.5)' },
  ], { duration: 1100, direction: entering ? 'normal' : 'reverse', easing: 'cubic-bezier(.45,0,.2,1)', fill: 'both' })));
  cancel();
}
