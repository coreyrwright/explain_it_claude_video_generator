How to run and use AI reviews (director's checklist; the review tools are in the template)

1. Render the draft and run qa-auto first; fix every automated failure that is real.
2. In parallel: `node tools/review-video.mjs <draft.mp4> review/<draftN>-video.md`, `node tools/review-frames.mjs review/<draftN>-frames.md`, and for audio a 48 kbps mono MP3 of assets/audio/mix.wav into `node tools/listen-mix.mjs <mp3> review/<draftN>-audio.md`. About $0.70 in total.
3. Make a list of claims. For each, render the frames at the claimed time and a second or two around it (`tools/stills.mjs`) or measure the audio (per-chapter RMS and spectral centroid, onsets, loudness). Mark each claim real or false with the evidence.
4. Known false claims: a "wrong" current year, "ghost" elements that are fade-in frames, intended visual stacks read as glitches, per-chapter "tone shifts" that measurement disproves, pronunciation complaints that transcripts contradict.
5. Fix the real ones (or hand larger rework to the chapter's animator), re-render, send the draft to the user with a short list of what changed and what you rejected and why. Stop after two rounds, or earlier if the user says the film is good enough.
