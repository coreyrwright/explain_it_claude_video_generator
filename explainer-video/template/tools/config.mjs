// Project configuration shared by every tool: reads project.json (with defaults), resolves the
// runtime (puppeteer-core and the Python venv live outside the project, in VIDEO_RUNTIME) and
// writes js/project-config.js for the browser. Nothing here touches the network.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOME = os.homedir();
const expand = (p) => (typeof p === 'string' && p.startsWith('~') ? path.join(HOME, p.slice(1)) : p);

const DEFAULTS = {
  name: 'explainer',
  title: 'Explainer',
  output: null,                                   // default "../<name>.mp4" (next to the project folder)
  budget: { capUsd: 10, stopAtUsd: 9.25 },
  eden: { base: 'https://api.edenai.run/v3', tags: {} },
  voice: { model: 'elevenlabs/eleven_v3', id: 'bIHbv24MWmeRgasZH58o', name: 'will' },
  spoken: [],                                     // [[regex, replacement], ...] applied to the text sent to the voice
  align: { gap: 1.0, gapBefore: {}, expand: {} },
  music: { bpm: 112, key: 'G major', pick: 'cartoon_marimba', prompts: {} },
  review: { film: '' },
  python: null,                                   // path to a python with numpy, scipy and pillow; null = the runtime venv
};
const merge = (a, b) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) out[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) ? merge(a[k], v) : v;
  return out;
};

function load() {
  const file = path.join(ROOT, 'project.json');
  if (!fs.existsSync(file)) throw new Error(`project.json not found in ${ROOT}`);
  let user;
  try { user = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new Error(`project.json is not valid JSON: ${e.message}`); }
  const c = merge(DEFAULTS, user);
  c.output = path.resolve(ROOT, expand(c.output || `../${c.name}.mp4`));
  c.align.expand = { ...(c.align.expand || {}) };
  return c;
}
export const cfg = load();

// ---- runtime -----------------------------------------------------------------------------------
export function runtimeDir() {
  if (process.env.VIDEO_RUNTIME) return path.resolve(expand(process.env.VIDEO_RUNTIME));
  return path.join(HOME, '.video-runtime');
}
export function pythonBin() {
  if (cfg.python) return path.resolve(ROOT, expand(cfg.python));
  const venv = path.join(runtimeDir(), 'venv', 'bin', 'python');
  return fs.existsSync(venv) ? venv : 'python3';
}
export function chromePath() {
  const c = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'];
  return c.find((p) => p && fs.existsSync(p)) || c[1];
}

// ---- browser config ----------------------------------------------------------------------------
// js/project-config.js is generated from project.json so the page needs no fetch (works from file://).
// Also keeps the scene <script> tags in index.html in step with js/scenes/*.js (sorted by file name),
// so a new scene file is picked up without editing the page.
export function writeBrowserConfig() {
  syncSceneTags();
  const body = `// Generated from project.json by tools/config.mjs (do not edit; edit project.json).\nwindow.PROJECT = ${JSON.stringify({ name: cfg.name, title: cfg.title, music: { bpm: cfg.music.bpm } })};\n`;
  const file = path.join(ROOT, 'js/project-config.js');
  let old = ''; try { old = fs.readFileSync(file, 'utf8'); } catch {}
  if (old !== body) fs.writeFileSync(file, body);
}

export const ensureDir = (...p) => { const d = path.join(ROOT, ...p); fs.mkdirSync(d, { recursive: true }); return d; };

export function syncSceneTags() {
  const file = path.join(ROOT, 'index.html');
  let html; try { html = fs.readFileSync(file, 'utf8'); } catch { return; }
  const dir = path.join(ROOT, 'js/scenes');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort() : [];
  const block = `<!-- scenes:start (tools rewrite this list from js/scenes/*.js, sorted by file name) -->\n${files.map((f) => `<script src="js/scenes/${f}"></script>`).join('\n')}\n<!-- scenes:end -->`;
  const next = html.replace(/<!-- scenes:start[\s\S]*?<!-- scenes:end -->/, block);
  if (next !== html) fs.writeFileSync(file, next);
}

// `node tools/config.mjs` regenerates js/project-config.js and the scene tags in index.html.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) { writeBrowserConfig(); console.log('js/project-config.js and index.html scene tags are up to date'); }
