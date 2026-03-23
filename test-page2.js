const { chromium } = require('playwright');

(async () => {
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 900 });

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
    });

    await page.goto('http://localhost:3000', { timeout: 20000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    // 截图
    await page.screenshot({ path: '/tmp/teamclaw-full.png', fullPage: true });
    console.log('Screenshot saved to /tmp/teamclaw-full.png');

    // 获取 landing-content 的完整 HTML
    const landingHtml = await page.locator('.landing-content').innerHTML().catch(() => 'NOT FOUND');
    console.log('\n=== landing-content HTML length ===');
    console.log(landingHtml.length, 'chars');

    console.log('\n=== landing-content HTML (first 2000 chars) ===');
    console.log(landingHtml.slice(0, 2000));

    // 检查 slot 填充情况
    console.log('\n=== Slot Check ===');
    console.log('heroBadge filled:', landingHtml.includes('data-slot="heroBadge"') === false);
    console.log('heroTitle filled:', landingHtml.includes('data-slot="heroTitle"') === false);
    console.log('heroSubtitle filled:', landingHtml.includes('data-slot="heroSubtitle"') === false);
    console.log('ctaButtons filled:', landingHtml.includes('data-slot="ctaButtons"') === false);

    // 检查是否有未解析的 slot 标记
    const unmatchedSlots = landingHtml.match(/data-slot="[^"]+"/g) || [];
    console.log('\n=== Unmatched slots ===');
    console.log(unmatchedSlots);

    // 检查 CSS
    console.log('\n=== CSS Check ===');
    const styles = await page.locator('style').allInnerTexts();
    console.log('Style tags count:', styles.length);
    console.log('Has landing CSS:', styles.some(s => s.includes('lp-hero')));

    // Console errors
    console.log('\n=== Console Errors ===');
    console.log('Total:', consoleErrors.length);
    consoleErrors.slice(0, 5).forEach(e => console.log(' -', e));

    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();