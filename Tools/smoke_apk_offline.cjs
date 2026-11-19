// Offline smoke for a finished APK: unzip assets, open index.html over file://
// (the exact path the WebView uses), then verify Mia loads, both texture sets
// resolve, and nothing throws.
const { chromium: pw } = require('playwright-core');
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const fs = require('fs');
const path = require('path');

const root = process.env.APK_DIR || '/tmp/apk-src';
const out = process.env.OUT || '/tmp/apk-smoke';

(async () => {
  const browser = await pw.launch({
    executablePath: await chromium.executablePath(),
    args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
           '--allow-file-access-from-files'],
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 562 }, deviceScaleFactor: 1 });
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => problems.push('request: ' + r.url().split('/').slice(-2).join('/')));

  await page.goto('file://' + path.join(root, 'assets', 'index.html'), { waitUntil: 'load', timeout: 240000 });
  await page.waitForTimeout(15000);

  const info = await page.evaluate(`(() => {
    const canvas = document.querySelector('canvas');
    let gl = null;
    let maxTexture = 0;
    if (canvas) {
      gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (gl) maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    }
    return {
      canvas: canvas ? [canvas.width, canvas.height] : null,
      maxTexture,
      glError: gl ? gl.getError() : null,
      hasGame: typeof window.state !== 'undefined' || !!document.querySelector('#hud, #joystick, .joystick'),
      title: document.title,
    };
  })()`);

  const client = await page.context().newCDPSession(page);
  for (const [name, action] of [['idle', null], ['walk', 'walk'], ['attack', 'attack']]) {
    if (action === 'walk') {
      await page.evaluate(`(() => { const t = document.querySelector('#joystick, .joystick, [data-joystick]');
        if (t) { const r = t.getBoundingClientRect(); const e = new PointerEvent('pointerdown', { clientX: r.x + r.width/2, clientY: r.y + r.height/2, bubbles: true }); t.dispatchEvent(e); } })()`);
      await page.waitForTimeout(2500);
    }
    if (action === 'attack') {
      await page.evaluate(`(() => { const b = document.querySelector('.attack-button, #attack, [data-action="attack"]');
        if (b) b.click(); })()`);
      await page.waitForTimeout(1500);
    }
    const shot = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${out}-${name}.png`, Buffer.from(shot.data, 'base64'));
  }

  const report = { ...info, problems, screenshots: [`${out}-idle.png`, `${out}-walk.png`, `${out}-attack.png`] };
  fs.writeFileSync(`${out}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
