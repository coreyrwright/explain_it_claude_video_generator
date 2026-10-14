// Builds the narration track and its word timing contract.
// 1. Trims each chapter take to its speech, joins them with a fixed gap -> assets/audio/vo/vo.wav
// 2. Aligns both speech-to-text results to the script tokens (sequence alignment, so numbers,
//    homophones and spelled-out letters cannot shift later words), keeps the consensus where the
//    two models agree, interpolates the rest -> js/vo-timing.js
// Usage: node align.mjs [take=a] [per-chapter overrides, e.g. 6=b]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, cfg } from './config.mjs';
import { chapters, tokens } from './script.mjs';

const take = process.argv[2] || 'a';
const override = Object.fromEntries((process.argv[3] || '').split(',').filter(Boolean).map((kv) => kv.split('=').map((v, i) => (i ? v : +v))));
const takeOf = (n) => override[n] || take;
const SR = 48000, GAP = cfg.align.gap ?? 1.0, PAD = 0.04;
// Pause before a chapter (seconds): project.json align.gap, with per-chapter overrides in align.gapBefore
// ({"5": 2.2} waits longer before chapter 5, e.g. so a punchline at the end of chapter 4 can land).
const GAP_BEFORE = cfg.align.gapBefore || {};
const gapBefore = (n) => GAP_BEFORE[n] ?? GAP;
const D = path.join(ROOT, 'assets/audio/vo/takes');

const load = (f) => { const b = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 }); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); };
function speechBounds(x) {                                   // first/last 10 ms window above -42 dBFS
  const hop = SR / 100, thr = 10 ** (-42 / 20);
  let a = -1, b = -1;
  for (let i = 0; i + hop <= x.length; i += hop) {
    let s = 0; for (let j = i; j < i + hop; j++) s += x[j] * x[j];
    if (Math.sqrt(s / hop) > thr) { if (a < 0) a = i; b = i + hop; }
  }
  return [Math.max(0, a / SR - PAD), Math.min(x.length / SR, b / SR + PAD)];
}

// Spoken sub-tokens, shared by script and transcripts. Generic entries here; project entries come from
// project.json align.expand ({token: [subtokens]}, e.g. {"gdpr": ["g","d","p","r"]}), matching the spoken forms.
const EXPAND = { md: ['dot', 'm', 'd'], clawed: ['claude'], cloud: ['claude'], '2': ['two'], ...(cfg.align.expand || {}) };
const sub = (w) => {
  const t = w.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  return t.flatMap((x) => EXPAND[x] || (/^\d+$/.test(x) ? [x] : [x]));
};

function align(script, heard) {                              // Needleman-Wunsch over sub-tokens
  const n = script.length, m = heard.length, S = [], B = [];
  for (let i = 0; i <= n; i++) { S.push(new Float64Array(m + 1)); B.push(new Uint8Array(m + 1)); S[i][0] = -i; B[i][0] = 1; }
  for (let j = 1; j <= m; j++) { S[0][j] = -j; B[0][j] = 2; }
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const d = S[i - 1][j - 1] + (script[i - 1] === heard[j - 1].t ? 2 : -1), u = S[i - 1][j] - 1, l = S[i][j - 1] - 1;
    if (d >= u && d >= l) { S[i][j] = d; B[i][j] = 0; } else if (u >= l) { S[i][j] = u; B[i][j] = 1; } else { S[i][j] = l; B[i][j] = 2; }
  }
  const map = new Array(n).fill(null);
  for (let i = n, j = m; i > 0 || j > 0;) {
    if (i > 0 && j > 0 && B[i][j] === 0) { if (script[i - 1] === heard[j - 1].t) map[i - 1] = heard[j - 1]; i--; j--; }
    else if (i > 0 && (j === 0 || B[i][j] === 1)) i--; else j--;
  }
  return map;
}

