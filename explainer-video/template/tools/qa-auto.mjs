// Automated checks before any AI review: stream durations, loudness and true peak of the master,
// a click scan of the mix, the layout lint, and every on-screen string for a spelling pass.
// Usage: node qa-auto.mjs <video.mp4>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { openPage } from './stills.mjs';
import { ROOT, pythonBin } from './config.mjs';

if (!process.argv[2]) { console.error('usage: node qa-auto.mjs <video.mp4>'); process.exit(2); }
const video = path.resolve(process.argv[2]);
const out = [];
const cues = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/audio/cues.json'), 'utf8'));
// 1. durations
const streams = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,duration', '-of', 'csv=p=0', video]).toString().trim().split('\n');
for (const s of streams) {
  const [type, dur] = s.split(',');
  if (type === 'subtitle') continue;
  const ok = Math.abs(+dur - cues.end) < 0.06;
  out.push(`${ok ? 'PASS' : 'FAIL'} ${type} duration ${(+dur).toFixed(2)} s (film ${cues.end.toFixed(2)} s)`);
}
// 2. loudness of the file as delivered
const ln = spawnSync('ffmpeg', ['-hide_banner', '-i', video, '-af', 'loudnorm=I=-16:TP=-1.5:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const js = JSON.parse(ln.slice(ln.lastIndexOf('{'), ln.lastIndexOf('}') + 1));
const silent = !Number.isFinite(+js.input_i);          // a --silent test render
if (silent) out.push('SKIP loudness and true peak: the file is silent (test render)');
else {
  out.push(`${Math.abs(+js.input_i + 16) <= 0.5 ? 'PASS' : 'FAIL'} loudness ${js.input_i} LUFS (target -16 +/- 0.5)`);
  out.push(`${+js.input_tp <= -1.0 ? 'PASS' : 'FAIL'} true peak ${js.input_tp} dBTP (limit -1.0)`);
}
// 3. click scan: sample-to-sample jumps far above the local level
const mixWav = path.join(ROOT, 'assets/audio/mix.wav');
const raw = fs.existsSync(mixWav) ? execFileSync('ffmpeg', ['-v', 'error', '-i', mixWav, '-ac', '1', '-f', 'f32le', '-'], { maxBuffer: 1 << 30 }) : Buffer.alloc(0);
if (!raw.length) out.push('SKIP click scan: no assets/audio/mix.wav yet');
const x = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
const SR = 48000, win = 480, clicks = [];
for (let i = win; i < x.length - win; i += win) {
  let e = 0, m = 0, at = 0;
  for (let j = i; j < i + win; j++) { e += x[j] * x[j]; const d = Math.abs(x[j] - 2 * x[j - 1] + x[j - 2]); if (d > m) { m = d; at = j; } }
  const rms = Math.sqrt(e / win);
  if (m > 0.25 && m > 12 * rms) clicks.push((at / SR).toFixed(2));
}
if (raw.length) out.push(`${clicks.length ? 'CHECK' : 'PASS'} click scan: ${clicks.length ? clicks.slice(0, 12).join(', ') + ' s' : 'no clicks found'}`);
// 4. lint and on-screen text
const { browser, page } = await openPage();
const info = await page.evaluate('window.__info');
const issues = new Set(), strings = new Set();
for (let t = 0; t <= info.end; t += 0.2) {
  for (const m of await page.evaluate((v) => window.__lint(v), t)) issues.add(m);
  for (const s of await page.evaluate(() => K.boxes.filter((b) => b.kind === 'text').map((b) => b.str))) strings.add(s);
}
await browser.close();
if (fs.existsSync(path.join(ROOT, 'assets/audio/stem_vo.wav'))) {
  const sync = spawnSync(pythonBin(), ['-I', path.join(ROOT, 'tools/sync_check.py')], { encoding: 'utf8' });
  out.push((sync.stdout || sync.stderr || 'FAIL sync_check produced no output').trim().split('\n').pop());
} else out.push('SKIP sync check (no assets/audio/stem_vo.wav; run tools/mix.py first)');
out.push(`${issues.size ? 'FAIL' : 'PASS'} layout lint: ${issues.size ? [...issues].slice(0, 8).join(' | ') : 'no issues'}`);
fs.mkdirSync(path.join(ROOT, 'review'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'review/onscreen-text.txt'), [...strings].sort().join('\n') + '\n');
out.push(`INFO ${strings.size} on-screen strings -> review/onscreen-text.txt`);
fs.writeFileSync(path.join(ROOT, 'review/qa-auto.txt'), out.join('\n') + '\n');
console.log(out.join('\n'));

// Chrome child processes can keep the event loop alive after browser.close(); exit explicitly.
process.exit(0);
