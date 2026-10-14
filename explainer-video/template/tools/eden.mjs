// Minimal Eden AI v3 client with a hard spend guard.
// Every paid call is logged to spend.log (human readable) and spend.json (ledger) in the project
// folder. New calls are refused once the running total plus the call's conservative estimate would
// cross the stop-at amount (project.json budget.stopAtUsd), so the cap (budget.capUsd) is never
// reached. Calls carry X-EdenAI-Tags (project.json eden.tags) so usage splits by brand and step.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { ROOT, cfg } from './config.mjs';

export { ROOT };
const HOME = os.homedir();
// The API key is read, never printed, logged or copied into the project. Lookup order:
// 1. EDEN_AI_API_KEY in the environment  2. the file named by EDEN_ENV  3. ~/.config/eden-ai/.env
const ENV_FILES = [process.env.EDEN_ENV, path.join(HOME, '.config', 'eden-ai', '.env')].filter(Boolean);
const TAGS = cfg.eden.tags || {};
const LOG = path.join(ROOT, 'spend.log');
const LEDGER = path.join(ROOT, 'spend.json');
const BASE = process.env.EDEN_BASE || cfg.eden.base;

export const HARD_LIMIT = cfg.budget.capUsd;
export const STOP_AT = cfg.budget.stopAtUsd; // headroom for rounding and late-reported costs

export function apiKey() {
  const clean = (v) => (v || '').trim().replace(/^["']|["']$/g, '');
  if (process.env.EDEN_AI_API_KEY) return clean(process.env.EDEN_AI_API_KEY);
  for (const f of ENV_FILES) {
    let txt; try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const line = txt.split('\n').find((l) => /^\s*(export\s+)?EDEN_AI_API_KEY\s*=/.test(l));
    const key = line ? clean(line.slice(line.indexOf('=') + 1)) : '';
    if (key) return key;
  }
  throw new Error('EDEN_AI_API_KEY not found: set it in the environment, or in the .env file named by EDEN_ENV or at ~/.config/eden-ai/.env');
}

// Cross-process lock so concurrent scripts never lose ledger entries.
function withLock(fn) {
  const lock = LEDGER + '.lock';
  const t0 = Date.now();
  for (;;) {
    try { fs.mkdirSync(lock); break; } catch {
      if (Date.now() - t0 > 20000) { try { fs.rmdirSync(lock); } catch {} continue; }
      const until = Date.now() + 25; while (Date.now() < until) {}
    }
  }
  try { return fn(); } finally { try { fs.rmdirSync(lock); } catch {} }
}

function ledger() {
  try { return JSON.parse(fs.readFileSync(LEDGER, 'utf8')); } catch { return { total: 0, calls: [] }; }
}

export function spent() { return ledger().total; }

function guard(estimate, label) {
  const total = spent();
  if (total + estimate > STOP_AT) {
    throw new Error(`BUDGET GUARD: refusing "${label}" (spent $${total.toFixed(4)} + est $${estimate.toFixed(4)} > stop at $${STOP_AT})`);
  }
}

function record(args) { return withLock(() => recordUnlocked(args)); }
function recordUnlocked({ endpoint, model, label, cost, estimated, provider, extra }) {
  const l = ledger();
  l.total = +(l.total + cost).toFixed(6);
  const entry = { at: new Date().toISOString(), endpoint, model, label, cost: +cost.toFixed(6), estimated: !!estimated, provider: provider || null, total: l.total, ...(extra ? { extra } : {}) };
  l.calls.push(entry);
  fs.writeFileSync(LEDGER, JSON.stringify(l, null, 2));
  if (!fs.existsSync(LOG)) fs.writeFileSync(LOG, `# Eden AI spend log (cap $${HARD_LIMIT.toFixed(2)}, generation stops at $${STOP_AT.toFixed(2)})\n# time | endpoint | model | label | cost USD | running total USD\n`);
  fs.appendFileSync(LOG, `${entry.at} | ${endpoint} | ${model} | ${label} | ${cost.toFixed(6)}${estimated ? ' (est)' : ''} | ${l.total.toFixed(6)}\n`);
  return entry;
}

async function request(method, url, { json, form, headers = {}, raw = false } = {}) {
  const tags = Object.entries({ ...TAGS, step: process.env.EDEN_STEP || 'build' }).map(([k, v]) => `${k}=${v}`).join(',');
  const h = { Authorization: `Bearer ${apiKey()}`, 'X-EdenAI-Tags': tags, ...headers };
  let body;
  if (json) { h['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url.startsWith('http') ? url : BASE + url, { method, headers: h, body, redirect: 'follow' });
    if (res.status === 429 || res.status >= 500) {
      const txt = await res.text();
      if (attempt === 3) throw new Error(`${method} ${url} -> ${res.status}: ${txt.slice(0, 600)}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      continue;
    }
    if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}: ${(await res.text()).slice(0, 1200)}`);
    return raw ? res : res.json();
  }
}

const costOf = (obj) => {
  if (!obj || typeof obj !== 'object') return null;
  if (typeof obj.cost === 'number') return obj.cost;
  if (obj.usage && typeof obj.usage.cost === 'number') return obj.usage.cost;
  return null;
};

// ---- persistent upload (for video/audio review inputs); free, but logged if Eden reports a cost
export async function upload(file, purpose = 'assistants') {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)]), path.basename(file));
  form.append('purpose', purpose);
  const out = await request('POST', '/upload', { form });
  const c = costOf(out);
  if (c) record({ endpoint: 'upload', model: '-', label: `upload ${path.basename(file)}`, cost: c, estimated: false });
  return out;
}

