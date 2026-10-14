# Brief for scene animators

You animate one or two chapters of a 1920x1080 canvas explainer (about 3 to 4 minutes, narrated). Read `PLAN.md` (look, characters, storyboard, sound effects) and this brief before writing code. Your files are listed in your task; edit nothing else.

## How the film works

- `index.html` loads, in order: `js/theme.js` (the brand look: palette roles, font, logo, style), `js/project-config.js` (generated from `project.json`), `js/vo-timing.js` (narration word timings), `js/engine.js` (K: base drawing, text, icons, easing), `js/kit.js` (K: the shape kit), `js/core.js` (S: cues and scene registry), every file in `js/scenes/` (sorted by name), `js/assemble.js`, `js/main.js`.
- Animation is a pure function of time T (seconds). No state between frames, no Date, no Math.random (use `K.rng(seed)`). The renderer seeks to arbitrary times.
- Each scene file is an IIFE that registers scenes with `S.add({ id, t0, exit?, draw(ctx, T, X) })`. A scene is drawn while `t0 - 0.01 <= T < exit + 0.5`; `exit` defaults to the next scene's `t0 - 0.3`. X is the exit time: pass it as `t1` to `K.pop`, `K.slide`, `S.en` so your elements leave smoothly. The background (`PAL.bg`) is cleared every frame by the assembler; you may paint your own backdrop.
- Timing: never hardcode absolute times. Key every beat to a spoken word: `S.cue('phrase')` returns the master time of the first match (searches the whole film; use `S.cue('phrase', { ch: 3 })` to search from chapter 3, or `{ after: t }`; `{ end: true }` gives the end of the last word; `S.cueEnd(...)` is a shortcut). Phrases are lowercased word tokens of `script/narration.md` (punctuation dropped, hyphens split: "GDPR-compliant" is `gdpr compliant`, "let's" is `let's`, "notes.md" is `notesmd`). A missing phrase throws at load and your whole file disappears from the film, so check the browser log. `S.CH[n-1]` is the start of chapter n.
- The timings may be ESTIMATED while you work; the real narration replaces `js/vo-timing.js` later. Because you key to words, your beats move with it. Leave each beat on screen long enough to read; do not assume exact gaps.
- Register one storyboard still per beat: `S.story(t, 'what the viewer sees')` (t = a moment when the beat is fully visible). Register sound effects: `S.sfx(name, t, gain)` with names from PLAN.md only. Sparse: not every pop needs a sound.
- Music direction (optional): `S.musicFx('cut', t)` stops the music, `S.musicFx('in', t)` restarts it on the next downbeat, `S.musicFx('low', t)` muffles it for a sad or tense part, `S.musicFx('full', t)` restores it. Register them from the scene that owns the moment.
- End card: set `S.endCard = t` (master time the end card starts); the chrome (logo, chapter pill) hides from there.
- Register what you load: `S.illus('id', ...)` for illustrations (ids from PLAN.md; files in `assets/illus/`; a missing file draws a labelled placeholder) and `S.icons('id', ...)` for icons (`assets/icons/<id>_<color>.svg` and `_white.svg`; list them with `ls assets/icons`). Follow the brand rules in PLAN.md (icon colours, never recolored, always next to a text label).

## Drawing API (read `js/engine.js` and `js/kit.js`; they are short)

