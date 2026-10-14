# Lessons from three films

Collected from three real productions in 2026: a 55-second external marketing explainer (paper-collage style), a 3.5-minute board explainer (flat corporate style) and a 3.5-minute internal team update (cartoon style). Grouped by area. Each lesson says what happened, so you can judge when it applies.

## Contents
1. Process and gates
2. Script
3. Narration and timing
4. Illustrations
5. Animation and layout
6. Music and sound effects
7. Mix
8. AI reviews
9. Delegation to subagents
10. Files, sharing and delivery
11. Compliance and claims

## 1. Process and gates

- Script approval before any recording or animation. The board film had a second gate (storyboard stills, two voice samples, a music sample) before full animation, and needed only one round of changes afterwards. The team update skipped that gate for speed (next-day deadline) and was still fine because the script was approved and the storyboard was reviewed before rendering.
- Cap AI review at two or three rounds. In the team update the requester stopped after round 2 ("the first version was pretty good, budget is tight"). Scores after round 2 were 8.5 to 9 out of 10; more rounds give diminishing returns.
- Keep `progress.md` and `START_HERE.md` current in the project folder, so another person or a new AI session can take over.

## 2. Script

- About 150 to 160 spoken words per minute with ElevenLabs v3. 553 words came out at 3:29 of speech.
- Chapters of 20 to 45 seconds, each recorded as its own take, so one line can be redone (about $0.08 to $0.10) without re-timing the rest.
- Keep the requester's must-keep lines word for word (sign-offs, thank-yous, in-jokes).
- A running visual gag pays off: one recurring character wore comedy glasses in every scene about him.
- Put one comic or emotional peak in the film, and give it room (see 3 and 6). In the team update it was a single word the boss is known for, said with exaggerated delight.
- Fact table: every claim maps to a source. List words to avoid for the audience in the plan (the board film banned internal jargon such as "vector search" and "harness").

## 3. Narration and timing

- Voice choice: audition four voices on one test line that contains the hard words and the emotional peak. Judge with a listening model in two orders: in one audition the judge preferred whichever clip came last (one voice scored 5 then 10, another 9 then 7). Pick the voice that scores well from a middle position in both orders, then check transcripts for mispronunciations.
- ElevenLabs v3 audio tags are not read aloud, but their effect depends on the voice. For one warm male voice, "[delighted]" plus a stretched spelling ("Fantaaastic!!") scored 9/10 where "[excited] Fantastic!" scored 4/10. Put tags only in the spoken form, never in the display script, so cue tokens stay clean.
- Spoken forms for anything a voice may misread: brand names with digits ("Acme2" -> "Acme two"), acronyms ("GDPR" -> "G D P R"), file names ("progress.md" -> "progress dot M D"), product names with unusual pronunciation (write them phonetically).
- Word timings: two speech-to-text models (Deepgram Nova-3 and Whisper) aligned to the script with sequence alignment; keep the consensus. Never give Whisper a prompt: it echoes the script. Add expansion entries for spoken forms so alignment does not drift.
- The chapter gap goes before each later chapter. In the board film it went after each chapter, so chapters 2 to 6 played 1.05 s early while the total length was correct, and both duration checks and AI reviewers missed it. `sync_check.py` now fails the build on a chapter shift.
- Snap sentence-opening words to their real sound onset (`snap_onsets.py`): speech-to-text puts them up to 100 ms late, and most scene changes key on them.
- Give the punchline a longer pause after it: `align.gapBefore` for the next chapter (2.2 s instead of 1.0 s).
- Deepgram Whisper calls can time out (300 s header timeout); retry one chapter at a time.

## 4. Illustrations

- Model: Google Gemini 3 Pro Image through Eden, about $0.14 per image. It ignores the requested size (returns 2752x1536 wide or 2048x2048 square).
- Generate one hero image first; it sets the style. Every other image is an edit with the hero as style reference, plus the character's first image as identity reference for later appearances (`refs` in `jobs.json`).
- Prompt for isolation: pure white background, generous margin, no floor shadow, no text, letters, numbers or logos anywhere (code adds all labels). Blank screens and blank papers.
- Inspect every image. Problems seen: a missing character trait, cropped figures, off-palette props (brown coffee, a wooden bed), pseudo-text squiggles on papers, and a paper held in front of a person's face (caught by two reviewers; fixed with "every face fully visible, papers held at chest height").
- Cut out with `cutout.py --keep-holes`, otherwise white eyes, shirts, screens and papers become transparent on dark backgrounds.
- Crop ratios vary, so scenes place characters with `K.illusFit` (bottom-center anchor, fits a box).
- Some brand guidelines forbid an "AI look"; get explicit approval before using AI illustrations, and label AI media once on the end card.

## 5. Animation and layout

- Every beat keyed to a word with `S.cue()`. A missing phrase throws at load and that scene file disappears, so check the browser log (`tools/cues.mjs` prints page errors).
- Estimated timing lets animators start before the voice exists; real timing then moves beats. After alignment, re-run the storyboard: real timing exposed an empty stage of about 1.5 s before a list of five values (fixed by showing the heading and five empty slots that fill on each spoken value).
- Look for: empty stages between beats, two headlines crossfading at the same spot, transitions caught mid-way in a story still, compositions crammed into the top half, flying elements crossing faces (re-route them below or around characters), text over text.
- Layout lint: safe area (96 px sides, 54 px top and bottom), text at least 34 px (26 px for small footnotes), no text overlapping text, and it respects group alpha (it gave false positives at scene handovers before that).
- Recaps: do not recap at the end of one chapter and again at the start of the next.
- A label that runs past its box (a long file name in a small card): shorten the label.
- Plain black X marks looked crude next to outlined cartoon shapes; the kit's X uses the accent color with the ink outline.
- Icons: check meaning ("Saving time" first had a bell icon; a clock was right).

