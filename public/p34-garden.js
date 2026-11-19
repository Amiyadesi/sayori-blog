import { Reflector } from './third-party/three/Reflector.js';
import { LINES } from './p34-script.js?v=20261119-garden';

export const POOL = { minX: -2.9, maxX: 2.9, minZ: -5.4, maxZ: -.7 };
export const SUNDIAL = { x: 2.05, y: 1.12, z: -2.25 };
export const CHIMES = { x: -22.1, y: 2.25, z: 11.8 };
export const GARDEN_LIGHT = {
  morning: { sun: 0xd7e9ed, sky: 0xdce7e7, ground: 0x747f79, fog: 0x718b91, glow: 0xe4f1f0, water: 0x899d9d, position: [-16, 10, -8], hemi: 1.5, direct: 1.45, pool: 42 },
  afternoon: { sun: 0xffdfac, sky: 0xf1e8d4, ground: 0x848276, fog: 0x9b9984, glow: 0xffe9be, water: 0xa8a994, position: [15, 13, 3], hemi: 1.45, direct: 1.6, pool: 52 },
  dusk: { sun: 0xf6b975, sky: 0xc4b7ac, ground: 0x706b6a, fog: 0x7d706e, glow: 0xf5cca0, water: 0x96908d, position: [-20, 6, 6], hemi: 1.12, direct: 1.8, pool: 36 },
  midnight: { sun: 0x92bada, sky: 0x9db6cd, ground: 0x46556b, fog: 0x26394e, glow: 0xa4c8e3, water: 0x667f97, position: [8, 15, -12], hemi: 1.02, direct: 1.32, pool: 28 },
};

export function skyFromHour(hour) {
  return hour >= 5 && hour < 11 ? 'morning' : hour >= 11 && hour < 17 ? 'afternoon' : hour >= 17 && hour < 21 ? 'dusk' : 'midnight';
}

export function isPoolEntry(href) {
  const url = new URL(href, 'https://sayori.org/');
  return url.searchParams.get('paper') === '0617' && url.searchParams.get('spot') === 'pool' && !url.searchParams.has('layer');
}

export function entrySpawn(spawn, href) {
  return isPoolEntry(href) ? { x: -1.8, y: 0, z: -.05, yaw: -.52, pitch: -.12 } : { ...spawn };
}

export function inPool(x, z, y = 0) {
  return Math.abs(y) < .08 && x > POOL.minX && x < POOL.maxX && z > POOL.minZ && z < POOL.maxZ;
}

// A change requires a real look, then walking away with the object behind you.
export function stepUnseenProp(prop, player) {
  const dx = prop.x - player.x, dz = prop.z - player.z;
  const distance = Math.hypot(dx, dz);
  const dot = (-Math.sin(player.yaw) * dx - Math.cos(player.yaw) * dz) / Math.max(.01, distance);
  if (dot > .8 && distance < 11 && prop.phase !== 'changed') {
    if (prop.phase !== 'seen') prop.seenAt = { x: player.x, z: player.z };
    prop.phase = 'seen';
  } else if (prop.phase === 'seen' && dot < -.5 && distance > 4 && Math.hypot(player.x - prop.seenAt.x, player.z - prop.seenAt.z) > 1.2) {
    prop.variant = 1 - prop.variant; prop.phase = 'changed';
    return 'shift';
  } else if (prop.phase === 'changed' && dot > .8 && distance < 11) {
    prop.phase = 'noticed';
    return 'notice';
  }
  return '';
}

export function dailyNote(state, date = new Date()) {
  const sky = skyFromHour(date.getHours());
  const lines = [LINES.garden.daily[sky][date.getDate() % 2]];
  if (state.garden.sky) lines.push(LINES.garden.noteSky);
  if (state.garden.chime !== null) lines.push(LINES.garden.noteChime);
  if (state.phase === 'after') lines.push(LINES.garden.noteAfter);
  return { sky, lines };
}

