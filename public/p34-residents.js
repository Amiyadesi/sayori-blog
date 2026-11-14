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
    speed = .85; resident.mode = 'yielding';
  } else if (watched) { speed = 0; resident.mode = 'watching'; }
  const next = onRoute(resident.distance + speed * direction * dt);
  if (Math.hypot(next.x - player.x, next.z - player.z) < 1.1 && Math.hypot(next.x - player.x, next.z - player.z) < distance) return here;
  resident.distance += speed * direction * dt;
  resident.phase += speed * dt * 5;
  return { ...next, dx: next.dx * direction, dz: next.dz * direction };
}

// These inhabitants are not the girl, enemies, clues, or quest triggers.
export function addResidents(THREE, scene, config, getPlayer, reduced) {
  const resident = { distance: 2, phase: 0, mode: 'roaming' };
  const walker = new THREE.Group(); scene.add(walker);
  const canvas = new THREE.MeshStandardMaterial({ color: 0xb6ad8d, roughness: 1, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: 0x30372e, roughness: 1 });
  const bone = new THREE.MeshStandardMaterial({ color: 0x777666, roughness: .95 });
  const cloth = new THREE.BufferGeometry(), vertices = [], indices = [];
  const rows = 16, columns = 32;
  for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
    const t = row / rows, a = .55 + col / columns * (Math.PI * 2 - 1.1);
    const radius = .19 + Math.sin(t * Math.PI * .8) * .44 + Math.sin(a * 9) * .035 * t;
    vertices.push(Math.sin(a) * radius, 2.48 - t * 1.64 + Math.cos(a * 7) * .08 * t * t, Math.cos(a) * radius * .68);
    if (row < rows && col < columns) {
      const k = row * (columns + 1) + col; indices.push(k, k + 1, k + columns + 1, k + 1, k + columns + 2, k + columns + 1);
    }
  }
  cloth.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); cloth.setIndex(indices); cloth.computeVertexNormals();
  const mantle = new THREE.Mesh(cloth, canvas); walker.add(mantle);
  const hollow = new THREE.Mesh(new THREE.SphereGeometry(.28, 12, 10), dark); hollow.scale.set(1, 1.6, .7); hollow.position.set(0, 1.83, .03); walker.add(hollow);
  function rod(parent, thickness = .025, mat = bone) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(thickness, thickness * .7, 1, 6), mat);
    parent.add(mesh);
    return { mesh, place(a, b) {
      const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
      mesh.position.copy(start.add(end).multiplyScalar(.5)); mesh.scale.y = delta.length(); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    } };
  }
  const legs = [0, 1, 2].map(() => [rod(walker), rod(walker)]);
  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 64;
  const c = shadowCanvas.getContext('2d'), g = c.createRadialGradient(32, 32, 1, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,.3)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .025; walker.add(shadow);
  const collider = { id: 'resident', minX: 0, maxX: 0, minZ: 0, maxZ: 0, minY: 0, maxY: 2.5, enabled: true }; config.colliders.push(collider);
  function visibleFromPlayer(p, x, z) {
    return !config.colliders.some(b => b !== collider && b.enabled && b.minY < p.y + 1.5 && b.maxY > p.y + 1.5 && segmentHitsBox(p.x, p.z, x, z, b));
  }
  let yaw = 0;
  function updateWalker(dt) {
    const p = getPlayer(), here = onRoute(resident.distance);
    const pos = stepResident(resident, dt, p, visibleFromPlayer(p, here.x, here.z));
    const targetYaw = resident.mode === 'watching' ? Math.atan2(p.x - pos.x, p.z - pos.z) : Math.atan2(pos.dx, pos.dz);
    yaw += Math.atan2(Math.sin(targetYaw - yaw), Math.cos(targetYaw - yaw)) * Math.min(1, dt * 2);
    walker.position.set(pos.x, 0, pos.z); walker.rotation.y = yaw;
    mantle.rotation.z = reduced() ? 0 : Math.sin(resident.phase) * .018;
    for (let i = 0; i < legs.length; i++) {
      const a = i / 3 * Math.PI * 2, stride = Math.sin(resident.phase + i * 2.1), lift = reduced() ? .02 : Math.max(0, Math.cos(resident.phase + i * 2.1)) * .1;
      const hip = [Math.sin(a) * .19, 1.28, Math.cos(a) * .15];
      const knee = [Math.sin(a) * .62, .58 + lift, Math.cos(a) * .48 + stride * .08];
      const foot = [Math.sin(a) * .43, .035 + lift, Math.cos(a) * .36 + stride * .14];
      legs[i][0].place(hip, knee); legs[i][1].place(knee, foot);
    }
    Object.assign(collider, { minX: pos.x - .46, maxX: pos.x + .46, minZ: pos.z - .46, maxZ: pos.z + .46 });
  }

  const moth = new THREE.Group(); scene.add(moth);
  const abdomen = new THREE.Mesh(new THREE.CapsuleGeometry(.035, .19, 3, 6), bone); moth.add(abdomen);
  const wings = [];
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape(); shape.moveTo(0, .11); shape.lineTo(side * .31, .25); shape.lineTo(side * .23, -.22); shape.lineTo(0, -.1);
    const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape), canvas); wing.rotation.y = side * .32; wings.push(wing); moth.add(wing);
    for (let i = 0; i < 3; i++) {
      const leg = rod(moth, .008); leg.place([side * .025, .09 - i * .07, 0], [side * .17, .16 - i * .14, -.035]);
    }
  }
  let climb = 0, time = 0;
  function updateMoth(dt) {
    const p = getPlayer(); time += dt;
    const near = Math.hypot(p.x - 23.58, p.z + 5.5) < 4.5;
    climb += Math.sign((near ? 1 : 0) - climb) * Math.min(Math.abs((near ? 1 : 0) - climb), dt * .3);
    moth.position.set(23.57, 1.95 + climb * 1.5, -5.8 + climb * .8); moth.rotation.y = -Math.PI / 2;
    wings.forEach((wing, i) => { wing.rotation.y = (i ? 1 : -1) * (.32 + (reduced() ? 0 : Math.sin(time * 2) * .04)); });
  }
  // The building's shadow map is static; inhabitants use a moving contact shadow instead.
  for (const group of [walker, moth]) group.traverse(o => { if (o.isMesh) o.userData.noShadow = true; });
  updateWalker(0); updateMoth(0);
  return { update(dt) { updateWalker(dt); updateMoth(dt); }, snapshot: () => ({ walker: { ...resident, x: walker.position.x, z: walker.position.z }, moth: { y: moth.position.y, z: moth.position.z } }) };
}

function segmentHitsBox(x, z, tx, tz, box) {
  let low = 0, high = 1;
  for (const [a, d, min, max] of [[x, tx - x, box.minX, box.maxX], [z, tz - z, box.minZ, box.maxZ]]) {
    if (Math.abs(d) < 1e-6) { if (a < min || a > max) return false; }
    else { const t1 = (min - a) / d, t2 = (max - a) / d; low = Math.max(low, Math.min(t1, t2)); high = Math.min(high, Math.max(t1, t2)); if (low > high) return false; }
  }
  return true;
}
