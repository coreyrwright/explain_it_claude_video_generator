#!/usr/bin/env node
// Scaffolds a new explainer video project from the skill's template and a brand profile.
//
//   node new_project.mjs <targetDir> --brand <brandId | path to a brand folder> --name <kebab-name> --title "<Title>" [--style cartoon|flat] [--cap <usd>]
//
// - copies template/ to targetDir (refuses if it exists and is not empty)
// - writes js/theme.js, css/fonts.css, assets/brand/ and fonts/ from brands/<id>/brand.json
// - writes project.json (name, title, Eden tags brand=<id> and project=<name>, brand pronunciation rules)
// - fills PLAN.md and README.md, writes assets/illus/jobs.json with the brand palette in the style prompt
// - copies the brand's own icon SVGs (brands/<id>/icons/) into assets/icons/ if brand.json says icons.source == "folder"
// - builds the estimated timing (js/vo-timing.js) from script/narration.md, then prints the next steps
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const die = (m) => { console.error('error: ' + m); process.exit(1); };

// ---- arguments ----------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };
const target = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const brandArg = opt('brand'), name = opt('name'), title = opt('title'), styleArg = opt('style');
if (!target || !brandArg || !name || !title) die('usage: node new_project.mjs <targetDir> --brand <brandId|path> --name <kebab-name> --title "<Title>" [--style cartoon|flat] [--cap <usd>]');
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) die('--name must be kebab-case (lowercase letters, digits, hyphens)');
if (styleArg && !['cartoon', 'flat'].includes(styleArg)) die('--style must be cartoon or flat');
const dest = path.resolve(target);
if (fs.existsSync(dest) && fs.readdirSync(dest).length) die(`${dest} exists and is not empty`);

