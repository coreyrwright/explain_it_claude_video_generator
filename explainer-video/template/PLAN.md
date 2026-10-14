# {{TITLE}}: production plan

Status: draft. Fill in every section before animation starts; keep it current (it is the brief the animators and the illustrator read).
Brand: {{BRAND_NAME}}. Look preset: {{STYLE}}.

## Deliverable

- Output: `{{OUTPUT}}`: 1920x1080, 30 fps, H.264 and AAC, -16 LUFS, soft English subtitles.
- Audience and setting: (who watches, where: meeting room, online, board room). Decide the minimum text size from it (34 px minimum on a meeting-room screen).
- Length: (target, for example about 3:30) and the one thing viewers should understand or do afterwards.

## Look

- Preset: {{STYLE}} (outline {{OUTLINE}} px, {{SHADOW}} shadow, radius {{RADIUS}}). All colours come from `js/theme.js` through palette ROLE names in `K.PAL`: ink, primary, accent, highlight, bg, surface, line, accentTint, bgTint, muted. No new colours.
- Palette values: {{PALETTE}}
- Brand rules:
{{RULES}}
- Characters, motion and tone: (describe: friendly cut-outs placed with `K.illusFit`; pop-ins with a small overshoot, gentle bobbing; what the film must never do).

## Characters and illustrations

Cut-outs: transparent PNG, cropped to content, in `assets/illus/<id>.png` (raw generations in `assets/raw/illus/`, cut with `tools/cutout.py`). The prompts live in `assets/illus/jobs.json`. Scenes place them with `K.illusFit(ctx, id, cx, bottomY, maxW, maxH, o)`; until a file exists a labelled placeholder is drawn.

| id | Shape | What it shows |
|---|---|---|
| `hero` | wide | Hero and style reference. |
| | | |

## Sound effects vocabulary

Placed by scenes with `S.sfx(name, t, gain)`: `pop` (soft bubble pop, most pop-ins), `whoosh` (scene changes), `ding` (a check or success), `sparkle` (shimmer), `type` (about 1.5 s of typing), `sneeze`, `scratch` (record scratch), `tada` (short fanfare, one big moment only), `boing` (spring), `click` (UI click), `swoosh` (paper slide). Scenes register generously; `assemble.js` thins the density automatically (signature gags are kept, pops need the most room). Music direction: `S.musicFx('cut' | 'in' | 'low' | 'full', t)`.

## Narration

Voice, model and file name come from `project.json` (voice.model, voice.id, voice.name). One take per chapter, so one chapter can be redone. Spoken forms (acronyms, names with digits, file names) are in `project.json` "spoken". Word timings from two speech-to-text models, sentence starts snapped to real onsets. Every beat is keyed to a spoken word with `S.cue('phrase')`.

## Storyboard

Beats keyed to the bold words (write one paragraph per chapter; bold the word each beat is keyed to).

**Open (before the voice).** Title card: logo, title, subtitle.

**1 (chapter title).** ...

**End card.** Logo on a primary-colour card, closing line, label for AI-generated media if any.

## Budget and data

- Eden AI cap: ${{CAP}} (`project.json` budget). The spend guard (`tools/eden.mjs`) stops new calls at ${{STOP}}.
- Per-agent caps (suggested): narration and timing 15 percent, illustrations 25 percent, music and effects 15 percent, reviews 10 percent.
- Data and privacy: no personal data in prompts. Facts on screen come only from the sources listed here: (list sources).

## Lessons

Storyboard before animation; every beat keyed to a spoken word; the pause between chapter takes goes before each later chapter (`align.gapBefore`); sentence starts snapped to real onsets and `sync_check.py` fails the build if a chapter shifts; layout lint on every draft; check every AI reviewer claim on the frame or waveform before changing anything; AI voice judges disagree when the clip order changes, so judge in two orders; no prompt for speech-to-text; at most three review rounds; spend ledger with a hard stop.
