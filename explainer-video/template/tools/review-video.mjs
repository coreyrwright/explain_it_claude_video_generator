// Whole-film review: a model watches and listens to the rendered draft.
// The film description (what it is, audience, setting, intended style) comes from project.json review.film.
// Usage: node review-video.mjs <video.mp4> <out.md> [model]
import fs from 'node:fs';
import path from 'node:path';
import { upload, chat } from './eden.mjs';
import { cfg } from './config.mjs';
import { chapters } from './script.mjs';

process.env.EDEN_STEP = 'qa-video';
const [video, outFile, model = cfg.review.models?.video || 'google/gemini-3.8-flash'] = process.argv.slice(2);
if (!video || !outFile) { console.error('usage: node review-video.mjs <video.mp4> <out.md> [model]'); process.exit(2); }
if (!cfg.review.film) console.error('note: project.json review.film is empty; describe the film, its audience and intended style for better reviews.');
const script = chapters().map((c) => `${c.num}. ${c.title}: ${c.text}`).join('\n');
const up = await upload(video);
const prompt = `You are a senior motion-design director reviewing a draft animated explainer film.\n\nAbout the film: ${cfg.review.film || '(no description given)'}\n\nNarration script:\n${script}\n\nWatch and listen to the whole film. Then:\n1) Scores out of 10: message clarity, fun and charm (or fit to the intended tone), visual polish, sync of visuals to narration, audio mix, overall.\n2) A timestamped list (mm:ss) of concrete problems with severity (high/med/low) and an exact fix. Look for visuals that don't match the words, beats that land late or early, cluttered or empty frames, illegible or misspelled text, jarring transitions, audio problems (narration clarity, music too loud or quiet, sound effects too loud, abrupt music changes other than any that are intended, clicks). Only report what you actually see or hear; do not guess.\n3) The 5 highest-impact improvements, ranked.`;
const res = await chat({ model, label: `video review ${path.basename(video)}`, estimate: 0.3, max_completion_tokens: 10000, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'file', file: { file_id: up.file_id } }] }] });
const text = res.choices?.[0]?.message?.content;
if (!text) throw new Error('empty review output: ' + JSON.stringify(res).slice(0, 600));
fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
fs.writeFileSync(outFile, `# Video review by ${model}\n\n${text}\n`);
console.log(text); console.log('[cost]', res.cost);