// ---- brand ----------------------------------------------------------------------------------------
const brandDir = fs.existsSync(path.join(brandArg, 'brand.json')) ? path.resolve(brandArg) : path.join(SKILL, 'brands', brandArg);
if (!fs.existsSync(path.join(brandDir, 'brand.json'))) die(`brand not found: ${brandArg} (looked in ${brandDir}). Brands: ${fs.readdirSync(path.join(SKILL, 'brands')).filter((d) => !d.startsWith('.')).join(', ')}`);
const brand = JSON.parse(fs.readFileSync(path.join(brandDir, 'brand.json'), 'utf8'));
const brandId = brand.id || path.basename(brandDir);
const ROLES = ['ink', 'primary', 'accent', 'highlight', 'bg', 'surface', 'line', 'accentTint', 'bgTint', 'muted'];
for (const r of ROLES) if (!/^#[0-9a-fA-F]{6}$/.test(brand.palette?.[r] || '')) die(`brand.json palette.${r} must be a #RRGGBB colour`);

// style: the brand's default, overridden by --style (flat = no outline, soft shadow)
let style = { outline: 5, shadow: 'offset', radius: 28, ...(brand.style || {}) };
if (styleArg === 'flat') style = { ...style, outline: 0, shadow: 'soft' };
if (styleArg === 'cartoon' && !(style.outline > 0)) style = { ...style, outline: 5, shadow: 'offset' };
const styleName = style.outline > 0 ? 'cartoon' : 'flat';

// ---- copy the template ----------------------------------------------------------------------------
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(path.join(SKILL, 'template'), dest, { recursive: true });
const W = (rel, txt) => { fs.mkdirSync(path.dirname(path.join(dest, rel)), { recursive: true }); fs.writeFileSync(path.join(dest, rel), txt); };
const R = (rel) => fs.readFileSync(path.join(dest, rel), 'utf8');

// ---- logo files -----------------------------------------------------------------------------------
const logo = {};
for (const k of ['color', 'white']) {
  const f = brand.logo?.[k];
  if (!f) continue;
  const src = path.join(brandDir, f);
  if (!fs.existsSync(src)) { console.warn(`warning: logo file ${f} not found in ${brandDir}; no ${k} logo`); continue; }
  fs.mkdirSync(path.join(dest, 'assets/brand'), { recursive: true });
  fs.copyFileSync(src, path.join(dest, 'assets/brand', f));
  logo[k] = `assets/brand/${f}`;
}
// the template ships neutral placeholder logos for the _template brand; remove them if this brand has its own
for (const f of fs.readdirSync(path.join(dest, 'assets/brand'))) if (!Object.values(logo).includes(`assets/brand/${f}`)) fs.rmSync(path.join(dest, 'assets/brand', f));

// ---- fonts ----------------------------------------------------------------------------------------
const font = { family: 'Inter', weights: [400, 600, 700], files: {}, ...(brand.font || {}) };
const fontFiles = {};
for (const w of font.weights) {
  const f = font.files?.[w] || (font.family === 'Inter' ? { 400: 'Inter-Regular.ttf', 500: 'Inter-Medium.ttf', 600: 'Inter-SemiBold.ttf', 700: 'Inter-Bold.ttf' }[w] : null);
  const cand = f && [path.join(brandDir, 'fonts', f), path.join(brandDir, f), path.join(SKILL, 'template/fonts', f)].find(fs.existsSync);
  if (!cand) { console.warn(`warning: no font file for ${font.family} ${w}; the film will fall back to Arial for that weight`); continue; }
  fs.mkdirSync(path.join(dest, 'fonts'), { recursive: true });
  fs.copyFileSync(cand, path.join(dest, 'fonts', path.basename(cand)));
  fontFiles[w] = path.basename(cand);
}
const keep = new Set(Object.values(fontFiles));
for (const f of fs.readdirSync(path.join(dest, 'fonts'))) {
  if (f === 'OFL.txt' ? font.family !== 'Inter' : !keep.has(f)) fs.rmSync(path.join(dest, 'fonts', f));
}
W('css/fonts.css', `/* Generated by new_project.mjs for THEME.font (${font.family}). Add @font-face rules here if you add weights; keep js/theme.js in step. */\n` +
  Object.entries(fontFiles).map(([w, f]) => `@font-face { font-family: "${font.family}"; src: url("../fonts/${f}") format("${f.endsWith('.otf') ? 'opentype' : f.endsWith('.woff2') ? 'woff2' : 'truetype'}"); font-weight: ${w}; font-style: normal; }`).join('\n') + '\n');

// ---- theme.js -------------------------------------------------------------------------------------
const theme = {
  brand: brandId,
  palette: Object.fromEntries(ROLES.map((r) => [r, brand.palette[r].toUpperCase()])),
  font: { family: font.family, weights: font.weights },
  logo,
  icons: { color: brand.icons?.color || 'color', white: brand.icons?.white || 'white', ids: [] },
  style: { outline: style.outline, shadow: style.shadow, radius: style.radius },
  chrome: { chapterPill: true, logo: true, ...(brand.chrome || {}) },
};
// ---- project.json ---------------------------------------------------------------------------------
const pj = JSON.parse(R('project.json'));
const capArg = opt('cap');
if (capArg) { const c = +capArg; if (!(c > 0)) die('--cap must be a number of US dollars'); pj.budget = { ...pj.budget, capUsd: c, stopAtUsd: +(c * 0.925).toFixed(2) }; }
pj.name = name; pj.title = title; pj.output = `../${name}.mp4`;
pj.eden.tags = { brand: brandId, project: name };
const spoken = [...(pj.spoken || [])];
for (const s of brand.spoken || []) if (!spoken.some((x) => x[0] === s[0])) spoken.push(s);
pj.spoken = spoken;
pj.align.expand = { ...(pj.align.expand || {}), ...(brand.align?.expand || {}) };
const look = styleName === 'cartoon' ? `outlined cartoon shapes (${style.outline} px outlines, flat fills, a soft offset shadow), playful pop-in motion` : 'clean flat shapes (no outlines, soft shadows), calm motion';
pj.review.film = `A narrated animated explainer film for ${brand.name}. TODO: topic, audience, where it is shown. Look: ${look}; ${font.family} type; palette ${ROLES.slice(0, 5).map((r) => `${r} ${theme.palette[r]}`).join(', ')}.`;
W('project.json', JSON.stringify(pj, null, 2) + '\n');

// ---- PLAN.md and README.md ------------------------------------------------------------------------
const fill = (txt, vars) => Object.entries(vars).reduce((t, [k, v]) => t.split(`{{${k}}}`).join(v), txt);
const vars = {
  TITLE: title, BRAND_NAME: brand.name, STYLE: styleName, OUTPUT: pj.output.replace(/^\.\.\//, '../'), OUTLINE: String(style.outline), SHADOW: style.shadow, RADIUS: String(style.radius),
  PALETTE: ROLES.map((r) => `${r} \`${theme.palette[r]}\``).join(', ') + '.',
  RULES: (brand.rules || ['(none listed in the brand profile)']).map((r) => `  - ${r}`).join('\n'),
  CAP: String(pj.budget.capUsd), STOP: String(pj.budget.stopAtUsd),
};
W('PLAN.md', fill(R('PLAN.md'), vars));
W('README.md', fill(R('README.md'), vars));

// ---- illustration jobs: palette into the style prompt ----------------------------------------------
const jobsFile = 'assets/illus/jobs.json';
const jobs = JSON.parse(R(jobsFile));
const p = theme.palette;
jobs.style = `${styleName === 'cartoon' ? 'Playful 2D cartoon illustration in the style of a modern animated explainer series. Bold, rounded, simple shapes; clean, even outlines of medium weight in ink ' + p.ink + ' around every shape; flat colors with at most one soft shade' : 'Clean modern flat 2D vector illustration in the style of a corporate explainer series. Simple rounded shapes with no outlines; flat colors with at most one soft shade'}; big expressive heads and large friendly eyes; simple bendy limbs; cheerful, warm. Strict palette: ink ${p.ink}, primary ${p.primary}, accent ${p.accent}, highlight ${p.highlight} (small accents only), background ${p.bg}, white, line ${p.line}, plus natural skin tones and natural hair colors.${(brand.rules || []).some((r) => /\bno red\b/i.test(r)) ? ' No red.' : ''} Diverse adults, tall and friendly.`;
W(jobsFile, JSON.stringify(jobs, null, 2) + '\n');

// ---- icons ----------------------------------------------------------------------------------------
// brand.json "icons": { "source": "folder" | "none", "color": "<suffix>", "white": "<suffix>" }
//   folder: every .svg in <brand folder>/icons/ is copied into assets/icons/. Files named <id>_<color>.svg / <id>_<white>.svg are copied as they are;
//           a plain <id>.svg is a single-color icon: it becomes <id>_<color>.svg and a white copy (all colors replaced by #FFFFFF) becomes <id>_<white>.svg.
//   none:   assets/icons/ stays empty; scenes must not call K.icon, K.badge or K.chip with an icon.
let iconNote = 'No icons for this brand (icons.source "none"): assets/icons/ is empty. Scenes must not call K.icon, K.badge or K.chip({icon}). To add icons put <id>_' + theme.icons.color + '.svg and <id>_' + theme.icons.white + '.svg in assets/icons/ then add the ids to THEME.icons.ids in js/theme.js (or register them with S.icons()).';
if (brand.icons?.source === 'folder') {
  const srcDir = path.join(brandDir, 'icons');
  const files = fs.existsSync(srcDir) ? fs.readdirSync(srcDir).filter((f) => f.toLowerCase().endsWith('.svg')) : [];
  if (!files.length) iconNote = `Note: brand icons.source is "folder" but ${srcDir} has no .svg files; assets/icons/ is empty.`;
  else {
    fs.mkdirSync(path.join(dest, 'assets/icons'), { recursive: true });
    const ids = new Set();
    const suffixed = new RegExp(`^(.+)_(${theme.icons.color}|${theme.icons.white})\\.svg$`, 'i');
    for (const f of files) {
      const m = suffixed.exec(f);
      if (m) { fs.copyFileSync(path.join(srcDir, f), path.join(dest, 'assets/icons', f)); ids.add(m[1]); continue; }
      const id = f.replace(/\.svg$/i, '');
      if (files.some((g) => g.startsWith(id + '_'))) continue;           // already has suffixed variants
      const txt = fs.readFileSync(path.join(srcDir, f), 'utf8');
      fs.writeFileSync(path.join(dest, 'assets/icons', `${id}_${theme.icons.color}.svg`), txt);
      fs.writeFileSync(path.join(dest, 'assets/icons', `${id}_${theme.icons.white}.svg`), txt.replace(/#[0-9a-fA-F]{3,8}\b|currentColor|rgb\([^)]*\)/g, '#FFFFFF'));
      ids.add(id);
    }
    iconNote = `Icons: ${ids.size} icons copied from brands/${brandId}/icons into assets/icons/ in two colors. All are loaded automatically (THEME.icons.ids); use them with K.icon(ctx, '${[...ids][0]}', x, y, size), K.badge or K.chip({icon}). List: ls assets/icons`;
  }
}
fs.rmSync(path.join(dest, 'assets/icons/.keep'), { force: true });
theme.icons.ids = fs.existsSync(path.join(dest, 'assets/icons')) ? [...new Set(fs.readdirSync(path.join(dest, 'assets/icons')).map((f) => /^(.+)_(.+)\.svg$/.exec(f)).filter((m) => m && m[2] === theme.icons.color).map((m) => m[1]))].sort() : [];
const fmt = (o, ind = 2) => JSON.stringify(o, null, ind).replace(/\[\s*((?:"[^"\n]*",?\s*)+)\]/g, (m, a) => '[' + a.trim().replace(/,\s+/g, ', ') + ']').replace(/"([A-Za-z_]\w*)":/g, '$1:').replace(/\[\s+([\d,\s]+?)\s+\]/g, (m, a) => '[' + a.replace(/\s+/g, ' ') + ']').replace(/"/g, "'");
const writeTheme = () => W('js/theme.js', `/* theme.js: the look of this film (brand ${brandId}, ${styleName} style). Generated by new_project.mjs from brands/${brandId}/brand.json; edit freely.
   window.THEME is read by engine.js and kit.js; scenes use K.PAL (palette ROLES: ink, primary, accent, highlight, bg, surface, line,
   accentTint, bgTint, muted) and never hardcode colours.
   style.outline: outline px (0 = flat, no strokes). style.shadow: 'offset' (solid) or 'soft' (blurred). style.radius: base corner radius.
   logo: files for light (color) and dark (white) surfaces; the aspect ratio is read from the loaded image.
   icons: file suffixes, assets/icons/<id>_<color>.svg and <id>_<white>.svg; ids lists the icons found in assets/icons (all of them are loaded,
   scenes may use any: K.icon(ctx, 'check', x, y, size)). Icons you add later: append the id here or register it with S.icons('id').
   chrome: chapterPill (numbered chapter title, top left) and logo (top right) during the chapters. */
window.THEME = ${fmt(theme)};
`);
writeTheme();


// ---- generated browser config, scene tags, estimated timing ------------------------------------------
let timing = 'No script/narration.md: write it, then run node tools/est-timing.mjs.';
spawnSync('node', ['tools/config.mjs'], { cwd: dest, encoding: 'utf8' });
if (fs.existsSync(path.join(dest, 'script/narration.md'))) {
  const r = spawnSync('node', ['tools/est-timing.mjs'], { cwd: dest, encoding: 'utf8' });
  timing = r.status === 0 ? r.stdout.trim() : 'est-timing failed: ' + (r.stderr || '').trim().split('\n').pop();
}

// ---- report ---------------------------------------------------------------------------------------
console.log(`Created ${dest}\n  brand ${brandId} (${brand.name}), style ${styleName}, name ${name}\n  ${iconNote}\n  Timing: ${timing}`);
if ((brand.rules || []).length) console.log('\nBrand rules:\n' + brand.rules.map((r) => '  - ' + r).join('\n'));
console.log(`
Next steps:
  1. cd "${dest}"
  2. Fill in PLAN.md and project.json (review.film has a TODO), and replace script/narration.md with the approved script.
  3. node tools/est-timing.mjs   then open index.html in Chrome to see the demo scene (js/scenes/s1_demo.js; replace it with your scenes).
  4. Follow README.md from step 1 (voice, illustrations, music, mix, render). Set up the runtime once with: bash ${path.join(SKILL, 'scripts/setup_runtime.sh')}
  5. The Eden key is read from EDEN_AI_API_KEY, or the .env at $EDEN_ENV or ~/.config/eden-ai/.env (never copy it into the project).
`);
