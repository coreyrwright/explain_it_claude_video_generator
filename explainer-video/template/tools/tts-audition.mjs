// Voice audition: one fixed test line across ElevenLabs v3 and Google Chirp 3 HD voices.
// Objective checks first (Whisper without a prompt, to hear what was actually said),
// then a blind listening rank by Gemini in two orders on a fixed rubric.
// Outputs: assets/audio/vo/audition/*.mp3, review/voice-audition.md
import fs from 'node:fs';
import path from 'node:path';
import { speech, transcribe, chat, ROOT } from './eden.mjs';
import { cfg } from './config.mjs';
import { chapters, spoken } from './script.mjs';

process.env.EDEN_STEP = 'voice-audition';
const LETTERS = 'ABCDEFGH';
const OUT = path.join(ROOT, 'assets/audio/vo/audition');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(ROOT, 'review'), { recursive: true });

// The test line: project.json voice.auditionLine, else the first sentences of the narration (spoken form),
// so the voices are judged on the real words, names and acronyms. Candidates: voice.candidates as
// [key, model, voiceId, description] rows, else four public ElevenLabs v3 voices.
const narration = chapters().map((c) => c.text).join(' ');
const firstSentences = narration.match(/^(?:[^.!?]+[.!?]\s*){1,3}/)?.[0].trim() || narration.slice(0, 300);
const LINE = cfg.voice.auditionLine || spoken(firstSentences);
const VOICES = cfg.voice.candidates || [
  ['george', 'elevenlabs/eleven_v3', 'JBFqnCBsd6RMkjVDRZzb', 'ElevenLabs George, warm captivating storyteller (M)'],
  ['will', 'elevenlabs/eleven_v3', 'bIHbv24MWmeRgasZH58o', 'ElevenLabs Will, relaxed optimist (M)'],
  ['chris', 'elevenlabs/eleven_v3', 'iP95p4xoKVk53GoZ742B', 'ElevenLabs Chris, charming down-to-earth (M)'],
  ['brian', 'elevenlabs/eleven_v3', 'nPczCjzI2devNBz1zQrb', 'ElevenLabs Brian, deep resonant comforting (M)'],
];

const clips = [];
for (const [key, model, voice, desc] of VOICES) {
  const file = path.join(OUT, `${key}.mp3`);
  if (!fs.existsSync(file)) {
    const r = await speech({ model, input: LINE, voice, label: `audition ${key}`, outFile: file });
    console.log(`${key}: $${r.cost} provider=${r.provider} ${r.buf.length} bytes`);
  }
  const dur = parseFloat((await import('node:child_process')).execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString());
  clips.push({ key, desc, file, dur });
}

// What did each voice actually say? (no prompt: a prompt makes Whisper echo the script)
process.env.AUDIO_SECONDS = '20';
for (const c of clips) {
  const tf = c.file.replace('.mp3', '.whisper.json');
  if (!fs.existsSync(tf)) fs.writeFileSync(tf, JSON.stringify(await transcribe({ file: c.file, label: `audition check ${c.key}` }), null, 2));
  c.heard = JSON.parse(fs.readFileSync(tf, 'utf8')).text?.trim();
  c.wpm = Math.round((LINE.split(/\s+/).length / c.dur) * 60);
}

// Blind listening rank, twice with the order reversed; labels are letters, not voice names.
const rubric = `You are casting the narrator for an animated explainer film.\n\nAbout the film: ${cfg.review.film || '(no description given)'}\nWanted voice: ${cfg.voice.brief || 'warm, friendly and clear, easy to follow for non-native listeners'}.\n\nEvery clip reads the same text: "${LINE}"\n(Spelled-out letters or odd spellings in the text are spoken forms on purpose. A bracketed audio tag such as [excited] must NOT be spoken aloud; it should only colour the delivery.) Score each clip from 1 to 10 on: warmth and friendliness, clarity for non-native listeners, fit to the film's tone, natural pacing, delivery of any emphasised words, and audio quality. Flag any mispronunciation, any spoken tag, any glitch. Output a table: clip label, total score out of 10, one-line reason, problems heard. Then name your single top pick.`;
const letters = LETTERS;
async function rank(order, tag) {
  const content = [{ type: 'text', text: rubric }];
  order.forEach((c, i) => {
    content.push({ type: 'text', text: `Clip label: ${letters[i]}` });
    content.push({ type: 'input_audio', input_audio: { data: fs.readFileSync(c.file).toString('base64'), format: 'mp3' } });
  });
  const res = await chat({ model: 'google/gemini-3.1-pro-preview', label: `audition rank ${tag}`, estimate: 0.1, max_completion_tokens: 6000, messages: [{ role: 'user', content }] });
  const text = res.choices?.[0]?.message?.content;
  if (!text) throw new Error('empty ranking output: ' + JSON.stringify(res).slice(0, 500));
  return order.map((c, i) => `${letters[i]} = ${c.key}`).join(', ') + '\n\n' + text;
}
const r1 = await rank(clips, 'order 1');
const r2 = await rank([...clips].reverse(), 'order 2');

const md = [`# Voice audition, ${new Date().toISOString().slice(0, 10)}`, '', `Line: ${LINE}`, '',
  '| Clip | Voice | Length | Words/min | Whisper heard |', '|---|---|---|---|---|',
  ...clips.map((c) => `| ${c.key} | ${c.desc} | ${c.dur.toFixed(1)} s | ${c.wpm} | ${c.heard} |`), '',
  '## Gemini 3.1 Pro, order 1', '', r1, '', '## Gemini 3.1 Pro, order 2 (reversed)', '', r2, ''].join('\n');
fs.writeFileSync(path.join(ROOT, 'review/voice-audition.md'), md);
console.log(md);
