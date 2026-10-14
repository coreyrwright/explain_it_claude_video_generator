/* main.js: asset loading (icons, illustrations, logo and fonts from THEME), browser playback synced to the audio clock, and the deterministic
   hooks used by the tools: __seek(t) for rendering, __lint(t) for the layout lint, __info. */
(function () {
  'use strict';
  const ICONS = [...new Set([...S.ICONS, ...((K.THEME.icons || {}).ids || [])])];                       // registered by the scene files with S.icons()
  const ILLUS = [...S.ILLUS];                       // registered with S.illus(); missing files draw a placeholder unless ?strict
  const params = new URLSearchParams(location.search);
  const RENDER = params.has('render');
  window.__strict = params.has('strict');
  window.__missing = [];
  // Player colours follow the theme (index.html uses these CSS variables).
  const PL = K.THEME.palette, rootStyle = document.documentElement.style;
  [['ink', PL.ink], ['primary', PL.primary], ['accent', PL.accent], ['highlight', PL.highlight], ['bg', PL.bg], ['muted', PL.line]].forEach(([k, v]) => rootStyle.setProperty('--' + k, v));
  const FAM = K.fontFamily, WTS = K.fontWeights, LOGO = K.THEME.logo || {}, ICO = { color: 'color', white: 'white', ...(K.THEME.icons || {}) };
  const canvas = document.getElementById('stage');
  if (window.PROJECT) { document.title = window.PROJECT.title; canvas.setAttribute('aria-label', window.PROJECT.title); }
  document.documentElement.style.setProperty('--font', `"${K.fontFamily}"`);
  const ctx = canvas.getContext('2d');
  canvas.width = K.W; canvas.height = K.H;
  if (RENDER) document.body.classList.add('render');

  const loadImage = (key, src) => new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => { K.images[key] = im; res(); };
    im.onerror = () => rej(new Error('failed to load ' + src));
    im.src = src;
  });

  async function boot() {
    await Promise.all([
      ...ICONS.flatMap((id) => ['color', 'white'].map((c) => loadImage(`icon:${id}:${c}`, `assets/icons/${id}_${ICO[c]}.svg`).catch((e) => { throw new Error(`icon "${id}" registered with S.icons() but assets/icons/${id}_${ICO[c]}.svg is missing. Add the file (a brand ships icons in brands/<id>/icons/) or remove the id from S.icons().`); }))),
      ...ILLUS.map((id) => loadImage(`illus:${id}`, `assets/illus/${id}.png`).catch((e) => { if (window.__strict) throw e; window.__missing.push(id); })),
      // brand logo files (THEME.logo.color on light surfaces, THEME.logo.white on dark ones); optional
      ...['color', 'white'].filter((k) => LOGO[k]).map((k) => loadImage('logo_' + k, LOGO[k]).then(() => {
        const im = K.images['logo_' + k];                  // aspect ratio from the loaded image, not hardcoded
        K.logoRatio[k] = im.naturalWidth > 0 && im.naturalHeight > 0 ? im.naturalHeight / im.naturalWidth : 0.3;
      }).catch((e) => { if (window.__strict) throw e; window.__missing.push('logo:' + k); })),
      ...WTS.map((w) => document.fonts.load(`${w} 64px "${FAM}"`)),
    ]);
    await document.fonts.ready;
    if (!document.fonts.check(`${WTS[WTS.length - 1]} 64px "${FAM}"`)) throw new Error(`font ${FAM} did not load (check css/fonts.css and fonts/)`);
    window.__info = { end: Scenes.END, pre: Scenes.PRE, music: Scenes.MUSIC, chapters: Scenes.CH, story: Scenes.STORY, sfx: Scenes.SFX, cues: Scenes.C, estimated: !!window.VO_TIMING.estimated, missing: window.__missing };
    window.__seek = (t) => { Scenes.frame(ctx, t); return true; };
    window.__lint = (t) => { K.lint = true; Scenes.frame(ctx, t); K.lint = false; return K.lintFrame(); };
    window.__ready = true;
    if (!RENDER) setupPlayer(); else Scenes.frame(ctx, 0);
  }

  function setupPlayer() {
    const audio = document.getElementById('mix');
    const btn = document.getElementById('play'), bar = document.getElementById('scrub'), time = document.getElementById('time'), cover = document.getElementById('cover');
    const END = Scenes.END;
    bar.max = END; bar.step = 0.01;
    let playing = false, clockStart = 0, clockOffset = 0, useClock = false;
    audio.addEventListener('error', () => { useClock = true; });
    const now = () => (useClock ? clockOffset + (playing ? (performance.now() - clockStart) / 1000 : 0) : audio.currentTime);
    const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    function draw() {
      const t = Math.min(now(), END);
      Scenes.frame(ctx, t);
      bar.value = t; time.textContent = `${fmt(t)} / ${fmt(END)}`;
      if (t >= END - 0.001 && playing) pause(true);
      if (playing) requestAnimationFrame(draw);
    }
    function play() {
      if (now() >= END - 0.05) seek(0);
      playing = true; cover.classList.add('hidden'); btn.textContent = 'Pause';
      if (useClock) clockStart = performance.now();
      else audio.play().catch(() => { useClock = true; clockOffset = audio.currentTime; clockStart = performance.now(); });
      requestAnimationFrame(draw);
    }
    function pause(ended) {
      if (useClock) clockOffset = now();
      playing = false; audio.pause(); btn.textContent = ended ? 'Replay' : 'Play';
    }
    function seek(t) {
      t = Math.max(0, Math.min(END, t));
      if (useClock) { clockOffset = t; clockStart = performance.now(); } else audio.currentTime = t;
      if (!playing) { Scenes.frame(ctx, t); bar.value = t; time.textContent = `${fmt(t)} / ${fmt(END)}`; }
    }
    btn.onclick = () => (playing ? pause() : play());
    cover.onclick = play;
    bar.oninput = () => seek(parseFloat(bar.value));
    document.getElementById('fs').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.getElementById('frame').requestFullscreen());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); playing ? pause() : play(); }
      if (e.keyCode === 39 /* right arrow */) seek(now() + 5);
      if (e.code === 'ArrowLeft') seek(now() - 5);
      if (e.key === 'f') document.getElementById('fs').click();
    });
    Scenes.frame(ctx, Math.min(1.6, Scenes.PRE - 0.4));
    time.textContent = `0:00 / ${fmt(END)}`;
  }

  boot().catch((e) => { window.__error = String(e && e.stack || e); console.error(e); });
})();
