import { Reflector } from './third-party/three/Reflector.js';
import { LINES } from './p34-script.js?v=20261126-playable';

export const POOL = { minX: -2.9, maxX: 2.9, minZ: -5.4, maxZ: -.7 };
export const SUNDIAL = { x: 2.05, y: 1.12, z: -2.25 };
export const CHIMES = { x: -22.1, y: 2.25, z: 11.8 };
export const GARDEN_LIGHT = {
  morning: { sun: 0xffede1, sky: 0xcdeef4, ground: 0x9baeb8, fog: 0x8baec1, glow: 0xd8fff9, water: 0x72c4bc, position: [-16, 10, -8], hemi: 1.58, direct: 1.7, pool: 58 },
  afternoon: { sun: 0xffdfae, sky: 0xffede0, ground: 0xa893aa, fog: 0xcfafbf, glow: 0xffe8b7, water: 0x73bdb5, position: [15, 13, 3], hemi: 1.60, direct: 2.15, pool: 58 },
  dusk: { sun: 0xff917c, sky: 0x9aa8ed, ground: 0x6b7bc7, fog: 0x726ba7, glow: 0xffac9a, water: 0x657db9, position: [-20, 6, 8], hemi: 1.6, direct: 2.0, pool: 54 },
  midnight: { sun: 0x87adff, sky: 0x9faeec, ground: 0x535e9a, fog: 0x313865, glow: 0xaedfff, water: 0x405b98, position: [8, 15, -12], hemi: 1.29, direct: .94, pool: 38 },
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
  group.userData.solidId="sundial";
  const stone = building.lathe([[0, 0], [.42, 0], [.42, .065], [.32, .14], [.24, .38], [.23, .61], [.35, .77], [.38, .81], [0, .81]], 0, 0, 0, building.plaster, group);
  stone.castShadow = true;
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(.52, .52, .055, 64), brass);
  plate.position.y = .84; group.add(building.solid(plate));
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

