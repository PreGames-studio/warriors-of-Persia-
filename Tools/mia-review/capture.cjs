const { chromium: pw } = require('playwright-core');
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const fs = require('fs');
const views = (process.env.VIEWS || 'front,close,side,back,hand').split(',');
const clip = process.env.CLIP || 'Idle';
const speed = Number(process.env.SPEED || 0);
const prefix = process.env.PREFIX || '/tmp/wop-mia';
const stepFrames = Number(process.env.STEP || 40);
(async () => {
  const browser = await pw.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error') console.log('[page]', m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('http://127.0.0.1:8799/Tools/mia-review/review.html' + (process.env.Q || ''), { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true || window.__error', null, { timeout: 180000 });
  const error = await page.evaluate('window.__error || null');
  if (error) { console.log('LOAD ERROR', error); await browser.close(); process.exit(1); }
  console.log('INFO', JSON.stringify(await page.evaluate('window.__info()')));
  if (process.env.ONLY) await page.evaluate(`window.__only(${JSON.stringify(process.env.ONLY)})`);
  if (speed) await page.evaluate(`window.__setSpeed(${speed})`);
  if (process.env.ONESHOT) await page.evaluate(`window.__play(${JSON.stringify(process.env.ONESHOT)})`);
  for (let i = 0; i < stepFrames; i++) await page.evaluate('window.__step(1/60)');
  const client = await page.context().newCDPSession(page);
  for (const view of views) {
    await page.evaluate(`window.__setView(${JSON.stringify(view)})`);
    for (let i = 0; i < 4; i++) await page.evaluate('window.__step(1/60)');
    await page.evaluate(`window.__setView(${JSON.stringify(view)})`);
    const shot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(`${prefix}-${clip}-${view}.png`, Buffer.from(shot.data, 'base64'));
    console.log('captured', view);
  }
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
