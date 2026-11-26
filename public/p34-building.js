import { createArchitectureIndex, solid } from './p34-architecture.js?v=20261126-playable';

// Broad matte surfaces do not need a per-pixel BRDF. Keep the actual scene lights
// (including the player's sky and the restored glow) and sample the real sun shadow.
function vertexLitStone(shader) {
  const varyings = 'varying vec3 masonryFill; varying vec3 masonrySun;';
  shader.vertexShader = shader.vertexShader.replace('#include <common>',
    '#include <common>\n#include <lights_pars_begin>\n' + varyings).replace('#include <project_vertex>', `#include <project_vertex>
    vec3 n = normalize(transformedNormal);
    masonryFill = vec3(.17) + ambientLightColor * RECIPROCAL_PI;
    masonrySun = vec3(0.);
    #if NUM_HEMI_LIGHTS > 0
    for (int i = 0; i < NUM_HEMI_LIGHTS; i++)
      masonryFill += getHemisphereLightIrradiance(hemisphereLights[i], n) * RECIPROCAL_PI;
    #endif
    #if NUM_DIR_LIGHTS > 0
    for (int i = 0; i < NUM_DIR_LIGHTS; i++)
      masonrySun += directionalLights[i].color * max(dot(n,directionalLights[i].direction),0.) * RECIPROCAL_PI;
    #endif
    #if NUM_POINT_LIGHTS > 0 && !defined(P34_DISTANT_STONE)
    for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
      vec3 d = pointLights[i].position - mvPosition.xyz;
      float d2 = max(dot(d,d),.1);
      masonryFill += pointLights[i].color * max(dot(n,d*inversesqrt(d2)),0.) / (1.+d2) * RECIPROCAL_PI;
    }
    #endif`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <shadowmap_pars_fragment>',
    '#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>\n' + varyings)
    .replace(/#include <lights_lambert_fragment>[\s\S]*?vec3 outgoingLight = [^;]+;/,
      'vec3 outgoingLight = diffuseColor.rgb * (masonryFill + masonrySun * getShadowMask()) + totalEmissiveRadiance;');
}