// Sample a small footprint around the projected ray; subpixel reflected edges do not sparkle at grazing angles.
export function poolMirror(THREE, width, depth, software, tint) {
  const original = Reflector.ReflectorShader;
  const w = software ? 288 : 960, h = software ? 180 : 640;
  const shader = {
    ...original,
    uniforms: { ...original.uniforms, clock: { value: 0 }, texel: { value: new THREE.Vector2(1/w, 1/h) } },
    vertexShader: original.vertexShader.replace('void main()', 'varying vec2 waterPoint; varying vec2 bank; void main()')
      .replace('vUv =', 'waterPoint = position.xy; bank = uv; vUv ='),
    fragmentShader: original.fragmentShader.replace('void main()', 'uniform float clock; uniform vec2 texel; varying vec2 waterPoint; varying vec2 bank; void main()')
      .replace('vec4 base = texture2DProj( tDiffuse, vUv );', `vec2 p = vUv.xy / vUv.w;
        vec2 waves = vec2(sin(waterPoint.x * 1.18 + waterPoint.y * .48 + clock * .64),
                          cos(waterPoint.y * .92 - waterPoint.x * .32 + clock * .41));
        p += waves * vec2(.0014, .0009);
        vec2 blur = texel * 1.55;
        vec3 mirror = texture2D(tDiffuse, p).rgb * .36
                    + .16 * (texture2D(tDiffuse, p + blur).rgb + texture2D(tDiffuse, p - blur).rgb
                          + texture2D(tDiffuse, p + vec2(blur.x,-blur.y)).rgb + texture2D(tDiffuse,p - vec2(blur.x,-blur.y)).rgb);`)
      .replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );', `vec2 rim = min(bank, 1.0 - bank);
        float deep = smoothstep(.0, .16, min(rim.x, rim.y));
        vec3 body = color * mix(.84, .53, deep) * (1.0 + .025 * (waves.x + waves.y));
        float fresnel = smoothstep(2.0, 28.0, vUv.w);
        gl_FragColor = vec4(mix(body, mirror * vec3(.82,.96,1.), .28 + .42 * fresnel), 1.0);`) };
  const water = new Reflector(new THREE.PlaneGeometry(width, depth), { shader, color: tint,
    textureWidth: w, textureHeight: h, multisample: software ? 0 : 2, clipBias: .006 });
  water.rotation.x = -Math.PI / 2;
  water.userData.noShadow = water.userData.noReceiveShadow = true;
  const reflect = water.onBeforeRender;
  const last = new THREE.Vector3(Infinity,Infinity,Infinity), gaze = new THREE.Quaternion();
  let reflectedAt = -Infinity;
  water.userData.invalidateReflection = () => { reflectedAt = -Infinity; };
  water.onBeforeRender = function (renderer, scene, camera) {
    const now = performance.now(), dist2 = last.distanceToSquared(camera.position);
    if (software && Number.isFinite(reflectedAt)) {
      // The static world stays projected by the capture matrix while its surface ripples at display rate.
      const angle = gaze.angleTo(camera.quaternion);
      if (dist2 < 1.3 && angle < .13 && now - reflectedAt < 1550) return;
      if (now - reflectedAt < 300 && dist2 < 9 && angle < .38) return;
    } else if (now - reflectedAt < 32 && dist2 < .04 && gaze.angleTo(camera.quaternion) < .035) return;
    reflectedAt = now; last.copy(camera.position); gaze.copy(camera.quaternion);
    reflect.call(this, renderer, scene, camera);
  };
  return water;
}

export function addAtriumGarden(THREE, scene, renderer, building, { reduced, software, getPlayer, onNotice, onShift }) {
  const { box, plaster, metal, wood } = building;
  const width = POOL.maxX - POOL.minX, depth = POOL.maxZ - POOL.minZ;
  const centerZ = (POOL.minZ + POOL.maxZ) / 2;
  const water = poolMirror(THREE, width, depth, software, 0x77bcb1);
  water.position.set(0, .032, centerZ); scene.add(water);
  for (const [offset, w, height, mat] of [[.135, .25, .052, building.paint], [.055, .105, .075, building.edge]]) {
    for (const x of [POOL.minX - offset, POOL.maxX + offset])
      building.slab(w, height, depth + offset * 2 + w, x, height / 3, centerZ, mat);
    for (const z of [POOL.minZ - offset, POOL.maxZ + offset])
      building.slab(width + offset * 2 - w, height, w, 0, height / 3, z, mat);
  }
  const dial = sundial(THREE, building, SUNDIAL.x, 0, SUNDIAL.z); scene.add(dial.group);
  const bells = chime(THREE, building, CHIMES.x, 3.15, CHIMES.z); scene.add(bells.group);
  box(.012, .6, .012, CHIMES.x, 4.5, CHIMES.z, metal);
  const bench = new THREE.Group(); bench.userData.movingSolid=true; bench.position.set(-18, 0, 11);
  building.slab(2.25, .12, .58, 0, .48, 0, wood, bench);
  for (const x of [-.78, .78]) building.slab(.27, .46, .43, x, .23, 0, plaster, bench);
  scene.add(bench);
  const prop = { x: -18, z: 11, variant: 0, phase: 'unseen', seenAt: null };
  const grit=new Float32Array(12*3);
  for(let i=0;i<12;i++){grit[i*3]=(i%2?-.78:.78)+Math.sin(i*7)*.16;grit[i*3+1]=.04+(i%4)*.025;grit[i*3+2]=Math.cos(i*3)*.21;}
  const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.BufferAttribute(grit,3));
  const dust=new THREE.Points(dustGeometry,new THREE.PointsMaterial({color:0xc5a890,size:.041,transparent:true,depthWrite:false}));
  dust.position.set(prop.x,0,prop.z);scene.add(dust);dust.visible=false;
  let shift=1,from=0;
  let noticed = false, elapsed = 0, swing = 0, rippleIndex = 0;
  const rippleGeometry = new THREE.PlaneGeometry(2,2);
  const ripples = Array.from({ length: 12 }, () => {
    const mesh = new THREE.Mesh(rippleGeometry,new THREE.ShaderMaterial({
      uniforms:{fade:{value:0}}, transparent:true, depthWrite:false,
      vertexShader:'varying vec2 rippleUV;void main(){rippleUV=uv-.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 rippleUV;uniform float fade;void main(){float r=length(rippleUV)*2.;float aa=max(.045,fwidth(r)*1.6);float a=1.-smoothstep(.0,aa,abs(r-.84));gl_FragColor=vec4(.62,.78,.70,a*fade);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }` }));
    mesh.rotation.x = -Math.PI / 2; mesh.visible = false; scene.add(mesh);
    return { mesh, age: 2 };
  });
  return {
    setSky(sky) {
      const mood = GARDEN_LIGHT[sky];
      water.material.uniforms.color.value.setHex(mood.water); water.userData.invalidateReflection();
      dial.needle.rotation.y = Object.keys(GARDEN_LIGHT).indexOf(sky) * Math.PI / 2;
    },
    setChime(tone) { bells.brass.color.setHex([0xb29a68, 0xa1b7b5, 0x8b7754][tone]); },
    pluck() { swing = .3; },
    ripple(x, z, small = false) {
      if (reduced() || !inPool(x, z)) return;
      const ring = ripples[rippleIndex++ % ripples.length];
      ring.age = 0; ring.small = small; ring.mesh.position.set(x, .044, z); ring.mesh.visible = true;
    },
    update(dt) {
      elapsed += dt;
      if (!reduced()) {
        water.material.uniforms.clock.value = elapsed;
        swing = Math.max(0, swing - dt * .045);
        bells.pipes.rotation.z = Math.sin(elapsed * 5.3) * (swing + .008);
        bells.pipes.rotation.x = Math.cos(elapsed * 4.1) * (swing * .4 + .006);
        const change = stepUnseenProp(prop, getPlayer());
        if (change === 'shift') {shift=0;from=1-prop.variant;onShift();}
        if (shift<1){
          shift=Math.min(1,shift+dt/1.05);
          const amount=from+(prop.variant-from)*shift*shift*(3-2*shift);
          bench.position.x=prop.x+amount*.5;bench.rotation.y=amount*.33;
          dust.visible=shift<1;dust.position.set(bench.position.x-.12*shift,.21*shift,prop.z);
          dust.material.opacity=.52*Math.sin(shift*Math.PI);dust.scale.z=1+shift;
        }
        if (change === 'notice' && !noticed) { noticed = true; onNotice(); }
      }
      for (const ring of ripples) {
        if (!ring.mesh.visible) continue;
        ring.age += dt;
        const t = ring.age / 1.8;
        ring.mesh.scale.setScalar((.07 + t * .8) * (ring.small ? .45 : 1));
        ring.mesh.material.uniforms.fade.value = Math.max(0, 1 - t) ** 1.25 * (ring.small ? .17 : .33);
        ring.mesh.visible = t < 1;
      }
    },
    snapshot: () => ({ pool: { ...POOL }, prop: { ...prop, x: bench.position.x, yaw: bench.rotation.y }, chimeSwing: swing, ripples: ripples.filter(r => r.mesh.visible).length }),
    dispose() { water.dispose(); },
  };
}

