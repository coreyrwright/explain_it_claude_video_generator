// Word timestamps for each narration chapter from two speech-to-text models (no prompt: a prompt
// makes Whisper echo the script). Also reports what was heard against the script (word error rate).
// Usage: node words.mjs [take=a] [chapter numbers]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { transcribe, ROOT } from './eden.mjs';
import { cfg } from './config.mjs';
import { chapters, spoken } from './script.mjs';

process.env.EDEN_STEP = 'word-timing';
const take = process.argv[2] || 'a';
const only = process.argv[3] ? process.argv[3].split(',').map(Number) : null;
const D = path.join(ROOT, 'assets/audio/vo/takes');
const MODELS = [['whisper', 'deepgram/whisper-large'], ['nova3', 'deepgram/nova-3']];
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
const wer = (r, h) => {
  const d = Array.from({ length: r.length + 1 }, (_, i) => [i, ...Array(h.length).fill(0)]);
  for (let j = 1; j <= h.length; j++) d[0][j] = j;
  for (let i = 1; i <= r.length; i++) for (let j = 1; j <= h.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
  return d[r.length][h.length] / r.length;
};

const report = [];
for (const ch of chapters()) {
  if (only && !only.includes(ch.num)) continue;
  const file = path.join(D, `ch${ch.num}_${cfg.voice.name}_${take}.mp3`);
  process.env.AUDIO_SECONDS = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim();
  for (const [tag, model] of MODELS) {
    const out = file.replace('.mp3', `.${tag}.json`);
    if (!fs.existsSync(out)) fs.writeFileSync(out, JSON.stringify(await transcribe({ file, model, label: `words ${tag} ch${ch.num}` }), null, 2));
    const tr = JSON.parse(fs.readFileSync(out, 'utf8'));
    const line = `ch${ch.num} ${tag}: ${(tr.words || []).length} words, WER ${wer(norm(spoken(ch.text)), norm(tr.text || '')).toFixed(3)} | ${tr.text}`;
    report.push(line);
    console.log(line);
  }
}
fs.mkdirSync(path.join(ROOT, 'review'), { recursive: true });
fs.writeFileSync(path.join(ROOT, `review/words-take-${take}.txt`), report.join('\n') + '\n');
