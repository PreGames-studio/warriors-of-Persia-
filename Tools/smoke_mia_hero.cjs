// In-game smoke: loads the real village build, waits for Mia's GLB, then walks,
// attacks and captures the result exactly as the game camera renders it.
const { chromium: pw } = require('playwright-core');
const chromium = require('@sparticuz/chromium').default;

const BASE = process.env.BASE || 'http://127.0.0.1:8801/unity_preview/index.html?debug=1';
const OUT = process.env.OUT || '/tmp/wop-game';

(async () => {
  const browser = await pw.launch({
    executablePath: await chromium.executablePath(),
    args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 562 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => { errors.push('pageerror: ' + error.message); console.log('[pageerror]', error.message); });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push('console: ' + message.text());
      console.log('[console]', message.text());
    }
  });
  const client = await page.context().newCDPSession(page);
  // The village renders continuously under software GL; Playwright's stable-frame
  // screenshot would time out, so frames are captured straight from CDP.
  const shoot = async (name) => {
    const { data } = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    require('fs').writeFileSync(`${OUT}-${name}.png`, Buffer.from(data, 'base64'));
    console.log('captured', name);
  };
  await page.goto(BASE, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction('window.__wopDebug && window.__wopDebug.ready', null, { timeout: 180000 }).catch(() => {});
  // Wait for the hero GLB to finish parsing.
  const started = Date.now();
  let ready = false;
  while (Date.now() - started < 120000) {
    ready = await page.evaluate(`(() => {
      const m = window.__wopDebug && window.__wopDebug.leader && window.__wopDebug.leader();
      return Boolean(m && m.userData && m.userData.modelReady);
    })()`).catch(() => false);
    if (ready) break;
    await page.waitForTimeout(500);
  }
  console.log('modelReady', ready, 'after', ((Date.now() - started) / 1000).toFixed(1), 's');
  await page.waitForTimeout(2500);
  await shoot('idle');

  // Walk forward for a moment using the same keyboard path the game listens to.
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1500);
  await shoot('walk');
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(500);
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(1500);
  await shoot('walk2');
  await page.keyboard.up('KeyA');
  await page.waitForTimeout(400);

  await page.evaluate('window.__wopDebug.attack()');
  await page.waitForTimeout(180);
  await shoot('attack');
  await page.waitForTimeout(1200);
  await page.evaluate('window.__wopDebug.skill(3)');
  await page.waitForTimeout(260);
  await shoot('skill');
  await page.waitForTimeout(1500);

  const info = await page.evaluate(`(() => {
    const m = window.__wopDebug.leader();
    const hero = m && m.userData && m.userData.getMia && m.userData.getMia();
    const THREE = window.__wopDebug.three();
    const box = hero ? new THREE.Box3().setFromObject(hero.root) : null;
    return {
      characterId: m && m.userData && m.userData.characterId,
      hasHero: Boolean(hero),
      animations: hero ? hero.clips.length : 0,
      triangles: hero ? hero.meshes.reduce((sum, mesh) => sum + (mesh.geometry.index ? mesh.geometry.index.count / 3 : 0), 0) : 0,
      meshes: hero ? hero.meshes.length : 0,
      height: box ? +box.getSize(new THREE.Vector3()).y.toFixed(3) : null,
      hp: window.__wopDebug.state().party[0].hp,
      cooldowns: window.__wopDebug.state().skillCooldowns
    };
  })()`).catch((error) => ({ error: String(error) }));
  console.log('INFO', JSON.stringify(info));
  console.log('ERRORS', errors.length ? JSON.stringify(errors.slice(0, 6)) : 'none');
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