const words = [], chaps = [], pieces = [], report = [];
let t = 0;
for (const ch of chapters()) {
  const file = path.join(D, `ch${ch.num}_${cfg.voice.name}_${takeOf(ch.num)}.mp3`);
  const x = load(file);
  const [a, b] = speechBounds(x);
  if (ch.num > 1) pieces.push(new Float32Array(Math.round(gapBefore(ch.num) * SR)));   // the pause comes before each later chapter
  pieces.push(x.subarray(Math.round(a * SR), Math.round(b * SR)));
  chaps.push({ num: ch.num, title: ch.title, t0: +t.toFixed(3), t1: +(t + b - a).toFixed(3) });

  // script tokens and their spoken sub-tokens
  const toks = tokens(ch.text);
  const subs = [], owner = [];
  toks.forEach((tk, k) => sub(tk).forEach((s) => { subs.push(s); owner.push(k); }));
  const fromModel = (tag) => {
    const tr = JSON.parse(fs.readFileSync(file.replace('.mp3', `.${tag}.json`), 'utf8'));
    const heard = [];
    for (const w of tr.words || []) {
      const ss = sub(w.word); const d = (w.end - w.start) / Math.max(1, ss.length);
      ss.forEach((s, i) => heard.push({ t: s, a: w.start + i * d, b: w.start + (i + 1) * d }));
    }
    const map = align(subs, heard);
    const span = toks.map(() => null);
    map.forEach((h, i) => { if (!h) return; const k = owner[i]; span[k] = span[k] ? [Math.min(span[k][0], h.a), Math.max(span[k][1], h.b)] : [h.a, h.b]; });
    return span;
  };
  const nova = fromModel('nova3'), wh = fromModel('whisper');
  let agree = 0, onlyOne = 0, none = 0;
  const span = toks.map((_, k) => {
    const p = nova[k], q = wh[k];
    if (p && q && Math.abs(p[0] - q[0]) < 0.12) { agree++; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; }
    if (p || q) { onlyOne++; return p || q; }
    none++; return null;
  });
  // interpolate words neither model placed, weighted by length
  for (let k = 0; k < span.length; k++) {
    if (span[k]) continue;
    let e = k; while (e < span.length && !span[e]) e++;
    const t0 = k > 0 ? span[k - 1][1] : a, t1 = e < span.length ? span[e][0] : b;
    const wsum = toks.slice(k, e).reduce((s, w) => s + w.length + 2, 0);
    let c = t0;
    for (let i = k; i < e; i++) { const d = ((toks[i].length + 2) / wsum) * (t1 - t0); span[i] = [c, c + d]; c += d; }
    k = e - 1;
  }
  toks.forEach((tk, k) => words.push([tk, +(t + span[k][0] - a).toFixed(3), +(t + span[k][1] - a).toFixed(3)]));
  // long pauses inside the chapter, for review
  const longGaps = [];
  for (let k = 1; k < toks.length; k++) { const g = span[k][0] - span[k - 1][1]; if (g > 0.7) longGaps.push(`${toks[k - 1]}|${toks[k]} ${g.toFixed(2)}s`); }
  report.push(`ch${ch.num}: ${toks.length} words, both models agree ${agree}, one model ${onlyOne}, interpolated ${none}; speech ${(b - a).toFixed(2)} s; long pauses: ${longGaps.join(', ') || 'none'}`);
  t += b - a + gapBefore(ch.num + 1);
}
t -= gapBefore(chapters().length + 1);

// write the narration track and the timing contract
const total = pieces.reduce((s, p) => s + p.length, 0), all = new Float32Array(total);
let o = 0; for (const p of pieces) { all.set(p, o); o += p.length; }
execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', '-', '-c:a', 'pcm_s24le', path.join(ROOT, 'assets/audio/vo/vo.wav')], { input: Buffer.from(all.buffer) });
const out = { estimated: false, take, duration: +t.toFixed(3), chapters: chaps, words };
fs.writeFileSync(path.join(ROOT, 'js/vo-timing.js'), `// Generated by tools/align.mjs from take "${take}": narration word timings (seconds from narration start).\nwindow.VO_TIMING = ${JSON.stringify(out)};\n`);
fs.mkdirSync(path.join(ROOT, 'review'), { recursive: true });
fs.writeFileSync(path.join(ROOT, `review/align-take-${take}.txt`), report.join('\n') + '\n');
console.log(report.join('\n'));
console.log(`narration ${t.toFixed(2)} s, ${words.length} words ->`, chaps.map((c) => `${c.num}@${c.t0.toFixed(1)}`).join(' '));
