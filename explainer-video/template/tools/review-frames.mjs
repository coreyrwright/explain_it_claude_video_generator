// Frame QA by a second model: one frame per beat (plus any extra times), each labelled with the
// words spoken around it. The model reports concrete, located issues only.
// Usage: node review-frames.mjs <out.md> [model=openai/gpt-5.5] [extra times, comma separated]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chat, ROOT } from './eden.mjs';
import { cfg } from './config.mjs';
import { openPage } from './stills.mjs';

process.env.EDEN_STEP = 'qa-frames';
const [outFile, model = cfg.review.models?.frames || 'openai/gpt-5.5', extra] = process.argv.slice(2);
if (!outFile) { console.error('usage: node review-frames.mjs <out.md> [model] [extra times, comma separated]'); process.exit(2); }
const { browser, page } = await openPage();
const info = await page.evaluate('window.__info');
const vo = await page.evaluate('window.VO_TIMING.words');
const times = [...info.story.map((s) => s.t), ...(extra ? extra.split(',').map(Number) : [])].sort((a, b) => a - b);
fs.mkdirSync(path.join(ROOT, 'review'), { recursive: true });
const dir = fs.mkdtempSync(path.join(ROOT, 'review', '.qa-'));
const content = [{ type: 'text', text: `You are a meticulous motion-design QA reviewer. These are frames (1920x1080, shown at 1280x720) from an animated explainer film.\n\nAbout the film: ${cfg.review.film || '(no description given)'}\n\nEach frame is labelled with its timestamp and the narration spoken within about 1.5 s before it. Judge each frame on: (a) does the visual match what is being said, (b) composition (awkward empty areas, crowding, overlaps, elements cut off by the frame edge), (c) legibility from the back of a meeting room and spelling of every text, (d) polish and consistency of the visual style, (e) anything confusing. Motion is not visible in stills, so do not flag something only because it is mid-animation. Do not invent problems: if a frame is fine, say OK. Output one line per frame: "t=..: OK" or "t=..: [high/med/low] issue -> concrete fix (with approximate pixel positions)". Then list the 5 most valuable improvements overall.` }];
for (const t of times) {
  await page.evaluate((x) => window.__seek(x), t);
  const f = path.join(dir, `f_${t.toFixed(2)}.jpg`);
  await page.screenshot({ path: f, type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', f, '-vf', 'scale=1280:720', '-q:v', '3', f.replace('.jpg', '_s.jpg')]);
  const words = vo.filter(([, a, b]) => info.pre + b > t - 1.5 && info.pre + a < t + 0.2).map(([w]) => w).join(' ');
  content.push({ type: 'text', text: `Frame t=${t.toFixed(2)}s, narration: "${words || '(no speech)'}"` });
  content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${fs.readFileSync(f.replace('.jpg', '_s.jpg')).toString('base64')}` } });
}
await browser.close();
fs.rmSync(dir, { recursive: true, force: true });
const res = await chat({ model, label: `frame QA (${model.split('/')[1]})`, estimate: 0.5, max_completion_tokens: 12000, ...(model.startsWith('openai/') ? { reasoning_effort: 'low' } : {}), messages: [{ role: 'user', content }] });
const text = res.choices?.[0]?.message?.content;
if (!text) throw new Error('empty review output: ' + JSON.stringify(res).slice(0, 600));
fs.writeFileSync(outFile, `# Frame QA by ${model}\n\n${text}\n`);
console.log(text); console.log('[cost]', res.cost);
