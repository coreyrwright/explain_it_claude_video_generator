/* assemble.js: orders the registered scenes, draws the on-screen chrome (brand logo and chapter pill, per THEME.chrome)
   and exposes window.Scenes for main.js and the tools. A scene draws while t0 - 0.01 <= T < exit + 0.5;
   exit defaults to the next scene's t0 - 0.3, and a scene fades its own elements out using X (= exit). */
(function () {
  'use strict';
  const { PAL } = K;
  const SC = S.SCENES.slice().sort((a, b) => a.t0 - b.t0);
  SC.forEach((s, i) => { if (s.exit == null) s.exit = i < SC.length - 1 ? SC[i + 1].t0 - 0.3 : Infinity; });
  const endCard = S.endCard ?? S.lastEnd - 3;
  const errors = new Map();

  // Music direction (S.musicFx, registered by the scenes) goes to tools/mix.py through cues.json as music.fx.
  S.MUSIC.fx = S.FX.slice().sort((p, q) => p.t - q.t);

  // Chrome: the brand logo (top right) and the chapter pill (top left) during the chapters, hidden from the end card on.
  // THEME.chrome {logo, chapterPill} switches each off. Scenes keep content below y = 140 while it is on.
  const CHROME = { logo: true, chapterPill: true, ...(K.THEME.chrome || {}) };
  function chrome(ctx, T) {
    const la = K.enter(T, S.CH[0] + 0.2, { t1: endCard - 0.5, d: 0.6, rise: 0 }).a;
    if (la <= 0.001) return;
    if (CHROME.logo && K.images.logo_color) {
      const ratio = K.logoRatio.color || 0.3, w = Math.max(90, Math.min(200, 50.5 / ratio));   // about 50 px tall, 90 to 200 px wide
      K.logo(ctx, 1824 - w * 0.95, 44, w, { a: la });
    }
    if (!CHROME.chapterPill) return;
    for (let i = 0; i < S.CH.length; i++) {
      const t0 = i === 0 ? S.CH[0] + 0.2 : S.CH[i] - 0.1, t1 = i < S.CH.length - 1 ? S.CH[i + 1] - 0.35 : endCard - 0.5;
      const e = K.enter(T, t0, { t1, d: 0.45, rise: 0 });
      if (e.a <= 0.001) continue;
      const label = S.TITLES[i], w = K.measure(ctx, label, 30, 600) + 104;
      K.tbox(ctx, 96, 40, w, 60, { a: e.a * la, r: 30, fill: PAL.white, lw: 4, sh: 5, noLint: true });
      K.circle(ctx, 96 + 32, 70, 20, { a: e.a * la, fill: PAL.purple, lw: 3, shadow: false });
      K.text(ctx, String(i + 1), 96 + 32, 80, { size: 28, weight: 700, color: PAL.white, align: 'center', a: e.a * la, small: true });
      K.text(ctx, label, 96 + 66, 81, { size: 30, weight: 600, a: e.a * la, small: true });
    }
  }

  function frame(ctx, T) {
    K.T = T; K.boxes = []; K.illusA = 0;
    K.bg(ctx);
    for (const s of SC) {
      if (!(T >= s.t0 - 0.01 && T < s.exit + 0.5)) continue;
      ctx.save();
      try { s.draw(ctx, T, s.exit); } catch (e) {
        if (window.__strict) throw e;
        if (!errors.has(s.id)) { errors.set(s.id, String(e)); console.error(`scene ${s.id} at T=${T.toFixed(2)}: ${e && e.stack || e}`); }
      }
      ctx.restore();
    }
    chrome(ctx, T);
  }

  // Sound-effect density: scenes register generously; keep the signature gags, then the more
  // meaningful effects, and drop anything that crowds a kept effect (pops need the most room).
  const PRIORITY = { tada: 0, scratch: 0, sneeze: 0, boing: 1, ding: 1, type: 1, whoosh: 1, sparkle: 2, swoosh: 2, click: 2, pop: 3 };
  const ROOM = [0, 0.9, 1.2, 1.7];
  const kept = [];
  S.SFX.slice().sort((a, b) => (PRIORITY[a.name] ?? 3) - (PRIORITY[b.name] ?? 3) || a.t - b.t).forEach((e) => {
    const p = PRIORITY[e.name] ?? 3;
    if (p === 0 || !kept.some((k) => Math.abs(k.t - e.t) < ROOM[p])) kept.push(e);
  });
  const SFX = kept.sort((a, b) => a.t - b.t);

  window.Scenes = { frame, END: S.END, PRE: S.PRE, C: S.C, CH: S.CH, MUSIC: S.MUSIC, STORY: S.STORY.sort((a, b) => a.t - b.t), SFX, SFX_ALL: S.SFX.slice().sort((a, b) => a.t - b.t), SCENES: SC, errors };
})();
