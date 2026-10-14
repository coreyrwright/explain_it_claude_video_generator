// Timing contract from the animation for the audio tools: film length, narration offset,
// music grid and chapter starts -> assets/audio/cues.json
import fs from 'node:fs';
import path from 'node:path';
import { openPage } from './stills.mjs';
import { ROOT } from './eden.mjs';

const { browser, page } = await openPage();
const info = await page.evaluate('window.__info');
await browser.close();
const out = { end: info.end, pre: info.pre, music: info.music, chapters: info.chapters, sfx: info.sfx };
fs.writeFileSync(path.join(ROOT, 'assets/audio/cues.json'), JSON.stringify(out, null, 2));
console.log(`end ${info.end.toFixed(2)} s, narration at ${info.pre} s, final chord ${info.music.final.toFixed(2)} s`);

// Chrome child processes can keep the event loop alive after browser.close(); exit explicitly.
process.exit(0);
