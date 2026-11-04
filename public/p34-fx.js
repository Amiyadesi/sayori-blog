/**
 * Project 34 — Staged Particle Choreographer (Home & Blog)
 *
 * Action-staged particle compositions inspired by PixelFX (patch-gg/pixelfx, MIT License,
 * Copyright (c) 2026 Patch) and Sprite Fusion open-source VFX (Hugo Duprez, MIT License):
 *   - collectBurst: white-hot core flash + cross flare + fast outer ring + delayed softer inner ring
 *                   + turning/braking 4-point star glints with short ribbon tails + slow rising motes.
 *   - directionalSpark: lopsided directional cross ray + crisp diamond core + cone of fast sparks
 *                       + tumbling pixel chips that bounce off a local floor plane.
 *   - parryClash: X-slash impact flash + broken shockwave ring arcs + velocity-stretched two-tone
 *                 sparks + bouncing geometric shards (used for Breakout collisions & paddle catches).
 *   - manaNova: inward gathering streaks -> dual shockwave ring + flung arcane/optic sigils (◇ ✦ ⟡ ⟐ △)
 *               that decelerate, bob, and pop one by one into secondary star bursts.
 *   - homingVolley: 3-5 curving arcane/refraction bolts with twisted ribbon trails & rotating star heads
 *                   that fan out from a source and home in on target coordinates with staged impact pops.

 *
 * Strictly event-driven: runs RAF only while active emitters exist; stops immediately when idle,
 * hidden, reduced-motion, or aborted.
 */

const TAU = Math.PI * 2;

function clamp(v, min = 0, max = 1) {
  return v < min ? min : v > max ? max : v;
}

const ease = {
  outCubic: t => 1 - Math.pow(1 - clamp(t), 3),
  outQuart: t => 1 - Math.pow(1 - clamp(t), 4),
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t))),
  outBack: t => {
    const u = clamp(t) - 1;
    return 1 + 2.70158 * u * u * u + 1.70158 * u * u;
  },
};

// High-contrast daylight palettes: deep chromatic anchors + vivid midtones + bright cores
export const FX_PALETTES = {
  cyan: ['#203B48','#247888','#28B5C1','#76D7CF','#BAEEE3','#E9FFF5','#FFFFFF'],
  gold: ['#54412A','#B57525','#E9A440','#F6C668','#FFE5A9','#FFF6DC','#FFFFFF'],
  arcane: ['#512D38','#B64C42','#E96D51','#F9A17B','#FFD0A2','#FFF1DD','#FFFFFF'],
  blue: ['#202D35','#203591','#284CCE','#5D7BE6','#AEC5FF','#E1EDFF','#FFFFFF'],
};

const SIGIL_GLYPHS = ['◇', '✦', '⟡', '⟐', '△', '❖'];

