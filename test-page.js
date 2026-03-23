const { chromium } = require('playwright');

(async () => {
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 150));
    });

    await page.goto('http://localhost:3000', { timeout: 20000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    const screenshot = await page.screenshot({ path: '/tmp/teamclaw-home2.png' });
    console.log('Screenshot saved, size:', screenshot.length);

    const bodyHtml = await page.locator('body').innerHTML();
    console.log('Has landing-page class:', bodyHtml.includes('landing-page'));
    console.log('Has lp-hero class:', bodyHtml.includes('lp-hero'));
    console.log('Has landing-content class:', bodyHtml.includes('landing-content'));

    console.log('Console errors:', consoleErrors.length);
    consoleErrors.slice(0, 3).forEach(e => console.log(' -', e));

    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();