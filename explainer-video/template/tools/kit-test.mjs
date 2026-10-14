// Draws the generic kit primitives on a blank frame for a visual check of the theme (colours, outline,
// shadow). Add your own shared pieces (anything used in more than one chapter) to js/kit.js and to this test.
// Usage: node kit-test.mjs <out.jpg>
import { openPage } from './stills.mjs';
if (!process.argv[2]) { console.error('usage: node kit-test.mjs <out.jpg>'); process.exit(2); }
const { browser, page, logs } = await openPage();
await page.evaluate(() => {
  const ctx = document.getElementById('stage').getContext('2d');
  K.bg(ctx);
  const P = K.PAL;
  // palette strip: the ten role names
  ['ink', 'primary', 'accent', 'highlight', 'bg', 'surface', 'line', 'accentTint', 'bgTint', 'muted'].forEach((r, i) => {
    K.circle(ctx, 130 + i * 175, 110, 52, { fill: P[r], lw: 3, shadow: false, border: true });
    K.text(ctx, r, 130 + i * 175, 210, { size: 34, weight: 600, align: 'center', color: P.ink });
  });
  K.folder(ctx, 120, 280, 360, 280, { label: 'Folder' });
  K.folder(ctx, 520, 280, 360, 280, { label: 'Dashed', dashed: true });
  K.doc(ctx, 940, 270, 260, 300, { title: 'notes.md', lines: 5, write: 0.7 });
  K.bubble(ctx, 1280, 280, 340, 130, { text: 'A speech bubble', tail: 'down', size: 36 });
  K.padlock(ctx, 1730, 330, 100);
  const c = K.window(ctx, 120, 620, 640, 380, { title: 'Window' });
  K.text(ctx, 'Content area', c.x + 20, c.y + 70, { size: 44, weight: 600 });
  K.laptop(ctx, 1000, 1000, 380, { screen: (x, y, w, h) => K.text(ctx, 'Screen', x + w / 2, y + h / 2 + 14, { size: 40, align: 'center' }) });
  K.cross(ctx, 1320, 690, 80, 1);
  K.star4(ctx, 1460, 690, 80);
  K.tag(ctx, 'Name tag', 1680, 690);
  K.tick(ctx, 1320, 810, 90, 1);
  K.bigText(ctx, 'Big text', 1600, 840, { size: 90 });
  K.bar(ctx, 1280, 900, 520, 36, 0.7);
  K.chip(ctx, 'A chip', 1280, 950, { size: 36 });
  // brand icons (if the brand has any): round badges, alternating light and dark; a chip with an icon
  const ids = ((K.THEME.icons || {}).ids || []).slice(0, 8);
  ids.forEach((id, i) => K.badge(ctx, id, 150 + i * 90, 1040, 64, { dark: i % 2 === 1 }));
  if (ids[0]) K.chip(ctx, ids[0], 850, 1012, { size: 30, icon: ids[0] });
  K.arrow(ctx, 1520, 985, 1800, 985, 1, { bend: 30 });
});
await page.screenshot({ path: process.argv[2], type: 'jpeg', quality: 85, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
const errs = logs.filter((l) => /error/i.test(l) && !/ERR_FILE_NOT_FOUND/.test(l));
if (errs.length) console.log(errs.join('\n'));
await browser.close(); process.exit(0);
