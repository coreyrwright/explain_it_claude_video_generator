// Captions from the word timings, in the script's written form (the display text, not the spoken forms).
// One line of at most 42 characters per cue, breaking at sentence ends -> captions.srt / .vtt
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './eden.mjs';
import { chapters, tokens } from './script.mjs';

const cues = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/audio/cues.json'), 'utf8'));
const timing = JSON.parse(fs.readFileSync(path.join(ROOT, 'js/vo-timing.js'), 'utf8').match(/window\.VO_TIMING = (\{.*\});/)[1]);
const PRE = cues.pre, MAX = 42;

// written words with the time of their spoken tokens
const words = [];
let k = 0;
for (const ch of chapters()) for (const w of ch.text.split(/\s+/)) {
  const n = tokens(w).length;
  if (!n) continue;
  const a = timing.words[k], b = timing.words[k + n - 1];
  words.push({ w, t0: PRE + a[1], t1: PRE + b[2] });
  k += n;
}
if (k !== timing.words.length) throw new Error(`token mismatch: ${k} vs ${timing.words.length}`);

const out = [];
let cur = [];
const text = (ws) => ws.map((x) => x.w).join(' ');
const flush = () => { if (cur.length) out.push({ t0: cur[0].t0, t1: cur[cur.length - 1].t1, text: text(cur) }); cur = []; };
for (const w of words) {
  const len = text([...cur, w]).length;
  if (cur.length && (len > 2 * MAX - 8 || w.t1 - cur[0].t0 > 6.5)) flush();
  cur.push(w);
  const l = text(cur).length;
  if (/[.?!:]["]?$/.test(w.w) || (/[,;]$/.test(w.w) && l > 48)) flush();
}
flush();
// two balanced lines of at most MAX characters
for (const c of out) {
  if (c.text.length <= MAX) continue;
  const ws = c.text.split(' ');
  let best = null;
  for (let i = 1; i < ws.length; i++) {
    const a = ws.slice(0, i).join(' '), b = ws.slice(i).join(' ');
    if (a.length > MAX || b.length > MAX) continue;
    const score = Math.abs(a.length - b.length) - (/[,;:]$/.test(ws[i - 1]) ? 12 : 0);
    if (!best || score < best.score) best = { score, t: a + '\n' + b };
  }
  if (best) c.text = best.t;
}
// hold each cue until the next one starts (up to 0.8 s) so they don't flicker
out.forEach((c, i) => { const next = out[i + 1]; c.t1 = Math.min(next ? next.t0 - 0.05 : c.t1 + 0.8, c.t1 + 0.8); });
const ts = (t, sep) => { const ms = Math.round(t * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${sep}${String(ms % 1000).padStart(3, '0')}`; };
fs.writeFileSync(path.join(ROOT, 'captions.srt'), out.map((c, i) => `${i + 1}\n${ts(c.t0, ',')} --> ${ts(c.t1, ',')}\n${c.text}\n`).join('\n'));
fs.writeFileSync(path.join(ROOT, 'captions.vtt'), 'WEBVTT\n\n' + out.map((c) => `${ts(c.t0, '.')} --> ${ts(c.t1, '.')}\n${c.text}\n`).join('\n'));
console.log(`${out.length} caption cues; longest line ${Math.max(...out.flatMap((c) => c.text.split('\n').map((l) => l.length)))} chars`);
