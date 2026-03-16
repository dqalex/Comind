/**
 * 渲染模板：公众号文章 - 模块化完整版
 * 1:1 复刻现代公众号文章风格，支持一对多 slot 映射
 */
import type { BuiltinRenderTemplate } from '../types';

export const rtWechatModular: BuiltinRenderTemplate = {
  id: 'rt-builtin-wechat-modular',
  name: '公众号文章-模块化',
  description: '高信息密度公众号风格，1:1复刻模块化布局，支持一对多slot映射',
  category: 'report',
  htmlTemplate: `<div class="wmod">
  <!-- 标题区 -->
  <div class="wmod-title">
    <div class="wmod-title-tag" data-slot="titleTag" data-slot-type="content"></div>
    <h1 class="wmod-title-main" data-slot="titleMain" data-slot-type="content"></h1>
    <div class="wmod-title-sub" data-slot="titleSub" data-slot-type="content"></div>
  </div>

  <!-- 封面图 -->
  <div class="wmod-cover" data-slot="cover" data-slot-type="image"></div>

  <!-- 导语 -->
  <div class="wmod-lead" data-slot="lead" data-slot-type="content"></div>

  <!-- Feature 卡片区 -->
  <div class="wmod-features">
    <div class="wmod-features-header" data-slot="featuresHeader" data-slot-type="content"></div>
    <div class="wmod-features-grid" data-slot="featuresGrid" data-slot-type="content"></div>
    <div class="wmod-features-summary" data-slot="featuresSummary" data-slot-type="content"></div>
  </div>

  <!-- Part 分区（循环区域） -->
  <div class="wmod-parts" data-slot-loop="part" data-slot-loop-items="partNum,partTitle,partImg,partContent">
    <div class="wmod-part">
      <div class="wmod-part-header">
        <span class="wmod-part-num" data-slot="partNum" data-slot-type="content"></span>
        <span class="wmod-part-divider"></span>
        <span class="wmod-part-title" data-slot="partTitle" data-slot-type="content"></span>
      </div>
      <div class="wmod-part-img" data-slot="partImg" data-slot-type="image"></div>
      <div class="wmod-part-content" data-slot="partContent" data-slot-type="content"></div>
    </div>
  </div>

  <!-- Case 案例区（循环区域） -->
  <div class="wmod-cases" data-slot-loop="case" data-slot-loop-items="caseNum,caseTitle,caseContent">
    <div class="wmod-case">
      <div class="wmod-case-header">
        <span class="wmod-case-num" data-slot="caseNum" data-slot-type="content"></span>
        <span class="wmod-case-title" data-slot="caseTitle" data-slot-type="content"></span>
      </div>
      <div class="wmod-case-content" data-slot="caseContent" data-slot-type="content"></div>
    </div>
  </div>

  <!-- 总结区 -->
  <div class="wmod-summary">
    <div class="wmod-summary-header">
      <span class="wmod-summary-num">LAST</span>
      <span class="wmod-summary-divider"></span>
      <span class="wmod-summary-title" data-slot="summaryTitle" data-slot-type="content"></span>
    </div>
    <div class="wmod-summary-content" data-slot="summaryContent" data-slot-type="content"></div>
    <div class="wmod-summary-quote" data-slot="summaryQuote" data-slot-type="content"></div>
  </div>

  <!-- 版权区 -->
  <div class="wmod-copyright" data-slot="copyright" data-slot-type="content"></div>

</div>`,
  cssTemplate: `/* ===== 基础 ===== */
.wmod {
  max-width: 480px;
  margin: 0 auto;
  background: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;
  color: #1a1a1a;
  line-height: 1.75;
}

/* ===== 标题区 ===== */
.wmod-title {
  padding: 0 16px 16px;
}
.wmod-title-tag {
  display: inline-block;
  padding: 4px 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  border-radius: 4px;
  margin-bottom: 12px;
  letter-spacing: 1px;
}
.wmod-title-tag p { margin: 0; }
.wmod-title-main {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.4;
  margin: 0 0 8px;
  color: #1a1a1a;
}
.wmod-title-main p { margin: 0; font-size: 24px; font-weight: 700; line-height: 1.4; }
.wmod-title-sub {
  font-size: 15px;
  color: #666;
  line-height: 1.6;
}
.wmod-title-sub p { margin: 0; }

/* ===== 封面图 ===== */
.wmod-cover {
  margin: 0 0 16px;
}
.wmod-cover img {
  width: 100%;
  height: auto;
  display: block;
}

/* ===== 导语 ===== */
.wmod-lead {
  padding: 0 16px;
  font-size: 15px;
  color: #333;
  line-height: 1.8;
  margin-bottom: 24px;
}
.wmod-lead p { margin: 0; }

/* ===== Feature 卡片区 ===== */
.wmod-features {
  margin: 0 16px 24px;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: #fff;
}
.wmod-features-header {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}
.wmod-features-header p { margin: 0; }
.wmod-features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.wmod-features-grid ul, .wmod-features-grid ol {
  display: contents;
  list-style: none;
  padding: 0;
  margin: 0;
}
.wmod-features-grid li {
  background: rgba(255,255,255,0.15);
  padding: 12px;
  border-radius: 8px;
  text-align: center;
  list-style: none;
}
.wmod-features-grid li strong {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}
.wmod-features-grid li p { margin: 0; font-size: 12px; opacity: 0.9; }
.wmod-features-summary {
  font-size: 13px;
  opacity: 0.9;
  text-align: center;
  padding-top: 12px;
  border-top: 1px solid rgba(255,255,255,0.2);
}
.wmod-features-summary p { margin: 0; }

/* ===== Part 分区 ===== */
.wmod-parts {
  margin: 0 16px 24px;
}
.wmod-part {
  margin-bottom: 24px;
}
.wmod-part:last-child {
  margin-bottom: 0;
}
.wmod-part-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}
.wmod-part-num {
  font-size: 12px;
  font-weight: 700;
  color: #667eea;
  letter-spacing: 2px;
}
.wmod-part-divider {
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, #667eea, transparent);
  margin: 0 12px;
}
.wmod-part-title {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
}
.wmod-part-title p { margin: 0; font-size: 18px; font-weight: 700; }
.wmod-part-img {
  margin-bottom: 12px;
  border-radius: 8px;
  overflow: hidden;
}
.wmod-part-img img {
  width: 100%;
  height: auto;
  display: block;
}
.wmod-part-content {
  font-size: 15px;
  color: #333;
  line-height: 1.8;
}
.wmod-part-content p { margin: 0 0 1em; }
.wmod-part-content ol, .wmod-part-content ul {
  margin: 0 0 1em;
  padding-left: 1.5em;
}
.wmod-part-content li { margin: 6px 0; }

/* ===== Case 案例区 ===== */
.wmod-cases {
  margin: 0 16px 24px;
}
.wmod-case {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}
.wmod-case:last-child {
  margin-bottom: 0;
}
.wmod-case-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}
.wmod-case-num {
  display: inline-block;
  padding: 4px 8px;
  background: #667eea;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  margin-right: 10px;
  letter-spacing: 1px;
}
.wmod-case-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
}
.wmod-case-title p { margin: 0; font-size: 16px; font-weight: 600; }
.wmod-case-content {
  font-size: 14px;
  color: #666;
  line-height: 1.7;
}
.wmod-case-content p { margin: 0; }

/* ===== 总结区 ===== */
.wmod-summary {
  margin: 0 16px 24px;
  padding: 20px;
  background: #fafafa;
  border-radius: 12px;
}
.wmod-summary-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}
.wmod-summary-num {
  font-size: 12px;
  font-weight: 700;
  color: #667eea;
  letter-spacing: 2px;
}
.wmod-summary-divider {
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, #667eea, transparent);
  margin: 0 12px;
}
.wmod-summary-title {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
}
.wmod-summary-title p { margin: 0; font-size: 18px; font-weight: 700; }
.wmod-summary-content {
  font-size: 15px;
  color: #333;
  line-height: 1.8;
  margin-bottom: 16px;
}
.wmod-summary-content p { margin: 0 0 1em; }
.wmod-summary-quote {
  padding: 16px;
  background: #fff;
  border-left: 4px solid #667eea;
  font-size: 14px;
  color: #666;
  font-style: italic;
  border-radius: 0 8px 8px 0;
}
.wmod-summary-quote p { margin: 0; }

/* ===== 版权区 ===== */
.wmod-copyright {
  margin: 0 16px 24px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  font-size: 12px;
  color: #999;
  text-align: center;
}
.wmod-copyright p { margin: 0; }
`,
  mdTemplate: `<!-- @slot:titleTag -->
深度解读

<!-- @slot:titleMain -->
AI编程助手大横评：2026年最值得关注的5款工具

<!-- @slot:titleSub -->
从效率提升到代码质量，全方位对比分析

<!-- @slot:cover -->

<!-- @slot:lead -->
随着大模型技术的成熟，AI编程助手已从"玩具"进化为开发者标配。本文横评5款主流工具，帮你找到最适合的那一个。

<!-- @slot:featuresHeader -->
评选维度

<!-- @slot:featuresGrid -->
- **代码补全** 实时预测
- **代码解释** 理解上下文
- **调试辅助** 定位问题

<!-- @slot:featuresSummary -->
基于真实开发场景，从效率、质量、体验三个维度综合评分

<!-- @slot:partNum -->
PART 01

<!-- @slot:partTitle -->
补全能力对比

<!-- @slot:partImg -->

<!-- @slot:partContent -->
代码补全是AI编程助手的核心能力。我们测试了以下场景：

1. **单行补全**：输入前半句，预测后半句
2. **多行补全**：根据函数签名生成完整实现
3. **跨文件补全**：理解项目结构后补全相关代码

测试发现，不同工具在复杂场景下差距明显。简单的CRUD代码各家表现接近，但涉及业务逻辑时，差异逐渐拉大。

<!-- @slot:partNum -->
PART 02

<!-- @slot:partTitle -->
代码理解能力

<!-- @slot:partImg -->

<!-- @slot:partContent -->
好的AI助手不仅要会写，还要会"读"。

- **代码解释**：能否准确说明某段代码的作用
- **问题诊断**：能否定位bug的根因
- **重构建议**：能否识别代码坏味道并给出优化方案

这一维度上，上下文窗口大小成为关键因素。窗口越大，理解越准确。

<!-- @slot:partNum -->
PART 03

<!-- @slot:partTitle -->
隐私与安全考量

<!-- @slot:partImg -->

<!-- @slot:partContent -->
企业用户最关心的是代码安全问题。

主流方案分为三类：

1. **云端处理**：代码上传至服务商服务器
2. **本地部署**：模型运行在内网环境
3. **混合模式**：敏感代码本地处理，通用代码云端处理

选择时需平衡效率与安全，根据团队实际情况决定。

<!-- @slot:caseNum -->
CASE 01

<!-- @slot:caseTitle -->
初创团队：选择云端方案快速启动

<!-- @slot:caseContent -->
5人小团队，项目周期紧。选择某云端AI助手，零部署成本，当天上手。代码补全效率提升约40%。

<!-- @slot:caseNum -->
CASE 02

<!-- @slot:caseTitle -->
金融企业：本地部署保障合规

<!-- @slot:caseContent -->
代码涉及客户敏感数据，必须本地部署。选用支持私有化的方案，前期投入较大但长期可控，合规审计无忧。

<!-- @slot:caseNum -->
CASE 03

<!-- @slot:caseTitle -->
开源项目：免费工具+自托管模型

<!-- @slot:caseContent -->
预算有限但技术实力强。组合使用免费工具+自托管开源模型，成本几乎为零，但需要额外的运维投入。

<!-- @slot:summaryTitle -->
选购建议

<!-- @slot:summaryContent -->
没有"最好的"AI编程助手，只有"最适合的"。

- **个人开发者**：优先考虑免费额度和使用体验
- **小团队**：关注协作功能和性价比
- **企业用户**：重点考察安全合规和可定制性

建议先试用再决策，大多数工具都提供免费试用期。

<!-- @slot:summaryQuote -->
AI不会取代程序员，但会用AI的程序员会取代不会用的。
`,
  slots: {
    titleTag: { label: '标题标签', type: 'content', placeholder: 'BREAKING 2026.03' },
    titleMain: { label: '主标题', type: 'content', placeholder: '# 主标题' },
    titleSub: { label: '副标题', type: 'content', placeholder: '副标题描述' },
    cover: { label: '封面图', type: 'image', placeholder: '' },
    lead: { label: '导语', type: 'content', placeholder: '导语段落...' },
    featuresHeader: { label: 'Features 标题', type: 'content', placeholder: '核心功能一览' },
    featuresGrid: { label: 'Features 卡片', type: 'content', placeholder: '- **功能1** 描述\n- **功能2** 描述\n- **功能3** 描述' },
    featuresSummary: { label: 'Features 总结', type: 'content', placeholder: '总结文字' },
    partNum: { label: 'Part 编号（可重复）', type: 'content', placeholder: 'PART 01（重复使用填充多个Part编号）' },
    partTitle: { label: 'Part 标题（可重复）', type: 'content', placeholder: '章节标题（重复使用填充多个Part）' },
    partImg: { label: 'Part 配图（可重复）', type: 'image', placeholder: '配图URL（重复使用）' },
    partContent: { label: 'Part 内容（可重复）', type: 'content', placeholder: '章节内容（重复使用填充多个Part）' },
    caseNum: { label: 'Case 编号（可重复）', type: 'content', placeholder: 'CASE 01（重复使用填充多个Case编号）' },
    caseTitle: { label: 'Case 标题（可重复）', type: 'content', placeholder: '案例标题（重复使用填充多个Case）' },
    caseContent: { label: 'Case 内容（可重复）', type: 'content', placeholder: '案例描述（重复使用）' },
    summaryTitle: { label: '总结标题', type: 'content', placeholder: '写在最后' },
    summaryContent: { label: '总结内容', type: 'content', placeholder: '总结段落...' },
    summaryQuote: { label: '总结引用', type: 'content', placeholder: '引用文字' },
    copyright: { label: '版权信息', type: 'content', placeholder: '© 本文由...创作' },
  },
  sections: [
    { id: 'title', label: '标题区', slots: ['titleTag', 'titleMain', 'titleSub', 'cover'] },
    { id: 'lead', label: '导语', slots: ['lead'] },
    { id: 'features', label: 'Feature 卡片', slots: ['featuresHeader', 'featuresGrid', 'featuresSummary'] },
    { id: 'parts', label: 'Part 分区（3个）', slots: ['partNum', 'partTitle', 'partImg', 'partContent'] },
    { id: 'cases', label: '案例区（3个）', slots: ['caseNum', 'caseTitle', 'caseContent'] },
    { id: 'summary', label: '总结', slots: ['summaryTitle', 'summaryContent', 'summaryQuote'] },
  ],
  exportConfig: { formats: ['jpg', 'html'], defaultWidth: 480, defaultScale: 2, mode: 'long' },
};
