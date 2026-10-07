// The 3D orbit behind the page: a star field with depth, the cream orbit ring with 20 ticks (the 20-day plan)
// and the ember planet parked on today's tick. Scrolling the hero flies the camera through the ring.
import * as THREE from '../vendor/three.module.min.js';

const canvas = document.getElementById('space');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CREAM = 0xf3eee4, EMBER = 0xff6b3d, MUTED = 0x8a91a6, INK = 0x0b0e17;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  document.documentElement.classList.add('no-webgl');
}

if (renderer) {
  const small = innerWidth < 760;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 1.75));
  renderer.setClearColor(INK, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(INK, 30, 120);
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 300);
  camera.position.set(0, 0, 16);

  // round star sprite
  const dotTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.beginPath(); x.arc(32, 32, 30, 0, Math.PI * 2); x.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  function starLayer(count, rMin, rMax, size, opacity) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = rMin + Math.random() * (rMax - rMin), th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th); pos[i * 3 + 2] = r * Math.cos(ph);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: CREAM, size, map: dotTex, transparent: true, opacity, depthWrite: false, sizeAttenuation: true });
    return new THREE.Points(g, m);
  }
  const far = starLayer(small ? 1400 : 2600, 40, 140, 0.32, 0.75);
  const near = starLayer(small ? 300 : 600, 6, 40, 0.07, 0.55);
  scene.add(far, near);

  // the orbit: main ring, faint outer ring, 20 ticks, ember planet on today
  const orbit = new THREE.Group();
  const R = 5;
  const ringMat = new THREE.MeshBasicMaterial({ color: CREAM });
  orbit.add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.035, 12, 320), ringMat));
  const outer = new THREE.Mesh(new THREE.TorusGeometry(R * 1.55, 0.012, 8, 320), new THREE.MeshBasicMaterial({ color: CREAM, transparent: true, opacity: 0.22 }));
  orbit.add(outer);
  const day = (window.CO_STATE && window.CO_STATE.day) || 0;
  const tickGeo = new THREE.BoxGeometry(0.05, 0.5, 0.05);
  const angleOf = (n) => Math.PI / 2 - (n - 1) * (Math.PI * 2 / 20);
  for (let n = 1; n <= 20; n++) {
    const tick = new THREE.Mesh(tickGeo, new THREE.MeshBasicMaterial({ color: n <= day ? CREAM : MUTED, transparent: true, opacity: n <= day ? 1 : 0.45 }));
    const a = angleOf(n);
    tick.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
    tick.rotation.z = a - Math.PI / 2;
    orbit.add(tick);
  }
  const planet = new THREE.Mesh(new THREE.SphereGeometry(0.42, 48, 48), new THREE.MeshBasicMaterial({ color: EMBER }));
  const pa = day ? angleOf(day) : angleOf(1) + 0.16;
  planet.position.set(Math.cos(pa) * R, Math.sin(pa) * R, 0);
  orbit.add(planet);
  // a small moon circling the planet keeps the scene alive
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 24), new THREE.MeshBasicMaterial({ color: CREAM }));
  orbit.add(moon);
  scene.add(orbit);

  // layout: ring off to the side of the headline, never behind it
  const layout = () => {
    const narrow = innerWidth < 760;
    return narrow ? { x: 0.6, y: 4.2, s: 0.72 } : { x: 7.4, y: 4.4, s: 0.8 };
  };
  let L = layout();

  let mx = 0, my = 0, cx = 0, cy = 0;
  addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    L = layout();
  }
  addEventListener('resize', resize); resize();

  const ease = (t) => t * t * (3 - 2 * t);
  const clock = new THREE.Clock();
  let running = true;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) requestAnimationFrame(frame); });
  function frame() {
    if (!running) return;
    const t = clock.getElapsedTime();
    const st = window.CO_STATE || {};
    const p = reduce ? 0 : Math.min(1, Math.max(0, st.hero || 0));
    const e = ease(p);
    const sy = st.scroll || 0;

    // fly-through: the ring comes to centre and faces the camera, the camera passes through it
    orbit.position.x = L.x * (1 - e);
    orbit.position.y = L.y * (1 - e);
    orbit.scale.setScalar(L.s * (1 + e * 0.6));
    orbit.rotation.x = 1.12 * (1 - e) + (reduce ? 0 : Math.sin(t * 0.2) * 0.04);
    orbit.rotation.y = -0.28 * (1 - e);
    orbit.rotation.z = (reduce ? 0 : t * 0.05) * (1 - e * 0.5);
    camera.position.z = 16 - e * 17;

    const ma = t * 1.1; moon.position.set(planet.position.x + Math.cos(ma) * 0.85, planet.position.y + Math.sin(ma) * 0.85, Math.sin(ma) * 0.3);
    planet.scale.setScalar(1 + Math.sin(t * 1.6) * 0.04);

    cx += (mx - cx) * 0.04; cy += (my - cy) * 0.04;
    camera.position.x = cx * 1.6;
    camera.position.y = -cy * 1.2 - (p >= 1 ? (sy - innerHeight) * 0.004 : 0);
    camera.lookAt(cx * 0.6, camera.position.y * 0.5, -10);

    far.rotation.y = t * 0.006 + sy * 0.00008;
    near.rotation.y = t * 0.012 + sy * 0.0002;
    orbit.visible = camera.position.z > -0.8;

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
