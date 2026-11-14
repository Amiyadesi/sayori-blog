import * as THREE from './third-party/three/three.module.min.js';
import { FontLoader } from './third-party/three/FontLoader.js';
import { TextGeometry } from './third-party/three/TextGeometry.js';

export function wrapSpatialText(text, columns) {
  return text.split('\n').flatMap(line => {
    const chars = Array.from(line), lines = [];
    for (let i = 0; i < chars.length; i += columns) lines.push(chars.slice(i, i + columns).join(''));
    return lines.length ? lines : [''];
  });
}

export async function createSpatialDialogue({ signal, reduced }) {
  const response = await fetch('/assets/p34/dialogue.typeface.json?v=20261113-library', { signal });
  if (!response.ok) throw new Error(`Dialogue font: HTTP ${response.status}`);
  const font = new FontLoader().parse(await response.json());
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(68, 1, .1, 20);
  camera.position.z = 4;
  camera.updateMatrixWorld();
  scene.add(new THREE.HemisphereLight(0xf0eee5, 0x526b7b, 2));
  const light = new THREE.DirectionalLight(0xfff6de, 3);
  light.position.set(-3, 5, 4); scene.add(light);
  const words = new THREE.Group(); words.rotation.y = -.12; scene.add(words);
  let content = null, width = 0, height = 0;
  let age = 0, glyphIndex = 0;
  const retiring = [];
  let stop = () => {};

  function disposeWords(group) {
    group.traverse(mesh => {
      if (mesh.isMesh) { mesh.geometry.dispose(); mesh.material.forEach(m => m.dispose()); }
    });
    group.clear();
  }

  function clear(animate) {
    stop();
    if (animate && !reduced() && words.children.length) {
      const previous = new THREE.Group(); previous.rotation.copy(words.rotation);
      previous.add(...words.children); scene.add(previous);
      previous.traverse(mesh => {
        if (mesh.isMesh) mesh.userData.departure = { position: mesh.position.clone(), rotation: mesh.rotation.clone(), opacity: mesh.material[0].opacity };
      });
      retiring.push({ group: previous, age: 0 });
    } else disposeWords(words);
  }

  function textMesh(text, size, y, color) {
    const line = new THREE.Group(), chars = Array.from(text);
    const advances = chars.map(char => (font.data.glyphs[char] || font.data.glyphs['?']).ha / font.data.resolution * size);
    const span = advances.reduce((sum, advance) => sum + advance, 0);
    let x = -span / 2;
    chars.forEach((char, i) => {
      const index = glyphIndex++;
      if (char.trim()) {
        const geometry = new TextGeometry(char, { font, size, depth: .022, curveSegments: 3, bevelEnabled: true, bevelSize: .001, bevelThickness: .001, bevelSegments: 1 });
        // Keep one baseline, including punctuation; rotate each glyph about its own center.
        geometry.translate(-advances[i] / 2, -size * .45, 0);
        const mesh = new THREE.Mesh(geometry, [
          new THREE.MeshBasicMaterial({ color, transparent: true }),
          new THREE.MeshStandardMaterial({ color: 0x627987, roughness: .85, transparent: true }),
        ]);
        mesh.position.x = x + advances[i] / 2;
        mesh.userData.index = index;
        line.add(mesh);
      }
      x += advances[i];
    });
    line.position.y = y; line.userData.span = span;
    words.add(line); return line;
  }

  function layout(w, h, animate = false) {
    width = w; height = h; clear(animate); glyphIndex = 0;
    if (!content) return;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const worldHeight = 8 * Math.tan(THREE.MathUtils.degToRad(34));
    const worldWidth = worldHeight * camera.aspect;
    const titleSize = .23, optionSize = .135;
    const titleAdvance = Math.max(...Array.from(content.text.replaceAll('\n', '')).map(char => (font.data.glyphs[char] || font.data.glyphs['?']).ha)) / font.data.resolution * titleSize;
    const lines = wrapSpatialText(content.text, Math.max(1, Math.floor(worldWidth * .78 / titleAdvance)));
    const titleTop = .8 + Math.max(0, lines.length - 1) * .16;
    lines.forEach((line, i) => { if (line) textMesh(line, titleSize, titleTop - i * .34, 0xe8e8da); });
    const events = new AbortController(); stop = () => events.abort();
    content.buttons.forEach((button, i) => {
      const y = titleTop - (lines.length - 1) * .34 - .8 - i * .38;
      const mesh = textMesh(button.textContent, optionSize, y, 0xb8c8cf);
      words.updateMatrixWorld(true);
      const center = new THREE.Vector3(0, y, 0).applyMatrix4(words.matrixWorld).project(camera);
      const span = mesh.userData.span;
      const hitWidth = Math.max(140, (span + .3) / worldWidth * w);
      Object.assign(button.style, { left: `${(center.x + 1) * w / 2 - hitWidth / 2}px`, top: `${(1 - center.y) * h / 2 - 24}px`, width: `${hitWidth}px`, height: '48px' });
      const highlight = selected => {
        for (const glyph of mesh.children) glyph.material[0].color.setHex(selected ? 0xffdfaa : 0xb8c8cf);
        mesh.position.z = selected ? .09 : 0;
      };
      for (const event of ['pointerenter', 'focus']) button.addEventListener(event, () => highlight(true), { signal: events.signal });
      for (const event of ['pointerleave', 'blur']) button.addEventListener(event, () => highlight(false), { signal: events.signal });
      highlight(document.activeElement === button);
    });
    age = animate && !reduced() ? 0 : Infinity;
  }

  return {
    show(text, buttons, w, h) { content = text ? { text, buttons } : null; layout(w, h, true); },
    resize(w, h) { if (w !== width || h !== height) layout(w, h); },
    render(renderer, dt) {
      if (!content && !retiring.length) return;
      age += dt;
      words.traverse(mesh => {
        if (!mesh.isMesh) return;
        const progress = reduced() ? 1 : THREE.MathUtils.clamp((age - mesh.userData.index * .045) / .36, 0, 1);
        const remaining = (1 - progress) ** 3;
        mesh.visible = progress > 0;
        mesh.position.z = -1.15 * remaining;
        mesh.position.y = -.13 * remaining;
        mesh.rotation.set(.18 * remaining, .65 * remaining, (mesh.userData.index % 2 ? .1 : -.1) * remaining);
        for (const mat of mesh.material) mat.opacity = Math.min(1, progress * 2);
      });
      for (const item of [...retiring]) {
        item.age += dt;
        let finished = true;
        item.group.traverse(mesh => {
          if (!mesh.isMesh) return;
          const progress = reduced() ? 1 : THREE.MathUtils.clamp((item.age - mesh.userData.index * .018) / .24, 0, 1);
          const from = mesh.userData.departure;
          mesh.position.copy(from.position); mesh.position.z -= .7 * progress ** 2; mesh.position.y += .12 * progress ** 2;
          mesh.rotation.copy(from.rotation); mesh.rotation.y -= .4 * progress;
          for (const mat of mesh.material) mat.opacity = from.opacity * (1 - progress);
          if (progress < 1) finished = false;
        });
        if (finished) {
          disposeWords(item.group); scene.remove(item.group); retiring.splice(retiring.indexOf(item), 1);
        }
      }
      renderer.render(scene, camera);
    },
    dispose() { content = null; clear(false); for (const item of retiring) { disposeWords(item.group); scene.remove(item.group); } retiring.length = 0; },
  };
}
