// Parallel frame-accurate render: splits the film into frame ranges across several headless Chrome
// workers, encodes each range, joins them losslessly and muxes the mix plus a soft English subtitle track.
// Usage: node render-par.mjs [out.mp4] [--workers=4] [--from=s] [--to=s] [--no-subs] [--silent]
//   out.mp4   default: project.json output (default ../<name>.mp4)
//   --silent  mux silence instead of assets/audio/mix.wav (layout and motion tests before the audio exists)
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { openPage } from './stills.mjs';
import { ROOT, cfg } from './config.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const out = path.resolve(args.find((a) => !a.startsWith('--')) || cfg.output);
const MIX = path.join(ROOT, 'assets/audio/mix.wav'), SILENT = args.includes('--silent');
if (!SILENT && !fs.existsSync(MIX)) { console.error('assets/audio/mix.wav not found. Build the audio first (see README), or pass --silent for a test render.'); process.exit(1); }
const WORKERS = +opt('workers', 4), FPS = 30;
const probe = await openPage();
const info = await probe.page.evaluate('window.__info');
await probe.browser.close();
const from = +opt('from', 0), to = +opt('to', info.end);
const f0 = Math.round(from * FPS), f1 = Math.ceil(to * FPS);
fs.mkdirSync(path.join(ROOT, 'review'), { recursive: true });
fs.mkdirSync(path.dirname(out), { recursive: true });
const tmp = fs.mkdtempSync(path.join(ROOT, 'review', '.render-'));

async function worker(w, a, b) {
  const { browser, page } = await openPage();
  const cdp = await page.createCDPSession();
  const seg = path.join(tmp, `seg_${w}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
    '-tune', 'animation', '-profile:v', 'high', '-g', '60', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', seg],
  { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = a; f < b; f++) {
    await page.evaluate((t) => window.__seek(t), f / FPS);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 }, optimizeForSpeed: true });
    const buf = Buffer.from(data, 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  return seg;
}

const t0 = Date.now();
const per = Math.ceil((f1 - f0) / WORKERS);
const segs = await Promise.all(Array.from({ length: WORKERS }, (_, w) => worker(w, f0 + w * per, Math.min(f1, f0 + (w + 1) * per))));
fs.writeFileSync(path.join(tmp, 'list.txt'), segs.map((s) => `file '${s}'`).join('\n'));
const video = path.join(tmp, 'video.mp4');
execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-c', 'copy', video]);
const subs = !args.includes('--no-subs') && fs.existsSync(path.join(ROOT, 'captions.srt')) && from === 0;
const dur0 = (f1 - f0) / FPS;
const audioIn = SILENT ? ['-f', 'lavfi', '-t', String(dur0), '-i', 'anullsrc=r=48000:cl=stereo'] : ['-ss', String(from), '-t', String(dur0), '-i', MIX];
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', video, ...audioIn,
  ...(subs ? ['-i', path.join(ROOT, 'captions.srt')] : []), '-map', '0:v', '-map', '1:a', ...(subs ? ['-map', '2:s', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng'] : []),
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', '-t', String(dur0), out]);
fs.rmSync(tmp, { recursive: true, force: true });
const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString());
console.log(`wrote ${out}: ${dur.toFixed(2)} s (expected ${((f1 - f0) / FPS).toFixed(2)}) in ${((Date.now() - t0) / 1000).toFixed(0)} s with ${WORKERS} workers`);
if (Math.abs(dur - (f1 - f0) / FPS) > 0.1) { console.error('DURATION MISMATCH'); process.exit(1); }

// Chrome child processes can keep the event loop alive after browser.close(); exit explicitly.
process.exit(0);
