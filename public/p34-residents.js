import { TextGeometry } from './third-party/three/TextGeometry.js';
import { POOL, inPool } from './p34-garden.js?v=20261126-playable';

export function stepWaterSkimmer(skimmer, dt, player, reduced, water = POOL, floorY = 0) {
  const dx = skimmer.x - player.x, dz = skimmer.z - player.z;
  const dist = Math.hypot(dx, dz);
  skimmer.fleeing = dist < 1.9 && Math.abs(player.y - floorY) < .2;
  if (reduced) return;
  skimmer.phase += dt * .4;
  const speed = skimmer.fleeing ? 1.1 : .12;
  const vx = skimmer.fleeing ? dx / Math.max(.01, dist) : Math.cos(skimmer.phase);
  const vz = skimmer.fleeing ? dz / Math.max(.01, dist) : Math.sin(skimmer.phase);
  skimmer.x = Math.max(water.minX + .3, Math.min(water.maxX - .3, skimmer.x + vx * speed * dt));
  skimmer.z = Math.max(water.minZ + .3, Math.min(water.maxZ - .3, skimmer.z + vz * speed * dt));
}

export const WALKER_ROUTE = [[-21.8, 3.2], [-22, 0], [-22, -6.4], [-15.4, -6.4], [-15.4, -3.2], [-21.8, -3.2]];
const lengths = WALKER_ROUTE.map(([x, z], i) => Math.hypot(x - WALKER_ROUTE[(i + 1) % WALKER_ROUTE.length][0], z - WALKER_ROUTE[(i + 1) % WALKER_ROUTE.length][1]));
const perimeter = lengths.reduce((sum, n) => sum + n, 0);

function onRoute(distance) {
  let d = (distance % perimeter + perimeter) % perimeter;
  let i = 0;
  while (d > lengths[i]) { d -= lengths[i]; i++; }
  const a = WALKER_ROUTE[i], b = WALKER_ROUTE[(i + 1) % WALKER_ROUTE.length], t = d / lengths[i];
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx: (b[0] - a[0]) / lengths[i], dz: (b[1] - a[1]) / lengths[i] };
}

export function stepResident(resident, dt, player, visible) {
  const here = onRoute(resident.distance);
  const dx = player.x - here.x, dz = player.z - here.z, distance = Math.hypot(dx, dz);
  const watched = visible && distance < 9 && (-Math.sin(player.yaw) * dx - Math.cos(player.yaw) * dz) < -distance * .78;
  let direction = 1, speed = .48;
  resident.mode = 'roaming';
  if (distance < 2.6) {
    direction = here.dx * dx + here.dz * dz > 0 ? -1 : 1;
    speed = 1.2; resident.mode = 'yielding';
  } else if (watched) { speed = 0; resident.mode = 'watching'; }
  const next = onRoute(resident.distance + speed * direction * dt);
  if (Math.hypot(next.x - player.x, next.z - player.z) < 1.1 && Math.hypot(next.x - player.x, next.z - player.z) < distance) return here;
  resident.distance += speed * direction * dt;
  resident.phase += speed * dt * 5;
  return { ...next, dx: next.dx * direction, dz: next.dz * direction };
}

