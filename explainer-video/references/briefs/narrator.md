You are producing the narration track for a <length> <style> explainer video for <audience>. Work autonomously; report back when done.

PROJECT FOLDER (B): "<path>/video-build". Read B/PLAN.md (Narration, Budget, Lessons), B/script/narration.md (chapters in "## N Title" format, do NOT change its wording), B/project.json (voice, spoken forms, align settings) and the tools before running them: tools/list-voices.mjs, tts-audition.mjs, listen.mjs, tts.mjs, words.mjs, align.mjs, snap_onsets.py, sync_check.py. Eden client: tools/eden.mjs (spend guard and shared ledger; never print, copy or log the API key). Python: the one in project.json "python".

BUDGET: at most $<1.50> of Eden spend for everything you do. Other agents spend from the same ledger in parallel; count your own calls.

STEPS
1. Audition: the client wants <voice brief, e.g. a warm male voice, friendly and clear for non-native English speakers>. Shortlist 4 ElevenLabs v3 voices (model 'elevenlabs/eleven_v3') from list-voices.mjs. Render one test line per voice containing the tricky words and the emotional peak line: "<test line>". Judge (a) with transcriptions (accuracy, mispronunciations) and (b) with a listening model via listen.mjs TWICE in reversed clip order (AI judges have strong position bias). Pick the voice that does well in both orders. Write B/review/voice-audition.md.
2. The peak line "<peak line>" must land: test ElevenLabs audio tags such as [delighted] or [excited] (and stretched spelling, e.g. "Fantaaastic!!") on it; tags go only into the spoken forms in project.json, never into the display script.
3. Set project.json voice {model, id, name}; record take "a" of every chapter (tools/tts.mjs).
4. Check the peak line and the ending by transcription and one cheap listen; re-record at most 2 chapters as take "b".
5. Word timings: tools/words.mjs (two STT models, never a prompt), then extend project.json align.expand for this script's spoken forms (for example a file name read as "progress dot m d"), set align.gapBefore for a longer pause after the peak if PLAN.md asks for it, run tools/align.mjs (with overrides like `a 4=b`), then snap_onsets.py and sync_check.py.
6. Report durations, words per minute and the longest pauses.

Do not edit B/js except the generated js/vo-timing.js, and do not touch PLAN.md, illustrations or music. No em dashes in anything you write.

FINAL REPORT (concise): chosen voice (name, id) and why, tags used, chapter durations and total, alignment stats per chapter, re-records, your spend, issues (mispronunciations you could not fix, long pauses).
