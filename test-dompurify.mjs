import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// 模拟 syncMdToHtml 的输出：完整 HTML 文档，style 在 head 中
const fullHtml = `<!DOCTYPE html>
<html><head>
<style data-studio-css="true">.landing-page{color:red;background:#020617}</style>
<style data-md-styles="true">[data-slot-type="content"] h1{font-size:1.4em}</style>
</head><body>
<div class="landing-page">
  <section class="lp-hero"><div data-slot="heroTitle">Hello</div></section>
</div>
</body></html>`;

console.log('=== Input length:', fullHtml.length, '===');

// Test 1: ADD_TAGS only
const r1 = DOMPurify.sanitize(fullHtml, {
  ADD_TAGS: ['style'],
  ADD_ATTR: ['class', 'style'],
});
console.log('\n=== ADD_TAGS: [style] ===');
console.log('Result:', r1.substring(0, 400));
console.log('Has <style>?', r1.includes('<style'));

// Test 2: WHOLE_DOCUMENT + ADD_TAGS
const r2 = DOMPurify.sanitize(fullHtml, {
  ADD_TAGS: ['style'],
  ADD_ATTR: ['class', 'style'],
  WHOLE_DOCUMENT: true,
});
console.log('\n=== WHOLE_DOCUMENT: true ===');
console.log('Result:', r2.substring(0, 500));
console.log('Has <style>?', r2.includes('<style'));

// Test 3: FORCE_BODY
const r3 = DOMPurify.sanitize(fullHtml, {
  ADD_TAGS: ['style'],
  ADD_ATTR: ['class', 'style'],
  FORCE_BODY: true,
});
console.log('\n=== FORCE_BODY: true ===');
console.log('Result:', r3.substring(0, 400));
console.log('Has <style>?', r3.includes('<style'));