function sundial(THREE, building, x, y, z, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, y, z); group.scale.setScalar(scale);
  const brass = new THREE.MeshStandardMaterial({ color: 0xb69a60, metalness: .5, roughness: .32 });
  const stone = building.box(.62, .8, .62, 0, .4, 0, building.plaster, group);
  stone.castShadow = true;
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(.52, .52, .055, 64), brass);
  plate.position.y = .84; group.add(plate);
  for (const radius of [.39, .48]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .008, 5, 64), building.metal);
    ring.rotation.x = Math.PI / 2; ring.position.y = .873; group.add(ring);
  }
  for (let i = 0; i < 24; i++) {
    const angle = i / 24 * Math.PI * 2;
    const tick = building.box(.009, .007, i % 6 ? .045 : .09, Math.sin(angle) * .435, .877, Math.cos(angle) * .435, building.metal, group);
    tick.rotation.y = angle;
  }
  const needle = new THREE.Group(); needle.position.y = .88; group.add(needle);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(.18, .4, 3), brass);
  fin.scale.z = .12; fin.position.y = .19; fin.rotation.y = Math.PI / 2; needle.add(fin);
  const arc = new THREE.Mesh(new THREE.TorusGeometry(.4, .012, 8, 64, Math.PI), brass);
  arc.position.y = .01; needle.add(arc);
  return { group, brass, needle };
}

function chime(THREE, building, x, y, z, scale = 1) {
  const group = new THREE.Group(); group.position.set(x, y, z); group.scale.setScalar(scale);
  const brass = new THREE.MeshStandardMaterial({ color: 0xb29a68, metalness: .65, roughness: .3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xd9e1d9, roughness: .48, transparent: true, opacity: .62 });
  building.box(.012, 1.05, .012, 0, .52, 0, building.metal, group);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.26, .018, 8, 40), brass);
  ring.rotation.x = Math.PI / 2; group.add(ring);
  const pipes = new THREE.Group(); group.add(pipes);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2, len = .45 + i * .075;
    building.box(.006, .21, .006, Math.sin(a) * .21, -.12, Math.cos(a) * .21, building.metal, pipes);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, len, 12, 1, true), brass);
    tube.position.set(Math.sin(a) * .21, -.22 - len / 2, Math.cos(a) * .21); pipes.add(tube);
  }
  building.box(.008, .9, .008, 0, -.45, 0, building.metal, pipes);
  const sail = new THREE.Mesh(new THREE.OctahedronGeometry(.13, 0), glass);
  sail.scale.set(.65, 1.5, .15); sail.position.y = -1.02; pipes.add(sail);
  return { group, brass, glass, pipes };
}

