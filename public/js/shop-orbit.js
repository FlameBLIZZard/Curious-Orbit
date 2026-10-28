// The shop's 3D orbit field: every product is a dot on its category's ring, the ember planet sits in the middle.
// Filtering the shop lights up the matching dots (js/shop.js sends 'co:filter'); hovering a card pulses its dot ('co:hover').
// Brand rule: the orbit never sits behind text, so it lives in its own box.
import * as THREE from '../vendor/three.module.min.js';

const box = document.getElementById('orbit-box'), canvas = document.getElementById('orbit-field');
const products = (window.CO_CATALOG && window.CO_CATALOG.products) || [];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CREAM = new THREE.Color(0xf3eee4), EMBER = new THREE.Color(0xff6b3d), MUTED = new THREE.Color(0x8a91a6);

let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' }); } catch (e) { box && box.classList.add('off'); document.documentElement.classList.add('orbit-off'); }

if (renderer && products.length) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 2.2, 8.2); camera.lookAt(0, 0, 0);
  const root = new THREE.Group(); root.rotation.x = 0.28; scene.add(root);

  // one ring per category; products are spread along it
  const cats = ['Games', 'Printables', 'Kids', 'Posters', 'Wallpapers', 'Bundles'].filter((c) => products.some((p) => p.category === c));
  const R0 = 1.1, DR = 0.36;
  const dots = [];
  cats.forEach((cat, ci) => {
    const list = products.filter((p) => p.category === cat);
    const ring = new THREE.Group(); ring.rotation.set((ci % 2 ? 1 : -1) * (0.06 + ci * 0.045), 0, ci * 0.18); root.add(ring);
    const r = R0 + ci * DR;
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 128 }, (_, i) => new THREE.Vector3(Math.cos(i / 128 * Math.PI * 2) * r, 0, Math.sin(i / 128 * Math.PI * 2) * r))),
      new THREE.LineBasicMaterial({ color: CREAM, transparent: true, opacity: 0.1 }));
    ring.add(line);
    ring.userData = { speed: (ci % 2 ? -1 : 1) * (0.05 + 0.025 * (cats.length - ci)) };
    list.forEach((p, i) => dots.push({ sku: p.sku, ring, r, a: (i / list.length) * Math.PI * 2 + ci, bundle: cat === 'Bundles' }));
  });

  const N = dots.length, pos = new Float32Array(N * 3), col = new Float32Array(N * 4), size = new Float32Array(N);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 4));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uScale: { value: 1 } },
    vertexShader: 'attribute vec4 aColor; attribute float aSize; varying vec4 vC; uniform float uScale; void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = aSize * uScale * (9. / -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec4 vC; void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard; float a = smoothstep(.5, .35, d); gl_FragColor = vec4(vC.rgb, vC.a * a); }',
  });
  const points = new THREE.Points(geo, mat); points.frustumCulled = false; root.add(points);

  // the ember planet
  const planet = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), new THREE.MeshBasicMaterial({ color: EMBER }));
  root.add(planet);
  const glow = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.52, 64), new THREE.MeshBasicMaterial({ color: EMBER, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  glow.rotation.x = Math.PI / 2; root.add(glow);

  // state: which skus match, which one is hovered; eased values so changes glide
  const idx = new Map(dots.map((d, i) => [d.sku, i]));
  let match = new Set(products.map((p) => p.sku)), active = false, hover = null;
  const eased = dots.map(() => ({ on: 1, pulse: 0 }));
  const counter = document.getElementById('orbit-n');
  const setCounter = () => { if (counter) counter.textContent = active ? `${match.size} lit` : `${N} products`; };
  window.addEventListener('co:filter', (e) => { match = new Set(e.detail.skus); active = e.detail.active; setCounter(); });
  window.addEventListener('co:hover', (e) => { hover = e.detail; });
  if (window.__coFilter) { match = new Set(window.__coFilter.skus); active = window.__coFilter.active; }
  setCounter();

  function resize() {
    const w = box.clientWidth, h = box.clientHeight;
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = w / h < 1.3 ? 36 : 28; camera.updateProjectionMatrix();
    mat.uniforms.uScale.value = Math.min(w, h) / 480 * dpr * 9;
  }
  resize(); new ResizeObserver(resize).observe(box);

  let mx = 0, my = 0, tmx = 0, tmy = 0;
  box.addEventListener('pointermove', (e) => { const r = box.getBoundingClientRect(); tmx = (e.clientX - r.left) / r.width - 0.5; tmy = (e.clientY - r.top) / r.height - 0.5; });
  box.addEventListener('pointerleave', () => { tmx = tmy = 0; });

  const v = new THREE.Vector3(), c = new THREE.Color();
  let t = 0, last = performance.now(), visible = true;
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (!reduce) t += dt;
    mx += (tmx - mx) * 0.06; my += (tmy - my) * 0.06;
    root.rotation.y = mx * 0.5; root.rotation.x = 0.28 + my * 0.3;
    planet.scale.setScalar(1 + Math.sin(t * 1.6) * 0.02);
    glow.scale.setScalar(1 + Math.sin(t * 1.6 + 1) * 0.06);
    dots.forEach((d, i) => {
      const e = eased[i];
      const target = !active || match.has(d.sku) ? 1 : 0;
      e.on += (target - e.on) * Math.min(1, dt * 7);
      e.pulse += ((hover === d.sku ? 1 : 0) - e.pulse) * Math.min(1, dt * 10);
      const a = d.a + d.ring.userData.speed * t;   // travel along the ring, then tilt the ring's plane
      v.set(Math.cos(a) * d.r, 0, Math.sin(a) * d.r).applyEuler(d.ring.rotation);
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
      const lit = active && target === 1;
      c.copy(d.bundle || lit ? EMBER : CREAM).lerp(EMBER, e.pulse);
      col.set([c.r, c.g, c.b, 0.12 + 0.88 * e.on * (active ? 1 : 0.8)], i * 4);
      size[i] = (d.bundle ? 1.5 : 1) * (0.55 + 0.45 * e.on) * (lit ? 1.8 : 1) * (1 + e.pulse * 1.8);
    });
    geo.attributes.position.needsUpdate = geo.attributes.aColor.needsUpdate = geo.attributes.aSize.needsUpdate = true;
    renderer.render(scene, camera);
    if (visible && !reduce) requestAnimationFrame(frame);
  }
  // draw once; keep animating only while the box is on screen and the user has not asked for less motion
  requestAnimationFrame(frame);
  new IntersectionObserver(([en]) => { const was = visible; visible = en.isIntersecting; if (visible && !was) { last = performance.now(); requestAnimationFrame(frame); } }).observe(box);
  if (reduce) { ['co:filter', 'co:hover'].forEach((n) => window.addEventListener(n, () => requestAnimationFrame(frame))); }
}
