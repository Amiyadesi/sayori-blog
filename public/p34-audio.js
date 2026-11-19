// Procedural spatial Web Audio soundscape for P34 threshold spaces.
// Runs entirely client-side with zero external audio assets and obeys motion.sound / visibility.

export function createWorldAudio({ motion, signal } = {}) {
  const docHidden = () => typeof document !== 'undefined' && document.hidden;
  let ctx = null;
  let master = null;
  let roomSend = null;
  let noiseBuffer = null;
  let active = Boolean(motion?.sound);
  let disposed = false;
  let currentLayer = null;
  let ambientNodes = [];
  let rainPanner = null;
  let rainGain = null;
  let rainDropTimer = 0.6;
  let carEchoTimer = 9;
  let walkerStepAccum = 0;
  let lastWalkerPos = null;
  let lastMothY = null;
  let mothFlutterCooldown = 0;
  let gardenSky = 'afternoon';

  function ensureContext() {
    if (disposed || typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = active && !docHidden() ? 0.72 : 0;

      // Subtle short liminal room tail (2 cross-fed lowpass taps)
      const delayA = ctx.createDelay(0.5);
      const delayB = ctx.createDelay(0.5);
      delayA.delayTime.value = 0.047;
      delayB.delayTime.value = 0.089;
      const damp = ctx.createBiquadFilter();
      damp.type = 'lowpass';
      damp.frequency.value = 1450;
      const fb = ctx.createGain();
      fb.gain.value = 0.24;
      const wet = ctx.createGain();
      wet.gain.value = 0.28;

      roomSend = ctx.createGain();
      roomSend.gain.value = 1;
      roomSend.connect(delayA);
      delayA.connect(delayB);
      delayB.connect(damp);
      damp.connect(fb);
      fb.connect(delayA);
      damp.connect(wet);
      wet.connect(master);

      master.connect(ctx.destination);

      // Shared 2.5s pink-ish noise buffer
      const length = Math.floor(ctx.sampleRate * 2.5);
      noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.0990460;
        b1 = 0.96300 * b1 + w * 0.2965164;
        b2 = 0.57000 * b2 + w * 1.0526913;
        data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
      }
    }
    if (ctx.state === 'suspended' && active && !docHidden()) {
      void ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function clearAmbient() {
    for (const entry of ambientNodes) {
      try { entry.stop?.(); } catch {}
      try { entry.disconnect?.(); } catch {}
    }
    ambientNodes = [];
    rainPanner = null;
    rainGain = null;
  }

  function buildAmbient(layerId) {
    clearAmbient();
    if (!active || docHidden() || !layerId) return;
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime;

    const addNoise = (type, freq, q, gainVal, panVal = 0) => {
      const src = ac.createBufferSource();
      src.buffer = noiseBuffer;
      src.loop = true;
      const filter = ac.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = freq * ({ morning: 1.12, afternoon: 1, dusk: .9, midnight: .74 }[gardenSky]);
      filter.Q.value = q;
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(gainVal * (gardenSky === 'midnight' ? .78 : 1), now + 0.8);
      const pan = ac.createStereoPanner();
      pan.pan.value = panVal;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(pan);
      pan.connect(master);
      src.start(now, Math.random() * 1.5);
      ambientNodes.push(src, filter, gain, pan);
      return { src, filter, gain, pan };
    };

    const addHum = (freq, gainVal, type = 'sine') => {
      const osc = ac.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(gainVal, now + 0.9);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      ambientNodes.push(osc, gain);
      return { osc, gain };
    };

    if (layerId === 'atrium') {
      // Fluorescent ballast hum + distant HVAC corridor draft
      addHum(60, 0.012, 'sine');
      addHum(120, 0.006, 'triangle');
      addNoise('bandpass', 260, 0.9, 0.045, -0.1);
      addNoise('lowpass', 180, 0.7, 0.032, 0.12);
    } else if (layerId === 'stacks') {
      // Deep cavernous archive resonance + cold high draft
      addHum(52, 0.011, 'sine');
      addNoise('bandpass', 175, 1.4, 0.052, 0);
      addNoise('bandpass', 580, 2.2, 0.015, 0.15);
    } else if (layerId === 'loft') {
      // Warm desk-room hum + spatialized rain outside the north window
      addHum(65, 0.008, 'sine');
      addNoise('lowpass', 210, 0.7, 0.025, 0);
      const rainBed = addNoise('bandpass', 920, 0.65, 0.048, 0);
      rainPanner = rainBed.pan;
      rainGain = rainBed.gain;
      addNoise('bandpass', 320, 0.8, 0.032, 0);
    } else if (layerId === 'library') {
      addNoise('lowpass', 230, 0.6, 0.024, 0);
      addNoise('bandpass', 520, 1.1, 0.012, 0);
    }
  }

  function setEnabled(next) {
    active = Boolean(next);
    if (!active) {
      if (master && ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      clearAmbient();
      return;
    }
    const ac = ensureContext();
    if (ac && master && !docHidden()) {
      master.gain.setTargetAtTime(0.72, ac.currentTime, 0.12);
      if (currentLayer) buildAmbient(currentLayer);
    }
  }

  function setLayer(layerId) {
    if (currentLayer === layerId) return;
    currentLayer = layerId;
    lastWalkerPos = null;
    lastMothY = null;
    if (active) buildAmbient(layerId);
  }

  function spatialPanAndGain(player, tx, tz, maxDist = 14) {
    const dx = tx - player.x;
    const dz = tz - player.z;
    const dist = Math.hypot(dx, dz);
    if (dist > maxDist) return { pan: 0, gain: 0, dist };
    const rightX = Math.cos(player.yaw);
    const rightZ = -Math.sin(player.yaw);
    const pan = Math.max(-0.85, Math.min(0.85, (dx * rightX + dz * rightZ) / Math.max(1.5, dist)));
    const gain = Math.max(0, 1 - dist / maxDist) ** 1.4;
    return { pan, gain, dist };
  }

  function playNoiseBurst({ freq = 900, freqEnd = freq, q = 1.2, duration = 0.08, gain = 0.08, pan = 0, wet = 0.35 }) {
    if (!active || docHidden()) return;
    const ac = ensureContext();
    if (!ac || ac.state === 'suspended') return;
    const now = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, now);
    if (freqEnd !== freq) filter.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);
    filter.Q.value = q;
    const env = ac.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(gain, now + Math.min(0.012, duration * 0.25));
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    const panner = ac.createStereoPanner();
    panner.pan.value = Math.max(-0.9, Math.min(0.9, pan));
    src.connect(filter);
    filter.connect(env);
    env.connect(panner);
    panner.connect(master);
    if (wet > 0) {
      const wetGain = ac.createGain();
      wetGain.gain.value = wet;
      panner.connect(wetGain);
      wetGain.connect(roomSend);
      src.onended = () => {
        src.disconnect(); filter.disconnect(); env.disconnect(); panner.disconnect(); wetGain.disconnect();
      };
    } else {
      src.onended = () => { src.disconnect(); filter.disconnect(); env.disconnect(); panner.disconnect(); };
    }
    src.start(now, Math.random() * 1.4, duration + 0.03);
    src.stop(now + duration + 0.04);
  }

  function playTone({ freq = 440, freqEnd = freq, type = 'sine', duration = 0.4, gain = 0.05, pan = 0, attack = 0.008, wet = 0.45 }) {
    if (!active || docHidden()) return;
    const ac = ensureContext();
    if (!ac || ac.state === 'suspended') return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    const env = ac.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(gain, now + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    const panner = ac.createStereoPanner();
    panner.pan.value = Math.max(-0.9, Math.min(0.9, pan));
    osc.connect(env);
    env.connect(panner);
    panner.connect(master);
    if (wet > 0) {
      const wetGain = ac.createGain();
      wetGain.gain.value = wet;
      panner.connect(wetGain);
      wetGain.connect(roomSend);
      osc.onended = () => { osc.disconnect(); env.disconnect(); panner.disconnect(); wetGain.disconnect(); };
    } else {
      osc.onended = () => { osc.disconnect(); env.disconnect(); panner.disconnect(); };
    }
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function playFootstep(surfaceKind = 'tile', sprinting = false) {
    if (!active || docHidden()) return;
    const jitter = 0.92 + Math.random() * 0.16;
    const amp = sprinting ? 1.25 : 0.9;
    if (surfaceKind === 'water') {
      playNoiseBurst({ freq: 2100 * jitter, freqEnd: 680, q: .6, duration: .15, gain: .026 * amp, wet: .45 });
      playTone({ freq: 780 * jitter, freqEnd: 390, duration: .14, gain: .017 * amp, attack: .003, wet: .55 });
    } else if (surfaceKind === 'bridge') {
      playTone({ freq: 520 * jitter, freqEnd: 460 * jitter, type: 'sine', duration: 0.16, gain: 0.022 * amp, wet: 0.7 });
      playNoiseBurst({ freq: 1450 * jitter, q: 2.2, duration: 0.045, gain: 0.025 * amp, wet: 0.6 });
    } else if (surfaceKind === 'wood') {
      playTone({ freq: 132 * jitter, freqEnd: 68 * jitter, type: 'triangle', duration: 0.085, gain: 0.042 * amp, attack: 0.003, wet: 0.35 });
      playNoiseBurst({ freq: 420 * jitter, freqEnd: 240, q: 1.4, duration: 0.055, gain: 0.032 * amp, wet: 0.35 });
    } else {
      // Tile / concrete liminal heel tap
      playTone({ freq: 165 * jitter, freqEnd: 82 * jitter, type: 'sine', duration: 0.055, gain: 0.028 * amp, attack: 0.002, wet: 0.5 });
      playNoiseBurst({ freq: 780 * jitter, freqEnd: 420, q: 1.6, duration: 0.04, gain: 0.03 * amp, wet: 0.5 });
    }
  }

  function playInteraction(kind, variant = 0) {
    if (!active || docHidden()) return;
    if (kind === 'chime') {
      const notes = [[523.25, 587.33, 659.25, 783.99, 880], [659.25, 739.99, 830.61, 987.77, 1108.73], [261.63, 293.66, 329.63, 392, 440]][variant];
      notes.forEach((freq, i) => { setTimeout(() => {
        playTone({ freq, duration: 1.8 + i * .1, gain: .023, attack: .003, wet: .65 });
        playTone({ freq: freq * 2.76, duration: .42, gain: .003, attack: .002, wet: .4 });
      }, i * 75); });
    } else if (kind === 'water') {
      playFootstep('water');
    } else if (kind === 'fork') {
      // Realistic twin-tine metallic tuning fork beating harmonics
      playTone({ freq: 440, type: 'sine', duration: 2.3, gain: 0.055, attack: 0.004, wet: 0.65 });
      playTone({ freq: 441.7, type: 'sine', duration: 2.2, gain: 0.052, attack: 0.004, wet: 0.65 });
      playTone({ freq: 1318, type: 'sine', duration: 0.85, gain: 0.015, attack: 0.003, wet: 0.5 });
    } else if (kind === 'lamp') {
      playNoiseBurst({ freq: 1900, freqEnd: 950, q: 2.5, duration: 0.03, gain: 0.05, wet: 0.3 });
      playTone({ freq: 587.3, freqEnd: 523.2, type: 'sine', duration: 0.45, gain: 0.025, wet: 0.5 });
    } else if (kind === 'paper' || kind === 'book' || kind === 'clue') {
      playNoiseBurst({ freq: 1150, freqEnd: 2300, q: 1.1, duration: 0.13, gain: 0.055, pan: -0.1, wet: 0.25 });
      setTimeout(() => playNoiseBurst({ freq: 1700, freqEnd: 900, q: 1.3, duration: 0.09, gain: 0.035, pan: 0.1, wet: 0.25 }), 70);
    } else if (kind === 'flip') {
      playNoiseBurst({ freq: 1850, freqEnd: 880, q: 1.3, duration: 0.11, gain: 0.05, wet: 0.2 });
    } else if (kind === 'pillar') {
      playTone({ freq: 210, freqEnd: 112, type: 'triangle', duration: 0.24, gain: 0.055, attack: 0.005, wet: 0.6 });
      playNoiseBurst({ freq: 520, freqEnd: 280, q: 2.0, duration: 0.11, gain: 0.04, wet: 0.45 });
    } else if (kind === 'unlock') {
      [220, 329.63, 493.88].forEach((f, i) => {
        setTimeout(() => playTone({ freq: f, type: 'sine', duration: 1.5, gain: 0.04, attack: 0.03, wet: 0.7 }), i * 110);
      });
    } else if (kind === 'shelf') {
      playNoiseBurst({ freq: 240, freqEnd: 135, q: 0.9, duration: 1.45, gain: 0.065, pan: -0.15, wet: 0.55 });
      playTone({ freq: 76, freqEnd: 58, type: 'triangle', duration: 1.4, gain: 0.038, attack: 0.08, wet: 0.5 });
    } else if (kind === 'portal') {
      playNoiseBurst({ freq: 210, freqEnd: 480, q: 1.5, duration: 0.45, gain: 0.042, wet: 0.7 });
      playTone({ freq: 196, freqEnd: 146.8, type: 'sine', duration: 0.55, gain: 0.025, attack: 0.04, wet: 0.7 });
    } else if (kind === 'terminal') {
      playNoiseBurst({ freq: 2400, q: 3.2, duration: 0.025, gain: 0.04, wet: 0.2 });
      playTone({ freq: 660, freqEnd: 880, type: 'sine', duration: 0.18, gain: 0.022, wet: 0.35 });
    } else if (kind === 'entity-hide') {
      playNoiseBurst({ freq: 860, freqEnd: 310, q: 1.4, duration: 0.18, gain: 0.024, wet: 0.6 });
    } else if (kind === 'glyph') {
      playTone({ freq: 820 + Math.random() * 140, type: 'sine', duration: 0.09, gain: 0.015, attack: 0.002, wet: 0.4 });
    } else {
      playTone({ freq: 587.3, type: 'sine', duration: 0.28, gain: 0.025, wet: 0.4 });
    }
  }

  function updateSpatial(player, layerId, residentsSnap, dt) {
    if (!active || docHidden() || !ctx || ctx.state === 'suspended') return;
    const now = ctx.currentTime;

    if (layerId === 'loft') {
      const win = spatialPanAndGain(player, 0, -7.2, 18);
      if (rainPanner && rainGain) {
        rainPanner.pan.setTargetAtTime(win.pan, now, 0.1);
        rainGain.gain.setTargetAtTime(0.022 + win.gain * 0.06, now, 0.12);
      }
      rainDropTimer -= dt;
      if (rainDropTimer <= 0) {
        rainDropTimer = 0.25 + Math.random() * 0.75;
        playNoiseBurst({
          freq: 1400 + Math.random() * 1400,
          q: 3.8,
          duration: 0.028,
          gain: 0.008 + win.gain * 0.018,
          pan: Math.max(-0.85, Math.min(0.85, win.pan + (Math.random() - 0.5) * 0.35)),
          wet: 0.3,
        });
      }
      carEchoTimer -= dt;
      if (carEchoTimer <= 0) {
        carEchoTimer = 11 + Math.random() * 6;
        // Faint muffled reversing-car chime outside the rain window
        playTone({ freq: 523, freqEnd: 518, type: 'sine', duration: 0.26, gain: 0.006 + win.gain * 0.008, pan: win.pan - 0.15, wet: 0.65 });
        setTimeout(() => {
          playTone({ freq: 523, freqEnd: 518, type: 'sine', duration: 0.26, gain: 0.005 + win.gain * 0.007, pan: win.pan - 0.12, wet: 0.65 });
        }, 480);
      }
    }

    if (layerId === 'atrium' && residentsSnap?.walker) {
      const w = residentsSnap.walker;
      if (lastWalkerPos) {
        const step = Math.hypot(w.x - lastWalkerPos.x, w.z - lastWalkerPos.z);
        walkerStepAccum += step;
        if (walkerStepAccum >= 0.68) {
          walkerStepAccum = 0;
          const spatial = spatialPanAndGain(player, w.x, w.z, 13);
          if (spatial.gain > 0.05) {
            playNoiseBurst({ freq: 620, freqEnd: 340, q: 1.8, duration: 0.045, gain: spatial.gain * 0.024, pan: spatial.pan, wet: 0.45 });
            playTone({ freq: 195, freqEnd: 130, type: 'triangle', duration: 0.04, gain: spatial.gain * 0.014, pan: spatial.pan, wet: 0.4 });
          }
        }
      }
      lastWalkerPos = { x: w.x, z: w.z };
    }

    if (layerId === 'atrium' && residentsSnap?.moth) {
      mothFlutterCooldown = Math.max(0, mothFlutterCooldown - dt);
      const my = residentsSnap.moth.y;
      if (lastMothY !== null && Math.abs(my - lastMothY) > 0.004 && mothFlutterCooldown <= 0) {
        const spatial = spatialPanAndGain(player, 23.57, residentsSnap.moth.z, 7.5);
        if (spatial.gain > 0.05) {
          mothFlutterCooldown = 0.22;
          playNoiseBurst({ freq: 1850, freqEnd: 1200, q: 2.2, duration: 0.055, gain: spatial.gain * 0.016, pan: spatial.pan, wet: 0.25 });
        }
      }
      lastMothY = my;
    }
  }

  const unsub = motion?.onSound?.(enabled => setEnabled(enabled));
  const onVis = () => {
    if (!ctx) return;
    if (docHidden() && ctx.state === 'running') void ctx.suspend();
    else if (!docHidden() && active && ctx.state === 'suspended') void ctx.resume();
  };
  if (typeof document !== 'undefined') document.addEventListener?.('visibilitychange', onVis, { signal });
  signal?.addEventListener?.('abort', () => {
    disposed = true;
    unsub?.();
    clearAmbient();
    if (ctx) void ctx.close().catch(() => {});
  }, { once: true });

  return {
    setGardenSky(sky) {
      if (gardenSky === sky) return;
      gardenSky = sky;
      if (active && currentLayer) buildAmbient(currentLayer);
    },
    setEnabled,
    setLayer,
    playFootstep,
    playInteraction,
    updateSpatial,
  };
}
