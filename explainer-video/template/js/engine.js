/* engine.js: a small, dependency-free, deterministic 2D engine. The look comes from window.THEME
   (js/theme.js): palette roles, font, logo files, shape style (outline, shadow, radius) and chrome.
   Everything is a pure function of time, so the browser preview and the MP4 render match frame
   for frame. Every text and card draw is registered for the layout lint (K.boxes). */
(function () {
  'use strict';
  const TH = window.THEME;
  if (!TH || !TH.palette) throw new Error('js/theme.js must load before engine.js (window.THEME missing)');
  const W = 1920, H = 1080;
  const P = TH.palette;
  // colour helpers (hex "#RRGGBB" only, which is what theme.js holds)
  const rgb = (hex) => { const h = hex.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const rgba = (hex, a) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; };
  const mix = (hex, other, t) => { const p = rgb(hex), q = rgb(other); return '#' + p.map((v, i) => Math.round(v + (q[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  // Palette: ROLE names (ink, primary, accent, highlight, bg, surface, line, accentTint, bgTint, muted) and the
  // legacy aliases the first scenes were written with (dark, purple, vibrant, green/lime, light, gray, lilac, mist, grayDark).
  const PAL = {
    ink: P.ink, primary: P.primary, accent: P.accent, highlight: P.highlight, bg: P.bg, surface: P.surface, line: P.line,
    accentTint: P.accentTint, bgTint: P.bgTint, muted: P.muted,
    dark: P.ink, purple: P.primary, vibrant: P.accent, green: P.highlight, lime: P.highlight, light: P.bg, gray: P.line,
    lilac: P.accentTint, mist: P.bgTint, grayDark: P.muted, white: '#FFFFFF', black: '#000000',
    // tints and shadows derived from the roles (states only, never for text or icons)
    purpleTint: mix(P.primary, '#FFFFFF', 0.87), vibrantTint: mix(P.accent, '#FFFFFF', 0.85),
    ink60: rgba(P.ink, 0.62), shadow: rgba(P.primary, 0.10),
  };
  const ST = { outline: 5, shadow: 'offset', radius: 28, ...(TH.style || {}) };
  const SAFE = { x0: 96, y0: 54, x1: W - 96, y1: H - 54 };
  const K = { W, H, PAL, SAFE, THEME: TH, STYLE: ST, rgba, mix, hex2rgb: rgb, T: 0, images: {}, boxes: [], lint: false, logoRatio: {} };

  // ---------- math and easing --------------------------------------------------------------
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const E = {
    linear: (t) => t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outQuint: (t) => 1 - Math.pow(1 - t, 5),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  };
  const prog = (t, t0, d) => (d <= 0 ? (t >= t0 ? 1 : 0) : clamp((t - t0) / d));
  Object.assign(K, { clamp, lerp, E, prog });

  // Appear at t0 (fade + rise), optionally leave at t1. Returns {a, dy} for a draw call.
  K.enter = (t, t0, { d = 0.5, rise = 24, t1 = Infinity, out = 0.4 } = {}) => {
    const pin = E.outCubic(prog(t, t0, d)), pout = t1 === Infinity ? 0 : E.inOutCubic(prog(t, t1, out));
    return { a: pin * (1 - pout), dy: (1 - pin) * rise - pout * rise * 0.5, p: pin };
  };
  K.ease = (t, t0, d, a, b, ez = E.inOutCubic) => lerp(a, b, ez(prog(t, t0, d)));

  // ---------- shapes -----------------------------------------------------------------------
  K.rr = (ctx, x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  };
  // Card: surface fill, rounded, 1 px line-colour border, a soft tinted shadow.
  K.card = (ctx, x, y, w, h, o = {}) => {
    const a = o.a ?? 1; if (a <= 0.001) return;
    const r = o.r ?? Math.round(ST.radius * 0.7), effA = ctx.globalAlpha * a;
    ctx.save(); ctx.globalAlpha *= a;
    if (o.shadow !== false) { ctx.shadowColor = PAL.shadow; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8; }
    K.rr(ctx, x, y, w, h, r); ctx.fillStyle = o.fill || PAL.surface; ctx.fill();
    ctx.shadowColor = 'transparent';
    if (o.stroke !== false) { ctx.lineWidth = o.lw || 2; ctx.strokeStyle = o.stroke || PAL.gray; ctx.stroke(); }
    ctx.restore();
    if (K.lint && effA > 0.5 && !o.noLint) K.boxes.push({ kind: 'card', x, y, w, h, id: o.id || '' });
  };
  // Text with optional wrapping. o: {size, weight, color, align, maxW, lh, a, small}
  // Font: THEME.font {family, weights}. A weight the theme does not list maps to the nearest listed one.
  const FAM = TH.font && TH.font.family || 'Inter', WTS = (TH.font && TH.font.weights) || [400, 600, 700];
  const nearestW = (w) => WTS.reduce((b, v) => (Math.abs(v - w) < Math.abs(b - w) ? v : b), WTS[0]);
  K.fontFamily = FAM; K.fontWeights = WTS;
  K.font = (size, weight = 400) => `${nearestW(weight)} ${size}px "${FAM}", Arial, sans-serif`;
  K.wrap = (ctx, str, maxW) => {
    const out = []; let line = '';
    for (const w of String(str).split(' ')) {
      const test = line ? line + ' ' + w : w;
      if (maxW && ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
    }
    if (line) out.push(line);
    return out;
  };
  K.text = (ctx, str, x, y, o = {}) => {
    const a = o.a ?? 1; if (a <= 0.001) return { w: 0, h: 0, lines: 1 };
    const size = o.size || 44, lh = (o.lh || 1.2) * size;
    ctx.save(); ctx.globalAlpha *= a;
    ctx.font = K.font(size, o.weight || 400); ctx.fillStyle = o.color || PAL.dark;
    ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'alphabetic';
    const lines = K.wrap(ctx, str, o.maxW);
    let wmax = 0;
    lines.forEach((ln, i) => { ctx.fillText(ln, x, y + i * lh); wmax = Math.max(wmax, ctx.measureText(ln).width); });
    const effA = ctx.globalAlpha;                                  // includes any parent group alpha (K.at)
    ctx.restore();
    const h = (lines.length - 1) * lh + size * 1.0;
    const x0 = o.align === 'center' ? x - wmax / 2 : o.align === 'right' ? x - wmax : x;
    if (K.lint && effA > 0.5) K.boxes.push({ kind: 'text', str: String(str), x: x0, y: y - size * 0.8, w: wmax, h, size, small: !!o.small });
    return { w: wmax, h, lines: lines.length };
  };
  K.measure = (ctx, str, size, weight = 400) => { ctx.save(); ctx.font = K.font(size, weight); const w = ctx.measureText(str).width; ctx.restore(); return w; };

  // Chip: rounded label, optional icon. Returns width.
  K.chip = (ctx, label, x, y, o = {}) => {
    const a = o.a ?? 1, size = o.size || 36, padX = o.padX ?? 28, h = o.h || Math.round(size * 1.9);
    const iconS = o.icon ? Math.round(size * 1.15) : 0, gap = o.icon ? 14 : 0;
    const w = o.w || K.measure(ctx, label, size, o.weight || 600) + padX * 2 + iconS + gap;
    const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    if (a <= 0.001) return w;
    K.card(ctx, x0, y, w, h, { a, r: o.r ?? Math.round(ST.radius / 2), fill: o.fill || PAL.surface, stroke: o.stroke ?? PAL.gray, shadow: o.shadow ?? false, noLint: true });
    if (o.icon) K.icon(ctx, o.icon, x0 + padX + iconS / 2, y + h / 2, iconS, { a, white: o.whiteIcon });
    K.text(ctx, label, x0 + padX + iconS + gap, y + h / 2 + size * 0.36, { size, weight: o.weight || 600, color: o.color || PAL.dark, a, small: o.small });
    return w;
  };

  // Library icon by id: the colour variant (brand colour on light surfaces) or white on dark ones.
  // Files: assets/icons/<id>_<THEME.icons.color>.svg and <id>_<THEME.icons.white>.svg (see main.js).
  K.icon = (ctx, id, cx, cy, s, o = {}) => {
    const a = o.a ?? 1; if (a <= 0.001) return;
    const im = K.images[`icon:${id}:${o.white ? 'white' : 'color'}`];
    if (!im) throw new Error(`icon "${id}" is not loaded. This brand ("${(K.THEME || {}).brand}") ships ${Object.keys(K.images).filter((k) => k.startsWith('icon:') && k.endsWith(':color')).length} icons. Put assets/icons/${id}_${((K.THEME || {}).icons || {}).color || 'color'}.svg and ${id}_${((K.THEME || {}).icons || {}).white || 'white'}.svg in the project, and register the id with S.icons('${id}') at the top of the scene file. Scenes of a brand without icons should not call K.icon, K.badge or K.chip({icon}).`);
    ctx.save(); ctx.globalAlpha *= a; ctx.drawImage(im, cx - s / 2, cy - s / 2, s, s); ctx.restore();
  };
  // Round icon badge: a background-tint or primary-colour disc with the icon inside.
  K.badge = (ctx, id, cx, cy, s, o = {}) => {
    const a = o.a ?? 1; if (a <= 0.001) return;
    ctx.save(); ctx.globalAlpha *= a;
    ctx.beginPath(); ctx.arc(cx, cy, s / 2, 0, Math.PI * 2); ctx.fillStyle = o.dark ? PAL.primary : PAL.bg; ctx.fill();
    ctx.restore();
    K.icon(ctx, id, cx, cy, s * 0.56, { a, white: !!o.dark });
  };

  // Connector: a line that draws itself from (x1,y1) to (x2,y2), elbowed if o.elbow ('h' or 'v').
  K.connector = (ctx, x1, y1, x2, y2, p, o = {}) => {
    if (p <= 0.001) return;
    const pts = o.elbow === 'h' ? [[x1, y1], [(x1 + x2) / 2, y1], [(x1 + x2) / 2, y2], [x2, y2]]
      : o.elbow === 'v' ? [[x1, y1], [x1, (y1 + y2) / 2], [x2, (y1 + y2) / 2], [x2, y2]] : [[x1, y1], [x2, y2]];
    const seg = []; let total = 0;
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); total += l; }
    let left = total * clamp(p);
    ctx.save(); ctx.globalAlpha *= o.a ?? 1;
    ctx.strokeStyle = o.color || PAL.purple; ctx.lineWidth = o.lw || 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (o.dash) ctx.setLineDash(o.dash);
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length && left > 0; i++) {
      const f = Math.min(1, left / seg[i - 1]);
      ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)); left -= seg[i - 1];
    }
    ctx.stroke();
    if (o.dots && p >= 1) for (const [x, y] of [pts[0], pts[pts.length - 1]]) { ctx.beginPath(); ctx.arc(x, y, (o.lw || 4) * 2, 0, Math.PI * 2); ctx.fillStyle = o.color || PAL.purple; ctx.fill(); }
    ctx.restore();
  };
  // Connection tab: a small rounded square bridging two cards.
  K.tab = (ctx, cx, cy, s = 28, o = {}) => {
    const a = o.a ?? 1; if (a <= 0.001) return;
    ctx.save(); ctx.globalAlpha *= a;
    K.rr(ctx, cx - s / 2, cy - s / 2, s, s, s * 0.3); ctx.fillStyle = o.fill || PAL.purple; ctx.fill();
    ctx.restore();
  };
  // Check mark drawn as a stroke (for ticks inside discs).
  K.tick = (ctx, cx, cy, s, p, o = {}) => {
    if (p <= 0.001) return;
    ctx.save(); ctx.globalAlpha *= o.a ?? 1;
    ctx.beginPath(); ctx.arc(cx, cy, s / 2, 0, Math.PI * 2); ctx.fillStyle = o.fill || PAL.purple; ctx.fill();
    const pts = [[-0.22, 0.02], [-0.06, 0.18], [0.24, -0.16]].map(([x, y]) => [cx + x * s, cy + y * s]);
    ctx.strokeStyle = o.color || PAL.white; ctx.lineWidth = s * 0.1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    const l1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), l2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
    const q = E.outCubic(clamp(p)) * (l1 + l2);
    if (q <= l1) ctx.lineTo(lerp(pts[0][0], pts[1][0], q / l1), lerp(pts[0][1], pts[1][1], q / l1));
    else { ctx.lineTo(pts[1][0], pts[1][1]); ctx.lineTo(lerp(pts[1][0], pts[2][0], (q - l1) / l2), lerp(pts[1][1], pts[2][1], (q - l1) / l2)); }
    ctx.stroke(); ctx.restore();
  };
  // Progress bar with rounded ends.
  K.bar = (ctx, x, y, w, h, p, o = {}) => {
    const a = o.a ?? 1; if (a <= 0.001) return;
    ctx.save(); ctx.globalAlpha *= a;
    K.rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = o.track || PAL.light; ctx.fill();
    if (p > 0.001) { K.rr(ctx, x, y, Math.max(h, w * clamp(p)), h, h / 2); ctx.fillStyle = o.fill || PAL.vibrant; ctx.fill(); }
    ctx.restore();
  };
  // Brand logo from THEME.logo (never redrawn; the file is drawn as is). x, y = top-left of the image box, w = width.
  // The aspect ratio is read from the loaded image (K.logoRatio, set by main.js), not hardcoded. Returns the height.
  K.logo = (ctx, x, y, w, o = {}) => {
    const a = o.a ?? 1; if (a <= 0.001) return 0;
    const key = o.white ? 'white' : 'color', im = K.images['logo_' + key];
    if (!im) return 0;                                       // no logo configured or file missing: draw nothing
    const h = w * (K.logoRatio[key] || 0.3);
    ctx.save(); ctx.globalAlpha *= a; ctx.drawImage(im, x, y, w, h); ctx.restore();
    return h;
  };
  // Illustration (cut-out PNG). x, y = top-left; w = width. o: {a, dy, zoom (0..1 progress), z (max extra scale)}
  K.illus = (ctx, id, x, y, w, o = {}) => {
    const a = o.a ?? 1, im = K.images['illus:' + id];
    if (!im) throw new Error('missing illustration ' + id);
    const h = w * im.height / im.width;
    if (a <= 0.001) return h;
    const effA = ctx.globalAlpha * a;
    const s = 1 + (o.z ?? 0.025) * (o.zoom ?? 0);
    ctx.save(); ctx.globalAlpha *= a;
    ctx.translate(x + w / 2, y + h / 2 + (o.dy || 0)); ctx.scale(s, s);
    ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
    K.illusA = Math.max(K.illusA || 0, a);
    if (K.lint && effA > 0.5) K.boxes.push({ kind: 'illus', x, y, w, h, id });
    return h;
  };
  K.bg = (ctx, color = PAL.bg) => { ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); };
  K.gradient = (ctx, c0, c1, angle = 0.35) => {
    const g = ctx.createLinearGradient(W * (0.5 - Math.cos(angle) / 2), H * (0.5 - Math.sin(angle) / 2), W * (0.5 + Math.cos(angle) / 2), H * (0.5 + Math.sin(angle) / 2));
    g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  };
  // Largest font size (<= max) at which str fits in maxW.
  K.fit = (ctx, str, maxW, max, weight = 700, min = 34) => {
    for (let s = max; s > min; s -= 2) if (K.measure(ctx, str, s, weight) <= maxW) return s;
    return min;
  };
  // Number formatting for settling counters
  K.fmt = (n) => Math.round(n).toLocaleString('en-US');

  // ---------- layout lint ------------------------------------------------------------------
  // Text inside the safe area, minimum sizes, no text over other text.
  K.lintFrame = () => {
    const issues = [];
    const texts = K.boxes.filter((b) => b.kind === 'text');
    for (const b of texts) {
      if (b.x < SAFE.x0 - 1 || b.x + b.w > SAFE.x1 + 1 || b.y < SAFE.y0 - 1 || b.y + b.h > SAFE.y1 + 1) issues.push(`outside safe area: "${b.str.slice(0, 40)}" (${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.w)}x${Math.round(b.h)})`);
      if (b.size < (b.small ? 26 : 34)) issues.push(`text too small (${b.size}px): "${b.str.slice(0, 40)}"`);
    }
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
      const p = texts[i], q = texts[j];
      const ox = Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x), oy = Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y);
      if (ox > 4 && oy > 4) issues.push(`text overlap: "${p.str.slice(0, 30)}" / "${q.str.slice(0, 30)}"`);
    }
    return issues;
  };

  window.K = K;
})();
