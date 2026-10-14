// Render selected frames of index.html (render mode) to JPEGs for review.
// Usage: node stills.mjs <outDir> t1 t2 ...  |  node stills.mjs <outDir> cues   (one still per scene beat)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { ROOT, runtimeDir, chromePath, writeBrowserConfig } from './config.mjs';

// puppeteer-core: from tools/node_modules if someone ran `npm install` here, otherwise from the video
// runtime outside the project (VIDEO_RUNTIME, default ~/.video-runtime), so thousands of library
// files never sync to a shared folder. Set it up once with <skill>/scripts/setup_runtime.sh.
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; } catch {
  const rt = runtimeDir();
  try { puppeteer = (await import(pathToFileURL(createRequire(path.join(rt, 'package.json')).resolve('puppeteer-core')).href)).default; } catch {
    throw new Error(`puppeteer-core not found in ${rt}. Run: bash <skill>/scripts/setup_runtime.sh`);
  }
}

export async function openPage(attempt = 1) {
  writeBrowserConfig();                       // js/project-config.js follows project.json
  // Watchdog: a Chrome launch occasionally hangs right after another session closes; retry instead of waiting forever.
  const launch = puppeteer.launch({
    executablePath: chromePath(),
    headless: 'new',
    args: ['--allow-file-access-from-files', '--hide-scrollbars', '--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'],
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    timeout: 20000,
  });
  let browser;
  try {
    browser = await Promise.race([launch, new Promise((_, rej) => setTimeout(() => rej(new Error('Chrome launch timed out')), 25000))]);
  } catch (e) {
    if (attempt >= 3) throw e;
    console.error(`${e.message}; retrying (${attempt + 1}/3)`);
    launch.then((b) => b.close()).catch(() => {});
    return openPage(attempt + 1);
  }
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => { if (!/ERR_FILE_NOT_FOUND/.test(m.text())) logs.push(m.type() + ': ' + m.text()); });   // the <audio> tag before a mix exists
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href + '?render=1', { waitUntil: 'load' });
  await page.waitForFunction('window.__ready || window.__error', { timeout: 60000 });
  const err = await page.evaluate('window.__error');
  if (err) { console.log(logs.join('\n')); throw new Error(err); }
  return { browser, page, logs };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [outDir, ...times] = process.argv.slice(2);
  fs.mkdirSync(outDir, { recursive: true });
  const { browser, page, logs } = await openPage();
  let ts = times.map(Number);
  if (times[0] === 'cues') {
    const c = await page.evaluate('window.__info.cues');
    ts = Object.values(c).map((t) => +(t + 0.3).toFixed(2)).sort((a, b) => a - b);
  }
  for (const t of ts) {
    await page.evaluate((x) => window.__seek(x), t);
    await page.screenshot({ path: path.join(outDir, `t_${t.toFixed(2).padStart(6, '0')}.jpg`), type: 'jpeg', quality: 85, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  }
  const errs = logs.filter((l) => /error/i.test(l));
  if (errs.length) console.log(errs.join('\n'));
  console.log('rendered', ts.length, 'stills');
  await browser.close();
}
