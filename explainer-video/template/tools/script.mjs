// Shared script helpers: chapters, cue tokens and spoken forms, all read from script/narration.md.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, cfg } from './config.mjs';

export function chapters() {
  const md = fs.readFileSync(path.join(ROOT, 'script/narration.md'), 'utf8');
  return md.split(/^## /m).slice(1).map((block) => {
    const [head, ...body] = block.trim().split('\n');
    const [, num, title] = head.match(/^(\d+)\s+(.*)$/);
    return { num: +num, title, text: body.join(' ').replace(/\s+/g, ' ').trim() };
  });
}

// Cue tokens: lowercased, split on spaces and hyphens, punctuation removed except apostrophes.
export const tokens = (text) => text.replace(/[’]/g, "'").split(/[\s\-]+/)
  .map((w) => w.toLowerCase().replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '')).filter(Boolean);

// What the voice should say: project.json "spoken" is a list of [regex, replacement] applied in order.
// A pattern is a plain regex source (flag g) or "/source/flags". To steer the voice on one word,
// add an ElevenLabs audio tag at speech time only, e.g. ["\\bWonderful\\.", "[delighted] Wonderful!!"];
// the displayed script, the captions and the cue tokens keep the written form.
const RULES = (cfg.spoken || []).map(([pat, rep]) => {
  const m = /^\/(.*)\/([a-z]*)$/s.exec(pat);
  return [m ? new RegExp(m[1], m[2].includes('g') ? m[2] : m[2] + 'g') : new RegExp(pat, 'g'), rep];
});
export const spoken = (text) => RULES.reduce((t, [re, rep]) => t.replace(re, rep), text);
