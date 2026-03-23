/**
 * 性能测试报告生成器
 */

import * as fs from 'fs';
import * as path from 'path';
import type { PerformanceMetrics } from './utils';

export interface PerformanceReport {
  title: string;
  timestamp: string;
  duration: number;
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    passRate: string;
  };
  modules: Array<{
    name: string;
    category: string;
    metrics: PerformanceMetrics;
    passed: boolean;
    grade: string;
  }>;
  recommendations: string[];
}

export class ReportGenerator {
  private reportDir: string;

  constructor() {
    this.reportDir = path.join(process.cwd(), 'tests', 'reports', 'performance');
    
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  generateMarkdownReport(report: PerformanceReport): string {
    const lines: string[] = [
      `# ${report.title}`,
      '',
      `**测试时间**: ${report.timestamp}`,
      `**总耗时**: ${(report.duration / 1000).toFixed(2)}s`,
      '',
      '## 测试概览',
      '',
      '| 指标 | 数值 |',
      '|------|------|',
      `| 总测试数 | ${report.summary.totalTests} |`,
      `| 通过数 | ${report.summary.passedTests} |`,
      `| 失败数 | ${report.summary.failedTests} |`,
      `| 通过率 | ${report.summary.passRate} |`,
      '',
      '## 性能详情',
      '',
      '### 按模块',
      '',
      '| 模块 | 类别 | 平均响应时间 | P95 | 等级 | 状态 |',
      '|------|------|-------------|-----|------|------|',
    ];

    report.modules.forEach(module => {
      const status = module.passed ? '✅' : '❌';
      lines.push(
        `| ${module.name} | ${module.category} | ` +
        `${module.metrics.avgResponseTime}ms | ` +
        `${module.metrics.p95ResponseTime}ms | ` +
        `${module.grade} | ${status} |`
      );
    });

    if (report.recommendations.length > 0) {
      lines.push('', '## 优化建议', '');
      report.recommendations.forEach((rec, i) => {
        lines.push(`${i + 1}. ${rec}`);
      });
    }

    lines.push('', '---', `*报告生成时间: ${new Date().toISOString()}*`);

    return lines.join('\n');
  }

  generateJsonReport(report: PerformanceReport): string {
    return JSON.stringify(report, null, 2);
  }

  saveReport(report: PerformanceReport, format: 'md' | 'json' | 'both' = 'both'): string[] {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const savedFiles: string[] = [];

    if (format === 'md' || format === 'both') {
      const mdPath = path.join(this.reportDir, `performance-report-${timestamp}.md`);
      const mdContent = this.generateMarkdownReport(report);
      fs.writeFileSync(mdPath, mdContent, 'utf-8');
      savedFiles.push(mdPath);
    }

    if (format === 'json' || format === 'both') {
      const jsonPath = path.join(this.reportDir, `performance-report-${timestamp}.json`);
      const jsonContent = this.generateJsonReport(report);
      fs.writeFileSync(jsonPath, jsonContent, 'utf-8');
      savedFiles.push(jsonPath);
    }

    return savedFiles;
  }

  analyzeAndRecommend(report: PerformanceReport): string[] {
    const recommendations: string[] = [];

    // 分析慢响应
    const slowModules = report.modules.filter(
      m => m.metrics.avgResponseTime > 500
    );
    
    if (slowModules.length > 0) {
      recommendations.push(
        `以下模块响应较慢，建议优化: ${slowModules.map(m => m.name).join(', ')}`
      );
    }

    // 分析高错误率
    const highErrorModules = report.modules.filter(
      m => m.metrics.errorRate > 0.05
    );
    
    if (highErrorModules.length > 0) {
      recommendations.push(
        `以下模块错误率较高，需要检查: ${highErrorModules.map(m => m.name).join(', ')}`
      );
    }

    // 分析内存使用
    const highMemoryModules = report.modules.filter(
      m => m.metrics.memoryUsage && m.metrics.memoryUsage.heapUsed > 100 * 1024 * 1024
    );
    
    if (highMemoryModules.length > 0) {
      recommendations.push(
        `以下模块内存使用较高: ${highMemoryModules.map(m => m.name).join(', ')}`
      );
    }

    // 根据等级给出建议
    const failedModules = report.modules.filter(m => m.grade === 'failed');
    if (failedModules.length > 0) {
      recommendations.push(
        `${failedModules.length} 个模块未达到性能标准，建议优先优化`
      );
    }

    const excellentModules = report.modules.filter(m => m.grade === 'excellent');
    if (excellentModules.length > report.modules.length * 0.7) {
      recommendations.push(
        '整体性能优秀，继续保持当前架构设计'
      );
    }

    return recommendations;
  }
}

/**
 * 合并多个测试结果
 */
export function mergeTestResults(
  results: Array<{
    module: string;
    category: string;
    metrics: PerformanceMetrics;
    passed: boolean;
    grade: string;
  }>
): PerformanceReport {
  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;
  const passRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : '0';

  const report: PerformanceReport = {
    title: 'TeamClaw 性能测试报告',
    timestamp: new Date().toISOString(),
    duration: results.reduce((sum, r) => sum + r.metrics.totalTime, 0),
    summary: {
      totalTests,
      passedTests,
      failedTests,
      passRate: `${passRate}%`,
    },
    modules: results.map(r => ({
      name: r.module,
      category: r.category,
      metrics: r.metrics,
      passed: r.passed,
      grade: r.grade,
    })),
    recommendations: [],
  };

  const generator = new ReportGenerator();
  report.recommendations = generator.analyzeAndRecommend(report);

  return report;
}
