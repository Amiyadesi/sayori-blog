// Architectural material & modular room primitives for P34 liminal spaces.
export function createBuilding(THREE, scene, renderer, { tone = 'atrium' } = {}) {
  let seed = 340617;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

  const PALETTES = {
    atrium: { plaster: 0xe4e0d4, floor: 0xb0ada0, ceiling: 0xc9c8bf, wood: 0x746754, paint: 0x939c90, metal: 0x62685e, diffuser: 0xf1f2e6, emissive: 0xe9e7d9 },
    stacks: { plaster: 0xa6afb0, floor: 0x5d676a, ceiling: 0x9aa2a4, wood: 0x5a4f45, paint: 0x515f63, metal: 0x454d52, diffuser: 0xe4ecea, emissive: 0xc3dad5 },
    loft: { plaster: 0xc9c0ae, floor: 0x6e5947, ceiling: 0xb0a594, wood: 0x5f4e3d, paint: 0x676459, metal: 0x4a4845, diffuser: 0xf6e9cf, emissive: 0xeac98e },
    library: { plaster: 0xd2cfc0, floor: 0x7d8a82, ceiling: 0xc5c4b7, wood: 0x586357, paint: 0x78877c, metal: 0x555c56, diffuser: 0xf0f1e5, emissive: 0xe0e8c8 },
  };
  const pal = PALETTES[tone] || PALETTES.atrium;

  function texture(kind) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const c = canvas.getContext('2d');

    if (kind === 'floor' && tone === 'loft') {
      // Brushed aged oak floorboards with natural grain streaks & clean plank seams
      c.fillStyle = '#ad967d'; c.fillRect(0, 0, 512, 512);
      for (let row = 0; row < 8; row++) {
        const y = row * 64;
        const tint = ((row * 37) % 14) - 7;
        c.fillStyle = `rgb(${170 + tint}, ${146 + tint}, ${121 + tint})`;
        c.fillRect(0, y, 512, 64);
        // Subtle horizontal grain lines
        for (let g = 0; g < 18; g++) {
          c.fillStyle = g % 2 ? 'rgba(68,48,30,.055)' : 'rgba(246,232,212,.045)';
          c.fillRect(0, y + 3 + random() * 58, 512, 1 + (g % 2));
        }
        c.fillStyle = 'rgba(38,26,16,.38)';
        c.fillRect(0, y, 512, 2);
        const joint = ((row * 193) % 380) + 64;
        c.fillRect(joint, y, 2, 64);
      }
    } else if (kind === 'floor') {
      // Honed travertine / architectural stone slabs (zero noisy confetti specks)
      c.fillStyle = '#c4c9be'; c.fillRect(0, 0, 512, 512);
      for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) {
        const shade = (random() - 0.5) * 10;
        const base = Math.round(196 + shade);
        c.fillStyle = `rgb(${base - 3}, ${base + 2}, ${base - 8})`;
        c.fillRect(tx * 128 + 2, ty * 128 + 2, 124, 124);
        const rg = c.createRadialGradient(
          tx * 128 + 40 + random() * 48, ty * 128 + 40 + random() * 48, 8,
          tx * 128 + 64, ty * 128 + 64, 96
        );
        rg.addColorStop(0, 'rgba(255,254,246,.08)');
        rg.addColorStop(1, 'rgba(72,80,72,.06)');
        c.fillStyle = rg;
        c.fillRect(tx * 128 + 2, ty * 128 + 2, 124, 124);
      }
      // Crisp grout lines & subtle highlight lip
      c.fillStyle = 'rgba(60, 68, 60, .16)';
      for (let i = 0; i < 4; i++) {
        c.fillRect(0, i * 128, 512, 1);
        c.fillRect(i * 128, 0, 1, 512);
      }
    } else if (kind === 'ceiling') {
      // Clean acoustic coffered tiles
      c.fillStyle = '#d7d6cb'; c.fillRect(0, 0, 512, 512);
      for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) {
        c.strokeStyle = 'rgba(82, 86, 76, .16)';
        c.lineWidth = 2;
        c.strokeRect(tx * 128 + 2, ty * 128 + 2, 124, 124);
        c.strokeStyle = 'rgba(255, 255, 248, .25)';
        c.lineWidth = 1;
        c.strokeRect(tx * 128 + 5, ty * 128 + 5, 118, 118);
      }
    } else if (kind === 'wood') {
      c.fillStyle = '#aa9d84'; c.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 90; i++) {
        c.fillStyle = i % 2 ? 'rgba(54,42,28,.065)' : 'rgba(244,236,220,.05)';
        c.fillRect(random() * 512, 0, 1 + random() * 3, 512);
      }
    } else {
      // Smooth gallery limewash plaster (broad soft tonal clouds, no harsh static dots)
      c.fillStyle = '#e1dfd3'; c.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 24; i++) {
        const cx = random() * 512, cy = random() * 512, r = 48 + random() * 96;
        const g = c.createRadialGradient(cx, cy, 4, cx, cy, r);
        g.addColorStop(0, i % 2 ? 'rgba(255,254,246,.018)' : 'rgba(84,88,74,.012)');
        g.addColorStop(1, 'rgba(225,223,211,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, 512, 512);
      }
      // Faint architectural plaster panel seam
      c.fillStyle = 'rgba(92,96,82,.045)';
      c.fillRect(255, 0, 1, 512);
      c.fillRect(0, 255, 512, 1);
    }

    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = Math.min(4, renderer?.capabilities.getMaxAnisotropy() || 1);
    return map;
  }

  const plasterMap = texture('plaster'), floorMap = texture('floor'), ceilingMap = texture('ceiling'), woodMap = texture('wood');
  const surface = (color, map, bumpScale = 0) => new THREE.MeshStandardMaterial({
    color, map, ...(bumpScale ? { bumpMap: map, bumpScale } : {}), roughness: .9,
  });
  const plaster = surface(pal.plaster, plasterMap, 0);
  const floor = surface(pal.floor, floorMap, .009);
  const ceiling = surface(pal.ceiling, ceilingMap, 0);
  const wood = surface(pal.wood, woodMap, .005);
  const paint = surface(pal.paint, plasterMap, 0);
  const metal = new THREE.MeshStandardMaterial({ color: pal.metal, roughness: .68, metalness: .28 });
  const materials = [plaster, floor, ceiling, wood, paint, metal];

  function box(w, h, d, x, y, z, mat = plaster, parent = scene) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const uv = geometry.attributes.uv, p = geometry.attributes.position, n = geometry.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      const horizontal = Math.abs(n.getY(i)) > .5;
      const side = Math.abs(n.getX(i)) > .5;
      uv.setXY(i, (side ? p.getZ(i) + z : p.getX(i) + x) / 2.4, (horizontal ? p.getZ(i) + z : p.getY(i) + y) / 2.4);
    }
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(x, y, z);
    mesh.castShadow = mat !== ceiling; mesh.receiveShadow = mat !== ceiling;
    // Sub-pixel joinery aliases in the room-wide shadow map; keep only its physical shading.
    if (Math.min(w, h, d) <= .22) { mesh.castShadow = false; mesh.userData.noShadow = true; }
    parent.add(mesh); return mesh;
  }

  function wall(w, h, d, x, y, z) {
    box(w, h, d, x, y + h / 2, z);
    if (y === 0) {
      box(w + .016, 1.08, d + .016, x, .54, z, paint);
      const rail = box(w + .034, .055, d + .034, x, 1.105, z, wood);
      rail.userData.noShadow = true;
      const base = box(w + .03, .13, d + .03, x, .065, z, metal);
      base.userData.noShadow = true;
    }
  }

  function column(w, h, d, x, y, z) {
    wall(w, h, d, x, y, z);
    const plinth = box(w + .08, .16, d + .08, x, y + .08, z, paint);
    plinth.userData.noShadow = true;
    const cap = box(w + .08, .16, d + .08, x, y + h - .08, z, plaster);
    cap.userData.noShadow = true;
  }

  function fixture(x, y, z, rotate = false) {
    const housing = box(rotate ? 1.25 : .26, .08, rotate ? .26 : 1.25, x, y, z, metal);
    housing.userData.noShadow = true;
    const diffuser = new THREE.MeshStandardMaterial({ color: pal.diffuser, emissive: pal.emissive, emissiveIntensity: 1.9, roughness: .5 });
    materials.push(diffuser);
    const tube = box(rotate ? 1.12 : .19, .035, rotate ? .19 : 1.12, x, y - .05, z, diffuser);
    tube.castShadow = false;
    tube.userData.noShadow = true;
    return tube;
  }

  function vent(x, y, z, side = 1) {
    const frame = box(.04, .42, .78, x, y, z, metal);
    frame.userData.noShadow = true;
    for (let i = 0; i < 6; i++) {
      const slat = box(.05, .024, .7, x - side * .025, y - .15 + i * .06, z, plaster);
      slat.userData.noShadow = true;
    }
  }

  function desk(x, y, z, w, d, h = 1.0, topMat = wood, legMat = metal) {
    box(w, .08, d, x, y + h - .04, z, topMat);
    const apron = box(w - .14, .06, d - .14, x, y + h - .1, z, legMat);
    apron.userData.noShadow = true;
    const lx = w / 2 - .12, lz = d / 2 - .12;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box(.065, h - .08, .065, x + sx * lx, y + (h - .08) / 2, z + sz * lz, legMat);
    }
  }

  // Non-Euclidean recessed doorway corridor: continuous telescoping tunnel sleeves fading into mist.
  function deepPortal(x, y, z, w, h, yaw = 0, depthSteps = 5, voidColor = 0x1a201e) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = yaw;
    const wallBase = new THREE.Color(pal.plaster).multiplyScalar(0.55);
    const floorBase = new THREE.Color(pal.floor).multiplyScalar(0.6);
    const ceilBase = new THREE.Color(pal.ceiling).multiplyScalar(0.42);
    const voidC = new THREE.Color(voidColor);
    const stripBase = new THREE.Color(pal.diffuser);
    const stepLen = 0.85;

    for (let i = 0; i < depthSteps; i++) {
      const t0 = i / depthSteps;
      const scale = Math.pow(0.87, i);
      const pw = w * scale, ph = h * scale;
      const zCenter = -0.38 - i * stepLen;
      const sleeve = new THREE.Group();
      sleeve.position.set(0, 0, zCenter);
      sleeve.rotation.z = i * 0.016 * (i % 2 ? 1 : -1);

      const fade = 0.2 + t0 * 0.72;
      const wMat = new THREE.MeshBasicMaterial({ color: wallBase.clone().lerp(voidC, fade) });
      const fMat = new THREE.MeshBasicMaterial({ color: floorBase.clone().lerp(voidC, fade) });
      const cMat = new THREE.MeshBasicMaterial({ color: ceilBase.clone().lerp(voidC, fade) });
      const bMat = new THREE.MeshBasicMaterial({ color: voidC });
      const sMat = new THREE.MeshBasicMaterial({ color: stripBase.clone().lerp(voidC, Math.min(.92, 0.32 + t0 * 0.6)) });
      materials.push(wMat, fMat, cMat, bMat, sMat);

      const wallThick = .12;
      const addPart = (bw, bh, bd, px, py, pz, mat) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
        m.position.set(px, py, pz);
        m.castShadow = false;
        m.receiveShadow = false;
        m.userData.noShadow = true;
        m.userData.noReceiveShadow = true;
        sleeve.add(m);
      };

      addPart(wallThick, ph + .12, stepLen + .04, -pw / 2 - wallThick / 2, ph / 2, 0, wMat);
      addPart(wallThick, ph + .12, stepLen + .04, pw / 2 + wallThick / 2, ph / 2, 0, wMat);
      addPart(pw + wallThick * 2, .12, stepLen + .04, 0, ph + .06, 0, cMat);
      addPart(pw + wallThick * 2, .1, stepLen + .04, 0, -.05, 0, fMat);
      // Interior doorway bezel ring + faint receding ceiling tube
      addPart(.07, ph, .07, -pw / 2 + .035, ph / 2, stepLen * .46, bMat);
      addPart(.07, ph, .07, pw / 2 - .035, ph / 2, stepLen * .46, bMat);
      addPart(pw, .07, .07, 0, ph - .035, stepLen * .46, bMat);
      if (i % 2 === 0) addPart(pw * .52, .022, .14, 0, ph - .015, 0, sMat);

      group.add(sleeve);
    }

    const backMat = new THREE.MeshBasicMaterial({ color: voidC });
    materials.push(backMat);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w * .75, h * .75), backMat);
    back.position.set(0, h * .38, -0.38 - depthSteps * stepLen);
    back.userData.noShadow = true;
    back.userData.noReceiveShadow = true;
    group.add(back);
    scene.add(group);
    return group;
  }

  return { box, wall, column, fixture, vent, desk, deepPortal, plaster, floor, ceiling, wood, paint, metal, materials };
}
