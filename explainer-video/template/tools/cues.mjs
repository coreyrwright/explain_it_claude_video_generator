// Prints the film's timing: chapter starts, named cues (S.C), story beats, sfx, scene list, page errors.
// Usage: node cues.mjs [phrase ...]   (extra args: also prints S.cue(phrase) for each)
import { openPage } from './stills.mjs';
const { browser, page, logs } = await openPage();
const out = await page.evaluate((phrases) => ({
  end: S.END, ch: S.CH.map((t, i) => `${i + 1} ${S.TITLES[i]} @ ${t.toFixed(2)}`), estimated: !!VO_TIMING.estimated,
  cues: Object.fromEntries(Object.entries(S.C).map(([k, v]) => [k, +v.toFixed(2)])),
  scenes: Scenes.SCENES.map((s) => `${s.id}: ${s.t0.toFixed(2)} -> ${Number.isFinite(s.exit) ? s.exit.toFixed(2) : 'end'}`),
  music: { bpm: S.MUSIC.bpm, final: +S.MUSIC.final.toFixed(2), fx: Scenes.MUSIC.fx.map((f) => `${f.t.toFixed(2)} ${f.type}`) },
  story: S.STORY.map((s) => `${s.t.toFixed(2)} ${s.label}`), sfx: S.SFX.map((s) => `${s.t.toFixed(2)} ${s.name}`),
  phrases: phrases.map((p) => { try { return `${p}: ${S.cue(p).toFixed(2)}`; } catch (e) { return `${p}: NOT FOUND`; } }),
  missing: window.__missing,
}), process.argv.slice(2));
console.log(JSON.stringify(out, null, 1));
const errs = logs.filter((l) => /error/i.test(l) && !/ERR_FILE_NOT_FOUND/.test(l));
if (errs.length) console.log('PAGE ERRORS:\n' + errs.join('\n'));
await browser.close(); process.exit(0);
