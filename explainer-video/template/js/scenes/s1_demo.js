/* s1_demo.js: a small demo scene so a fresh project renders. Replace it with your own scenes
   (s1_..., s2_... one file per chapter or two; the page picks up every file in js/scenes/).
   It shows the pattern: every beat is keyed to a spoken word with S.cue(), drawn with K primitives,
   registered for the storyboard (S.story), the sound effects (S.sfx) and the end card (S.endCard). */
(function () {
  'use strict';
  const { PAL, E, prog } = K;
  const { cue, story, sfx } = S;
  const title = (window.PROJECT && window.PROJECT.title) || 'Explainer';

  // ---- word keys (the phrases come from script/narration.md; a missing phrase throws and the file is skipped)
  const hello = cue('hello everyone'), example = cue('short example film', { ch: 1 }), keyed = cue('every beat', { ch: 1 });
  const moves = cue('animation moves', { ch: 1 });
  const write = cue('write the script', { ch: 2 }), record = cue('record the voice', { ch: 2 }), timing = cue('timing', { ch: 2 });
  const thanks = cue('thank you', { ch: 2 });
  S.C.hello = hello; S.C.thanks = thanks;                           // named cues show up in tools/cues.mjs
  S.endCard = thanks - 0.2;                                          // the chrome (logo, chapter pill) hides from here

  // ---- title card, before the narration starts
  S.add({
    id: 'open', t0: 0, exit: hello - 0.25,
    draw(ctx, T, X) {
      const a = K.slide(T, 0.2, { dy: 50, t1: X }), b = K.slide(T, 0.5, { dy: 40, t1: X });
      K.logo(ctx, 96, 70, 280, { a: K.enter(T, 0.05, { t1: X, d: 0.6, rise: 0 }).a });
      const size = K.fit(ctx, title, 1100, 132, 700, 60);
      K.tag(ctx, 'Example film', 290, 380 + a.dy, { a: a.a, size: 38 });
      K.bigText(ctx, title, 136, 560 + a.dy, { size, align: 'left', a: a.a });
      K.text(ctx, 'Built with the explainer-video template', 140, 660 + b.dy, { size: 40, weight: 600, color: PAL.primary, a: b.a });
      const p = K.pop(T, 0.7, { t1: X });
      K.at(ctx, 1400, 640, { a: p.a, s: p.s, dy: K.bob(T, 8) }, () => {
        K.folder(ctx, 1230, 420, 340, 260, { label: 'Folder' });
        K.doc(ctx, 1480, 340, 200, 250, { title: 'Doc', lines: 4 });
      });
      K.burst(ctx, 1400, 420, T, 1.0, { n: 8, r: 220, seed: 11 });
    },
  });
  sfx('pop', 0.7, 0.8); sfx('sparkle', 1.0, 0.7);
  story(2.0, 'Title card');

  // ---- chapter 1: three beats keyed to words
  S.add({
    id: '1-welcome', t0: hello,
    draw(ctx, T, X) {
      const h = K.pop(T, hello, { t1: moves + 1, d: 0.6 });
      K.at(ctx, 960, 340, { a: h.a, s: h.s, rot: K.wiggle(T, hello + 0.1, { amp: 0.04 }) }, () => K.bubble(ctx, 640, 270, 640, 140, { text: 'Hello everyone!', size: 64, weight: 700, tail: 'down', tailAt: 0.5 }));
      const chips = [['Short example', example, 560, 620], ['Keyed to a word', keyed, 1130, 620]];
      chips.forEach(([label, t, x, y]) => {
        const p = K.pop(T, t, { t1: X });
        K.at(ctx, x, y, { a: p.a, s: p.s }, () => {
          const w = K.measure(ctx, label, 48, 700) + 80;
          K.tbox(ctx, x - w / 2, y - 60, w, 120, { r: 60, fill: PAL.white, id: 'chip' });
          K.text(ctx, label, x, y + 17, { size: 48, weight: 700, align: 'center' });
        });
      });
      K.arrow(ctx, 760, 720, 1000, 800, E.outCubic(prog(T, keyed + 0.3, 0.6)), { bend: 40, a: K.enter(T, keyed, { t1: X }).a });
      // a bar that fills as the narration moves on
      const bp = K.slide(T, moves, { dy: 40, t1: X });
      K.at(ctx, 960, 880, { a: bp.a, dy: bp.dy }, () => {
        K.tbox(ctx, 460, 810, 1000, 150, { fill: PAL.white, id: 'bar' });
        K.text(ctx, 'Animation follows the voice', 960, 870, { size: 44, weight: 600, align: 'center' });
        K.bar(ctx, 520, 900, 880, 30, E.inOutCubic(prog(T, moves + 0.2, 2.0)), { fill: PAL.accent, track: PAL.bg });
      });
    },
  });
  sfx('pop', hello, 0.8); sfx('pop', example, 0.7); sfx('pop', keyed, 0.7); sfx('whoosh', moves, 0.6);
  story(example + 0.9, 'Hello bubble and the first chip');
  story(moves + 2.4, 'Bar filled, animation follows the voice');

  // ---- chapter 2: three steps tick in turn
  S.add({
    id: '2-wrap-up', t0: write,
    draw(ctx, T, X) {
      const steps = [['1', 'Write', write], ['2', 'Record', record], ['3', 'Time it', timing]];
      steps.forEach(([n, label, t], i) => {
        const cx = 360 + i * 600, cy = 560, p = K.pop(T, t, { t1: X, over: 2 });
        K.at(ctx, cx, cy, { a: p.a, s: p.s }, () => {
          K.tbox(ctx, cx - 230, cy - 200, 460, 400, { fill: PAL.white, id: 'step' });
          K.circle(ctx, cx, cy - 90, 64, { fill: PAL.primary });
          K.text(ctx, n, cx, cy - 66, { size: 72, weight: 700, color: PAL.white, align: 'center' });
          K.text(ctx, label, cx, cy + 70, { size: 64, weight: 700, align: 'center' });
        });
        K.tick(ctx, cx + 190, cy - 170, 70, E.outCubic(prog(T, t + 0.5, 0.4)), { fill: PAL.accent });
      });
    },
  });
  sfx('pop', write, 0.8); sfx('pop', record, 0.7); sfx('ding', timing + 0.5, 0.7);
  story(timing + 1.2, 'Three steps ticked');

  // ---- end card (hides the chrome via S.endCard)
  S.add({
    id: 'end', t0: thanks - 0.2,
    draw(ctx, T) {
      const e = K.enter(T, thanks - 0.2, { d: 0.6, rise: 0 }), p = K.pop(T, thanks + 0.1);
      ctx.save(); ctx.globalAlpha = e.a; ctx.fillStyle = PAL.primary; ctx.fillRect(0, 0, K.W, K.H); ctx.restore();
      K.logo(ctx, 960 - 200, 250, 400, { white: true, a: e.a });
      K.at(ctx, 960, 560, { a: p.a, s: p.s }, () => K.bigText(ctx, 'Thank you!', 960, 600, { size: 150, fill: PAL.highlight }));
      // Label only what is actually AI-generated in this film (voice, illustrations, music), once, on the end card.
      K.text(ctx, 'Voice, illustrations and music are AI-generated.', 960, 900, { size: 36, weight: 600, color: PAL.white, align: 'center', a: K.enter(T, thanks + 0.6, { rise: 0 }).a });
      K.confetti(ctx, T, thanks + 0.1, { dur: 3 });
    },
  });
  sfx('tada', thanks, 0.8);
  story(thanks + 1.4, 'End card');
})();
