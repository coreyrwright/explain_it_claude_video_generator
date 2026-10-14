// Narration: one take per chapter with the voice from project.json (voice.model, voice.id, voice.name), so a single
// chapter can be re-recorded without touching the others. Existing files are skipped.
// Usage: node tts.mjs [take=a] [chapter numbers, e.g. 5 or 2,5]
import fs from 'node:fs';
import path from 'node:path';
import { speech, ROOT } from './eden.mjs';
import { cfg } from './config.mjs';
import { chapters, spoken } from './script.mjs';

process.env.EDEN_STEP = 'narration';
const VOICE = { model: cfg.voice.model, voice: cfg.voice.id, name: cfg.voice.name };
const take = process.argv[2] || 'a';
const only = process.argv[3] ? process.argv[3].split(',').map(Number) : null;
const OUT = path.join(ROOT, 'assets/audio/vo/takes');
fs.mkdirSync(OUT, { recursive: true });

for (const ch of chapters()) {
  if (only && !only.includes(ch.num)) continue;
  const file = path.join(OUT, `ch${ch.num}_${VOICE.name}_${take}.mp3`);
  if (fs.existsSync(file)) { console.log('skip', path.basename(file)); continue; }
  const input = spoken(ch.text);
  const r = await speech({ model: VOICE.model, voice: VOICE.voice, input, label: `narration ch${ch.num} take ${take}`, outFile: file });
  console.log(`ch${ch.num}: ${input.length} chars, $${r.cost}, ${r.buf.length} bytes`);
}