// ---- chat completions (LLM review, audio/vision judging) -------------------
export async function chat({ model, messages, label = 'chat', estimate = 0.05, ...rest }) {
  guard(estimate, label);
  const out = await request('POST', '/chat/completions', { json: { model, messages, ...rest } });
  const c = costOf(out);
  record({ endpoint: 'chat/completions', model, label, cost: c ?? estimate, estimated: c == null, provider: out.provider });
  return out;
}

// ---- image generation / edits ------------------------------------------------
export async function image({ model, prompt, label = 'image', estimate = 0.2, size, quality, n = 1, ...rest }) {
  guard(estimate * n, label);
  const out = await request('POST', '/images/generations', { json: { model, prompt, n, ...(size ? { size } : {}), ...(quality ? { quality } : {}), ...rest } });
  const c = costOf(out);
  record({ endpoint: 'images/generations', model, label, cost: c ?? estimate * n, estimated: c == null, provider: out.provider });
  return out;
}

export async function imageEdit({ model, prompt, images, label = 'image-edit', estimate = 0.2, size, ...rest }) {
  guard(estimate, label);
  const out = await request('POST', '/images/edits', { json: { model, prompt, images, ...(size ? { size } : {}), ...rest } });
  const c = costOf(out);
  record({ endpoint: 'images/edits', model, label, cost: c ?? estimate, estimated: c == null, provider: out.provider });
  return out;
}

export async function saveImages(out, basePath) {
  const files = [];
  for (const [i, d] of (out.data || []).entries()) {
    const file = out.data.length > 1 ? basePath.replace(/(\.\w+)$/, `_${i}$1`) : basePath;
    if (d.b64_json) fs.writeFileSync(file, Buffer.from(d.b64_json, 'base64'));
    else if (d.url) fs.writeFileSync(file, Buffer.from(await (await fetch(d.url)).arrayBuffer()));
    files.push(file);
  }
  return files;
}

// ---- text to speech ------------------------------------------------------------
export async function speech({ model, input, voice, response_format = 'mp3', label = 'tts', outFile, ...rest }) {
  const perChar = model.startsWith('elevenlabs/') ? 0.00018 : 0.00003;
  const estimate = input.length * perChar * 1.1 + 0.001;
  guard(estimate, label);
  const res = await request('POST', '/audio/speech', { json: { model, input, ...(voice ? { voice } : {}), response_format, ...rest }, raw: true });
  const buf = Buffer.from(await res.arrayBuffer());
  const hdrCost = parseFloat(res.headers.get('x-edenai-cost') ?? res.headers.get('x-edenai-cost-usd') ?? '');
  const provider = res.headers.get('x-edenai-provider');
  const cost = Number.isFinite(hdrCost) ? hdrCost : estimate;
  record({ endpoint: 'audio/speech', model, label, cost, estimated: !Number.isFinite(hdrCost), provider, extra: { voice, chars: input.length } });
  if (outFile) fs.writeFileSync(outFile, buf);
  return { buf, cost, provider, headers: Object.fromEntries([...res.headers].filter(([k]) => k.startsWith('x-edenai'))) };
}

// ---- speech to text with word timestamps ----------------------------------------
export async function transcribe({ file, model = 'groq/whisper-large-v3', label = 'transcribe', prompt, language = 'en', format = 'verbose_json' }) {
  const seconds = parseFloat(process.env.AUDIO_SECONDS || '90');
  const estimate = Math.max(0.01, seconds * 0.0002);
  guard(estimate, label);
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)]), path.basename(file));
  form.append('model', model);
  form.append('response_format', format);
  if (format === 'verbose_json') {
    form.append('timestamp_granularities[]', 'word');
    form.append('timestamp_granularities[]', 'segment');
  }
  if (language) form.append('language', language);
  if (prompt) form.append('prompt', prompt);
  const out = await request('POST', '/audio/transcriptions', { form });
  const c = costOf(out);
  record({ endpoint: 'audio/transcriptions', model, label, cost: c ?? estimate, estimated: c == null, provider: out.provider });
  return out;
}

// ---- video generation (used only for its generated audio track) -----------------
export async function video({ model, prompt, seconds, size, label = 'video', perSecond, outFile, pollMs = 8000, timeoutMs = 15 * 60 * 1000, ...rest }) {
  const estimate = (perSecond ?? 0.4) * Number(seconds || 8) + 0.02;
  guard(estimate, label);
  const job = await request('POST', '/videos', { json: { model, prompt, ...(seconds ? { seconds: String(seconds) } : {}), ...(size ? { size } : {}), ...rest } });
  const t0 = Date.now();
  let cur = job;
  while (!['completed', 'failed', 'cancelled', 'expired'].includes(cur.status)) {
    if (Date.now() - t0 > timeoutMs) throw new Error(`video ${job.id} timed out (status ${cur.status})`);
    await new Promise((r) => setTimeout(r, pollMs));
    cur = await request('GET', `/videos/${job.id}`);
  }
  const c = costOf(cur);
  // A failed job may still be billed; record whatever Eden reports (or the estimate if it reports nothing and completed).
  const cost = c ?? (cur.status === 'completed' ? estimate : 0);
  record({ endpoint: 'videos', model, label, cost, estimated: c == null, provider: cur.provider, extra: { id: job.id, status: cur.status, seconds } });
  if (cur.status !== 'completed') throw new Error(`video ${job.id} ${cur.status}: ${JSON.stringify(cur.error || cur).slice(0, 800)}`);
  if (outFile) {
    const res = await request('GET', `/videos/${job.id}/content`, { raw: true });
    fs.writeFileSync(outFile, Buffer.from(await res.arrayBuffer()));
  }
  return cur;
}

// Quick CLI: `node eden.mjs spent`
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const cmd = process.argv[2];
  if (cmd === 'spent') console.log(`spent $${spent().toFixed(4)} of $${HARD_LIMIT} (stop at $${STOP_AT})`);
}
