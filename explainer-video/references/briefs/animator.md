You are a scene animator for a <style>, narrated explainer video for <audience> ("<title>"). Work autonomously and report when done.

PROJECT FOLDER (B): "<path>/video-build". Read, in this order: B/ANIMATOR_BRIEF.md (how the film works, the API, layout rules, testing), B/PLAN.md (look, characters and their placement notes, storyboard), B/script/narration.md (chapters <n, m> are yours), B/js/theme.js, B/js/engine.js, B/js/kit.js, B/js/core.js, and B/js/scenes/<an existing finished scene file, if any> for the expected style.

YOUR FILES (edit only these): B/js/scenes/<file(s)>. Replace the placeholder(s) with full animation for <chapters>, following the storyboard in PLAN.md. Use B/review/<your dir> for renders.

Chapter direction:
- <beat by beat direction for the important moments: what each spoken phrase should show, which characters, which shared kit element, which sound effect, the peak moment and how big it should be>
- Keep the top band y < 140 free during chapters (chapter pill and logo).
- Use only the sound effects named in PLAN.md; signature sounds (<e.g. scratch, tada, sneeze>) only where the plan puts them.

Be efficient: plan the beats with `node tools/cues.mjs "phrase" ...`, write the code, render stills of every beat with tools/stills.mjs, look at them, fix, and run tools/storyboard.mjs once at the end for the layout lint of your chapters. Timing may switch from estimated to real while you work; your cues adapt automatically.

FINAL REPORT (concise): each beat (one line with its cue phrase), sound effects used, lint status for your chapters, what you could not do, and kit helpers you wish existed (do not edit kit.js yourself). No em dashes in on-screen text or the report.
