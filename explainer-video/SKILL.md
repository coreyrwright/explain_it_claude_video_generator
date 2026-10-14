---
name: explainer-video
description: Produce narrated, animated explainer videos (Full HD MP4 with captions) for any brand or project, from a rough idea or script to a finished film, using Claude Code, Eden AI (AI voice, illustrations, music, AI reviewers) and a deterministic HTML-canvas animation engine with word-synced beats, under a hard API budget. Use this skill whenever the user wants an explainer video, animated video, short film, video update for a meeting (weekly, all-hands, board), onboarding or training video, product or program explainer, "a video like the last one", or wants to turn a script, deck, document or website into a video, even if they only say "make a short video that explains X" or "can you animate this". Also use it to change, re-voice or re-render a video that was made with this skill.
---

# Explainer videos

This skill packages what was learned building three real films: a 55-second marketing explainer (paper-collage style), a 3.5-minute board explainer (flat corporate style) and a 3.5-minute internal team update (cartoon style). Each cost $4 to $7 of Eden AI credits and took one evening of wall time with parallel subagents.

What you deliver for every film:
- `<name>.mp4`: 1920x1080, 30 fps, H.264 and AAC, -16 LUFS, true peak below -1 dBTP, switchable English subtitles
- `captions.srt` and `.vtt`, a poster frame, `index.html` that plays the animation from disk
- `START_HERE.md` and `progress.md` in the project folder, so anyone (or any Claude) can pick the project up
- a spend ledger (`spend.log`) with every paid call

The film is a pure function of time drawn on a canvas, with every beat keyed to a spoken word. That is the core idea: when the narration changes, the animation re-times itself, and renders are frame-exact.

## Setup (once per computer)

1. Runtime: `bash <skill>/scripts/setup_runtime.sh`. It creates `~/.video-runtime` (puppeteer-core, a Python venv with numpy, scipy and Pillow) and checks ffmpeg and Google Chrome. Libraries live outside the project, so a project inside a synced folder (Box, OneDrive) does not sync thousands of files.
2. Eden AI key: `EDEN_AI_API_KEY` in the environment, or in a `.env` file at `$EDEN_ENV` or `~/.config/eden-ai/.env`. Never copy the key into the project, never print it, never put it in a shared folder.

## Workflow

Work in gates. Each gate exists because skipping it caused rework in an earlier film.

### 0. Intake

