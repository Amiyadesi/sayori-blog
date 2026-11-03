// World coordinates are CSS pixels before the viewport scale. y is the caret's feet.
export const WALK_LEVELS = [
  { name: '先在一句话上站稳。', hint: '← → 移动，空格或 ↑ 跳。走到最后的句号。', width: 1450,
    words: [
      ['start','从这里，出发。',35,365,195], ['a','轻轻一跳',290,295,145], ['b','别着急',505,345,120], ['c','向上看',695,270,135], ['d','风把这一行吹远了',925,325,225], ['goal','到了。',1270,270,125],
    ], star: [756,193], goal: 'goal' },
  { name: '借一句话，搭一座桥。', hint: '拖动带下划线的那句，放好再跳。也可选中它，按 Shift + 方向键挪动。', width: 1500,
    words: [
      ['start','脚下的字很稳。',35,365,200], ['bridge','这句话借给你',335,225,200,'drag'], ['a','这里有点远',650,335,180], ['b','往高处看看',930,265,155], ['goal','又见到你啦。',1210,330,205],
    ], star: [1010,185], goal: 'goal', bounds: [250,590,210,380] },
  { name: '有些话，会让人跳起来。', hint: '在「弹一下」上落脚。括号会把你接到另一句。', width: 1860,
    words: [
      ['start','准备好了？',35,365,190], ['spring','弹一下',315,330,130,'spring'], ['a','这句跳得很高',535,155,200], ['b','先歇一歇',835,220,160], ['portal','（下一行',1090,285,145,'portal'], ['arrival','就在这里）',1390,335,170], ['goal','收好这阵风。',1655,265,170],
    ], star: [920,140], goal: 'goal', portal: ['portal','arrival'] },
  { name: '把这些话，连成一段旅行。', hint: '借来的句子、会弹的词和括号。现在它们都认识你了。', width: 2270,
    words: [
      ['start','这回，你来写。',35,365,205], ['bridge','借我一点点',345,230,195,'drag'], ['spring','再弹一下',665,330,155,'spring'], ['a','把话说到一半',920,155,200], ['portal','（然后呢',1210,220,155,'portal'], ['arrival','接着写下去）',1575,345,195], ['b','再走一小段',1870,275,180], ['goal','晚安，句号。',2140,335,125],
    ], star: [1010,77], goal: 'goal', bounds: [260,610,210,380], portal: ['portal','arrival'] },
];

export function makeWalker(platform) {
  return { x: platform.x + 28, y: platform.y, vx: 0, vy: 0, ground: platform.id, coyote: .12, buffer: 0, jumpHeld: false, springJump: false };
}
export function stepWalker(p, input, platforms, dt = 1 / 120) {
  const events = [];
  p.buffer = input.jumpPressed ? .13 : Math.max(0, p.buffer - dt);
  p.coyote = p.ground ? .12 : Math.max(0, p.coyote - dt);
  const target = (input.axis || 0) * 265;
  p.vx += (target - p.vx) * Math.min(1, dt * (p.ground ? 20 : 11));
  if (p.buffer > 0 && p.coyote > 0) {
    p.vy = -570; p.buffer = 0; p.coyote = 0; p.ground = null; p.springJump = false; events.push('jump');
  }
  if (!input.jumpHeld && p.jumpHeld && p.vy < -260 && !p.springJump) p.vy = -260;
  p.jumpHeld = input.jumpHeld;
  const before = p.y;
  p.x += p.vx * dt; p.vy += 1500 * dt; p.y += p.vy * dt;
  p.ground = null;
  if (p.vy >= 0) {
    const below = platforms.filter(w => p.x + 7 > w.x && p.x - 7 < w.x + w.w && before <= w.y + 2 && p.y >= w.y).sort((a,b) => a.y - b.y)[0];
    if (below) {
      p.y = below.y; p.ground = below.id;
      if (p.vy > 90) events.push('land');
      p.vy = 0; p.springJump = false;
      if (below.kind === 'spring') { p.vy = -865; p.ground = null; p.coyote = 0; p.springJump = true; events.push('bounce'); }
    }
  }
  if (p.y > 550) events.push('fall');
  return events;
}