export function addStacksGarden(THREE, scene, building, reduced) {
  const { box, metal, plaster } = building;
  const ribbons = [];
  const shade = new THREE.MeshStandardMaterial({ color: 0x46688a, transparent: true, opacity: .66, side: THREE.DoubleSide, roughness: 1 });
  for (let i = 0; i < 11; i++) {
    const pivot = new THREE.Group(); pivot.position.set(-10 + i * 2, 6.42 + i % 3 * .04, -15.65);
    const len = 1.5 + (i * 7 % 5) * .65;
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(.13 + i % 3 * .047, len, 2, 9), shade);
    const pos = strip.geometry.attributes.position;
    for (let v = 0; v < pos.count; v++) pos.setX(v, pos.getX(v) + Math.sin(pos.getY(v) * 1.6 + i) * .1);
    strip.position.y = -len / 2; pivot.add(strip); scene.add(pivot); ribbons.push(pivot);
  }
  const brass = new THREE.MeshStandardMaterial({ color: 0xb39a65, roughness: .37, metalness: .6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xc2d1cd, transparent: true, opacity: .12, roughness: .2, metalness: .05, depthWrite: false });
  for (const [i, x] of [-7.2, -4.6, 7.2].entries()) {
    const z = 8.3;
    building.slab(1.05, .72, .7, x, .36, z, plaster);
    building.slab(1.09, .055, .74, x, .745, z, building.edge);
    for (const sx of [-.51, .51]) box(.018, .85, .018, x + sx, 1.19, z - .33, brass);
    building.slab(1.08, .021, .7, x, 1.61, z, brass);
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
    building.slab(1.04, .83, .68, x, 1.18, z, glass);
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