function makeLinenTexture(THREE) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d');
  c.fillStyle = '#a49c85'; c.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 3) {
    c.fillStyle = y % 6 === 0 ? 'rgba(54,56,44,.08)' : 'rgba(244,240,224,.06)';
    c.fillRect(0, y, 256, 1);
  }
  const g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(42,46,38,.36)');
  g.addColorStop(0.28, 'rgba(240,236,222,.05)');
  g.addColorStop(0.75, 'rgba(58,62,48,.1)');
  g.addColorStop(1, 'rgba(28,31,26,.48)');
  c.fillStyle = g; c.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeWingTexture(THREE) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const c = canvas.getContext('2d');
  c.fillStyle = '#c9c2a8'; c.fillRect(0, 0, 128, 128);
  c.strokeStyle = 'rgba(60,62,48,.3)'; c.lineWidth = 1.6;
  for (let i = 0; i < 6; i++) {
    c.beginPath(); c.moveTo(0, 64); c.quadraticCurveTo(56, 16 + i * 18, 122, 12 + i * 20); c.stroke();
  }
  c.fillStyle = 'rgba(46,52,44,.38)'; c.beginPath(); c.arc(84, 52, 12, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(235,232,215,.52)'; c.beginPath(); c.arc(84, 52, 5, 0, Math.PI * 2); c.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// These inhabitants are neither enemies nor quest gates; they belong to the space she rules.
export function addResidents(THREE, scene, config, getPlayer, reduced, opts = {}) {
  const layerId = opts.layerId || config.id || 'atrium';
  const isDialogueOpen = opts.isDialogueOpen || (() => false);
  const onEntityGlance = opts.onEntityGlance || (() => {});
  const onArrivalReveal = opts.onArrivalReveal || (() => {});
  const onArrivalDissolve = opts.onArrivalDissolve || (() => {});
  const linenMap = makeLinenTexture(THREE);
  const wingMap = makeWingTexture(THREE);

  const canvasMat = new THREE.MeshStandardMaterial({
    color: 0xa8a088, map: linenMap, roughness: .96, side: THREE.DoubleSide,
  });
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0xc2ba9c, map: wingMap, roughness: .92, side: THREE.DoubleSide,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1e241f, roughness: 1 });
  const bone = new THREE.MeshStandardMaterial({ color: 0x6f6e60, roughness: .9 });
  const paperEntityMat = new THREE.MeshStandardMaterial({ color: 0xd4d0be, roughness: .9, side: THREE.DoubleSide });
  const brassEntityMat = new THREE.MeshStandardMaterial({ color: 0xa49062, roughness: .42, metalness: .62 });

  function rod(parent, rTop = .02, rBot = .014, mat = bone) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, 1, 8), mat);
    parent.add(mesh);
    return {
      mesh,
      place(a, b) {
        const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
        mesh.position.copy(start.add(end).multiplyScalar(.5));
        mesh.scale.y = Math.max(0.001, delta.length());
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
      },
    };
  }

  // --- First-Entry Sovereign Apparition -> dissolves into floating text ---
  let arrivalApi = null;
  if (layerId === 'atrium' && opts.showArrival) {
    const group = new THREE.Group();
    group.position.set(2.1, 1.58, 5.2);
    group.scale.setScalar(.62);
    scene.add(group);

    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(.22, 0),
      new THREE.MeshBasicMaterial({ color: 0x1b221e, transparent: true, opacity: .94 })
    );
    core.scale.set(1.05, 3.6, .68);
    group.add(core);

    const veils = [];
    for (let i = 0; i < 4; i++) {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(.35, 1.22),
        new THREE.MeshBasicMaterial({ color: i % 2 ? 0xcfd6c6 : 0x262e29, transparent: true, opacity: .44, side: THREE.DoubleSide, depthWrite: false })
      );
      plane.rotation.y = (i / 4) * Math.PI;
      plane.rotation.z = (i % 2 ? 1 : -1) * 0.14;
      group.add(plane);
      veils.push(plane);
    }

    const halos = [];
    for (let i = 0; i < 3; i++) {
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(.42 + i * .16, .009, 6, 36),
        new THREE.MeshBasicMaterial({ color: 0xe6e4d2, transparent: true, opacity: .72 - i * .16 })
      );
      halo.rotation.set(0.7 + i * .5, i * .8, 0);
      group.add(halo);
      halos.push(halo);
    }

    const shards = [];
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Mesh(
        new THREE.PlaneGeometry(.08, .12),
        new THREE.MeshBasicMaterial({ color: i % 3 ? 0xeae6d4 : 0x8da095, transparent: true, opacity: .78, side: THREE.DoubleSide })
      );
      const ang = (i / 12) * Math.PI * 2;
      s.userData = { ang, r: .36 + (i % 3) * .18, y0: ((i % 5) - 2) * .28, vy: .45 + (i % 4) * .2 };
      s.position.set(Math.cos(ang) * s.userData.r, s.userData.y0, Math.sin(ang) * s.userData.r);
      group.add(s);
      shards.push(s);
    }

    group.traverse(o => {
      if (o.isMesh) { o.userData.manifestOpacity = o.material.opacity; o.material.opacity = 0; }
    });
    const glyphBanner = new THREE.Group();
    glyphBanner.position.set(2.1, 2.1, 5.2);
    scene.add(glyphBanner);

    const mote = new THREE.Mesh(
      new THREE.OctahedronGeometry(.11, 0),
      new THREE.MeshBasicMaterial({ color: 0xf1eee0, transparent: true, opacity: 0 })
    );
    mote.position.set(2.1, 1.55, 5.2);
    scene.add(mote);

    let age = 0;
    let stateMode = reduced() ? 'dissolving' : 'manifest';
    let dissolveT = 0;
    let revealed = false;

    function triggerDissolve(immediate = false) {
      if (stateMode === 'mote') return;
      if (immediate || reduced()) {
        group.visible = false;
        glyphBanner.visible = false;
        stateMode = 'mote';
        mote.visible = false;
        if (!revealed) { revealed = true; onArrivalDissolve(); }
        return;
      }
      if (stateMode === 'manifest') {
        stateMode = 'dissolving';
        dissolveT = 0;
        onArrivalDissolve();
        if (!revealed) { revealed = true; onArrivalReveal(); }
      }
    }

    if (reduced()) {
      group.visible = false;
    }

    arrivalApi = {
      triggerDissolve,
      setFont(font) {
        const text = Array.from('换回字说话吧');
        text.forEach((char, i) => {
          const geometry = new TextGeometry(char, { font, size: .23, depth: .026, curveSegments: 3, bevelEnabled: false });
          const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xeeeade, transparent: true, opacity: 0 }));
          mesh.position.x = (i - text.length / 2) * .25;
          mesh.userData.index = i;
          glyphBanner.add(mesh);
        });
      },
      snapshot: () => ({ mode: stateMode, age, glyphs: glyphBanner.children.length }),
      update(dt) {
        age += dt;
        const p = getPlayer();
        if (stateMode === 'manifest') {
          group.traverse(o => { if (o.isMesh) o.material.opacity = o.userData.manifestOpacity * Math.min(1, age / 1.25); });
          if (!reduced()) {
            core.rotation.y += dt * .35;
            const pulse = 1 + Math.sin(age * 4.2) * .06;
            core.scale.set(1.05 * pulse, 3.6 + Math.sin(age * 2.5) * .25, .68 * pulse);
            veils.forEach((v, idx) => { v.rotation.y += dt * (idx % 2 ? .22 : -.28); v.rotation.z = Math.sin(age * .6 + idx) * .14; });
            halos.forEach((h, idx) => { h.rotation.x += dt * (.15 + idx * .08); h.rotation.y -= dt * (.1 + idx * .05); });
            shards.forEach(s => {
              const a = s.userData.ang + age * 1.4;
              s.position.set(Math.cos(a) * s.userData.r, s.userData.y0 + Math.sin(age * 3 + s.userData.ang) * .12, Math.sin(a) * s.userData.r);
              s.rotation.y = a;
            });
          }
          if (age > 3.2 || Math.hypot(p.x-2.1, p.z - 5.2) < 2.4) triggerDissolve(false);
        } else if (stateMode === 'dissolving') {
          if (!revealed) { revealed = true; onArrivalReveal(); }
          dissolveT += dt;
          const k = Math.min(1, dissolveT / 1.15);
          core.scale.setScalar(Math.max(0.01, 1 - k));
          core.material.opacity = Math.max(0, 0.94 * (1 - k * 1.4));
          veils.forEach((v, idx) => {
            v.scale.y = Math.max(0.02, 1 - k);
            v.position.y = k * (0.4 + idx * .12);
            v.rotation.y += dt * 3.5;
            v.material.opacity = Math.max(0, 0.44 * (1 - k));
          });
          halos.forEach(h => {
            h.scale.setScalar(1 + k * .6);
            h.material.opacity = Math.max(0, 0.65 * (1 - k));
          });
          shards.forEach(s => {
            s.position.y += s.userData.vy * dt * 1.8;
            s.position.x *= 1 + dt * 1.1;
            s.position.z *= 1 + dt * 1.1;
            s.rotation.x += dt * 4;
            s.material.opacity = Math.max(0, 0.8 * (1 - dissolveT / 1.5));
          });
          // Float crisp 3D glyph ribbon where entity unfolded into language
          if (dissolveT > 0.2 && dissolveT < 4.0) {
            glyphBanner.visible = true;
            const textLife = dissolveT - 0.2;
            const alpha = textLife < .45 ? textLife / .45 : textLife > 2.4 ? Math.max(0, 1 - (textLife - 2.4) / 1.3) : 1;
            for (const glyph of glyphBanner.children) {
              const progress = reduced() ? 1 : Math.max(0, Math.min(1, (textLife - glyph.userData.index * .08) / .5));
              glyph.material.opacity = alpha * progress;
              glyph.position.z = -(1 - progress) * .24;
              glyph.rotation.y = (1 - progress) * .4;
            }
            glyphBanner.position.y = 2.0 + Math.min(0.45, textLife * .11);
            glyphBanner.lookAt(p.x, glyphBanner.position.y, p.z);
          } else if (dissolveT >= 4.0) {
            group.visible = false;
            glyphBanner.visible = false;
            stateMode = 'mote';
          }
          mote.material.opacity = Math.min(.28, dissolveT * .18);
        } else {
          if (!reduced()) {
            mote.rotation.y += dt * .9;
            mote.position.y = 1.55 + Math.sin(age * 2.1) * .06;
          }
        }
      },
    };
  }

  // --- Layer 1: Atrium Sculptural Walker + 4-Wing Moth + Ceiling Shadewisps ---
  let walkerApi = null;
  let mothApi = null;
  const wisps = [];

  if (layerId === 'atrium') {
    const resident = { distance: 2, phase: 0, mode: 'roaming' };
    const walker = new THREE.Group();walker.userData.movingSolid=true;walker.userData.solidId='resident';scene.add(walker);
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.13,.31,1.57,10),dark);
    body.position.y=1.69;body.userData.solid=true;walker.add(body);
    const cloth = new THREE.BufferGeometry(), vertices = [], uvs = [], indices = [];
    const rows = 18, columns = 36;
    for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
      const t = row / rows;
      const a = .46 + (col / columns) * (Math.PI * 2 - .92);
      // Tall slender draped cloak silhouette tapering gently up into a cowl neck
      const profile = .12 + Math.pow(t, .62) * .28 - Math.pow(t, 3.2) * .04;
      const pleat = Math.sin(a * 11) * .028 * t;
      const radius = Math.max(.08, profile + pleat);
      vertices.push(
        Math.sin(a) * radius,
        2.56 - t * 1.66 + Math.cos(a * 9) * .04 * t * t,
        Math.cos(a) * radius * .72
      );
      uvs.push(col / columns, 1 - t);
      if (row < rows && col < columns) {
        const k = row * (columns + 1) + col;
        indices.push(k, k + 1, k + columns + 1, k + 1, k + columns + 2, k + columns + 1);
      }
    }
    cloth.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    cloth.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    cloth.setIndex(indices); cloth.computeVertexNormals();
    const mantle = new THREE.Mesh(cloth, canvasMat); walker.add(mantle);

    // Tall hooded collar & deep shadow cowl interior (instead of solid flat black sticker)
    const innerHollow = new THREE.Mesh(new THREE.CylinderGeometry(.11, .16, .52, 12), dark);
    innerHollow.position.set(0, 2.24, -.01); walker.add(innerHollow);
    const hood = new THREE.Mesh(new THREE.LatheGeometry([
      new THREE.Vector2(.12, 2.16), new THREE.Vector2(.17, 2.35), new THREE.Vector2(.2, 2.55), new THREE.Vector2(.13, 2.72), new THREE.Vector2(0, 2.79),
    ], 32, .65, Math.PI * 2 - 1.3), canvasMat);
    hood.position.z = -.02; walker.add(hood);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(.016, 6, 6), new THREE.MeshBasicMaterial({ color: 0xf0ebd4 }));
    glint.position.set(0, 2.34, .11); walker.add(glint);

    // Fine draped ribbon pleats beneath hem
    for (let s = 0; s < 4; s++) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(.055, .32), paperEntityMat);
      const ang = (s / 4) * Math.PI * 2 + .4;
      strip.position.set(Math.sin(ang) * .25, .84, Math.cos(ang) * .18);
      strip.rotation.y = ang;
      walker.add(strip);
    }

    // Tapered articulated tripod stilts with brass knee collars & tiny foot pads
    const legs = [0, 1, 2].map(() => ({
      upper: rod(walker, .022, .015),
      lower: rod(walker, .014, .009),
      joint: new THREE.Mesh(new THREE.SphereGeometry(.021, 8, 6), brassEntityMat),
    }));
    for (const leg of legs) walker.add(leg.joint);

    const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 64;
    const c = shadowCanvas.getContext('2d'), g = c.createRadialGradient(32, 32, 1, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,.32)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .02; walker.add(shadow);
    function visibleFromPlayer(p,x,z){
      const distance=Math.hypot(x-p.x,z-p.z);
      if(distance>9)return false;
      for(let d=.32;d<distance-.5;d+=.32){
        const t=d/distance;
        if(config.physics.blocked(p.x+(x-p.x)*t,z*t+p.z*(1-t),1.5+p.y*(1-t),.03,.045))return false;
      }
      return true;
    }
    let yaw = 0;
    function updateWalker(dt) {
      const p = getPlayer(), here = onRoute(resident.distance);
      const sovHold = isDialogueOpen();
      const pos = sovHold ? here : stepResident(resident, dt, p, visibleFromPlayer(p, here.x, here.z));
      const targetYaw = sovHold ? Math.atan2(p.x - pos.x, p.z - pos.z) : (resident.mode === 'watching' ? Math.atan2(p.x - pos.x, p.z - pos.z) : Math.atan2(pos.dx, pos.dz));
      yaw += Math.atan2(Math.sin(targetYaw - yaw), Math.cos(targetYaw - yaw)) * Math.min(1, dt * 2);
      walker.position.set(pos.x, 0, pos.z); walker.rotation.y = yaw;
      mantle.rotation.z = reduced() || sovHold ? 0 : Math.sin(resident.phase) * .014;
      glint.visible = resident.mode === 'watching' || sovHold;
      for (let i = 0; i < legs.length; i++) {
        const a = i / 3 * Math.PI * 2 + .5, stride = Math.sin(resident.phase + i * 2.1), lift = reduced() || sovHold ? .015 : Math.max(0, Math.cos(resident.phase + i * 2.1)) * .09;
        const hip = [Math.sin(a) * .14, 1.32, Math.cos(a) * .11];
        const knee = [Math.sin(a) * .42, .64 + lift, Math.cos(a) * .34 + stride * .07];
        const foot = [Math.sin(a) * .31, .025 + lift, Math.cos(a) * .25 + stride * .12];
        legs[i].upper.place(hip, knee);
        legs[i].lower.place(knee, foot);
        legs[i].joint.position.set(knee[0], knee[1], knee[2]);
      }
    }
    walkerApi = {
      update: updateWalker,
      snapshot: () => ({ ...resident, x: walker.position.x, z: walker.position.z }),
    };

    // Sculptural 4-wing veined Moth + Antennae near East Window
    const moth = new THREE.Group(); scene.add(moth);
    const abdomen = new THREE.Mesh(new THREE.CapsuleGeometry(.026, .16, 4, 8), bone); moth.add(abdomen);
    const thorax = new THREE.Mesh(new THREE.SphereGeometry(.034, 8, 6), dark);
    thorax.position.set(0, .06, .01); moth.add(thorax);
    const wings = [];
    for (const side of [-1, 1]) {
      // Forewing
      const fore = new THREE.Shape();
      fore.moveTo(0, .06); fore.quadraticCurveTo(side * .18, .22, side * .3, .14);
      fore.quadraticCurveTo(side * .28, .01, side * .16, -.03); fore.lineTo(0, -.01);
      const fg = new THREE.ShapeGeometry(fore);
      const fuv = fg.attributes.uv, fpos = fg.attributes.position;
      for (let k = 0; k < fuv.count; k++) fuv.setXY(k, Math.abs(fpos.getX(k)) / .32, (fpos.getY(k) + .05) / .28);
      const foreWing = new THREE.Mesh(fg, wingMat); foreWing.rotation.y = side * .26;
      // Hindwing
      const hind = new THREE.Shape();
      hind.moveTo(0, -.01); hind.quadraticCurveTo(side * .2, -.03, side * .21, -.16);
      hind.quadraticCurveTo(side * .1, -.22, 0, -.12);
      const hg = new THREE.ShapeGeometry(hind);
      const huv = hg.attributes.uv, hpos = hg.attributes.position;
      for (let k = 0; k < huv.count; k++) huv.setXY(k, Math.abs(hpos.getX(k)) / .25, (hpos.getY(k) + .24) / .24);
      const hindWing = new THREE.Mesh(hg, wingMat); hindWing.rotation.y = side * .18; hindWing.position.z = -.008;
      wings.push(foreWing, hindWing);
      moth.add(foreWing, hindWing);
      // Curved delicate antennae
      const ant = rod(moth, .004, .002, dark);
      ant.place([side * .01, .09, .015], [side * .05, .21, .035]);
    }
    let climb = 0, time = 0;
    function updateMoth(dt) {
      const p = getPlayer(); time += dt;
      const near = Math.hypot(p.x - 23.58, p.z + 5.5) < 4.5;
      climb += Math.sign((near ? 1 : 0) - climb) * Math.min(Math.abs((near ? 1 : 0) - climb), dt * .3);
      moth.position.set(23.58, 1.95 + climb * 1.5, -5.8 + climb * .8); moth.rotation.y = -Math.PI / 2;
      const flutter = reduced() ? 0 : Math.sin(time * 2.4) * .05;
      wings[0].rotation.y = -(.26 + flutter); wings[1].rotation.y = -(.18 + flutter * .7);
      wings[2].rotation.y = (.26 + flutter); wings[3].rotation.y = (.18 + flutter * .7);
    }
    mothApi = {
      update: updateMoth,
      snapshot: () => ({ y: moth.position.y, z: moth.position.z }),
    };

    // Ceiling corner shadewisps
    for (const [wx, wy, wz] of [[-5.2, 4.15, -6.1], [15.2, 3.65, 15.6]]) {
      const wisp = new THREE.Group();
      wisp.position.set(wx, wy, wz);
      const body = new THREE.Mesh(new THREE.OctahedronGeometry(.13, 0), dark);
      body.scale.set(1, 2.4, .65);
      const foldL = new THREE.Mesh(new THREE.PlaneGeometry(.24, .54), paperEntityMat);
      foldL.position.set(-.15, .04, 0); foldL.rotation.y = .45;
      const foldR = new THREE.Mesh(new THREE.PlaneGeometry(.24, .54), paperEntityMat);
      foldR.position.set(.15, .04, 0); foldR.rotation.y = -.45;
      wisp.add(body, foldL, foldR);
      scene.add(wisp);
      wisps.push({ group: wisp, baseY: wy, tuck: 0, phase: wx, wasHidden: false });
    }
  }

  // --- Layer 2: Stacks Sleek Astrolabe Index Spindles in Open Aisles ---
  const spindles = [];
  if (layerId === 'stacks') {
    for (const [sx, sz, dir] of [[-5.5, -3.2, 1], [5.5, 2.8, -1]]) {
      const sp = new THREE.Group();
      sp.position.set(sx, 2.55, sz);
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(.14, 0), paperEntityMat);
      core.scale.set(1, 2.2, .65);
      const haloA = new THREE.Mesh(new THREE.TorusGeometry(.27, .01, 6, 28), brassEntityMat);
      haloA.rotation.x = Math.PI / 2;
      const haloB = new THREE.Mesh(new THREE.TorusGeometry(.22, .008, 6, 24), brassEntityMat);
      haloB.rotation.z = Math.PI / 3;
      const pennant = new THREE.Mesh(new THREE.PlaneGeometry(.14, .42), wingMat);
      pennant.position.y = -.42;
      sp.add(core, haloA, haloB, pennant);
      scene.add(sp);
      spindles.push({ group: sp, halo: haloA, haloB, baseX: sx, z: sz, dir, time: sx });
    }
  }

  // --- Layer 3: Loft Tiny Glowing Desk Motes + Soft Misty Street Silhouette ---
  const deskMotelings = [];
  if (layerId === 'loft') {
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Group();
      const wingL = new THREE.Mesh(new THREE.PlaneGeometry(.055, .035), paperEntityMat);
      wingL.position.x = -.026;
      const wingR = new THREE.Mesh(new THREE.PlaneGeometry(.055, .035), paperEntityMat);
      wingR.position.x = .026;
      m.add(wingL, wingR);
      scene.add(m);
      deskMotelings.push({ group: m, left: wingL, right: wingR, angle: i * 1.57, radius: .28 + (i % 2) * .12, yBase: 1.5 + (i % 2) * .12 });
    }
  }
  const posts = {
    atrium: [[-34,3.49,-16],[24,2.01,-34]], stacks: [[-26.7,3.63,-11.6],[26.7,-4.37,-50.4]],
    poolrooms: [[-20,-.12,-22],[15,2.8,-80]], drafts: [[-12,2.4,-7],[8,0,9]],
    library: [[-6.2,1.71,-35]], loft: [[17,-4.4,-44]],
  };
  const watchers = [];
  const shell = new THREE.ConeGeometry(.38,1.45,3), shoulder = new THREE.OctahedronGeometry(.38,0);
  for(const [x,y,z] of posts[layerId]){
    const g = new THREE.Group(); g.position.set(x,y,z);scene.add(g);
    // Three spindly feet and a surveyor's prism: no face, no human figure.
    for(let i=0;i<3;i++){
      const a=i*Math.PI*2/3;
      rod(g,.037,.022,dark).place([Math.sin(a)*.15,1.07,Math.cos(a)*.15],[Math.sin(a)*.46,.02,Math.cos(a)*.46]);
    }
    const cloak=new THREE.Mesh(shell,dark);cloak.position.y=1.73;cloak.scale.z=.57;g.add(cloak);
    const crest=new THREE.Mesh(shoulder,bone);crest.scale.set(.85,.84,.5);crest.position.set(.12,2.29,0);g.add(crest);
    watchers.push({g,x,z,phase:0,watched:false});
  }
  const fliers=[];
  if(layerId==='stacks' || layerId==='drafts'){
    const shape = new THREE.BufferGeometry();
    shape.setAttribute('position',new THREE.Float32BufferAttribute([0,.16,-1.1,-1.26,.04,.78,-.17,0,.23, 0,.16,-1.1,-.17,0,.23,0,-.29,.68,
      0,.16,-1.1,0,-.29,.68,.16,0,.23, 0,.16,-1.1,.16,0,.23,1.17,.16,.65],3));shape.computeVertexNormals();
    for(let i=0;i<4;i++){
      const mesh=new THREE.Mesh(shape,paperEntityMat);mesh.scale.setScalar(.44+i*.085);scene.add(mesh);
      fliers.push(mesh);
    }
  }
  const waterSkimmers = [];
  if (layerId === 'atrium' || layerId === 'poolrooms') for (let i = 0; i < (layerId==='atrium'?4:8); i++) {
    const group = new THREE.Group();
    const glint = new THREE.MeshStandardMaterial({ color: 0x91c8b4, roughness:.38, metalness:.34 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.016, .009, .16, 6), glint);
    body.rotation.x = Math.PI / 2; group.add(body);
    const legMesh=new THREE.CylinderGeometry(.004,.0025,.2,4);
    for (let side of [-1, 1]) for (let leg = 0; leg < 3; leg++) {
      const limb = new THREE.Mesh(legMesh, glint);
      limb.rotation.set(Math.PI / 2, 0, side * (.65 + leg * .5));
      limb.position.set(side * .055, 0, -.06 + leg * .06); group.add(limb);
    }
    scene.add(group);
    const inBath=layerId==='poolrooms', inner=inBath && i>=4;
    const water=inBath ? {minX:-7,maxX:5,minZ:inner?-67:-5.5,maxZ:inner?-62.2:2.5}:POOL;
    waterSkimmers.push({group, water, inner, x:-1.7+(i%4)*.95,z:inner?-65+i%2:-3.9+i%2*1.3,phase:i*1.6,fleeing:false,wake:0});
  }
  const shelfBookmarks = [];
  if (layerId === 'stacks') for (let i = 0; i < 4; i++) {
    const side = i % 2 ? 1 : -1, z = -4.8 + Math.floor(i / 2) * 5.6;
    const group = new THREE.Group(); group.position.set(side * 8.8, 3.5 + i % 2 * 1.05, z);
    const leaves = [];
    for (const fold of [-1, 1]) {
      const page = new THREE.Mesh(new THREE.PlaneGeometry(.3, .44), paperEntityMat);
      page.position.x = fold * .12; page.rotation.y = fold * .5; page.rotation.z = fold * .2; group.add(page); leaves.push(page);
    }
    group.rotation.y = -side * Math.PI / 2; scene.add(group);
    shelfBookmarks.push({ group, leaves, side, baseX: side * 8.8, tuck: 0, watched: false });
  }
  const echo = new THREE.Group(); echo.visible = false;
  if (['atrium', 'stacks'].includes(layerId)) {
    for (let i = 0; i < 4; i++) {
      const veil = new THREE.Mesh(new THREE.PlaneGeometry(.45, 1.85 - i * .13), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x1b2634 : 0xc4d1d6, transparent: true, opacity: .4, side: THREE.DoubleSide, depthWrite: false }));
      veil.rotation.set(0, i * Math.PI / 4, i % 2 ? .13 : -.13); echo.add(veil);
    }
    const halo = new THREE.Mesh(new THREE.TorusGeometry(.43, .008, 6, 40), new THREE.MeshBasicMaterial({ color: 0xccd6d3, transparent: true, opacity: .45 }));
    halo.rotation.set(.8, .3, 0); echo.add(halo); scene.add(echo);
  }
  let echoUntil = 0;
  function updateEcho() {
    if (!echo.visible) return;
    const left = Math.max(0, (echoUntil - performance.now()) / 900);
    echo.visible = left > 0 && !reduced();
    echo.children.forEach((mesh, i) => { mesh.material.opacity = Math.min(.4, left * 1.1); mesh.position.x = (1 - left) ** 3 * (i % 2 ? .4 : -.4); });
  }

  let sharedTime = 0;
  function updateExtras(dt) {
    const p = getPlayer();
    const sovHold = isDialogueOpen();
    sharedTime += dt;
    arrivalApi?.update(dt);
    updateEcho();
    for (const skimmer of waterSkimmers) {
      skimmer.group.visible = layerId !== 'poolrooms' || skimmer.inner === (p.z < -36);
      if(!skimmer.group.visible) continue;
      stepWaterSkimmer(skimmer, dt, p, reduced(), skimmer.water, layerId==='poolrooms'?-.8:0);
      skimmer.group.position.set(skimmer.x, layerId==='poolrooms'?-.403:.052, skimmer.z);
      skimmer.group.rotation.y = skimmer.phase;
      skimmer.wake -= dt;
      if (!reduced() && skimmer.wake <= 0 && (layerId==='poolrooms' || inPool(skimmer.x, skimmer.z))) {
        opts.onRipple?.(skimmer.x, skimmer.z, true); skimmer.wake = skimmer.fleeing ? .35 : 2.8;
      }
    }
    for (const bookmark of shelfBookmarks) {
      const dx = bookmark.group.position.x - p.x, dy = bookmark.group.position.y - p.y - 1.65, dz = bookmark.group.position.z - p.z;
      const dist = Math.hypot(dx, dy, dz);
      const dot = (-Math.sin(p.yaw) * Math.cos(p.pitch) * dx + Math.sin(p.pitch) * dy - Math.cos(p.yaw) * Math.cos(p.pitch) * dz) / Math.max(.01, dist);
      const watched = dist < 11 && dot > .9;
      if (watched && !bookmark.watched && bookmark.tuck < .2) onEntityGlance();
      bookmark.watched = watched;
      bookmark.tuck += ((watched ? 1 : 0) - bookmark.tuck) * (reduced() ? 1 : Math.min(1, dt * 2.8));
      bookmark.group.position.x = bookmark.baseX + bookmark.side * bookmark.tuck * .44;
      bookmark.group.scale.setScalar(1 - bookmark.tuck * .75);
      bookmark.leaves.forEach((leaf, i) => { leaf.rotation.y = (i ? 1 : -1) * (.5 + bookmark.tuck * .9); });
    }

    for (const w of wisps) {
      const dx = p.x - w.group.position.x, dy = (p.y + 1.65) - w.group.position.y, dz = p.z - w.group.position.z;
      const dist = Math.hypot(dx, dy, dz) || 1;
      const dot = (-Math.sin(p.yaw) * -dx - Math.cos(p.yaw) * -dz) / dist;
      const stared = dist < 11 && dot > 0.86;
      if (stared && !w.wasHidden && w.tuck < 0.25) onEntityGlance();
      w.wasHidden = stared;
      const targetTuck = sovHold ? 1 : stared ? 1 : 0;
      w.tuck += (targetTuck - w.tuck) * Math.min(1, dt * 4);
      w.group.position.y = w.baseY + w.tuck * 0.55 + (reduced() ? 0 : Math.sin(sharedTime * 1.7 + w.phase) * .06);
      w.group.scale.setScalar(1 - w.tuck * .45);
      w.group.rotation.y = Math.atan2(dx, dz);
    }

    for (const sp of spindles) {
      sp.time += dt;
      const dx = p.x - sp.group.position.x, dz = p.z - sp.group.position.z;
      const dist = Math.hypot(dx, dz) || 1;
      const watched = dist < 10 && ((-Math.sin(p.yaw) * -dx - Math.cos(p.yaw) * -dz) / dist) > 0.78;
      if (!watched && !sovHold) {
        sp.z += sp.dir * dt * 0.42;
        if (sp.z > 4.6) sp.dir = -1;
        if (sp.z < -4.6) sp.dir = 1;
      }
      const retreatY = dist < 2.8 ? 3.5 : 2.55;
      sp.group.position.y += (retreatY - sp.group.position.y) * Math.min(1, dt * 2.5);
      sp.group.position.z = sp.z;
      sp.group.position.x = sp.baseX + (reduced() ? 0 : Math.sin(sp.time * .7) * .18);
      if (!reduced()) {
        sp.halo.rotation.z += dt * (watched ? .2 : 1.1);
        sp.haloB.rotation.x += dt * (watched ? .15 : .8);
      }
      sp.group.rotation.y = Math.atan2(dx, dz);
    }

    for (const m of deskMotelings) {
      if (!reduced()) m.angle += dt * (sovHold ? .2 : .72);
      const dx = p.x - .95, dz = p.z + 1.4;
      const expand = Math.hypot(dx, dz) < 2.2 ? 1.55 : 1.0;
      m.group.position.set(
        .95 + Math.cos(m.angle) * m.radius * expand,
        m.yBase + (reduced() ? 0 : Math.sin(m.angle * 2.1) * .06),
        -1.4 + Math.sin(m.angle) * m.radius * expand
      );
      m.group.rotation.y = -m.angle;
      const flap = reduced() ? .45 : .45 + Math.sin(sharedTime * 9 + m.angle) * .24;
      m.left.rotation.y = flap;
      m.right.rotation.y = -flap;
    }

    for(const w of watchers){
      const {g}=w;
      g.visible=layerId!=='poolrooms' || (w.z<-36)===(p.z<-36);
      if(!g.visible)continue;
      const dx=g.position.x-p.x,dy=g.position.y+1.5-p.y-1.65,dz=g.position.z-p.z;
      const gaze=(-Math.sin(p.yaw)*Math.cos(p.pitch)*dx+Math.sin(p.pitch)*dy-Math.cos(p.yaw)*Math.cos(p.pitch)*dz)/Math.max(1,Math.hypot(dx,dy,dz));
      w.watched=gaze>.975;
      if(!w.watched && !reduced() && !sovHold)w.phase+=dt*.31;
      g.position.x=w.x+Math.sin(w.phase)*.52;g.rotation.y=.37+w.phase*.14;
    }
    for(let i=0;i<fliers.length;i++){
      const t=(reduced()?0:sharedTime*.14)+i*1.8;
      fliers[i].position.set(Math.sin(t)*(6+i*1.5),4.8+i*1.3+Math.sin(t*1.22)*.74,-15+Math.cos(t)*(4+i*.8));
      fliers[i].rotation.set(Math.sin(t)*.09,-t-Math.PI/2,Math.sin(t*.61)*.27);
    }
  }

  scene.traverse(o => { if (o.isMesh && !o.castShadow) o.userData.noShadow = true; });
  walkerApi?.update(0);
  mothApi?.update(0);
  updateExtras(0);

  return {
    update(dt) {
      walkerApi?.update(dt);
      mothApi?.update(dt);
      updateExtras(dt);
    },
    triggerArrivalDissolve(immediate = false) {
      arrivalApi?.triggerDissolve(immediate);
    },
    setArrivalFont(font) { arrivalApi.setFont(font); },
    updateEcho,
    flashSovereign() {
      if (reduced() || !['atrium', 'stacks'].includes(layerId)) return false;
      echo.position.set(layerId === 'atrium' ? -.8 : 6.2, 2.1, layerId === 'atrium' ? -7.1 : -12.5);
      echo.visible = true; echoUntil = performance.now() + 900; return true;
    },
    snapshot: () => ({
      ...(arrivalApi ? { arrival: arrivalApi.snapshot() } : {}),
      ...(walkerApi ? { walker: walkerApi.snapshot() } : {}),
      ...(mothApi ? { moth: mothApi.snapshot() } : {}),
      watchers: watchers.map(w=>({x:w.g.position.x,y:w.g.position.y,z:w.z,watched:w.watched})),
      kites:fliers.length,
      waterSkimmers: waterSkimmers.map(s => ({ x: s.x, z: s.z, fleeing: s.fleeing })),
      shelfBookmarks: shelfBookmarks.map(b => ({ x: b.group.position.x, tuck: b.tuck, watched: b.watched })),
      sovereignEcho: echo.visible,
      layer: layerId,
    }),
  };
}