function drawStarGlint(ctx, x, y, r, color, alpha = 1, rot = 0, rimColor = null) {
  if (r <= 0.2 || alpha <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.globalAlpha = clamp(alpha);
  const inner = r * 0.28;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const d = i % 2 === 0 ? r : inner;
    const px = Math.cos(a) * d;
    const py = Math.sin(a) * d;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (rimColor) {
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawDiamond(ctx, x, y, r, coreColor, rimColor, alpha = 1) {
  if (r <= 0.2 || alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha);
  if (rimColor) {
    ctx.fillStyle = rimColor;
    ctx.beginPath();
    ctx.moveTo(x, y - r - 2.8);
    ctx.lineTo(x + r + 2.8, y);
    ctx.lineTo(x, y + r + 2.8);
    ctx.lineTo(x - r - 2.8, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = coreColor;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTaperedRay(ctx, x, y, angle, length, width, color, alpha = 1, fromFrac = 0, rimColor = null) {
  if (length <= 1 || alpha <= 0.01) return;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const x0 = x + c * (length * fromFrac);
  const y0 = y + s * (length * fromFrac);
  const x1 = x + c * length;
  const y1 = y + s * length;
  const nx = -s * width;
  const ny = c * width;

  ctx.save();
  ctx.globalAlpha = clamp(alpha);
  ctx.beginPath();
  ctx.moveTo(x0 + nx, y0 + ny);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x0 - nx, y0 - ny);
  ctx.closePath();
  if (rimColor) {
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawSoftGlow(ctx, x, y, radius, color, alpha = 0.42) {
  if (radius <= 1 || alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha);
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, color);
  grad.addColorStop(0.48, color);
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawBrokenRing(ctx, x, y, radius, width, color, alpha = 1, segs = 5, gap = 0.32, rot = 0) {
  if (radius <= 1 || alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, width);
  ctx.lineCap = 'round';
  const step = TAU / segs;
  for (let i = 0; i < segs; i++) {
    const a0 = rot + i * step + step * gap * 0.5;
    const a1 = rot + (i + 1) * step - step * gap * 0.5;
    if (a1 <= a0) continue;
    ctx.beginPath();
    ctx.arc(x, y, radius, a0, a1);
    ctx.stroke();
  }
  ctx.restore();
}

export function createParticleStage({ signal, motion } = {}) {
  const emitters = new Set();
  let canvas = null;
  let ctx = null;
  let rafId = null;
  let lastNow = 0;
  let viewW = 1024;
  let viewH = 768;

  const isDisabled = () =>
    Boolean(signal?.aborted || document.hidden || (motion && motion.reduced()));

  function ensureCanvas() {
    if (canvas && canvas.isConnected) return true;
    if (typeof document === 'undefined' || !document.body) return false;
    canvas = document.createElement('canvas');
    canvas.className = 'p34-fx-stage';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText =
      'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9995;';
    document.body.append(canvas);
    ctx = canvas.getContext('2d');
    syncCanvasSize();
    return true;
  }

  function syncCanvasSize() {
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    viewW = window.innerWidth || document.documentElement.clientWidth || 1024;
    viewH = window.innerHeight || document.documentElement.clientHeight || 768;
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function stopLoop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (ctx && canvas) {
      ctx.clearRect(0, 0, viewW, viewH);
    }
  }

  function clearAll() {
    emitters.clear();
    stopLoop();
  }

  function tick(now) {
    rafId = null;
    if (isDisabled() || emitters.size === 0) {
      clearAll();
      return;
    }
    const dt = clamp((now - lastNow) / 1000, 0.001, 0.05);
    lastNow = now;

    ctx.clearRect(0, 0, viewW, viewH);
    for (const emitter of [...emitters]) {
      const alive = emitter.step(dt, ctx);
      if (!alive) emitters.delete(emitter);
    }

    if (emitters.size > 0) {
      rafId = requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, viewW, viewH);
    }
  }

  function spawnEmitter(emitter) {
    if (isDisabled()) return;
    if (!ensureCanvas()) return;
    if (emitters.size >= 22) {
      const oldest = emitters.values().next().value;
      if (oldest) emitters.delete(oldest);
    }
    emitters.add(emitter);
    if (rafId === null) {
      lastNow = performance.now();
      rafId = requestAnimationFrame(tick);
    }
  }

  /**
   * 1. Collect Burst (inspired by PixelFX pickups/collect-burst.js):
   *    - White-hot core flash & 4-way cross rays with chromatic rim
   *    - Fast thin outer ring + delayed softer secondary ring
   *    - 14 curving star glints with 4-point short trails & aerodynamic drag
   *    - 8 slow rising after-motes
   */
  function collectBurst(x, y, options = {}) {
    if (isDisabled()) return;
    const pal = FX_PALETTES[options.palette] || FX_PALETTES.cyan;
    const scale = options.scale || 1;
    const small = typeof innerWidth === 'number' && innerWidth <= 640;
    const starCount = small ? 10 : 15;
    const moteCount = small ? 5 : 8;

    const stars = Array.from({ length: starCount }, (_, i) => {
      const a = (i / starCount) * TAU + ((i * 1.7) % 0.4) - 0.2;
      const sp = (175 + ((i * 43) % 120)) * (i % 3 === 0 ? 1.18 : 0.9) * scale;
      return {
        x,
        y,
        a,
        sp,
        turn: (i % 2 ? 1 : -1) * (2.6 + (i % 4) * 0.75),
        life: 0.64 + (i % 4) * 0.12,
        age: 0,
        size: (i % 3 === 0 ? 7.2 : 4.4 + (i % 3)) * scale,
        trail: [],
        color: i % 4 === 0 ? pal[6] : i % 2 ? pal[3] : pal[2],
        rim: pal[1],
        phase: i * 1.1,
      };
    });

    const motes = Array.from({ length: moteCount }, (_, i) => ({
      x: x + (((i * 23) % 38) - 19) * scale,
      y: y + (((i * 13) % 22) - 9) * scale,
      vy: -(28 + (i % 4) * 14) * scale,
      life: 0.58 + (i % 3) * 0.16,
      delay: 0.06 + (i % 4) * 0.05,
      wobble: i * 1.3,
    }));

    let t = 0;
    const duration = 1.05;

    spawnEmitter({
      step(dt, c) {
        t += dt;
        if (t > duration) return false;

        for (const s of stars) {
          if (s.age > s.life) continue;
          s.age += dt;
          s.trail.unshift([s.x, s.y]);
          if (s.trail.length > 5) s.trail.pop();
          s.a += s.turn * dt * Math.max(0, 1 - s.age * 1.45);
          s.sp -= s.sp * 3.9 * dt;
          s.x += Math.cos(s.a) * s.sp * dt;
          s.y += Math.sin(s.a) * s.sp * dt + 14 * s.age * dt;
        }

        // Stage A: Core flash & cross flare (0 - 165ms)
        if (t < 0.085) {
          const k = 1 - t / 0.085;
          drawSoftGlow(c, x, y, 48 * scale, pal[3], 0.62 * k);
          drawDiamond(c, x, y, (11 * k + 2) * scale, pal[6], pal[2], k);
        }
        if (t < 0.17) {
          const k = 1 - t / 0.17;
          const L = 52 * scale * ease.outCubic(Math.min(1, t / 0.035 + 0.35)) * k;
          drawTaperedRay(c, x, y, 0, L, 3.6 * scale, pal[6], 0.94 * k, 0, pal[2]);
          drawTaperedRay(c, x, y, Math.PI, L, 3.6 * scale, pal[6], 0.94 * k, 0, pal[2]);
          drawTaperedRay(c, x, y, Math.PI / 2, L * 0.72, 2.8 * scale, pal[3], 0.88 * k, 0, pal[1]);
          drawTaperedRay(c, x, y, -Math.PI / 2, L * 0.72, 2.8 * scale, pal[3], 0.88 * k, 0, pal[1]);
        }

        // Stage B: Fast snapping outer ring + softer trailing inner ring
        const u1 = t / 0.34;
        if (u1 < 1) {
          const r = (6 + 54 * ease.outExpo(u1)) * scale;
          c.save();
          c.strokeStyle = u1 < 0.28 ? pal[2] : pal[3];
          c.globalAlpha = clamp(1.15 - u1 * 1.08);
          c.lineWidth = Math.max(1.2, 2.8 * (1 - u1 * 0.55) * scale);
          c.beginPath();
          c.arc(x, y, r, 0, TAU);
          c.stroke();
          c.restore();
        }

        const u2 = (t - 0.045) / 0.5;
        if (u2 > 0 && u2 < 1) {
          const r = (4 + 38 * ease.outCubic(u2)) * scale;
          c.save();
          c.strokeStyle = pal[4];
          c.globalAlpha = clamp((1 - u2) * 0.88);
          c.lineWidth = Math.max(1.2, 4.6 * (1 - u2) * scale);
          c.beginPath();
          c.arc(x, y, r, 0, TAU);
          c.stroke();
          c.restore();
        }

        // Stage C: Curving star glints with short ribbon tails
        for (const s of stars) {
          if (s.age > s.life) continue;
          const k = 1 - s.age / s.life;
          const tw = 0.7 + 0.3 * Math.sin(s.age * 26 + s.phase);
          if (s.trail.length > 1) {
            c.save();
            for (let i = 0; i < s.trail.length - 1; i++) {
              const [x0, y0] = s.trail[i];
              const [x1, y1] = s.trail[i + 1];
              c.strokeStyle = i < 2 ? pal[2] : pal[3];
              c.globalAlpha = clamp((1 - i / s.trail.length) * k * 0.85);
              c.lineWidth = Math.max(1.1, (3.0 - i * 0.5) * scale);
              c.lineCap = 'round';
              c.beginPath();
              c.moveTo(x0, y0);
              c.lineTo(x1, y1);
              c.stroke();
            }
            c.restore();
          }
          if (k < 0.24 && Math.sin(s.age * 38 + s.phase) < 0) continue;
          drawStarGlint(
            c,
            s.x,
            s.y,
            s.size * tw * Math.min(1, k * 2.2),
            s.color,
            0.95 * k,
            s.age * 3.4,
            s.rim
          );
        }

        // Stage D: Slow rising after-motes
        for (const m of motes) {
          const age = t - m.delay;
          if (age < 0 || age > m.life) continue;
          const k = 1 - age / m.life;
          const mx = m.x + Math.sin(age * 6.5 + m.wobble) * 4 * scale;
          const my = m.y + m.vy * age;
          drawSoftGlow(c, mx, my, 7 * scale, pal[3], 0.4 * k);
          c.save();
          c.fillStyle = k > 0.5 ? pal[2] : pal[3];
          c.globalAlpha = clamp(k * 0.95);
          c.fillRect(mx - 1.8 * scale, my - 1.8 * scale, 3.6 * scale, 3.6 * scale);
          c.restore();
        }

        return true;
      },
    });
  }

  /**
   * 2. Directional Hit Spark (inspired by PixelFX impacts/hit-spark.js):
   *    - Lopsided directional cross flare with one long ray along impact vector + crisp diamond core
   *    - Cone of fast directional sparks + tumbling square chips that bounce off a local floor
   */
  function directionalSpark(x, y, aimAngle = -Math.PI / 3, options = {}) {
    if (isDisabled()) return;
    const pal = FX_PALETTES[options.palette] || FX_PALETTES.cyan;
    const scale = options.scale || 1;
    const floorY = y + (options.floorOffset || 38) * scale;

    const rays = [
      { a: aimAngle, L: 64 * scale, w: 4.0 * scale },
      { a: aimAngle + Math.PI, L: 18 * scale, w: 3.2 * scale },
      { a: aimAngle - Math.PI / 2, L: 32 * scale, w: 3.4 * scale },
      { a: aimAngle + Math.PI / 2, L: 24 * scale, w: 3.0 * scale },
      { a: aimAngle - Math.PI / 4, L: 16 * scale, w: 2.0 * scale },
    ];

    const sparks = Array.from({ length: 13 }, (_, i) => {
      const a = aimAngle + (((i * 19) % 100) / 100 - 0.5) * 1.18;
      const v = (220 + ((i * 53) % 240)) * scale;
      return {
        x,
        y,
        px: x,
        py: y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 48 * scale,
        life: 0.3 + (i % 4) * 0.08,
        age: 0,
        color: i % 3 === 0 ? pal[2] : i % 2 ? pal[3] : FX_PALETTES.gold[2],
        tipColor: pal[6],
      };
    });

    const chips = Array.from({ length: 8 }, (_, i) => {
      const a = aimAngle + (((i * 31) % 100) / 100 - 0.5) * 1.45;
      const v = (95 + ((i * 37) % 135)) * scale;
      return {
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - (44 + (i % 3) * 28) * scale,
        rot: i * 0.8,
        vrot: (i % 2 ? 1 : -1) * 9.5,
        size: (3.4 + (i % 3) * 1.3) * scale,
        life: 0.45 + (i % 3) * 0.1,
        age: 0,
        color: i % 2 === 0 ? FX_PALETTES.gold[2] : pal[2],
      };
    });

    let t = 0;
    const duration = 0.65;

    spawnEmitter({
      step(dt, c) {
        t += dt;
        if (t > duration) return false;

        // Core diamond & directional cross rays
        if (t < 0.045) {
          drawSoftGlow(c, x, y, 48 * scale, pal[3], 0.58);
          for (const r of rays) drawTaperedRay(c, x, y, r.a, r.L, r.w, pal[6], 0.96, 0, pal[2]);
          drawDiamond(c, x, y, 8.2 * scale, pal[6], pal[2], 1);
        } else if (t < 0.095) {
          for (const r of rays) drawTaperedRay(c, x, y, r.a, r.L * 1.24, r.w * 0.58, pal[3], 0.9, 0.14, pal[1]);
          drawDiamond(c, x, y, 6.0 * scale, pal[6], pal[2], 0.92);
        } else if (t < 0.15) {
          const r = rays[0];
          drawTaperedRay(c, x, y, r.a, r.L * 1.38, 1.6 * scale, pal[2], 0.76, 0.38);
        }

        // Fast velocity-stretched two-tone directional sparks
        for (const s of sparks) {
          if (s.age > s.life) continue;
          s.age += dt;
          s.px = s.x;
          s.py = s.y;
          s.vy += 470 * scale * dt;
          s.vx *= 1 - 2.3 * dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          if (s.y > floorY && s.vy > 0) {
            s.y = floorY;
            s.vy = -s.vy * 0.48;
            s.vx *= 0.76;
          }
          const k = 1 - s.age / s.life;
          const speed = Math.hypot(s.vx, s.vy) || 1;
          const ux = s.vx / speed;
          const uy = s.vy / speed;
          const tailLen = Math.min(20 * scale, speed * 0.036);
          c.save();
          c.strokeStyle = s.color;
          c.globalAlpha = clamp(k * 0.96);
          c.lineWidth = Math.max(1.4, 2.8 * k * scale);
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(s.x - ux * tailLen, s.y - uy * tailLen);
          c.lineTo(s.x, s.y);
          c.stroke();
          c.fillStyle = s.tipColor;
          c.beginPath();
          c.arc(s.x, s.y, Math.max(1, 1.5 * k * scale), 0, TAU);
          c.fill();
          c.restore();
        }

        // Tumbling square chips
        for (const ch of chips) {
          if (ch.age > ch.life) continue;
          ch.age += dt;
          ch.vy += 520 * scale * dt;
          ch.x += ch.vx * dt;
          ch.y += ch.vy * dt;
          ch.rot += ch.vrot * dt;
          if (ch.y > floorY && ch.vy > 0) {
            ch.y = floorY;
            ch.vy = -ch.vy * 0.42;
            ch.vx *= 0.72;
          }
          const k = 1 - ch.age / ch.life;
          c.save();
          c.translate(ch.x, ch.y);
          c.rotate(ch.rot);
          c.fillStyle = ch.color;
          c.globalAlpha = clamp(k * 0.92);
          c.fillRect(-ch.size * 0.5, -ch.size * 0.5, ch.size, ch.size);
          c.restore();
        }

        return true;
      },
    });
  }

  /**
   * 3. Parry Clash (inspired by PixelFX impacts/parry.js):
   *    - X-slash clash rays + broken shockwave ring + directional spark fan
   *    - Ideal for Breakout ball collisions and paddle deflections
   */
  function parryClash(x, y, normalX = 0, normalY = -1, options = {}) {
    if (isDisabled()) return;
    const tier = options.tier || 1;
    const pal = FX_PALETTES[options.palette || (tier >= 3 ? 'gold' : 'cyan')] || FX_PALETTES.cyan;
    const scale = (options.scale || 1) * (tier >= 3 ? 1.22 : tier === 2 ? 1.08 : 0.95);
    const aimAngle = Math.atan2(normalY || -1, normalX || 0);

    directionalSpark(x, y, aimAngle, {
      palette: options.palette || (tier >= 3 ? 'gold' : 'cyan'),
      scale,
      floorOffset: 42,
    });

    let t = 0;
    const duration = 0.42;
    spawnEmitter({
      step(dt, c) {
        t += dt;
        if (t > duration) return false;
        const u = t / duration;
        // X-edge clash flash (first 90ms)
        if (t < 0.09) {
          const k = 1 - t / 0.09;
          const slashLen = 36 * scale * ease.outCubic(t / 0.09 + 0.2);
          drawTaperedRay(c, x, y, aimAngle - 0.65, slashLen, 3.2 * scale, pal[6], 0.95 * k, 0, pal[2]);
          drawTaperedRay(c, x, y, aimAngle + 0.65, slashLen, 3.2 * scale, pal[6], 0.95 * k, 0, pal[2]);
        }
        // Broken shockwave ring
        const r = (8 + 46 * ease.outQuart(u)) * scale;
        drawBrokenRing(
          c,
          x,
          y,
          r,
          3.2 * (1 - u) * scale,
          u < 0.3 ? pal[2] : pal[3],
          (1 - u) * 0.92,
          tier >= 2 ? 6 : 4,
          0.28,
          aimAngle + u * 1.4
        );
        return true;
      },
    });
  }

  /**
   * 4. Mana Nova / Sigil Burst (inspired by PixelFX arcane/mana-burst.js & arcane/_lib.js):
   *    - Inward gathering streaks (0 - 150ms)
   *    - Dual expanding shockwave rings + core cross flare
   *    - 6-8 glowing sigils (◇ ✦ ⟡ ⟐ △) flung outward that brake, bob, and pop into secondary stars!
   */
  function manaNova(x, y, options = {}) {
    if (isDisabled()) return;
    const pal = FX_PALETTES[options.palette] || FX_PALETTES.arcane;
    const scale = options.scale || 1;
    const small = typeof innerWidth === 'number' && innerWidth <= 640;
    const sigilCount = small ? 5 : 7;

    const gatherStreaks = Array.from({ length: small ? 10 : 16 }, (_, i) => {
      const a = (i / (small ? 10 : 16)) * TAU + (i % 3) * 0.14;
      const dist = (42 + (i % 4) * 14) * scale;
      return { a, dist, color: i % 2 === 0 ? pal[3] : FX_PALETTES.gold[3] };
    });

    const sigils = Array.from({ length: sigilCount }, (_, i) => {
      const a = (i / sigilCount) * TAU + 0.25;
      const sp = (150 + (i % 3) * 42) * scale;
      return {
        glyph: SIGIL_GLYPHS[i % SIGIL_GLYPHS.length],
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.82 - 18 * scale,
        popAt: 0.44 + i * 0.055,
        popped: false,
        color: i % 2 === 0 ? pal[2] : FX_PALETTES.gold[2],
      };
    });

    const secondaryStars = [];
    let released = false;
    let t = 0;
    const RELEASE = 0.14;
    const duration = 0.98;

    spawnEmitter({
      step(dt, c) {
        t += dt;
        if (t > duration) return false;

        // Phase 1: Inward gathering streaks (0 -> RELEASE)
        if (t < RELEASE) {
          const u = t / RELEASE;
          const k = ease.outCubic(u);
          drawSoftGlow(c, x, y, (18 + 26 * k) * scale, pal[3], 0.45 * k);
          for (const gs of gatherStreaks) {
            const r0 = gs.dist * (1 - k * 0.85);
            const r1 = gs.dist * Math.max(0, 1 - k * 1.15);
            c.save();
            c.strokeStyle = gs.color;
            c.globalAlpha = clamp(0.4 + 0.6 * u);
            c.lineWidth = 2.2 * scale;
            c.lineCap = 'round';
            c.beginPath();
            c.moveTo(x + Math.cos(gs.a) * r0, y + Math.sin(gs.a) * r0);
            c.lineTo(x + Math.cos(gs.a) * r1, y + Math.sin(gs.a) * r1);
            c.stroke();
            c.restore();
          }
          return true;
        }

        const rt = t - RELEASE;
        if (!released) {
          released = true;
        }

        // Phase 2: Release flash + dual rings
        if (rt < 0.14) {
          const k = 1 - rt / 0.14;
          drawSoftGlow(c, x, y, 64 * scale, pal[3], 0.65 * k);
          const L = 58 * scale * k;
          for (let i = 0; i < 4; i++) {
            drawTaperedRay(c, x, y, (i * Math.PI) / 2, L, 3.8 * scale, pal[6], 0.95 * k, 0, pal[2]);
            drawTaperedRay(c, x, y, (i * Math.PI) / 2 + Math.PI / 4, L * 0.6, 2.4 * scale, FX_PALETTES.gold[4], 0.85 * k, 0, FX_PALETTES.gold[2]);
          }
        }

        const ru1 = rt / 0.36;
        if (ru1 < 1) {
          const rr = (8 + 68 * ease.outExpo(ru1)) * scale;
          c.save();
          c.strokeStyle = ru1 < 0.3 ? pal[2] : pal[3];
          c.globalAlpha = clamp((1 - ru1) * 0.92);
          c.lineWidth = Math.max(1.2, 3.2 * (1 - ru1 * 0.6) * scale);
          c.beginPath();
          c.arc(x, y, rr, 0, TAU);
          c.stroke();
          c.restore();
        }

        // Phase 3: Flung sigils decelerate, bob, and pop into secondary stars
        for (const sg of sigils) {
          if (rt < sg.popAt) {
            sg.vx *= 1 - 3.4 * dt;
            sg.vy *= 1 - 3.4 * dt;
            sg.x += sg.vx * dt;
            sg.y += sg.vy * dt + Math.sin(rt * 18) * 12 * dt;
            const pulse = 0.88 + 0.18 * Math.sin(rt * 24);
            drawSoftGlow(c, sg.x, sg.y, 14 * scale, sg.color, 0.38);
            c.save();
            c.font = `700 ${Math.round(15 * scale * pulse)}px "JetBrains Mono", system-ui, sans-serif`;
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillStyle = sg.color;
            c.fillText(sg.glyph, sg.x, sg.y);
            c.restore();
          } else if (!sg.popped) {
            sg.popped = true;
            for (let k = 0; k < 4; k++) {
              const sa = (k * Math.PI) / 2 + 0.35;
              const ssp = (55 + k * 14) * scale;
              secondaryStars.push({
                x: sg.x,
                y: sg.y,
                vx: Math.cos(sa) * ssp,
                vy: Math.sin(sa) * ssp,
                age: 0,
                life: 0.28,
                color: sg.color,
              });
            }
          }
        }

        for (const st of secondaryStars) {
          st.age += dt;
          if (st.age > st.life) continue;
          st.x += st.vx * dt;
          st.y += st.vy * dt;
          const k = 1 - st.age / st.life;
          drawStarGlint(c, st.x, st.y, 5.2 * k * scale, pal[6], k * 0.95, st.age * 8, st.color);
        }

        return true;
      },
    });
  }

  function homingVolley(fromX, fromY, targets = [], options = {}) {
    if (isDisabled() || !targets.length) return;
    const pal = FX_PALETTES[options.palette] || FX_PALETTES.cyan;
    const count = Math.min(5, Math.max(2, targets.length));

    const bolts = Array.from({ length: count }, (_, i) => {
      const tgt = targets[i % targets.length];
      const baseAngle = Math.atan2(tgt.y - fromY, tgt.x - fromX);
      const fanAngle = baseAngle + (i - (count - 1) * 0.5) * 0.68;
      const initSpeed = 250 + (i % 3) * 48;
      return {
        x: fromX,
        y: fromY,
        vx: Math.cos(fanAngle) * initSpeed,
        vy: Math.sin(fanAngle) * initSpeed,
        tx: tgt.x,
        ty: tgt.y,
        onHit: tgt.onHit || null,
        t0: i * 0.045,
        on: false,
        hitAt: -1,
        twist: i * 1.4,
        trail: [],
      };
    });

    const pops = [];
    let t = 0;

    spawnEmitter({
      step(dt, c) {
        t += dt;
        if (t > 1.35) return false;

        let anyActive = false;
        for (const b of bolts) {
          if (t < b.t0) {
            anyActive = true;
            continue;
          }
          if (!b.on) {
            b.on = true;
            b.trail.push([b.x, b.y]);
          }
          if (b.hitAt < 0) {
            anyActive = true;
            const age = t - b.t0;
            const dx = b.tx - b.x;
            const dy = b.ty - b.y;
            const dist = Math.hypot(dx, dy) || 1;
            const speed = 290 + 990 * age * age;
            const steer = Math.min(1, (2.5 + 18 * age) * dt);
            b.vx += ((dx / dist) * speed - b.vx) * steer;
            b.vy += ((dy / dist) * speed - b.vy) * steer;
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.trail.unshift([b.x, b.y]);
            if (b.trail.length > 15) b.trail.pop();

            if (dist < 14 || age > 0.68) {
              b.hitAt = t;
              b.x = b.tx;
              b.y = b.ty;
              pops.push({ t, x: b.tx, y: b.ty });
              if (typeof b.onHit === 'function') {
                b.onHit();
              }
            }
          }

          // Draw high-contrast two-layer ribbon trail
          const fade = b.hitAt < 0 ? 1 : 1 - clamp((t - b.hitAt) / 0.24);
          if (fade > 0.02 && b.trail.length > 1) {
            anyActive = true;
            c.save();
            for (let i = 0; i < b.trail.length - 1; i++) {
              const [x0, y0] = b.trail[i];
              const [x1, y1] = b.trail[i + 1];
              const u = i / b.trail.length;
              c.strokeStyle = u < 0.28 ? pal[2] : u < 0.65 ? pal[3] : pal[4];
              c.globalAlpha = clamp((1 - u) * fade * 0.92);
              c.lineWidth = Math.max(1.2, (1 - u) * 5.8);
              c.lineCap = 'round';
              c.beginPath();
              c.moveTo(x0, y0);
              c.lineTo(x1, y1);
              c.stroke();
            }
            c.restore();
          }

          // Draw spinning bolt head
          if (b.hitAt < 0) {
            drawSoftGlow(c, b.x, b.y, 24, pal[3], 0.58);
            drawStarGlint(c, b.x, b.y, 9.2, pal[6], 0.98, t * 14 + b.twist, pal[2]);
          }
        }

        // Draw arrival pops
        for (const p of pops) {
          const q = (t - p.t) / 0.34;
          if (q >= 0 && q < 1) {
            anyActive = true;
            if (q < 0.24) {
              const r = 15 * (1 - q / 0.24) + 2;
              drawSoftGlow(c, p.x, p.y, r * 2.4, pal[3], 0.68);
              drawDiamond(c, p.x, p.y, r * 0.68, pal[6], pal[2], 0.96);
            }
            const rr = 4 + 34 * ease.outCubic(q);
            c.save();
            c.strokeStyle = q < 0.35 ? pal[2] : pal[3];
            c.globalAlpha = clamp((1 - q) * 0.92);
            c.lineWidth = Math.max(1.2, 3.4 * (1 - q));
            c.beginPath();
            c.arc(p.x, p.y, rr, 0, TAU);
            c.stroke();
            c.restore();
          }
        }

        return anyActive;
      },
    });
  }

  window.addEventListener('resize', syncCanvasSize, { signal });
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) clearAll();
    },
    { signal }
  );
  signal?.addEventListener(
    'abort',
    () => {
      clearAll();
      canvas?.remove();
      canvas = null;
      ctx = null;
    },
    { once: true }
  );

  return {
    collectBurst,
    directionalSpark,
    parryClash,
    manaNova,
    homingVolley,
    clearAll,
  };
}
