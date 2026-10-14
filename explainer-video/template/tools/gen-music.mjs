// Music via Eden AI. Eden has no music endpoint, so a sound-capable video model (Veo 3.1 Lite)
// generates a short clip and only its audio track is kept; mix.py loops it on bar lines.
// Fine for an internal film; replace with a licensed track before any public use.
// Usage: node gen-music.mjs <job> [<job> ...]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { video, ROOT } from './eden.mjs';
import { cfg } from './config.mjs';

process.env.EDEN_STEP = 'music';
const RAW = path.join(ROOT, 'assets/raw/av'), OUT = path.join(ROOT, 'assets/audio/music');
[RAW, OUT].forEach((d) => fs.mkdirSync(d, { recursive: true }));
// Visual prompt for the video model (only its audio track is kept); music.scene in project.json overrides it.
const SCENE = cfg.music.scene || 'A cheerful flat cartoon animation of colourful paper shapes bouncing gently in time to music on a pastel background, playful and bright.';
const TAIL = `${cfg.music.key}, exactly ${cfg.music.bpm} BPM, perfectly steady tempo from the first to the last second, 4/4. Instrumental only: no vocals, no humming, no speech, no sound effects. Sparse arrangement with a lot of space in the middle frequencies so a narrator can speak over it.`;
// project.json music.prompts {job: description of the music}. The scene, the tempo and the key are added here.
const DEFAULT_PROMPTS = {
  cartoon_uke: 'a playful, warm, upbeat cartoon explainer music cue: bouncy strummed ukulele on the offbeats, glockenspiel plinks, pizzicato strings, a round bouncy bass, a soft kick drum on every beat and light hand claps on beats two and four.',
  cartoon_marimba: 'a quirky, happy, upbeat cartoon explainer music cue: plucked acoustic guitar playing a bouncy rhythm, marimba and glockenspiel accents, pizzicato strings, a bouncy bass, a soft kick drum and light finger snaps and claps on beats two and four.',
};
const PROMPTS = { ...DEFAULT_PROMPTS, ...(cfg.music.prompts || {}) };
const JOBS = Object.fromEntries(Object.entries(PROMPTS).map(([k, p]) => [k, `${SCENE} Audio: ${p} ${TAIL}`]));
if (!process.argv[2]) { console.log('usage: node gen-music.mjs <job> [<job> ...]   jobs:', Object.keys(JOBS).join(', ')); process.exit(0); }

await Promise.all(process.argv.slice(2).map(async (key) => {
  const prompt = JOBS[key];
  if (!prompt) { console.log('unknown', key); return; }
  const mp4 = path.join(RAW, `${key}.mp4`);
  if (!fs.existsSync(mp4)) {
    try {
      const v = await video({ model: 'google/veo-3.1-lite-generate-preview', prompt, seconds: 8, perSecond: 0.05, label: `music ${key}`, outFile: mp4 });
      console.log(key, v.status, 'cost', v.cost);
    } catch (e) { console.log(key, 'FAILED', e.message.slice(0, 400)); return; }
  }
  const wav = path.join(OUT, `${key}.wav`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', mp4, '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s24le', wav]);
  console.log(key, '->', path.relative(ROOT, wav));
}));