export function addAtriumGarden(THREE, scene, renderer, building, { reduced, getPlayer, onNotice }) {
  const { box, plaster, metal, wood } = building;
  const width = POOL.maxX - POOL.minX, depth = POOL.maxZ - POOL.minZ;
  const centerZ = (POOL.minZ + POOL.maxZ) / 2;
  const shader = { ...Reflector.ReflectorShader, uniforms: THREE.UniformsUtils.clone(Reflector.ReflectorShader.uniforms),
    fragmentShader: Reflector.ReflectorShader.fragmentShader.replace('blendOverlay( base.rgb, color )', 'mix( color * 0.52, blendOverlay( base.rgb, color ), 0.48 )') };
  const water = new Reflector(new THREE.PlaneGeometry(width, depth), { shader, color: 0xa8a994, textureWidth: 384, textureHeight: 384, multisample: 0, clipBias: .003 });
  water.rotation.x = -Math.PI / 2; water.position.set(0, .014, centerZ);
  water.userData.noShadow = water.userData.noReceiveShadow = true;
  const reflect = water.onBeforeRender; let reflectedAt = -Infinity;
  water.onBeforeRender = function (...args) {
    if (performance.now() - reflectedAt < 160) return;
    reflectedAt = performance.now(); reflect.apply(this, args);
  };
  scene.add(water);
  for (const x of [POOL.minX - .04, POOL.maxX + .04]) box(.08, .026, depth + .16, x, .013, centerZ, plaster);
  for (const z of [POOL.minZ - .04, POOL.maxZ + .04]) box(width, .026, .08, 0, .013, z, plaster);
  const moss = new THREE.MeshStandardMaterial({ color: 0x697666, roughness: 1 });
  for (let i = 0; i < 5; i++) box(.012, .002, .08 + i % 2 * .11, -2.91, .028, -4.9 + i * .23, moss);
  const dial = sundial(THREE, building, SUNDIAL.x, 0, SUNDIAL.z); scene.add(dial.group);
  const bells = chime(THREE, building, CHIMES.x, 3.15, CHIMES.z); scene.add(bells.group);
  box(.012, .6, .012, CHIMES.x, 4.5, CHIMES.z, metal);
  const bench = new THREE.Group(); bench.position.set(-18, 0, 11);
  box(2.25, .1, .52, 0, .52, 0, wood, bench);
  for (const x of [-.85, .85]) box(.07, .5, .45, x, .25, 0, metal, bench);
  for (const z of [-.17, .17]) box(2.2, .016, .008, 0, .58, z, metal, bench);
  scene.add(bench);
  const prop = { x: -18, z: 11, variant: 0, phase: 'unseen', seenAt: null };
  let noticed = false, elapsed = 0, swing = 0, rippleIndex = 0;
  const ripples = Array.from({ length: 18 }, () => {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(.98, 1, 56), new THREE.MeshBasicMaterial({ color: 0xd4e4dc, transparent: true, opacity: 0, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2; mesh.visible = false; scene.add(mesh);
    return { mesh, age: 2 };
  });
  return {
    setSky(sky) {
      const mood = GARDEN_LIGHT[sky];
      water.material.uniforms.color.value.setHex(mood.water); reflectedAt = -Infinity;
      dial.needle.rotation.y = Object.keys(GARDEN_LIGHT).indexOf(sky) * Math.PI / 2;
    },
    setChime(tone) { bells.brass.color.setHex([0xb29a68, 0xa1b7b5, 0x8b7754][tone]); },
    pluck() { swing = .3; },
    ripple(x, z, small = false) {
      if (reduced() || !inPool(x, z)) return;
      const ring = ripples[rippleIndex++ % ripples.length];
      ring.age = 0; ring.small = small; ring.mesh.position.set(x, .025, z); ring.mesh.visible = true;
    },
    update(dt) {
      elapsed += dt;
      if (!reduced()) {
        swing = Math.max(0, swing - dt * .045);
        bells.pipes.rotation.z = Math.sin(elapsed * 5.3) * (swing + .008);
        bells.pipes.rotation.x = Math.cos(elapsed * 4.1) * (swing * .4 + .006);
        const change = stepUnseenProp(prop, getPlayer());
        if (change === 'shift') { bench.position.x = prop.x + prop.variant * .5; bench.rotation.y = prop.variant * .33; }
        if (change === 'notice' && !noticed) { noticed = true; onNotice(); }
      }
      for (const ring of ripples) {
        if (!ring.mesh.visible) continue;
        ring.age += dt;
        const t = ring.age / 1.8;
        ring.mesh.scale.setScalar((.07 + t * .8) * (ring.small ? .45 : 1));
        ring.mesh.material.opacity = (1 - t) * (ring.small ? .12 : .23);
        ring.mesh.visible = t < 1;
      }
    },
    snapshot: () => ({ pool: { ...POOL }, prop: { ...prop, x: bench.position.x, yaw: bench.rotation.y }, chimeSwing: swing, ripples: ripples.filter(r => r.mesh.visible).length }),
    dispose() { water.getRenderTarget().dispose(); },
  };
}

export function addStacksGarden(THREE, scene, building, reduced) {
  const { box, metal, plaster } = building;
  const ribbons = [];
  const shade = new THREE.MeshStandardMaterial({ color: 0x65746c, transparent: true, opacity: .48, side: THREE.DoubleSide, roughness: 1 });
  for (let i = 0; i < 15; i++) {
    const pivot = new THREE.Group(); pivot.position.set(-10.6 + i * 1.5, 6.5 + i % 3 * .04, -15.25);
    const len = 1.5 + (i * 7 % 5) * .65;
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(.035 + i % 3 * .016, len, 1, 6), shade);
    const pos = strip.geometry.attributes.position;
    for (let v = 0; v < pos.count; v++) pos.setX(v, pos.getX(v) + Math.sin(pos.getY(v) * 1.6 + i) * .1);
    strip.position.y = -len / 2; pivot.add(strip); scene.add(pivot); ribbons.push(pivot);
  }
  const brass = new THREE.MeshStandardMaterial({ color: 0xb39a65, roughness: .37, metalness: .6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xc2d1cd, transparent: true, opacity: .12, roughness: .2, metalness: .05, depthWrite: false });
  for (const [i, x] of [-7.2, -4.6, 7.2].entries()) {
    const z = 8.3;
    box(1.05, .72, .7, x, .36, z, plaster);
    box(1.09, .05, .74, x, .745, z, metal);
    for (const sx of [-.51, .51]) box(.018, .85, .018, x + sx, 1.19, z - .33, brass);
    box(1.08, .018, .7, x, 1.61, z, brass);
    if (i === 0) {
      box(.3, .035, .24, x, .79, z, brass); box(.018, .38, .018, x, 1, z, brass);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(.19, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), brass);
      cap.position.set(x, 1.23, z); scene.add(cap);
      const light = new THREE.PointLight(0xe6c48c, 1.8, 3); light.position.set(x, 1.15, z); scene.add(light);
    } else if (i === 1) {
      const page = box(.42, .025, .37, x, .91, z, plaster); page.rotation.z = .25;
      const fold = box(.21, .025, .37, x + .23, .94, z, plaster); fold.rotation.z = -.5;
    } else {
      const plaque = box(.62, .055, .36, x, .91, z, brass); plaque.rotation.x = .24;
      for (const sx of [-.25, .25]) box(.023, .012, .023, x + sx, .949, z + .12, metal);
    }
    box(1.04, .83, .68, x, 1.18, z, glass);
  }
  let time = 0;
  return { update(dt) { time += dt; if (!reduced()) ribbons.forEach((r, i) => { r.rotation.z = Math.sin(time * .24 + i * .6) * .025; r.rotation.y = Math.sin(time * .18 + i) * .1; }); } };
}

export function addLoftGarden(THREE, scene, building) {
  const { box, wood, metal, plaster } = building;
  building.desk(-3.1, 0, 2.3, 1.15, .8, .82, wood, metal);
  for (let i = 0; i < 5; i++) {
    const page = box(.43, .014, .34, -3.12 + (i % 2) * .012, .84 + i * .014, 2.3, plaster); page.rotation.y = -.18 + i * .035;
  }
  const dial = sundial(THREE, building, -.95, .97, -1.7, .25);
  const bell = chime(THREE, building, -.45, 1.38, -1.83, .28);
  box(.012, .7, .012, -.45, 1.32, -1.92, metal);
  box(.012, .012, .12, -.45, 1.674, -1.875, metal);
  box(.2, .018, .18, -.45, .978, -1.92, metal);
  scene.add(dial.group, bell.group);
  return { setSky(sky) { dial.brass.color.setHex(GARDEN_LIGHT[sky].sun); dial.needle.rotation.y = Object.keys(GARDEN_LIGHT).indexOf(sky) * Math.PI / 2; },
    setChime(tone) { bell.brass.color.setHex([0xb29a68, 0xa1b7b5, 0x8b7754][tone]); } };
}
