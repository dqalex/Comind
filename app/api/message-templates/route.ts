/**
 * 消息模板 API 路由别名
 * 
 * v1.0.1 新增：与 /api/templates 功能相同
 * 提供更语义化的 API 路径
 */

// 直接复用 templates 路由的实现
export { GET } from '../templates/route';
export const dynamic = 'force-dynamic';
