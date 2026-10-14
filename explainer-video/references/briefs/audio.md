You are making the music bed (and any extra sound effects) for a <length> <style> explainer video. Work autonomously; report back when done.

PROJECT FOLDER (B): "<path>/video-build". Read B/PLAN.md (Sound effects vocabulary, Budget), B/project.json (music.bpm, music.prompts), and the tools: tools/gen-music.mjs (Eden has no music endpoint: Veo 3.1 Lite generates an 8 s clip and only its audio is kept), tools/music_cartoon.py (tempo measure, stretch to the grid, bar-line loop and ending), tools/sfx_make.py, tools/mix.py, tools/glitch_scan.py, tools/listen.mjs, tools/eden.mjs (spend guard; never print the API key). The template already contains 11 sound effects in B/assets/audio/sfx/ (pop, click, ding, sparkle, type, whoosh, swoosh, boing, sneeze, scratch, tada): reuse them; add new ones only if PLAN.md names them.

BUDGET: at most $<1.50> (a Veo clip is about $0.40, a listening check about $0.03).

STEPS
1. Music: <mood and instruments, e.g. playful, warm, upbeat cartoon cue: marimba, plucked guitar, pizzicato, light claps, soft kick, bouncy bass>, instrumental only, no lead melody in the voice's range, exactly <bpm> BPM in 4/4. Generate at most 2 candidates, compare (tempo stability, loudness, clicks, one listening comparison), pick one, stretch it to the exact BPM, make a bar-line loop and a resolving ending, write a 30 s preview to B/review/music_preview.mp3.
2. New sound effects only if needed: synthesize in numpy where possible (Veo is poor at effects), 48 kHz, trimmed, peak about -6 dBFS.
3. Test the mixer with a stand-in voice and B/review/test_cues.json (do not commit the stand-in): -16 LUFS, true peak below -1 dBTP after AAC, no clicks, music ducked about 5 dB under the voice with a slow release.

Do not edit B/js, B/index.html, B/PLAN.md, B/script, narration files or illustrations. No em dashes in anything you write.

FINAL REPORT (concise): music choice, BPM and bar length, loop and ending details, any new effects and how they were made, test loudness numbers, your spend, licence caveat (AI music is for internal use).
