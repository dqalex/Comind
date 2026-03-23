/**
 * 前端性能测试 (E2E)
 * 
 * 使用 Playwright 测试前端页面的性能指标
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// 性能指标接口
interface WebVitals {
  FCP: number;  // First Contentful Paint
  LCP: number;  // Largest Contentful Paint
  FID: number;  // First Input Delay
  CLS: number;  // Cumulative Layout Shift
  TTFB: number; // Time to First Byte
}

// 获取 Web Vitals
async function getWebVitals(page: Page): Promise<WebVitals> {
  return await page.evaluate(() => {
    return new Promise((resolve) => {
      const vitals: Partial<WebVitals> = {};
      
      // 使用 PerformanceObserver 获取性能指标
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'paint') {
            if (entry.name === 'first-contentful-paint') {
              vitals.FCP = entry.startTime;
            }
          }
          if (entry.entryType === 'largest-contentful-paint') {
            vitals.LCP = entry.startTime;
          }
          if (entry.entryType === 'layout-shift') {
            vitals.CLS = (vitals.CLS || 0) + (entry as any).value;
          }
        }
      });

      observer.observe({
        entryTypes: ['paint', 'largest-contentful-paint', 'layout-shift']
      });

      // 获取 TTFB
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      vitals.TTFB = navEntry?.responseStart - navEntry?.requestStart || 0;

      // FID 需要用户交互，这里用 0 占位
      vitals.FID = 0;

      // 等待一段时间让观察者收集数据
      setTimeout(() => {
        observer.disconnect();
        resolve(vitals as WebVitals);
      }, 3000);
    });
  });
}

test.describe('前端性能测试', () => {
  const results: Array<{
    page: string;
    metrics: WebVitals;
    passed: boolean;
  }> = [];

  test.afterAll(() => {
    console.log('\n' + '='.repeat(80));
    console.log('前端性能测试报告');
    console.log('='.repeat(80));
    
    results.forEach(result => {
      console.log(`\n[${result.page}]`);
      console.log(`  FCP: ${result.metrics.FCP.toFixed(2)}ms`);
      console.log(`  LCP: ${result.metrics.LCP.toFixed(2)}ms`);
      console.log(`  CLS: ${result.metrics.CLS.toFixed(4)}`);
      console.log(`  TTFB: ${result.metrics.TTFB.toFixed(2)}ms`);
      console.log(`  状态: ${result.passed ? '✓ 通过' : '✗ 失败'}`);
    });
    
    console.log('\n' + '='.repeat(80));
  });

  test('首页性能', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // 等待页面加载完成
    await page.waitForLoadState('networkidle');
    
    const metrics = await getWebVitals(page);
    
    results.push({
      page: '首页',
      metrics,
      passed: metrics.FCP < 3000 && metrics.LCP < 4000,
    });

    // 验证性能指标
    expect(metrics.FCP).toBeLessThan(3000);
    expect(metrics.LCP).toBeLessThan(4000);
    expect(metrics.CLS).toBeLessThan(0.25);
  });

  test('任务列表页性能', async ({ page }) => {
    // 先登录
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', 'perf-test@teamclaw.test');
    await page.fill('input[name="password"]', 'PerfTest123!');
    await page.click('button[type="submit"]');
    
    // 等待登录完成
    await page.waitForURL('**/tasks', { timeout: 10000 }).catch(() => {
      // 如果重定向失败，手动导航
      page.goto(`${BASE_URL}/tasks`);
    });
    
    await page.waitForLoadState('networkidle');
    
    const metrics = await getWebVitals(page);
    
    results.push({
      page: '任务列表',
      metrics,
      passed: metrics.FCP < 3000 && metrics.LCP < 4000,
    });

    expect(metrics.FCP).toBeLessThan(3000);
    expect(metrics.LCP).toBeLessThan(4000);
  });

  test('项目列表页性能', async ({ page }) => {
    await page.goto(`${BASE_URL}/projects`);
    await page.waitForLoadState('networkidle');
    
    const metrics = await getWebVitals(page);
    
    results.push({
      page: '项目列表',
      metrics,
      passed: metrics.FCP < 3000 && metrics.LCP < 4000,
    });

    expect(metrics.FCP).toBeLessThan(3000);
    expect(metrics.LCP).toBeLessThan(4000);
  });

  test('文档列表页性能', async ({ page }) => {
    await page.goto(`${BASE_URL}/wiki`);
    await page.waitForLoadState('networkidle');
    
    const metrics = await getWebVitals(page);
    
    results.push({
      page: '文档列表',
      metrics,
      passed: metrics.FCP < 3000 && metrics.LCP < 4000,
    });

    expect(metrics.FCP).toBeLessThan(3000);
    expect(metrics.LCP).toBeLessThan(4000);
  });

  test('设置页性能', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState('networkidle');
    
    const metrics = await getWebVitals(page);
    
    results.push({
      page: '设置页',
      metrics,
      passed: metrics.FCP < 3000 && metrics.LCP < 4000,
    });

    expect(metrics.FCP).toBeLessThan(3000);
    expect(metrics.LCP).toBeLessThan(4000);
  });

  test('交互响应时间测试', async ({ page }) => {
    await page.goto(`${BASE_URL}/tasks`);
    await page.waitForLoadState('networkidle');

    // 测试按钮点击响应时间
    const startTime = Date.now();
    await page.click('button:has-text("新建任务")');
    const responseTime = Date.now() - startTime;

    console.log(`  创建任务按钮响应时间: ${responseTime}ms`);
    
    // 按钮响应应该在 100ms 内
    expect(responseTime).toBeLessThan(100);
  });

  test('列表滚动性能', async ({ page }) => {
    await page.goto(`${BASE_URL}/tasks`);
    await page.waitForLoadState('networkidle');

    // 监控滚动性能
    const scrollMetrics = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let frameCount = 0;
        const startTime = performance.now();
        
        const scrollInterval = setInterval(() => {
          window.scrollBy(0, 100);
          frameCount++;
          
          if (frameCount >= 50) {
            clearInterval(scrollInterval);
            const duration = performance.now() - startTime;
            resolve(duration);
          }
        }, 16); // ~60fps
      });
    });

    const avgFrameTime = scrollMetrics / 50;
    console.log(`  滚动平均帧时间: ${avgFrameTime.toFixed(2)}ms`);
    
    // 平均帧时间应该小于 16.67ms (60fps)
    expect(avgFrameTime).toBeLessThan(20);
  });
});