// Shared stone profiles, furniture and low-frequency lighting.
export function createBuilding(THREE, scene, renderer, { tone = 'atrium', software = false } = {}) {
  const physics = createArchitectureIndex();
  const palettes = {
    atrium: [0xf6dfc8, 0xc5aba7, 0xe7c9b0, 0x795246, 0xbc827f, 0x725650],
    poolrooms: [0xe1ebe1,0xb2d5c9,0xd9e3d5,0x6f8a81,0x8fb7b0,0x6a817e],
    drafts: [0xc9b5a6,0xa59d91,0xc7bbb4,0x775f51,0x998278,0x645f63],
    stacks: [0x8fabbf, 0x5a7588, 0x587488, 0x5e545b, 0x4e687b, 0x455565],
    loft: [0xf1cfad, 0xa17459, 0xd4ad8c, 0x744c3e, 0xc28b76, 0x524349],
    library: [0xe4d5ba, 0x9eaaa0, 0xcac8ad, 0x6f6151, 0x758f8b, 0x64726e],
  };
  const [stoneColor, floorColor, ceilingColor, walnutColor, trimColor, metalColor] = palettes[tone];
  function texture(kind) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const c = canvas.getContext('2d');
    if (kind === 'stone') {
      const grad = c.createLinearGradient(0, 0, 0, 256);
      for (const [at, shade] of [[0, '#ded4d5'], [.21, '#fff9f2'], [.62, '#f1e4e4'], [.89, '#ddcdd2'], [1, '#bfaeb8']]) grad.addColorStop(at, shade);
      c.fillStyle = grad; c.fillRect(0, 0, 256, 256);
    } else {
      const woodgrain = kind === 'wood' || tone === 'loft';
      for (let i = 0; i < 4; i++) {
        const y = i * 64;
        c.fillStyle = ['#f3e7e2', '#ecdfdf', '#f1e7e4', '#e8dadb'][i];
        c.fillRect(0, y, 256, 64);
        c.fillStyle = woodgrain ? '#957d76' : '#cbbdc0';
        c.fillRect(0, y, 256, 1); c.fillRect(41 + i * 59, y, 1, 64);
      }
      if (woodgrain) for (let i = 0; i < 52; i++) {
        c.fillStyle = i % 2 ? '#70515111' : '#fff1dc3b';
        c.fillRect((i * 127) % 95, (i * 173) % 256, 145 + i % 17, 1);
      }
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    if (kind !== 'stone') map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = software ? 1 : Math.min(8, renderer?.capabilities.getMaxAnisotropy() || 1);
    return map;
  }
  const stoneMap = texture('stone');
  const surface = (color, map, roughness = .76) => {
    if (!software) return new THREE.MeshStandardMaterial({ color, map, roughness });
    const stone = new THREE.MeshLambertMaterial({ color, map });
    stone.onBeforeCompile = vertexLitStone;
    return stone;
  };
  const plaster = surface(stoneColor, stoneMap);
  const floor = surface(floorColor, texture('floor'), .58);
  const ceiling = surface(ceilingColor, stoneMap);
  const wood = surface(walnutColor, texture('wood'), .58);
  const paint = surface(trimColor, stoneMap);
  const metal = software ? surface(metalColor, null) : new THREE.MeshStandardMaterial({ color: metalColor, roughness: .47, metalness: .42 });
  const edge = surface(new THREE.Color(stoneColor).lerp(new THREE.Color(0xfffaeb), .52), null, .48);
  const materials = [plaster, floor, ceiling, wood, paint, metal, edge];

  function mesh(geometry, x, y, z, mat, parent) {
    const item = new THREE.Mesh(geometry, mat);
    item.position.set(x, y, z); parent.add(item);
    item.userData.masonry = parent === scene;
    solid(item, { material: mat === wood ? 'wood' : undefined });
    item.receiveShadow = mat !== ceiling;
    return item;
  }

  function box(w, h, d, x, y, z, mat = plaster, parent = scene) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const { uv, position: p, normal: n } = geometry.attributes;
    if (mat === floor || mat === wood) for (let i = 0; i < uv.count; i++) {
      const horizontal = Math.abs(n.getY(i)) > .5, side = Math.abs(n.getX(i)) > .5;
      uv.setXY(i, (side ? p.getZ(i) + z : p.getX(i) + x) / 4, (horizontal ? p.getZ(i) + z : p.getY(i) + y) / 4);
    }
    const item = mesh(geometry, x, y, z, mat, parent);
    item.userData.noShadow = Math.min(w, h, d) <= .22;
    item.castShadow = mat !== ceiling && !item.userData.noShadow;
    return item;
  }

  function wall(w, h, d, x, y, z) {
    const panel = box(w, h, d, x, y + h / 2, z);
    if (y === 0) box(w + .026, .13, d + .026, x, .065, z, paint);
    return panel;
  }

  function lathe(profile, x, y, z, mat = plaster, parent = scene) {
    const geometry = new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), software ? 16 : 48);
    const item = mesh(geometry, x, y, z, mat, parent);
    item.castShadow = true;
    return item;
  }

  function column(w, h, d, x, y, z) {
    const r = Math.min(w, d) * .5;
    const group = new THREE.Group(); group.position.set(x, y, z); scene.add(group);
    lathe([[0, 0], [r, 0], [r, .07], [r * .96, .13], [r * .84, .17], [r * .82, .28],
      [r * .79, h * .29], [r * .73, h - .4], [r * .78, h - .24], [r * .94, h - .16], [r, h - .08], [r, h], [0, h]],
    0, 0, 0, plaster, group);
    for (const at of [.15, h - .12]) lathe([[r * .87, at - .029], [r * .95, at], [r * .87, at + .029]], 0, 0, 0, edge, group);
    const flute = new THREE.CylinderGeometry(.015, .023, h - .62, 6);
    const ribs = new THREE.InstancedMesh(flute, edge, 16), pose = new THREE.Object3D();
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8;
      pose.position.set(Math.cos(a) * .77 * r, h / 2, Math.sin(a) * .77 * r);
      pose.rotation.set(-.035 * Math.sin(a), 0, .035 * Math.cos(a)); pose.updateMatrix();
      ribs.setMatrixAt(i, pose.matrix);
    }
    ribs.userData.noShadow = true; group.add(ribs);
    return group;
  }

  // Continuous masonry with an open passage and real beveled edges.
  function arch(x, y, z, span, spring, band, depth, yaw = 0, mat = plaster, parent = scene) {
    const r = span / 2, outer = r + band;
    const shape = new THREE.Shape();
    shape.moveTo(-outer, 0); shape.lineTo(-outer, spring);
    shape.absarc(0, spring, outer, Math.PI, 0, true);
    shape.lineTo(outer, 0); shape.lineTo(r, 0); shape.lineTo(r, spring);
    shape.absarc(0, spring, r, 0, Math.PI, false);
    shape.lineTo(-r, 0); shape.closePath();
    const bevel = Math.min(.045, band * .18, depth * .24);
    const g = new THREE.ExtrudeGeometry(shape, { depth, curveSegments: software ? 12 : 24, bevelSize: bevel, bevelThickness: bevel, bevelEnabled: !software, bevelSegments: 2 });
    const { uv, position } = g.attributes;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, .5, THREE.MathUtils.clamp(position.getY(i) / (spring + outer), 0, 1));
    const item = mesh(g, x - Math.sin(yaw) * depth / 2, y, z - Math.cos(yaw) * depth / 2, mat, parent);
    g.userData.pierced=true;
    item.rotation.y = yaw;
    item.castShadow = depth >= .25;
    item.userData.noShadow = !item.castShadow;
    return item;
  }

  function archedWindow(w, h, span, sill, spring, x, z) {
    const front = new THREE.Shape();
    front.moveTo(-w / 2, 0); front.lineTo(w / 2, 0); front.lineTo(w / 2, h); front.lineTo(-w / 2, h); front.closePath();
    const r = span / 2, hole = new THREE.Path();
    hole.moveTo(-r, sill); hole.lineTo(-r, spring); hole.absarc(0, spring, r, Math.PI, 0, true); hole.lineTo(r, sill); hole.closePath();
    front.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(front, { depth: .35, curveSegments: 32, bevelEnabled: false });
    const { uv, position } = g.attributes;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, .5, position.getY(i) / h);
    g.userData.pierced=true;
    return mesh(g, x, 0, z, plaster, scene);
  }

  function slab(w, h, d, x, y, z, mat = plaster, parent = scene) {
    const a = w / 2, b = d / 2, r = Math.min(w, d) * .14;
    const s = new THREE.Shape();
    s.moveTo(-a + r, -b); s.lineTo(a - r, -b); s.quadraticCurveTo(a, -b, a, -b + r);
    s.lineTo(a, b - r); s.quadraticCurveTo(a, b, a - r, b);
    s.lineTo(-a + r, b); s.quadraticCurveTo(-a, b, -a, b - r);
    s.lineTo(-a, -b + r); s.quadraticCurveTo(-a, -b, -a + r, -b);
    const bevel = Math.min(h * .24, .055);
    const g = new THREE.ExtrudeGeometry(s, { depth: software ? h : h - bevel * 2, curveSegments: software ? 2 : 5, bevelSize: bevel, bevelThickness: bevel, bevelEnabled: !software, bevelSegments: 2 });
    g.translate(0, 0, (software ? 0 : bevel) - h / 2); g.rotateX(-Math.PI / 2);
    return mesh(g, x, y, z, mat, parent);
  }

  function fixture(x, y, z, rotate = false) {
    slab(rotate ? 1.25 : .26, .08, rotate ? .26 : 1.25, x, y, z, metal).userData.noShadow = true;
    const lit = new THREE.MeshStandardMaterial({ color: 0xffe3be, emissive: 0xffdcba, emissiveIntensity: .9, roughness: .5 });
    const diffuser = slab(rotate ? 1.12 : .19, .035, rotate ? .19 : 1.12, x, y - .05, z, lit);
    diffuser.userData.noShadow = true;
    return diffuser;
  }

  function vent(x, y, z, side = 1) {
    box(.04, .42, .78, x, y, z, metal);
    for (let i = 0; i < 6; i++) box(.05, .024, .7, x - side * .025, y - .15 + i * .06, z, plaster);
  }

  function desk(x, y, z, w, d, h = 1, topMat = wood, legMat = metal) {
    slab(w, .12, d, x, y + h - .06, z, topMat);
    for (const side of [-1, 1]) slab(.17, h - .12, d * .73, x + side * w * .33, y + (h - .12) / 2, z, legMat);
  }

  function deepPortal(x, y, z, w, h, yaw = 0, depthSteps = 5, voidColor = 0x1a201e) {
    const group = new THREE.Group();
    group.position.set(x, y, z); group.rotation.y = yaw;
    const far = new THREE.Color(voidColor), near = new THREE.Color(stoneColor);
    mesh(new THREE.PlaneGeometry(w * 1.65, h * 1.4), 0, h * .56, -depthSteps * .62 - .4, new THREE.MeshBasicMaterial({ color: far }), group);
    for (let i = depthSteps - 1; i >= 0; i--) {
      const scale = .83 ** i;
      const mat = i === 0 ? plaster : new THREE.MeshBasicMaterial({ color: near.clone().lerp(far, .37 + .57 * i / depthSteps) });
      arch(0, 0, -i * .62, w * scale, (h - w / 2) * scale, .2 + i * .018, .34, 0, mat, group);
    }
    arch(0, 0, .24, w - .1, h - w / 2, .065, .08, 0, edge, group);
    scene.add(group);
    return group;
  }

  // A named rigid assembly can be batched in its own coordinates and still move as one.
  function bakeMasonry(parent = scene) {
    if (parent === scene) physics.add(scene);
    const buckets = new Map();
    for (const item of parent.children) {
      if ((parent === scene && !item.userData.masonry) || !item.isMesh || item.children.length || item.material.transparent) continue;
      const key = item.material.uuid + Number(item.castShadow) + Number(item.receiveShadow);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(item);
    }
    for (const parts of buckets.values()) {
      if (parts.length < 3) continue;
      const count = parts.reduce((n,p) => n + (p.geometry.index?.count ?? p.geometry.attributes.position.count),0);
      const positions = new Float32Array(count*3), normals = new Float32Array(count*3), uv = new Float32Array(count*2);
      let i=0;
      for (const p of parts) {
        p.updateMatrix(); const g=p.geometry;g.applyMatrix4(p.matrix);
        const attrs=g.attributes, n=g.index?.count ?? attrs.position.count;
        for(let j=0;j<n;j++,i++){
          const k=g.index ? g.index.getX(j) : j;
          for(const [buffer,attr] of [[positions,attrs.position],[normals,attrs.normal]]) {
            buffer[i*3]=attr.getX(k); buffer[i*3+1]=attr.getY(k); buffer[i*3+2]=attr.getZ(k);
          }
          uv[i*2]=attrs.uv.getX(k);uv[i*2+1]=attrs.uv.getY(k);
        }
        parent.remove(p);g.dispose();
      }
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('normal',new THREE.BufferAttribute(normals,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
      const mesh=new THREE.Mesh(g,parts[0].material);mesh.castShadow=parts[0].castShadow;mesh.receiveShadow=parts[0].receiveShadow; parent.add(mesh);
    }
  }
  return { physics, solid, bakeMasonry, box, wall, column, arch, archedWindow, slab, lathe, fixture, vent, desk, deepPortal, plaster, floor, ceiling, wood, paint, metal, edge, materials };
}

export function galleryEnvironment(THREE, renderer) {
  const width = 256, height = 128;
  const pixels = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const elevation = Math.cos(Math.PI * (y + .5) / height), angle = x / width * Math.PI * 2;
    const sun = Math.max(0, Math.cos(angle - 1.2) * .78 + elevation * .22) ** 14;
    const fill = Math.max(0, Math.cos(angle - 4.05) * .77 + elevation * .23) ** 8;
    const ambient = .16 + .34 * Math.max(0, elevation);
    pixels.set([ambient + sun * 3 + fill * .27, ambient * .91 + sun * 1.75 + fill * .5, ambient + sun * 1.15 + fill * .86, 1], (y * width + x) * 4);
  }
  const sky = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat, THREE.FloatType);
  sky.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(sky);
  sky.dispose(); pmrem.dispose();
  return environment;
}