## 6. Music and sound effects

- Eden has no music endpoint. Generate an 8 s clip with Google Veo 3.1 Lite through `/v3/videos` (about $0.40) and keep only its audio. Prompt for an exact BPM and "instrumental only, no vocals". Measure the tempo, stretch to the grid, loop on bar lines, end on a resolving chord on a bar line. A whistled lead melody fought the voice; marimba and plucked guitar left room.
- A 2-bar loop repeats about 50 times in 3.5 minutes. It was acceptable under narration; consider a second clip for variation on longer films.
- Music direction helps the story: stop the music on a record scratch ("but that is not what I want to talk about"), restart on a downbeat, muffle it (low-pass, quieter) during the sad part, bring it back at the fix.
- AI music licensing is unsettled; use it for internal viewing and replace it with a licensed track before public use.
- Veo is poor at sound effects (no usable sneeze; the fanfare came out as music). Effects synthesized in numpy worked: pop, click, ding, sparkle, type, whoosh, swoosh, boing, a cartoon sneeze, a record scratch and a short fanfare (`tools/sfx_make.py`).
- Scene code registers far too many effects (153 in 3.5 minutes). Thin to about 3 per 10 seconds with priorities, and keep signature sounds (record scratch, fanfare, sneeze) to one occurrence each.

## 7. Mix

- Voice about -19 dBFS active RMS, music bed -26.5 dBFS, ducked 5 dB under the voice with a slow release (150 ms attack, 2.2 s release). At 7 dB with a 1.5 s release the reviewer heard pumping.
- Master to -16 LUFS integrated. Limit at -2.5 dBFS sample peak: at -1.7 the AAC encode overshot to -0.53 dBTP; at -2.5 the delivered file measures about -1.3 to -2.2 dBTP.
- Sound effects about 14 dB under the voice peak, not ducked.

## 8. AI reviews

- Whole film: Gemini 3.8 Flash via an uploaded file, about $0.31 per review. Frames: GPT-5.5 with one frame per beat and the words spoken around it, about $0.3 to $0.5. Audio: Gemini 3.1 Pro listening, about $0.05 to $0.08. Send a 48 kbps mono MP3: with a 128 kbps file it replied "please upload the audio". Its output can get cut off or contain its own guesswork; treat it as weak evidence.
- Verify every claim on the frame or the waveform before fixing. Recurring false claims:
  - "The year on the title card is a typo" (the model assumes an earlier current year). Ignore.
  - "Chapter X sounds muffled or boxy" (claimed for one chapter, then for another in the next round). Measured: the chapter was the brightest take, levels within 0.7 dB. Measure spectral centroid and RMS per chapter instead of re-recording.
  - "Ghost placeholder before the pop-in" (normal fade-in frames).
  - "Glitched black rectangle" (an intended stack of film strips).
  - Pronunciation complaints that the transcripts contradict.
- Real issues they did find: a face covered by paper, an empty stage, a recap layout with the lower two thirds empty, a credit line too small and covered by confetti, sound effects too busy, a harsh record scratch, low-contrast text, a wrong icon.
- Frame QA from GPT was conservative and precise (mostly "OK"); Gemini's whole-film review found sequencing and transition problems that stills cannot show.

## 9. Delegation to subagents

- Parallel subagents finished their parts in 4 to 6 minutes each (narration took about 16 minutes because of speech-to-text timeouts). The whole film took about two hours of wall time.
- Briefs that worked: what to read first, exactly which files the agent owns, what it must not touch, a dollar cap, house style rules, and a concise final report format.
- Shared contracts before the agents start: illustration ids and descriptions, sound-effect names, kit primitives, the cue API. Write the brief file once (`ANIMATOR_BRIEF.md`) and point every animator at it.
- Give animators the illustrator's placement notes (where faces are, which way characters face, where a hand points), so UI elements land next to the pointing hand.
- Agents wished for kit helpers they had to write by hand (pill with icon, film strip, calendar, paperclip, progress bar with label, moon). Add helpers to the kit between projects rather than during one.
- Make one scene's runtime error unable to break the film (the assembler catches draw errors per scene), because agents test while others edit.

## 10. Files, sharing and delivery

- Building inside a team's shared folder works well, but keep `node_modules` and the Python venv outside (`~/.video-runtime`), and the API key outside too.
- Drafts (about 45 MB each) and review files go to `review/`; offer to delete them after approval.
- Render speed: 216 s of film in about 52 s with 8 workers on a 12-core laptop.

## 11. Compliance and claims

- If the film makes a compliance claim about its own production (for example "made with a GDPR-compliant API"), check what it rests on. Eden AI states GDPR compliance, but its standard endpoint routes to US providers (ElevenLabs, Google, Deepgram). Eden also has an EU endpoint (`https://api.eu.edenai.run/v3`) with only EU-hosted models (see `eden.md`). Do not switch providers for a wording request without asking, and flag that such claims rest on vendor statements and need legal review before external use.
- Do not put personal data in prompts. First names in narration go to the voice provider; mention it.
- Never reuse one brand's assets for another brand.
