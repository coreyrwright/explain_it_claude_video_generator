/* core.js: timing contract and scene registry (window.S), shared by every scene file.
   Every beat is keyed to a spoken word with S.cue(), using the narration's word timings
   (js/vo-timing.js), so the animation re-times itself whenever the narration changes. */
(function () {
  'use strict';
  const PRE = 2.4;                                  // seconds of title card before the narration starts
  const LEAD = 0.06;                                // beats land two frames before their word
  const VO = window.VO_TIMING, VOW = VO.words;
  const CH = VO.chapters.map((c) => PRE + c.t0);    // chapter starts, master time (CH[0] = chapter 1)

  // cue('phrase') -> master time of the first matching word sequence.
  // opts: a number (search after this master time) or {ch: n (search from chapter n), after: t, end: true (time of the last word's end)}
  function cue(phrase, opts = 0) {
    const o = typeof opts === 'number' ? { after: opts } : opts;
    const after = Math.max(o.after || 0, o.ch ? CH[o.ch - 1] - 0.01 : 0);
    const toks = phrase.toLowerCase().replace(/[’]/g, "'").split(/[\s\-]+/).map((w) => w.replace(/[^a-z0-9']/g, '')).filter(Boolean);
    for (let i = 0; i + toks.length <= VOW.length; i++) {
      if (PRE + VOW[i][1] < after - 0.001) continue;
      if (toks.every((tk, j) => VOW[i + j][0] === tk)) return PRE + (o.end ? VOW[i + toks.length - 1][2] : VOW[i][1] - LEAD);
    }
    throw new Error(`cue "${phrase}" ${JSON.stringify(o)} not found`);
  }
  // End time of the narration word at a cue (for holding something until a word finishes).
  const cueEnd = (phrase, opts = 0) => cue(phrase, typeof opts === 'number' ? { after: opts, end: true } : { ...opts, end: true });

  const BPM = (window.PROJECT && window.PROJECT.music && window.PROJECT.music.bpm) || 112, BAR = (60 / BPM) * 4;
  const lastEnd = PRE + VOW[VOW.length - 1][2];
  const MUSIC = { t0: 0, bpm: BPM, bar: BAR, final: Math.ceil((lastEnd + 0.6) / BAR) * BAR };
  const END = MUSIC.final + 4.0;

  const S = {
    PRE, CH, END, MUSIC, lastEnd, cue, cueEnd,
    TITLES: VO.chapters.map((c) => c.title),
    C: {},                       // named cues (exported to the tools as __info.cues)
    STORY: [], SFX: [], SCENES: [],
    ICONS: new Set(), ILLUS: new Set(),
    endCard: null,               // master time the end card starts (a scene sets S.endCard = t); chrome (logo, chapter pill) hides from here
    FX: [],                      // music direction, registered with S.musicFx()
  };
  S.story = (t, label) => S.STORY.push({ t: +t.toFixed(2), label });
  S.sfx = (name, t, gain = 1) => S.SFX.push({ name, t: +t.toFixed(3), gain });
  // Music direction for tools/mix.py (exported in cues.json as music.fx), registered by the scenes that want it:
  //   S.musicFx('cut', t)   stops the music at t (e.g. on a record-scratch effect)
  //   S.musicFx('in', t)    restarts it on the first downbeat at or after t
  //   S.musicFx('low', t)   muffles it (low-pass and quieter) from t, for a sad or tense part
  //   S.musicFx('full', t)  restores it
  S.musicFx = (type, t) => { if (!['cut', 'in', 'low', 'full'].includes(type)) throw new Error('musicFx: unknown type ' + type); S.FX.push({ type, t: +t.toFixed(3) }); };
  S.add = (scene) => { S.SCENES.push(scene); return scene; };
  S.icons = (...ids) => ids.forEach((i) => S.ICONS.add(i));
  S.illus = (...ids) => ids.forEach((i) => S.ILLUS.add(i));
  S.en = (T, t0, X, o = {}) => K.enter(T, t0, { t1: X, ...o });
  window.S = S;
})();
