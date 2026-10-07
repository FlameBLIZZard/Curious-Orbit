// lib/motion.js — closed-form springs. Every function is a pure function of time (no state, no integration).
// Rebuilt to the kit's documented API (ENGINE.md / chapter 8): step, track, indicator, swapAlpha, loopT, PRESETS.
(() => {
  // omega: natural frequency (rad/s), zeta: damping ratio (<1 overshoots)
  const PRESETS = {
    snappy:  { omega: 30, zeta: 0.86 },   // buttons, toggles, pills, leading edges — tiny overshoot
    default: { omega: 19, zeta: 0.9 },    // cards, containers, camera
    heavy:   { omega: 13, zeta: 1.0 },    // big type, logo lockups — no overshoot
    playful: { omega: 17, zeta: 0.45 },   // visible overshoot, mascots only
  };
  const resolve = (p) => (typeof p === 'object' && p ? p : PRESETS[p] || PRESETS.default);

  /** 0 → 1 spring response, tau seconds after release. tau <= 0 → 0. */
  function step(tau, preset = 'default') {
    if (tau <= 0) return 0;
    const { omega: w, zeta: z } = resolve(preset);
    if (z >= 1 - 1e-6) {                       // critically damped (and over-damped treated as critical)
      return 1 - Math.exp(-w * tau) * (1 + w * tau);
    }
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + (z * w / wd) * Math.sin(wd * tau));
  }

  /** Value with several targets: keys = [[time, value, preset?], ...]; first key is the initial value.
   *  Sum of one spring per change, each starting at its own time — never restarts, so retargets keep velocity. */
  function track(t, keys, preset = 'default') {
    if (!keys.length) return 0;
    let v = keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [ti, vi, pi] = keys[i];
      v += (vi - keys[i - 1][1]) * step(t - ti, pi || preset);
    }
    return v;
  }

  /** Bar / underline between stops: stops = [[time, start, end], ...].
   *  The leading edge (in the direction of travel) rides a stiffer spring than the trailing edge, so it stretches. */
  function indicator(t, stops, lead = 'snappy', trail = 'default') {
    let s = stops[0][1], e = stops[0][2];
    for (let i = 1; i < stops.length; i++) {
      const [ti, si, ei] = stops[i], [, sp, ep] = stops[i - 1];
      const right = (si + ei) / 2 >= (sp + ep) / 2;
      s += (si - sp) * step(t - ti, right ? trail : lead);
      e += (ei - ep) * step(t - ti, right ? lead : trail);
    }
    return { start: s, end: e, size: e - s };
  }

  /** Text inside a morphing box: invisible while the box changes shape.
   *  Enters `delay` s after tIn (morph start), leaves `lead` s before tOut (next morph). Short snaps, not fades. */
  function swapAlpha(t, tIn, tOut = Infinity, delay = 0.08, ramp = 0.06, lead = 0.06) {
    const a = Math.min(1, Math.max(0, (t - tIn - delay) / ramp));
    const b = Math.min(1, Math.max(0, (tOut - lead - t) / ramp));
    return Math.min(a, b);
  }

  /** Pin the last frame to the first. */
  const loopT = (t, dur) => ((t % dur) + dur) % dur;

  const api = { PRESETS, step, track, indicator, swapAlpha, loopT };
  if (typeof window !== 'undefined') window.Motion = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