- Text: `K.text(ctx, str, x, y, {size, weight, color, align, maxW, a})` (y is the baseline). `K.bigText` for punchline text. `K.measure`, `K.fit`.
- Shapes (they follow the theme: outlined cartoon or clean flat, offset or soft shadow, theme corner radius): `K.tbox` (rounded box), `K.circle`, `K.toon(ctx, pathFn, o)` for any custom path, `K.bubble` (speech bubble with tail and text), `K.folder`, `K.doc`, `K.window` (app window, returns content rect), `K.laptop`, `K.padlock`, `K.spinner`, `K.cross`, `K.arrow` (draws itself, can bend), `K.star4`, `K.burst` (sparkle burst), `K.confetti`, `K.tag` (name tag), `K.tick` (check mark disc), `K.bar` (progress bar), `K.chip`, `K.badge`, `K.icon`, `K.connector`, `K.logo`, `K.illusFit(ctx, id, cx, bottomY, maxW, maxH, {a, s, flip, rot})` for characters. Anything that appears in more than one chapter belongs in `js/kit.js` (one place, one look); add it there and to `tools/kit-test.mjs`.
- Motion: `K.pop(T, t0, {t1: X})` -> {a, s} (pop-in with small overshoot), `K.slide(T, t0, {dx, dy, t1: X})` -> {a, dx, dy}, `S.en(T, t0, X)` -> {a, dy} (fade and rise), `K.bob(T, amp)`, `K.wiggle(T, t0)`, `K.squash(T, t0)`, `K.typed(str, T, t0, cps)`, `K.at(ctx, cx, cy, {a, s, rot, dx, dy}, fn)` to draw a group scaled or rotated around a pivot.
- Palette: `K.PAL` by ROLE: `ink` (text, outlines), `primary`, `accent`, `highlight` (small pops, never body text), `bg`, `surface`, `line`, `accentTint`, `bgTint`, `muted`. Older scenes use the legacy aliases (`dark`, `purple`, `vibrant`, `lime`, `light`, `gray`, `lilac`, `mist`, `grayDark`, plus `white`, `black`); both work. No new colours. Check the brand rules in PLAN.md for colours that are forbidden (for example a bad state may not be red).

## Layout rules (checked by the layout lint)

- Safe area: x 96 to 1824, y 54 to 1026. During the chapters the top band y < 130 is reserved for the chapter pill (top left) and the logo (top right) when `THEME.chrome` has them on: keep your content at y >= 140.
- Text at least 34 px (26 px only for tiny footnotes, passed `small: true`); most text 44 px or larger, because people watch on a meeting-room screen. Short words on screen, not sentences: the narrator says the sentences.
- No text on top of other text. Leave air: one strong idea per beat, at most two or three groups on screen. Characters are large (300 to 650 px tall), friendly, and react (bob, wiggle, squash).
- Everything you draw must leave by the scene's exit (pass X).
- On-screen text follows the brand language rules in PLAN.md, sentence case, no em dashes, no emoji.

## Testing (from `tools/`)

- `node cues.mjs "phrase one" "phrase two"` prints chapter starts, your named cues (`S.C`), scenes, music direction, story beats, sound effects, page errors, and the time of any phrases you pass. Use it first to plan.
- `node stills.mjs ../review/<yourdir> 12.5 14 20` renders frames at those master times. Look at them with the Read tool (1920x1080 JPEGs).
- `node storyboard.mjs ../review/sb_<yourdir>` renders every story beat of the whole film plus the layout lint (writes `lint.txt`); check the lint lines that fall inside your chapters.
- `node kit-test.mjs ../review/kit.jpg` draws the kit primitives in the current theme.
- Page errors: the tools print the browser console. A draw error in your scene is caught and logged ("scene <id> at T=..."), so read the output.
- Other animators are editing the other scene files at the same time. If their chapter looks broken, ignore it.

## Quality bar

Fun and clear. Every narrated idea gets a visual within about 0.2 s of its word, with a pop or slide. Show how things work (connections drawn as lines, files moving into folders) rather than decorating. Characters carry emotion. Keep it tidy: aligned, consistent sizes, generous spacing. When done, render your story beats and look at every one critically, fix what looks clumsy, then report.

## Patterns that save time

- Compute cue times once at file load (top of the IIFE), not inside `draw()`, which runs every frame.
- Handover between two scenes that share elements (the same cards continue into the next chapter): give the first scene an explicit `exit` a little before the next scene's `t0`, so the elements never appear twice or blink.
- Keep a beat on screen until the next one replaces it: an empty stage for more than half a second reads as a mistake. After real narration timing arrives, re-check the storyboard for gaps.
- Flying elements route around characters (below the feet or outside the group), never across faces.
