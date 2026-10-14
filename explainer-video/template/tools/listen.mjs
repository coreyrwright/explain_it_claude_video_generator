// Ask the listening model about one or more audio files. Usage: node listen.mjs "<question>" file1 [file2...]
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chat } from './eden.mjs';
const [q, ...files] = process.argv.slice(2);
const content = [{ type: 'text', text: q }];
for (const f of files) {
  const mp3 = f.endsWith('.mp3') ? f : path.join(os.tmpdir(), `listen_${path.basename(f)}.mp3`);
  if (mp3 !== f) execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', f, '-b:a', '192k', mp3]);
  content.push({ type: 'text', text: `File: ${path.basename(f)}` });
  content.push({ type: 'input_audio', input_audio: { data: fs.readFileSync(mp3).toString('base64'), format: 'mp3' } });
}
const r = await chat({ model: process.env.JUDGE || 'google/gemini-3.1-pro-preview', label: `listen: ${files.map((f) => path.basename(f)).join(',')}`.slice(0, 90), estimate: 0.04, max_completion_tokens: Number(process.env.MAXTOK || 12000), messages: [{ role: 'user', content }] });
console.log(r.choices?.[0]?.message?.content);
