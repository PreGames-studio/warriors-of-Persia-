#!/usr/bin/env node
/* Offline WebView smoke for the Mia-only constant-daylight package. */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

(async () => {
  const playwright = require(process.env.WOP_PLAYWRIGHT_MODULE || 'playwright-core');
  const chromiumModule = process.env.WOP_CHROMIUM_MODULE;
  if (!chromiumModule) throw new Error('WOP_CHROMIUM_MODULE must point to @sparticuz/chromium build/index.js');
  const chromiumPackModule = await import(pathToFileURL(chromiumModule).href);
  const chromiumPack = chromiumPackModule.default;
  const executablePath = await chromiumPack.executablePath();
  const al2023 = path.join(path.dirname(chromiumModule), '..', 'bin', 'al2023.tar.br');
  if (fs.existsSync(al2023)) {
    const extracted = await chromiumPackModule.inflate(al2023);
    process.env.LD_LIBRARY_PATH = `${path.join(extracted, 'lib')}:${process.env.LD_LIBRARY_PATH || ''}`;
  }

  const target = argument('--url');
  const screenshot = argument('--screenshot', '/tmp/mia-daylight.png');
  const reportPath = argument('--report', `${screenshot}.json`);
  if (!target) throw new Error('Missing --url');
  const browser = await playwright.chromium.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader', '--allow-file-access-from-files'
    ]
  });
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 });
    const javascriptErrors = [];
    const resourceErrors = [];
    page.on('pageerror', error => javascriptErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
        javascriptErrors.push(message.text());
      }
    });
    page.on('requestfailed', request => resourceErrors.push({
      url: request.url(), error: request.failure() ? request.failure().errorText : 'unknown'
    }));
    await page.goto(target, { waitUntil: 'load', timeout: 240000 });
    await page.waitForFunction(() => {
      const canvas = document.getElementById('three-canvas');
      return canvas && canvas.width > 0 && document.body.innerText.includes('میا');
    }, null, { timeout: 240000 });
    await page.waitForTimeout(Number(process.env.WOP_SMOKE_WAIT_MS) || 12000);
    await page.screenshot({ path: screenshot, timeout: 120000 });
    const info = await page.evaluate(() => ({
      build: document.querySelector('meta[name="wop-build"]')?.content || null,
      lighting: document.querySelector('meta[name="wop-house-lighting"]')?.content || null,
      bodyText: document.body.innerText.slice(0, 1200),
      attilaVisible: document.body.innerText.includes('آتیلا'),
      attilaBundleMarker: document.documentElement.innerHTML.includes('Attila_Rigged_3D_Model'),
      canvas: [...document.querySelectorAll('canvas')].map(canvas => ({
        id: canvas.id, width: canvas.width, height: canvas.height,
        visible: Boolean(canvas.offsetWidth || canvas.offsetHeight)
      }))
    }));
    const report = {
      url: target, ...info, javascriptErrors, resourceErrors,
      pbrResourceErrors: resourceErrors.filter(item => item.url.includes('pbr_hq/')),
      screenshot
    };
    if (process.env.WOP_PNGJS_MODULE) {
      const { PNG } = require(process.env.WOP_PNGJS_MODULE);
      const image = PNG.sync.read(fs.readFileSync(screenshot));
      // Fixed house band in the reproducible 960x600 first-person spawn view.
      const region = { x: 150, y: 55, width: 660, height: 190 };
      let sum = 0, dark = 0, count = 0;
      for (let y = region.y; y < region.y + region.height; y++) {
        for (let x = region.x; x < region.x + region.width; x++) {
          const offset = (y * image.width + x) * 4;
          const luma = image.data[offset] * .2126 + image.data[offset + 1] * .7152 + image.data[offset + 2] * .0722;
          sum += luma;
          if (luma < 28) dark++;
          count++;
        }
      }
      report.houseBandLuma = { region, mean: sum / count, darkPixelRatio: dark / count };
    }
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (javascriptErrors.length || report.pbrResourceErrors.length || info.attilaVisible || info.attilaBundleMarker) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
