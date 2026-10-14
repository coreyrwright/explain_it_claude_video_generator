/* kit.js: the cartoon kit on top of engine.js (K). Colours, outline, shadow and corner radius come from
   window.THEME (js/theme.js): style.outline > 0 gives the outlined cartoon look; outline 0 with
   shadow 'soft' gives a clean flat look (no strokes, blurred soft shadows). Palette: K.PAL has the role
   names (ink, primary, accent, highlight, bg, surface, line, accentTint, bgTint, muted) and legacy aliases.
   Motion helpers are pure functions of time (deterministic, seekable).
   Scene files use these instead of inventing their own primitives. */
(function () {
  'use strict';
  const { PAL, E, clamp, lerp, prog, STYLE } = K;
  const OUT = PAL.ink, LW = STYLE.outline, FLAT = !(LW > 0), SOFT = STYLE.shadow === 'soft', R = STYLE.radius;
  const SHADOW = K.rgba(PAL.ink, SOFT ? 0.16 : 0.13);
  const rad = (r) => Math.round(r * R / 28);                  // corner radii written for radius 28 scale with the theme
  K.rad = rad;
  K.FLAT = FLAT;

  // ---------- motion -------------------------------------------------------------------------
  const outBack = (t, s = 1.7) => { const c = s + 1; return 1 + c * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
  E.outBack = outBack;
  E.inCubic = (t) => t * t * t;
  E.outBounce = (t) => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; };
  // Pop in at t0 (scale from 0.6 with a small overshoot + fade), optional exit at t1 (shrink + fade).
  // Returns {a, s, p}: alpha, scale, raw progress. Use with K.at().
  K.pop = (T, t0, { d = 0.45, t1 = Infinity, out = 0.3, from = 0.6, over = 1.6 } = {}) => {
    const p = prog(T, t0, d);
    const sIn = p <= 0 ? from : lerp(from, 1, outBack(p, over));
    const q = t1 === Infinity ? 0 : E.inOutCubic(prog(T, t1, out));
    return { a: clamp(p * 2.2) * (1 - q), s: sIn * (1 - 0.35 * q), p };
  };
  // Slide in from an offset (dx, dy) with an ease-out and fade; exit fades and drifts.
  K.slide = (T, t0, { d = 0.55, dx = 0, dy = 60, t1 = Infinity, out = 0.35 } = {}) => {
    const p = E.outCubic(prog(T, t0, d)), q = t1 === Infinity ? 0 : E.inOutCubic(prog(T, t1, out));
    return { a: p * (1 - q), dx: (1 - p) * dx, dy: (1 - p) * dy - q * 20, p };
  };
  K.bob = (T, amp = 6, period = 2.6, phase = 0) => Math.sin((T / period + phase) * Math.PI * 2) * amp;
  // Wiggle: a decaying rotation (radians) after t0, for "problem" moments.
  K.wiggle = (T, t0, { d = 0.7, amp = 0.07, freq = 7 } = {}) => {
    const p = prog(T, t0, d); if (p <= 0 || p >= 1) return 0;
    return Math.sin(p * freq * Math.PI) * amp * (1 - p);
  };
  // Squash on landing: returns [sx, sy] around 1 shortly after t0.
  K.squash = (T, t0, { d = 0.35, amt = 0.12 } = {}) => {
    const p = prog(T, t0, d); if (p <= 0 || p >= 1) return [1, 1];
    const k = Math.sin(p * Math.PI) * amt * (1 - p);
    return [1 + k, 1 - k];
  };
  K.typed = (str, T, t0, cps = 28) => String(str).slice(0, Math.max(0, Math.floor((T - t0) * cps)));
  // Deterministic random numbers (mulberry32).
  K.rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  // Draw fn inside a transform around pivot (cx, cy). o: {a, s, sx, sy, rot, dx, dy}; scale = s * sx horizontally, s * sy vertically (use K.squash for [sx, sy]).
  K.at = (ctx, cx, cy, o, fn) => {
    const a = o.a ?? 1; if (a <= 0.001) return;
    ctx.save(); ctx.globalAlpha *= a;
    ctx.translate(cx + (o.dx || 0), cy + (o.dy || 0));
    if (o.rot) ctx.rotate(o.rot);
    const s = o.s ?? 1; ctx.scale(s * (o.sx ?? 1), s * (o.sy ?? 1));
    ctx.translate(-cx, -cy);
    fn(); ctx.restore();
  };

  // ---------- cartoon shapes -----------------------------------------------------------------
  // Fill + outline + shadow for any path built by pathFn(). Style comes from THEME.style:
  //  outline > 0: stroke of that width (o.lw is scaled by outline/5), shadow 'offset': a solid offset copy, 'soft': a blurred shadow.
  //  outline 0 (flat): no stroke, except dashed outlines (o.dash) and o.border, which are meaningful.
  // o: {a, fill (false = none), stroke (colour or false), lw, dash, shadow (false = none), sh (shadow size px)}
  K.toon = (ctx, pathFn, o = {}) => {
    const a = o.a ?? 1; if (a <= 0.001) return;
    const sh = o.sh ?? 8;
    ctx.save(); ctx.globalAlpha *= a;
    if (o.shadow !== false && !(SOFT && o.fill === false)) {
      if (SOFT) {                                           // one pass: the fill carries the blurred shadow
        ctx.save(); ctx.shadowColor = SHADOW; ctx.shadowBlur = sh * 3.5; ctx.shadowOffsetY = sh * 1.25;
        pathFn(); ctx.fillStyle = o.fill || PAL.surface; ctx.fill(); ctx.restore();
      } else { ctx.save(); ctx.translate(0, sh); pathFn(); ctx.fillStyle = SHADOW; ctx.fill(); ctx.restore(); }
    }
    pathFn();
    if (o.fill !== false && !(SOFT && o.shadow !== false)) { ctx.fillStyle = o.fill || PAL.surface; ctx.fill(); }
    if (o.stroke !== false && (!FLAT || o.dash || o.border)) {
      ctx.lineWidth = o.lw ? o.lw * (FLAT ? 1 : LW / 5) : (FLAT ? 3 : LW); ctx.strokeStyle = o.stroke || (FLAT ? PAL.line : OUT); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (o.dash) ctx.setLineDash(o.dash);
      ctx.stroke();
    }
    ctx.restore();
  };
  // Cartoon box (rounded rectangle). Registers as a card for the layout lint.
  K.tbox = (ctx, x, y, w, h, o = {}) => {
    K.toon(ctx, () => K.rr(ctx, x, y, w, h, o.r ?? R), o);
    if (K.lint && ctx.globalAlpha * (o.a ?? 1) > 0.5 && !o.noLint) K.boxes.push({ kind: 'card', x, y, w, h, id: o.id || '' });
  };
  K.circle = (ctx, cx, cy, r, o = {}) => K.toon(ctx, () => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); }, o);

  // Speech bubble with a tail. tail: 'down' | 'left' | 'right' | 'up', tailAt: 0..1 along that edge.
  // o.text: centered text inside (o.size, o.weight, o.color). Returns nothing.
  K.bubble = (ctx, x, y, w, h, o = {}) => {
    const r = o.r ?? rad(32), side = o.tail || 'down', at = o.tailAt ?? 0.3, tl = o.tailLen ?? 44, tw = o.tailW ?? 46;
    K.toon(ctx, () => {
      ctx.beginPath();
      const tx = x + w * at, ty = y + h * at;
      ctx.moveTo(x + r, y);
      if (side === 'up') { ctx.lineTo(tx - tw / 2, y); ctx.lineTo(tx - tw * 0.1, y - tl); ctx.lineTo(tx + tw / 2, y); }
      ctx.arcTo(x + w, y, x + w, y + h, r);
      if (side === 'right') { ctx.lineTo(x + w, ty - tw / 2); ctx.lineTo(x + w + tl, ty + tw * 0.1); ctx.lineTo(x + w, ty + tw / 2); }
      ctx.arcTo(x + w, y + h, x, y + h, r);
      if (side === 'down') { ctx.lineTo(tx + tw / 2, y + h); ctx.lineTo(tx - tw * 0.1, y + h + tl); ctx.lineTo(tx - tw / 2, y + h); }
      ctx.arcTo(x, y + h, x, y, r);
      if (side === 'left') { ctx.lineTo(x, ty + tw / 2); ctx.lineTo(x - tl, ty + tw * 0.1); ctx.lineTo(x, ty - tw / 2); }
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }, o);
    if (o.text) {
      const size = o.size || 40;
      K.text(ctx, o.text, x + w / 2, y + h / 2 + size * 0.36, { size, weight: o.weight || 600, align: 'center', color: o.color || PAL.dark, a: o.a, maxW: w - 48 });
    }
  };

  // Folder. o: {fill, tab, label, sub, open (0..1 lifts the front flap), dashed, a, labelSize}
  K.folder = (ctx, x, y, w, h, o = {}) => {
    const a = o.a ?? 1; if (a <= 0.001) return;
    const back = o.back || PAL.purple, front = o.fill || PAL.vibrant, dash = o.dashed ? [16, 12] : null;
    const tabW = w * 0.38, tabH = h * 0.14;
    K.toon(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(x + 20, y + tabH); ctx.lineTo(x + 20, y + 18); ctx.quadraticCurveTo(x + 20, y, x + 38, y);
      ctx.lineTo(x + tabW - 14, y); ctx.quadraticCurveTo(x + tabW, y, x + tabW + 10, y + tabH * 0.6);
      ctx.lineTo(x + tabW + 24, y + tabH); ctx.lineTo(x + w - 24, y + tabH); ctx.quadraticCurveTo(x + w - 4, y + tabH, x + w - 4, y + tabH + 20);
      ctx.lineTo(x + w - 4, y + h - 24); ctx.lineTo(x + 20, y + h - 24); ctx.closePath();
    }, { a, fill: o.dashed ? PAL.light : back, dash, stroke: o.dashed ? PAL.grayDark : OUT });
    if (o.inside) o.inside(x, y + tabH, w, h - tabH);           // papers sticking out, drawn between back and front
    const lift = (o.open || 0) * h * 0.22;
    K.toon(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(x, y + tabH + 26 + lift); ctx.lineTo(x + w, y + tabH + 26 + lift);
      ctx.lineTo(x + w - 10, y + h); ctx.lineTo(x + 10, y + h); ctx.closePath();
    }, { a, fill: o.dashed ? PAL.white : front, dash, stroke: o.dashed ? PAL.grayDark : OUT, shadow: false });
    if (o.label) {
      const size = o.labelSize || Math.min(48, Math.round(h * 0.13));
      K.text(ctx, o.label, x + w / 2, y + tabH + 26 + lift + (h - tabH - 26 - lift) * 0.5 + size * 0.2, { size, weight: 700, align: 'center', color: o.dashed ? PAL.grayDark : PAL.white, a, maxW: w - 60 });
      if (o.sub) K.text(ctx, o.sub, x + w / 2, y + tabH + 26 + lift + (h - tabH - 26 - lift) * 0.5 + size * 0.2 + size * 1.1, { size: Math.max(34, Math.round(size * 0.72)), weight: 600, align: 'center', color: o.dashed ? PAL.grayDark : PAL.lime, a, maxW: w - 60 });
    }
  };

  // Document with a folded corner. o: {title, lines (count), write (0..1 how much is written), fill, a, titleSize}
  K.doc = (ctx, x, y, w, h, o = {}) => {
    const a = o.a ?? 1; if (a <= 0.001) return;
    const f = Math.min(w, h) * 0.18;
    K.toon(ctx, () => {
      ctx.beginPath(); ctx.moveTo(x + 18, y); ctx.lineTo(x + w - f, y); ctx.lineTo(x + w, y + f); ctx.lineTo(x + w, y + h - 18);
      ctx.quadraticCurveTo(x + w, y + h, x + w - 18, y + h); ctx.lineTo(x + 18, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - 18);
      ctx.lineTo(x, y + 18); ctx.quadraticCurveTo(x, y, x + 18, y); ctx.closePath();
    }, { a, fill: o.fill || PAL.surface });
    K.toon(ctx, () => { ctx.beginPath(); ctx.moveTo(x + w - f, y); ctx.lineTo(x + w - f, y + f); ctx.lineTo(x + w, y + f); ctx.closePath(); }, { a, fill: PAL.mist, shadow: false, lw: 4 });
    let ty = y + 28;
    if (o.title) { const s = Math.max(34, Math.min(o.titleSize || 40, K.fit(ctx, o.title, w - f - 44, o.titleSize || 40, 700, 34))); K.text(ctx, o.title, x + 28, y + 24 + s, { size: s, weight: 700, a, color: PAL.dark, maxW: w - f - 40 }); ty = y + 24 + s + 26; }
    const n = o.lines ?? 4, wr = o.write ?? 1;
    for (let i = 0; i < n; i++) {
      const lp = clamp(wr * n - i); if (lp <= 0) break;
      const lw = (w - 56) * (i === n - 1 ? 0.6 : 0.9 - 0.08 * (i % 2));
      ctx.save(); ctx.globalAlpha *= a; K.rr(ctx, x + 28, ty + i * 30, lw * lp, 12, 6); ctx.fillStyle = PAL.lilac; ctx.fill(); ctx.restore();
    }
  };

  // App window (terminal, browser, chat). Returns the content rect {x, y, w, h}.
  K.window = (ctx, x, y, w, h, o = {}) => {
    const a = o.a ?? 1, bar = o.bar ?? 64;
    if (a > 0.001) {
      K.tbox(ctx, x, y, w, h, { a, r: rad(26), fill: o.dark ? PAL.dark : PAL.surface, id: o.id });
      ctx.save(); ctx.globalAlpha *= a; ctx.beginPath(); ctx.rect(x + 3, y + bar, w - 6, 3); ctx.fillStyle = o.dark ? PAL.purple : PAL.gray; ctx.fill(); ctx.restore();
      [PAL.lime, PAL.vibrant, PAL.lilac].forEach((c, i) => K.circle(ctx, x + 36 + i * 34, y + bar / 2, 10, { a, fill: c, lw: 3, shadow: false }));
      if (o.title) K.text(ctx, o.title, x + 150, y + bar / 2 + 12, { size: 34, weight: 600, color: o.dark ? PAL.white : PAL.dark, a });
    }
    return { x: x + 24, y: y + bar + 20, w: w - 48, h: h - bar - 40 };
  };

  // Laptop seen from the front. (cx, by) = bottom center of the base. screen(x, y, w, h) draws the screen content.
  K.laptop = (ctx, cx, by, w, o = {}) => {
    const a = o.a ?? 1; if (a <= 0.001) return;
    const sh = w * 0.62, sw = w * 0.86, sx = cx - sw / 2, sy = by - 28 - sh;
    K.tbox(ctx, sx, sy, sw, sh, { a, r: rad(20), fill: PAL.purple, noLint: true });
    K.toon(ctx, () => K.rr(ctx, sx + 18, sy + 18, sw - 36, sh - 36, 10), { a, fill: o.screenFill || PAL.white, shadow: false, lw: 3 });
    if (o.screen) { ctx.save(); ctx.globalAlpha *= a; K.rr(ctx, sx + 18, sy + 18, sw - 36, sh - 36, 10); ctx.clip(); o.screen(sx + 18, sy + 18, sw - 36, sh - 36); ctx.restore(); }
    K.toon(ctx, () => { ctx.beginPath(); ctx.moveTo(cx - w / 2, by - 28); ctx.lineTo(cx + w / 2, by - 28); ctx.lineTo(cx + w / 2 - 14, by); ctx.lineTo(cx - w / 2 + 14, by); ctx.closePath(); }, { a, fill: PAL.lilac });
  };

  // Padlock (closed). Dark by default.
  K.padlock = (ctx, cx, cy, s, o = {}) => {
    const a = o.a ?? 1; if (a <= 0.001) return;
    ctx.save(); ctx.globalAlpha *= a; ctx.lineWidth = s * 0.14; ctx.strokeStyle = FLAT ? PAL.primary : OUT; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy - s * 0.12, s * 0.28, Math.PI, 0); ctx.lineTo(cx + s * 0.28, cy + s * 0.05); ctx.moveTo(cx - s * 0.28, cy - s * 0.12); ctx.lineTo(cx - s * 0.28, cy + s * 0.05); ctx.stroke(); ctx.restore();
    K.tbox(ctx, cx - s * 0.42, cy, s * 0.84, s * 0.62, { a, r: s * 0.12, fill: o.fill || PAL.purple, lw: 4, noLint: true });
    K.circle(ctx, cx, cy + s * 0.28, s * 0.08, { a, fill: PAL.lime, lw: 2, shadow: false });
  };

  // Loading spinner (stuck). r = radius.
  K.spinner = (ctx, cx, cy, r, T, o = {}) => {
    const a = o.a ?? 1; if (a <= 0.001) return;
    ctx.save(); ctx.globalAlpha *= a; ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + Math.floor(T * 8) * (Math.PI / 4);
      ctx.strokeStyle = K.rgba(PAL.primary, 0.15 + 0.85 * (i / 8)); ctx.lineWidth = r * 0.22;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(ang) * r * 0.5, cy + Math.sin(ang) * r * 0.5); ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r); ctx.stroke();
    }
    ctx.restore();
  };

  // Cartoon "X" that draws itself (p 0..1): Vibrant Purple with a Dark Purple outline (o.flat: plain stroke). Never red.
  K.cross = (ctx, cx, cy, s, p, o = {}) => {
    if (p <= 0.001) return;
    const h = s / 2, p1 = clamp(p * 2), p2 = clamp(p * 2 - 1), lw = o.lw || s * 0.16;
    const strokes = (w, col) => {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - h, cy - h); ctx.lineTo(cx - h + s * p1, cy - h + s * p1); ctx.stroke();
      if (p2 > 0) { ctx.beginPath(); ctx.moveTo(cx + h, cy - h); ctx.lineTo(cx + h - s * p2, cy - h + s * p2); ctx.stroke(); }
    };
    ctx.save(); ctx.globalAlpha *= o.a ?? 1;
    if (o.flat || FLAT) strokes(lw, o.color || PAL.accent);
    else { strokes(lw + 10, OUT); strokes(lw, PAL.accent); }       // cartoon X: accent colour with the usual outline
    ctx.restore();
  };

  // Arrow that draws itself, optionally curved (o.bend in px, perpendicular offset of the midpoint).
  K.arrow = (ctx, x1, y1, x2, y2, p, o = {}) => {
    if (p <= 0.001) return;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const bx = mx - ((y2 - y1) / len) * (o.bend || 0), by = my + ((x2 - x1) / len) * (o.bend || 0);
    const pt = (t) => [(1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * bx + t * t * x2, (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * by + t * t * y2];
    const q = E.outCubic(clamp(p)), N = 40;
    ctx.save(); ctx.globalAlpha *= o.a ?? 1; ctx.strokeStyle = o.color || OUT; ctx.lineWidth = o.lw || 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (o.dash) ctx.setLineDash(o.dash);
    ctx.beginPath(); ctx.moveTo(x1, y1);
    for (let i = 1; i <= N * q; i++) { const [x, y] = pt(i / N); ctx.lineTo(x, y); }
    ctx.stroke(); ctx.setLineDash([]);
    if (q > 0.85) {
      const [ex, ey] = pt(q), [px, py] = pt(Math.max(0, q - 0.05)), ang = Math.atan2(ey - py, ex - px), hs = o.head || 26;
      ctx.beginPath(); ctx.moveTo(ex - Math.cos(ang - 0.5) * hs, ey - Math.sin(ang - 0.5) * hs); ctx.lineTo(ex, ey); ctx.lineTo(ex - Math.cos(ang + 0.5) * hs, ey - Math.sin(ang + 0.5) * hs); ctx.stroke();
    }
    ctx.restore();
  };

  // Sparkle star (four points). Lime with a dark outline by default.
  K.star4 = (ctx, cx, cy, s, o = {}) => K.toon(ctx, () => {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.2 : s / 2, ang = (i / 8) * Math.PI * 2 - Math.PI / 2; ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r); }
    ctx.closePath();
  }, { fill: PAL.lime, lw: 4, shadow: false, ...o });
  // Burst of sparkles around (cx, cy) after t0, fading out over d seconds.
  K.burst = (ctx, cx, cy, T, t0, o = {}) => {
    const p = prog(T, t0, o.d ?? 0.9); if (p <= 0 || p >= 1) return;
    const n = o.n ?? 8, R = o.r ?? 140, rnd = K.rng(o.seed ?? 7);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + rnd() * 0.5, dist = R * (0.5 + 0.5 * E.outCubic(p)) * (0.8 + rnd() * 0.4);
      K.star4(ctx, cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist, (o.s ?? 34) * (1 - p * 0.6), { a: 1 - p, fill: i % 2 ? PAL.lime : PAL.vibrant });
    }
  };
  // Confetti: deterministic pieces falling from the top after t0 for dur seconds.
  K.confetti = (ctx, T, t0, o = {}) => {
    const dt = T - t0, dur = o.dur ?? 4; if (dt <= 0 || dt > dur + 2) return;
    const n = o.n ?? 90, rnd = K.rng(o.seed ?? 3), cols = [PAL.lime, PAL.vibrant, PAL.purple, PAL.white, PAL.lilac];
    const fade = 1 - clamp((dt - dur) / 1.5);
    for (let i = 0; i < n; i++) {
      const x0 = (o.x ?? 0) + rnd() * (o.w ?? K.W), delay = rnd() * 0.6, vy = 380 + rnd() * 380, sway = 30 + rnd() * 50, ph = rnd() * 6.28, sz = 14 + rnd() * 14, spin = (rnd() - 0.5) * 10;
      const t = dt - delay; if (t <= 0) continue;
      const y = (o.y ?? -40) + vy * t, x = x0 + Math.sin(t * 3 + ph) * sway;
      if (y > K.H + 40) continue;
      ctx.save(); ctx.globalAlpha *= fade; ctx.translate(x, y); ctx.rotate(spin * t + ph); ctx.scale(1, Math.abs(Math.cos(t * 4 + ph)) * 0.8 + 0.2);
      ctx.fillStyle = cols[i % cols.length]; K.rr(ctx, -sz / 2, -sz / 3, sz, sz * 0.66, 3); ctx.fill();
      if (!FLAT) { ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke(); }
      ctx.restore();
    }
  };

  // Name tag pill with outline (e.g. "Claude" under the buddy). Centered at (cx, cy).
  K.tag = (ctx, label, cx, cy, o = {}) => {
    const a = o.a ?? 1; if (a <= 0.001) return;
    const size = o.size || 34, w = K.measure(ctx, label, size, 700) + 48, h = size * 1.7;
    K.tbox(ctx, cx - w / 2, cy - h / 2, w, h, { a, r: h / 2, fill: o.fill || PAL.lime, lw: 4, sh: 5, noLint: true });
    K.text(ctx, label, cx, cy + size * 0.36, { size, weight: 700, align: 'center', color: o.color || PAL.dark, a });
  };

  // Illustration fitted into a box: anchored at bottom-center (cx, by), within maxW x maxH.
  // o: {a, s (scale around the bottom center), rot, dx, dy, flip}. Missing files draw a labelled placeholder.
  K.illusFit = (ctx, id, cx, by, maxW, maxH, o = {}) => {
    const a = o.a ?? 1; if (a <= 0.001) return null;
    const im = K.images['illus:' + id];
    let w, h;
    if (im) { const k = Math.min(maxW / im.width, maxH / im.height); w = im.width * k; h = im.height * k; } else { w = maxW; h = maxH; }
    const s = o.s ?? 1;
    ctx.save(); ctx.globalAlpha *= a;
    ctx.translate(cx + (o.dx || 0), by + (o.dy || 0)); if (o.rot) ctx.rotate(o.rot); ctx.scale(s * (o.flip ? -1 : 1), s);
    if (im) ctx.drawImage(im, -w / 2, -h, w, h);
    else {
      ctx.setLineDash([14, 10]); ctx.lineWidth = 4; ctx.strokeStyle = PAL.grayDark; K.rr(ctx, -w / 2, -h, w, h, 24); ctx.stroke();
      ctx.font = K.font(34, 600); ctx.fillStyle = PAL.grayDark; ctx.textAlign = 'center'; ctx.fillText(id, 0, -h / 2);
    }
    ctx.restore();
    if (K.lint && ctx.globalAlpha * a > 0.5) K.boxes.push({ kind: 'illus', x: cx - w / 2, y: by - h, w, h, id });
    return { x: cx - (w * s) / 2, y: by - h * s, w: w * s, h: h * s };
  };

  // Big title text for punchlines. Cartoon style: outlined with an offset shadow; flat style: plain fill with a soft shadow.
  K.bigText = (ctx, str, x, y, o = {}) => {
    const a = o.a ?? 1; if (a <= 0.001) return;
    const size = o.size || 140, effA = ctx.globalAlpha * a;
    ctx.save(); ctx.globalAlpha *= a; ctx.font = K.font(size, 700); ctx.textAlign = o.align || 'center'; ctx.lineJoin = 'round';
    if (FLAT) {
      if (SOFT) { ctx.shadowColor = SHADOW; ctx.shadowBlur = size * 0.2; ctx.shadowOffsetY = size * 0.06; }
      ctx.fillStyle = o.fill || PAL.accent; ctx.fillText(str, x, y);
    } else {
      ctx.fillStyle = SHADOW; ctx.fillText(str, x, y + size * 0.07);
      ctx.lineWidth = o.lw || Math.max(8, size * 0.08); ctx.strokeStyle = o.stroke || OUT; ctx.strokeText(str, x, y);
      ctx.fillStyle = o.fill || PAL.accent; ctx.fillText(str, x, y);
    }
    ctx.restore();
    if (K.lint && effA > 0.5) { const w = K.measure(ctx, str, size, 700); const x0 = o.align === 'left' ? x : o.align === 'right' ? x - w : x - w / 2; K.boxes.push({ kind: 'text', str, x: x0, y: y - size * 0.8, w, h: size, size }); }
  };
})();
