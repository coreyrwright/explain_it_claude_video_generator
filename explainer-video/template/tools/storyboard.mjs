// Storyboard and layout lint.
// Renders one still per beat (Scenes.STORY) with the words spoken around it, and runs the layout
// lint every 0.2 s over the whole film (safe area, minimum text size, text overlapping text).
// Usage: node storyboard.mjs [outDir=review/storyboard]
import fs from 'node:fs';
import path from 'node:path';
import { openPage } from './stills.mjs';
import { ROOT } from './eden.mjs';

const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'review/storyboard'));
fs.mkdirSync(OUT, { recursive: true });
const { browser, page, logs } = await openPage();
const info = await page.evaluate('window.__info');
const vo = await page.evaluate('window.VO_TIMING.words');
const said = (t, w = 1.6) => vo.filter(([, a, b]) => info.pre + b > t - w && info.pre + a < t + 0.3).map(([tk]) => tk).join(' ');

const frames = [];
for (const [i, s] of info.story.entries()) {
  await page.evaluate((t) => window.__seek(t), s.t);
  const file = path.join(OUT, `${String(i + 1).padStart(2, '0')}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  frames.push({ n: i + 1, t: s.t, label: s.label, words: said(s.t), file: path.basename(file) });
}
fs.writeFileSync(path.join(OUT, 'frames.json'), JSON.stringify(frames, null, 2));

const issues = new Map();
for (let t = 0; t <= info.end; t += 0.2) {
  for (const msg of await page.evaluate((x) => window.__lint(x), t)) if (!issues.has(msg)) issues.set(msg, t);
}
const lint = [...issues].map(([m, t]) => `t=${t.toFixed(1)}s  ${m}`);
fs.writeFileSync(path.join(OUT, 'lint.txt'), (lint.join('\n') || 'no issues') + '\n');
await browser.close();
if (logs.length) console.log(logs.join('\n'));
console.log(`${frames.length} stills -> ${OUT}; film ${info.end.toFixed(1)} s; lint: ${lint.length} issue(s)`);
lint.slice(0, 40).forEach((l) => console.log('  ' + l));

// Chrome child processes can keep the event loop alive after browser.close(); exit explicitly.
process.exit(0);