Find out (from the conversation first, ask only for what is missing): audience and setting (meeting room, online, board), the one thing viewers should understand or do afterwards, length, brand, style (cartoon, flat corporate, collage), voice (warm male, bright female, etc.), Eden budget cap, deadline, where the project should live (prefer the team's shared folder), lines that must stay word for word, and sources for every factual claim. Read `references/brands.md` for the brand, and `references/styles.md` for the style.

### 1. Script (gate 1)

Write the narration in chapters of 20 to 45 seconds (about 150 words per minute) with short chapter titles (they appear in the on-screen chapter pill). The film runs about 6 to 7 seconds longer than the narration (2.4 s title card plus the end-card hold), so a 45-second film needs about 38 seconds of speech. Plain words, one idea per sentence, no jargon the audience would not use. Keep the user's must-keep lines exactly. Build a fact table in `PLAN.md`: every number or claim maps to a source, and nothing on screen is invented (a made-up "82%" on a progress bar had to be removed). Mark spoken forms for tricky words (brand names with digits, acronyms, file names). Show the script and wait for approval: nothing is recorded or animated before this, because a script change after recording costs a re-record and re-timing.

### 2. Plan and scaffold

```bash
node <skill>/scripts/new_project.mjs <project-dir>/video-build --brand <brand-id, e.g. example> --name <kebab-name> --title "<Title>" --style cartoon|flat --cap <usd>
```

Then fill in `video-build/PLAN.md` (look, characters and illustrations table, sound-effect vocabulary, storyboard with every beat keyed to a bold spoken word, budget), `script/narration.md` (`## N Title` chapters), and `project.json`: `voice`, `spoken` (regex to spoken form, including any ElevenLabs tag for the peak word), `align` (`gapBefore` for a longer pause after the peak, `expand` for spoken forms), `music` (`bpm`, prompts), `budget`, and `review.film` (replace its TODO: it is the context every AI reviewer gets). `template/README.md` in the skill lists every command in order. Tools regenerate `js/project-config.js` and the scene `<script>` tags in `index.html` on every run, so a new file in `js/scenes/` is picked up automatically. Python tools run through `node tools/py.mjs <script.py>`, which uses the runtime venv. If the project sits in a shared folder, write `START_HERE.md` and `progress.md` next to `video-build/` and keep `progress.md` current at each gate. Run `node tools/est-timing.mjs` so animators can start on estimated timing before the voice exists.

### 3. Assets, in parallel (subagents)

Spawn three background agents at once (a faster, cheaper model such as Sonnet is plenty for this work), each with a brief from `references/briefs/` filled in for this project: narrator (voice audition in two orders, per-chapter takes, word timings, alignment), illustrator (hero image first, then every other image as an edit with the hero and the character's first image as references, cut-outs, contact sheet), audio (music bed at the film's BPM, only if the project needs a new one; the template already has 11 reusable sound effects and the mixer). Give each a dollar cap; the shared ledger enforces the total.

### 4. Shared visual pieces, then animation in parallel

Before animators start, put any visual element that appears in more than one chapter into `js/kit.js` (in the cartoon film, a dashboard appeared in chapters 3 and 4), and check it with `tools/kit-test.mjs`. Then spawn one animator subagent per one or two chapters with `references/briefs/animator.md`. Each owns separate files in `js/scenes/`, so nobody overwrites anyone; a draw error in one scene is caught and logged, so it cannot break the others.

### 5. Assemble on real timing

When narration is aligned (`js/vo-timing.js` no longer says estimated): run `node tools/cues.mjs`, `node tools/storyboard.mjs review/storyboard` and `node tools/py.mjs contact.py review/storyboard review/sheet_`, and look at every sheet yourself. Real timing moves beats: look for empty stages between beats, crossfades where two headlines overlap, transitions caught mid-way, compositions crammed into one half, text that covers faces. Fix in the scene files (small fixes yourself; larger rework back to the chapter's animator). For a board or external film, show the storyboard sheets and the voice sample to the user here (gate 2). For an internal film on a deadline, go straight on and send draft 1.

### 6. Mix, captions, render, automated QA

```bash
node tools/export-cues.mjs && node tools/py.mjs mix.py && node tools/captions.mjs
node tools/render-par.mjs --workers=8            # writes project.json "output"; add a path for drafts, e.g. review/draft1.mp4
node tools/qa-auto.mjs <out.mp4>
```

A 3.5-minute film renders in about a minute with 8 workers. Before narration or music exist (or for a dry run with no paid calls), render with `--silent` and mix with `node tools/py.mjs mix.py --no-vo` (no music bed is fine); qa-auto then skips loudness and the sync check fails until narration exists, which is expected. `qa-auto` checks durations, loudness, true peak, clicks, audio-to-animation sync and the layout lint, and writes every on-screen string to `review/onscreen-text.txt`: read that list for typos and invented numbers.

### 7. AI review rounds (at most two, stop earlier if the user says so)

Run `review-video.mjs` (Gemini watches the whole film, about $0.31), `review-frames.mjs` (GPT checks one frame per beat with the words being spoken, about $0.3 to $0.5) and `listen-mix.mjs` (Gemini listens, about $0.05; send a 48 kbps mono MP3 or it may not receive the audio) in parallel. Then verify every claim on the actual frame or waveform before changing anything. Roughly half of the claims are wrong; `references/lessons.md` lists the recurring false ones. Fix what is real, re-render, and send the draft to the user.

### 8. Deliver (gate 3)

Put the final MP4 where the user wants it (usually next to `START_HERE.md`), update `progress.md` (status, spend, review history, decisions), and tell the user: what changed since the last draft, what you rejected and why, total Eden spend, and caveats (AI music is for internal use; compliance wording; files over 30 MB can only be previewed in the desktop app). Offer to delete the drafts in `review/` after approval.

## Delegation

Delegate production work to subagents wherever possible (a faster model is fine), with the main session as director. Parallel agents cut a three-hour build to about one hour of wall time. What made that work:
- A written brief per agent (start from `references/briefs/`), naming exactly which files it owns and which it must not touch.
- Shared contracts written before agents start: `PLAN.md`, `ANIMATOR_BRIEF.md`, the illustration table (ids and what each shows), the sound-effect vocabulary, the kit.
- Agents run in the background and in parallel; you integrate, look at every storyboard frame, and make the final calls.
- Agents over-register sound effects and reuse signature sounds (record scratch, fanfare). The assembler thins effects to about 3 per 10 seconds; still check that each signature sound happens once, where it is meant to.
- Agents cannot listen. Anything about how audio sounds is measured (loudness, spectral centroid, onsets) or judged by a listening model in two orders.

## Budget

Every paid call goes through `tools/eden.mjs`, which refuses a call when the ledger plus the call's estimate would cross `budget.stopAtUsd` in `project.json` (the single place the budget lives; `--cap` sets it at scaffold time). Set the stop at about 92 percent of the user's cap, and remember that Eden adds a 5.5 percent platform fee and the user may think in euros. Typical costs: voice audition $0.25, narration $0.45 to $0.55 for 3.5 minutes, word timings $0.05, illustrations $0.14 each, music $0.40 per Veo clip, reviews $0.40 per round. Report spend at each gate.

## Quality rules that matter most

- Key beats to words with `S.cue('phrase')`; never hardcode times. Music direction (stop on a record scratch, restart on a downbeat, muffle during a sad part) is registered by scenes with `S.musicFx('cut' | 'in' | 'low' | 'full', t)`.
- One idea per beat, at most two or three groups on screen, text at least 34 px (44 px and up for most), top band reserved for the chapter pill and logo.
- Show how things work (connections drawing themselves, files moving into folders) rather than decorating.
- Characters carry the emotion; keep the same characters across the film (identity references).
- The comedic or emotional peak gets room: a longer pause after it in the narration (`align.gapBefore`), a unique sound, and the biggest visual.
- No invented numbers, no other brand's assets. Label AI-generated media once on the end card, naming only what this film actually used (voice, illustrations, music).

## Reference files

- `references/lessons.md`: everything that went wrong or worked in the three films, by area. Read before planning.
- `references/eden.md`: endpoints, models, costs and quirks (EU endpoint, music via Veo, reviewers).
- `references/styles.md`: cartoon, flat corporate and collage, with illustration style prompts and motion rules.
- `references/brands.md`: how brand profiles work, known brands, adding a new one.
- `references/briefs/`: subagent briefs (narrator, illustrator, audio, animator, reviewer-verifier).
- `template/README.md`: rebuild commands for a generated project; `template/ANIMATOR_BRIEF.md`: the API for scene code.
