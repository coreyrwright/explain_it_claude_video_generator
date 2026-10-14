// Audio QA: a listening model reviews the final mix (narration clarity, music balance, artifacts).
// Usage: node listen-mix.mjs <mix.mp3> <out.md> [model=google/gemini-3.1-pro-preview]
import fs from 'node:fs';
import path from 'node:path';
import { chat, ROOT } from './eden.mjs';
import { cfg } from './config.mjs';

process.env.EDEN_STEP = 'qa-audio';
const [file, outFile, model = cfg.review.models?.audio || 'google/gemini-3.1-pro-preview'] = process.argv.slice(2);
if (!file || !outFile) { console.error('usage: node listen-mix.mjs <mix.mp3> <out.md> [model]'); process.exit(2); }
const cues = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/audio/cues.json'), 'utf8'));
const mt = (t) => `${t.toFixed(1)} s`;
// Intended music moves come from the animation (S.musicFx), so the reviewer is not told about problems that are deliberate.
const fxText = { cut: (t) => `the music stops abruptly at ${mt(t)}`, in: (t) => `the music restarts on the first downbeat after ${mt(t)}`, low: (t) => `the music is muffled from ${mt(t)}`, full: (t) => `the music returns to full sound at ${mt(t)}` };
const moves = (cues.music.fx || []).map((f) => fxText[f.type]?.(f.t)).filter(Boolean);
const prompt = `You are a broadcast audio engineer. This is the full mix of a ${cues.end.toFixed(0)}-second animated explainer film: an AI narrator over a ${cues.music.bpm || ''} BPM music bed with sound effects.\n\nAbout the film: ${cfg.review.film || '(no description given)'}\n\nIntended music moves: ${moves.length ? moves.join('; ') : 'none, the bed plays throughout'}; a final chord at ${cues.music.final.toFixed(1)} s that rings out. Target: -16 LUFS. Report with timestamps: (1) narration clarity and consistency between chapters, mispronunciations; (2) music balance under the voice (too loud, too quiet, pumping); (3) sound effects too loud, badly timed or annoying; (4) clicks, pops, distortion, abrupt cuts, loop seams you can hear (other than the intended moves); (5) whether the ending lands. Only report what you actually hear; say 'fine' where it is fine. Finish with a score out of 10 and the top 3 fixes.`;
const res = await chat({ model, label: 'audio review', estimate: 0.1, max_completion_tokens: 6000, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'input_audio', input_audio: { data: fs.readFileSync(file).toString('base64'), format: 'mp3' } }] }] });
const text = res.choices?.[0]?.message?.content;
if (!text) throw new Error('empty review output: ' + JSON.stringify(res).slice(0, 600));
fs.writeFileSync(outFile, `# Audio review by ${model}\n\n${text}\n`);
console.log(text); console.log('[cost]', res.cost);
