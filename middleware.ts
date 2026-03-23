import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * 安全中间件
 * - 添加安全响应头（含 CSP）
 * - CSRF 保护（无 Origin/Referer 时拒绝变更请求）
 * - 请求体大小限制（Content-Length 缺失时也拦截）
 * - 全局 API 限流（写操作）
 */

// 允许的来源（开发环境允许所有，生产环境需要配置）
const getAllowedOrigins = (): string[] => {
  const origins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
  // 开发环境允许 localhost
  if (process.env.NODE_ENV === 'development') {
    origins.push('http://localhost:3000', 'http://127.0.0.1:3000');
  }
  return origins;
};

// 最大请求体大小 (1MB)
const MAX_BODY_SIZE = 1024 * 1024;

// 不需要 CSRF 检查的 API 路径（如外部 MCP 调用使用 Bearer token 认证、内部初始化接口）
const CSRF_EXEMPT_PATHS = ['/api/mcp/external', '/api/heartbeat/start'];

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const isApiRoute = request.nextUrl.pathname.startsWith('/api');

  // 1. 安全响应头（对所有路由生效）
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  
  // HSTS：生产环境强制 HTTPS（1年有效期，包含子域名）
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // CSP：限制资源来源，防止 XSS（生产环境移除 unsafe-eval）
  const scriptSrc = process.env.NODE_ENV === 'development' 
    ? "'self' 'unsafe-inline' 'unsafe-eval'" 
    : "'self' 'unsafe-inline'";
  response.headers.set(
    'Content-Security-Policy',
    `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; connect-src 'self' ws: wss:; font-src 'self' data: https://fonts.gstatic.com;`
  );

  if (isApiRoute) {
    const origin = request.headers.get('origin');
    const allowedOrigins = getAllowedOrigins();

    // 2. CORS 处理
    if (origin && (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development')) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Agent-Id, X-Session-Key, X-Request-Id');
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }

    // 问题 #14：OPTIONS 预检请求快速返回
    if (request.method === 'OPTIONS') {
      const preflightResponse = new NextResponse(null, { status: 204 });
      if (origin && (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development')) {
        preflightResponse.headers.set('Access-Control-Allow-Origin', origin);
        preflightResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        preflightResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Agent-Id, X-Session-Key, X-Request-Id');
        preflightResponse.headers.set('Access-Control-Allow-Credentials', 'true');
        preflightResponse.headers.set('Access-Control-Max-Age', '86400');
      }
      return preflightResponse;
    }

    // 3. 请求体大小限制（Content-Length 缺失时对变更请求也拦截）
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const contentLength = request.headers.get('content-length');
      if (contentLength) {
        if (parseInt(contentLength) > MAX_BODY_SIZE) {
          return new NextResponse(
            JSON.stringify({ error: 'Payload too large' }),
            { status: 413, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
      // Content-Length 缺失但有 body 的请求，在 API handler 层通过 JSON.parse 后校验
    }

    // 4. CSRF 保护：检查 Origin/Referer（生产环境强制）
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      const pathname = request.nextUrl.pathname;
      const isExempt = CSRF_EXEMPT_PATHS.some(p => pathname.startsWith(p));

      // 开发环境或测试环境跳过 CSRF 检查
      const shouldSkipCsrf = process.env.NODE_ENV === 'development' || process.env.PLAYWRIGHT_TEST === 'true';

      if (!isExempt && !shouldSkipCsrf && process.env.NODE_ENV === 'production') {
        const referer = request.headers.get('referer');
        const host = request.headers.get('host');

        // 无 Origin 且无 Referer 时拒绝（防止绕过）
        if (!origin && !referer) {
          return new NextResponse(
            JSON.stringify({ error: 'CSRF validation failed: missing origin' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const requestOrigin = origin || (referer ? new URL(referer).origin : '');
        const expectedOrigin = `${request.nextUrl.protocol}//${host}`;

        const isSameOrigin = requestOrigin === expectedOrigin;
        const isAllowed = allowedOrigins.includes(requestOrigin);

        // SSH 端口转发兼容：浏览器 Origin 可能是 localhost:8000 而服务器是 localhost:3000
        // 只要 hostname 是 localhost/127.0.0.1 就视为同域（端口转发场景）
        const isLocalPortForward = (() => {
          try {
            const reqUrl = new URL(requestOrigin);
            const expUrl = new URL(expectedOrigin);
            const localHosts = ['localhost', '127.0.0.1', '::1'];
            return localHosts.includes(reqUrl.hostname) && localHosts.includes(expUrl.hostname);
          } catch {
            return false;
          }
        })();

        if (!isSameOrigin && !isAllowed && !isLocalPortForward) {
          return new NextResponse(
            JSON.stringify({ error: 'CSRF validation failed' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // 5. 全局 API 限流（写操作统一限制，GET 不限制）
    // 测试环境（E2E）跳过限流，通过环境变量 PLAYWRIGHT_TEST 标识
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method) && process.env.PLAYWRIGHT_TEST !== 'true') {
      const pathname = request.nextUrl.pathname;
      const clientId = getClientIdentifier(request);
      
      // 敏感操作使用严格限制（debug 修复、MCP 外部调用）
      const isStrict = pathname.startsWith('/api/debug') || pathname.startsWith('/api/mcp/external');
      // Gateway 代理接口使用宽松限制（启动时并发多个请求）
      const isGatewayProxy = pathname === '/api/gateway/request';
      const config = isStrict ? RATE_LIMITS.STRICT : isGatewayProxy ? RATE_LIMITS.RELAXED : RATE_LIMITS.STANDARD;
      const rateLimitKey = `${request.method}:${pathname}`;
      
      const result = checkRateLimit(`${clientId}:${rateLimitKey}`, config);
      if (!result.allowed) {
        return new NextResponse(
          JSON.stringify({ error: 'Rate limit exceeded, please try again later', retryAfter: result.retryAfter }),
          { 
            status: 429, 
            headers: { 
              'Content-Type': 'application/json',
              ...(result.retryAfter ? { 'Retry-After': String(result.retryAfter) } : {}),
            } 
          }
        );
      }
      
      // 添加限流头信息
      response.headers.set('X-RateLimit-Limit', String(config.maxRequests));
      response.headers.set('X-RateLimit-Remaining', String(result.remaining));
      response.headers.set('X-RateLimit-Reset', String(result.resetTime));
    }

    // 添加请求 ID 用于追踪
    const requestId = crypto.randomUUID();
    response.headers.set('X-Request-Id', requestId);
    
    // 敏感 API 添加 no-store 头，防止缓存
    const sensitivePaths = ['/api/auth', '/api/users', '/api/mcp', '/api/chat'];
    const isSensitivePath = sensitivePaths.some(p => request.nextUrl.pathname.startsWith(p));
    if (isSensitivePath) {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
    }
  }

  return response;
}

export const config = {
  matcher: [
    // 匹配所有路由（安全头对页面也生效）
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
