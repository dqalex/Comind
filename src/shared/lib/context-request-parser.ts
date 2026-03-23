/**
 * 上下文请求解析器
 * 
 * 从 Markdown 格式解析上下文请求，供 API 和测试使用
 */
import type { ContextType, ContextRequest } from '@/src/shared/lib/workspace/service';

/**
 * 从 Markdown 格式解析上下文请求
 * 
 * 支持格式：
 * ```markdown
 * 请求上下文:
 * - 类型: task_detail
 * - 参数: { "task_id": "xxx" }
 * ```
 */
export function parseContextRequest(text: string): ContextRequest[] {
  const requests: ContextRequest[] = [];
  
  // 正则匹配规范化格式
  const pattern = /请求上下文:\s*\n\s*-\s*类型:\s*(\w+)\s*\n\s*-\s*参数:\s*(\{[^}]*\})/g;
  
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const type = match[1] as ContextType;
    try {
      const params = JSON.parse(match[2]);
      requests.push({ type, params });
    } catch {
      // 解析失败，跳过
      console.warn('[context-request] Failed to parse params:', match[2]);
    }
  }
  
  return requests;
}
