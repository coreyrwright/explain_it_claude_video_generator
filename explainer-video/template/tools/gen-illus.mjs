// Illustrations via Eden AI (default Gemini 3 Pro Image). The first job is the hero and style reference;
// later images go through /v3/images/edits with refs (the hero, and for variants also the character's first image).
// Usage: node gen-illus.mjs <id> [<id> ...]   (existing files are skipped unless FORCE=1)
import fs from 'node:fs';
import path from 'node:path';
import { image, imageEdit, saveImages, ROOT } from './eden.mjs';

process.env.EDEN_STEP = 'illustrations';
const RAW = path.join(ROOT, 'assets/raw/illus');
fs.mkdirSync(RAW, { recursive: true });
// All creative content lives in assets/illus/jobs.json: { model, style, isolate, ref, jobs: { id: { prompt, size, refs: [] } } }.
//  style    prepended to every prompt (the look: line, palette, characters)
//  isolate  appended to every prompt (background and "no text" rules; keeps cut-outs clean)
//  ref      prepended to prompts that have refs (explains that the reference images only set the style)
//  refs     ids of earlier illustrations passed as reference images to /v3/images/edits (the hero first, then the character's first image)
const JOBS_FILE = path.join(ROOT, 'assets/illus/jobs.json');
if (!fs.existsSync(JOBS_FILE)) throw new Error('assets/illus/jobs.json not found');
const CFG = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'));
const MODEL = CFG.model || 'google/gemini-3-pro-image';
const JOBS = Object.fromEntries(Object.entries(CFG.jobs || {}).map(([id, j]) => [id, {
  refs: j.refs && j.refs.length ? j.refs : null,
  size: j.size || '2048x2048',
  prompt: [j.refs && j.refs.length ? CFG.ref : '', CFG.style, j.prompt, CFG.isolate].filter(Boolean).join(' '),
}]));

const b64 = (id) => ({ image_url: `data:image/png;base64,${fs.readFileSync(path.join(RAW, `${id}.png`)).toString('base64')}` });
const ids = process.argv.slice(2);
if (!ids.length) { console.log('usage: node gen-illus.mjs <id> [<id> ...]   ids:', Object.keys(JOBS).join(', ') || '(none: add jobs to assets/illus/jobs.json)'); process.exit(0); }
await Promise.all(ids.map(async (id) => {
  const j = JOBS[id];
  if (!j) { console.log('unknown', id); return; }
  const out = path.join(RAW, `${id}.png`);
  if (fs.existsSync(out) && !process.env.FORCE) { console.log('exists', id); return; }
  try {
    const res = j.refs
      ? await imageEdit({ model: MODEL, prompt: j.prompt, images: j.refs.map(b64), label: `illustration ${id}`, estimate: 0.2, size: j.size })
      : await image({ model: MODEL, prompt: j.prompt, label: `illustration ${id}`, estimate: 0.2, size: j.size });
    const files = await saveImages(res, out);
    console.log(id, 'cost', res.cost, '->', files.map((f) => path.basename(f)).join(','));
  } catch (e) { console.log(id, 'FAILED', e.message.slice(0, 600)); }
}));
