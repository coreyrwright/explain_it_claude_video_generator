# explainer-video: a Claude Code skill for narrated, animated explainer videos

Give Claude Code a rough idea ("a 3-minute video for my team about why we should work in shared folders") and this skill walks it through making a finished, narrated, animated explainer video: script, AI voice, illustrations, music, sound effects, animation synced to the spoken words, a broadcast-level mix, captions, automated QA and AI review rounds. Output is a Full HD MP4.

I built it after making three real explainer films this way (a 55-second marketing explainer, a 3.5-minute board explainer and a 3.5-minute internal team update). Each cost about $4 to $7 in API credits and one evening of wall time. The skill is everything those three films taught me, packaged so the next one is faster. I'm sharing it to see how others would improve it.

## Why

If you're deep into a technical or strategic topic, it's hard to explain it simply. Making a short video forces you to: every idea needs a visual, so jargon dies fast, and you can show how something works instead of describing it. This skill makes that cheap enough to do for a weekly team meeting.

## What you get per film

- `<name>.mp4`: 1920x1080, 30 fps, H.264 and AAC, -16 LUFS, true peak below -1 dBTP, switchable subtitles
- `captions.srt` and `.vtt`, a poster frame, and an `index.html` that plays the animation in a browser
- `START_HERE.md` and `progress.md`, so someone else (or another AI session) can pick the project up
- a spend ledger with every paid API call

## How it works

1. **Script gate.** Claude writes the narration in short chapters with a fact table, and waits for your approval. Nothing is recorded before that.
2. **Scaffold.** `scripts/new_project.mjs` creates a project from the template with your brand profile (palette roles, font, logo, icons, style).
3. **Assets in parallel.** Subagents make the voice (auditioned, recorded per chapter, word timings from two speech-to-text models), the illustrations (a hero image sets the style, every other image is generated with it as reference) and the music (if needed).
4. **Animation in parallel.** One subagent per chapter writes scene code against a small cartoon/flat drawing kit. Every beat is keyed to a spoken word (`S.cue('phrase')`), so when the narration changes, the animation re-times itself.
5. **Assemble and check.** Storyboard stills and contact sheets on the real timing, a layout lint (safe area, minimum text size, no overlaps), then the mix, captions and a parallel frame-exact render (about a minute for 3.5 minutes of film).
6. **AI review, at most two rounds.** A model watches the whole film, another checks one frame per beat with the words being spoken, a third listens to the mix. Every claim is checked on the actual frame or waveform before anything changes, because about half of them are wrong (see `references/lessons.md`).

The animation is a deterministic HTML canvas engine: the film is a pure function of time, so the browser preview and the MP4 are identical frame for frame.

## Requirements

- [Claude Code](https://claude.com/claude-code)
- Node 20+, Python 3.11+, ffmpeg, Google Chrome (tested on macOS)
- An [Eden AI](https://www.edenai.co) account and API key. Eden is an API aggregator; the skill uses it for ElevenLabs voices, Google Gemini images, Google Veo (music), Deepgram speech-to-text and the review models. Every call goes through a spend guard with a hard stop you set per project.

## Install

```bash
cp -R explainer-video ~/.claude/skills/
bash ~/.claude/skills/explainer-video/scripts/setup_runtime.sh    # puppeteer-core and a Python venv in ~/.video-runtime
mkdir -p ~/.config/eden-ai && echo "EDEN_AI_API_KEY=your-key" > ~/.config/eden-ai/.env
```

Then in Claude Code, just ask, for example: "Make a 90-second cartoon-style explainer for my team about our new onboarding checklist, budget $5."

To try it without spending anything, ask for a dry run: the skill can scaffold, animate on estimated timing and render a silent draft with no paid calls.

## Typical costs (Eden AI, US dollars)

| Step | Cost |
|---|---|
| Voice audition (4 voices) | about $0.25 |
| Narration, 3.5 minutes | $0.45 to $0.55 |
| Word timings | about $0.05 |
| Illustrations | about $0.14 each (8 to 14 per film) |
| Music | about $0.40 per 8-second clip |
| One AI review round | about $0.40 to $0.70 |

## What's in the folder

```
explainer-video/
  SKILL.md                  the workflow Claude follows (gates, delegation, budget, quality rules)
  references/               lessons from three films, Eden notes, styles, brands, subagent briefs
  template/                 the project skeleton: engine, kit, tools, sound effects, Inter font
  brands/                   brand profiles (example and a blank template)
  scripts/                  new_project.mjs (scaffold), setup_runtime.sh
```

## Known limitations and ideas (this is where I'd love input)

- **Provider lock-in.** Everything paid goes through Eden AI. Direct adapters for ElevenLabs, OpenAI, Google or local models (for example local TTS and Whisper) would make it cheaper and more flexible.
- **Music.** AI music from a video model's audio track is a workaround, and its licensing is unsettled, so I only use it internally. Better options: a licensed-track importer with beat detection, or music composed in code.
- **Characters don't really move.** Illustrations are static cut-outs that pop, bob, squash and wiggle. Simple rigging (separate arms, blinking, mouth shapes synced to the voice) would add a lot.
- **Only two styles in the template** (cartoon and flat corporate). The paper-collage style from the first film needs its own engine and isn't included yet.
- **AI judges are noisy.** Voice auditions use a listening model in two orders because of position bias; review claims are often wrong. Better automatic checks (and fewer AI opinions) would help.
- **English only so far**, and only tested on macOS (on Linux or Windows, set `CHROME_PATH` to your Chrome or Chromium binary).
- **Kit helpers.** Subagents keep hand-drawing the same things (pills with icons, film strips, calendars, progress bars with labels). A richer kit would save time on every film.
- **Skill triggering and evals.** The description hasn't been optimized, and the tests so far are dry runs plus real productions, not a formal eval suite.

## A note on responsible use

Label AI-generated voice, illustrations and music in the film (the template's end card does this). Don't put personal or confidential data into prompts: narration text goes to the voice provider. Check brand guidelines before using AI imagery, and get legal review before making compliance claims about how a film was produced.

## License

Apache License 2.0, see [LICENSE](LICENSE). Bundled third-party files (the Inter font, SIL Open Font License 1.1) and dependencies installed at setup are listed in [explainer-video/LICENSES/THIRD_PARTY.md](explainer-video/LICENSES/THIRD_PARTY.md).

