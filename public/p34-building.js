// Small, local materials: one repeat is 2.4 metres, not one stretched wall.
export function createBuilding(THREE, scene, renderer) {
  let seed = 340617;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  function texture(kind) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const c = canvas.getContext('2d');
    c.fillStyle = kind === 'floor' ? '#c1c6ba' : kind === 'wood' ? '#aaa18a' : '#dedacc';
    c.fillRect(0, 0, 512, 512);
    if (kind === 'floor' || kind === 'ceiling') {
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        c.fillStyle = `rgba(64,70,57,${.025 + random() * .07})`;
        c.fillRect(x * 128, y * 128, 128, 128);
        c.strokeStyle = kind === 'floor' ? '#9b9e91' : '#b2b1a4'; c.lineWidth = 2;
        c.strokeRect(x * 128 + 1, y * 128 + 1, 126, 126);
      }
    }
    const flecks = kind === 'floor' ? 16000 : 26000;
    for (let i = 0; i < flecks; i++) {
      c.fillStyle = random() > .5 ? 'rgba(50,50,38,.07)' : 'rgba(255,255,240,.13)';
      c.fillRect(random() * 512, random() * 512, kind === 'wood' ? 1 : 1 + random() * 2, kind === 'wood' ? 12 + random() * 80 : 1 + random() * 2);
    }
    if (kind === 'floor') for (let i = 0; i < 3500; i++) {
      c.fillStyle = ['#d8d8c7', '#a1a99a', '#b4bbab', '#898e80'][i % 4];
      const x = random() * 512, y = random() * 512;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + random() * 3, y + 1); c.lineTo(x + 1, y + random() * 3); c.fill();
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = Math.min(8, renderer?.capabilities.getMaxAnisotropy() || 1);
    return map;
  }
  const plasterMap = texture('plaster'), floorMap = texture('floor'), ceilingMap = texture('ceiling'), woodMap = texture('wood');
  const surface = (color, map, bumpScale = .008) => new THREE.MeshStandardMaterial({ color, map, bumpMap: map, bumpScale, roughness: .92 });
  const plaster = surface(0xc1bfaf, plasterMap, .003);
  const floor = surface(0x85918a, floorMap, .012);
  const ceiling = surface(0xb7b6a6, ceilingMap, .006);
  const wood = surface(0x786c53, woodMap);
  const paint = surface(0x8a978c, plasterMap);
  const metal = new THREE.MeshStandardMaterial({ color: 0x62685f, roughness: .72, metalness: .25 });
  function box(w, h, d, x, y, z, mat = plaster) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const uv = geometry.attributes.uv, p = geometry.attributes.position, n = geometry.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      const horizontal = Math.abs(n.getY(i)) > .5;
      const side = Math.abs(n.getX(i)) > .5;
      uv.setXY(i, (side ? p.getZ(i) + z : p.getX(i) + x) / 2.4, (horizontal ? p.getZ(i) + z : p.getY(i) + y) / 2.4);
    }
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(x, y, z);
    mesh.castShadow = mat !== ceiling; mesh.receiveShadow = mat !== ceiling;
    scene.add(mesh); return mesh;
  }
  function wall(w, h, d, x, y, z) {
    box(w, h, d, x, y + h / 2, z);
    if (y === 0) {
      box(w + .015, 1.08, d + .015, x, .54, z, paint);
      box(w + .025, .14, d + .025, x, .07, z, metal);
    }
  }
  function fixture(x, y, z, rotate = false) {
    box(rotate ? 1.25 : .26, .09, rotate ? .26 : 1.25, x, y, z, metal);
    const diffuser = new THREE.MeshStandardMaterial({ color: 0xe8e9d8, emissive: 0xd8e3bd, emissiveIntensity: 1.8, roughness: .6 });
    box(rotate ? 1.1 : .19, .035, rotate ? .19 : 1.1, x, y - .055, z, diffuser).castShadow = false;
  }
  function vent(x, y, z, side = 1) {
    box(.04, .42, .78, x, y, z, metal);
    for (let i = 0; i < 6; i++) box(.05, .025, .7, x - side * .025, y - .15 + i * .06, z, plaster);
  }
  return { box, wall, fixture, vent, plaster, floor, ceiling, wood, paint, metal, materials: [plaster, floor, ceiling, wood, paint, metal] };
}
