/**
 * Next.js Instrumentation Hook
 * 
 * 在服务启动时执行，用于初始化：
 * 1. 服务端 Gateway 连接（server_proxy 模式）
 * 2. 定时全量同步调度器（auto-sync scheduler）
 * 3. 心跳 + 文件监听
 * 4. Skill 快照定时任务（安全审计）
 */

export async function register() {
  // 仅在服务端运行
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Server starting...');
    
    // 0. 验证环境变量（第一步执行）
    try {
      const { validateEnvOnStartup } = await import('./src/shared/lib/env-validator');
      validateEnvOnStartup();
    } catch (err) {
      console.error('[Instrumentation] Environment validation failed:', err);
      // 生产环境继续执行（已在上游处理），开发环境仅警告
    }
    
    // 1. 初始化 Gateway 连接
    try {
      const { initServerGatewayClient } = await import('./src/shared/lib/server-gateway-client');
      
      initServerGatewayClient()
        .then((client) => {
          if (client) {
            console.log('[Instrumentation] Gateway client initialized successfully');
          } else {
            console.log('[Instrumentation] No Gateway config found, skipping connection');
          }
        })
        .catch((err) => {
          console.error('[Instrumentation] Gateway initialization failed:', err.message);
        });
    } catch (err) {
      console.error('[Instrumentation] Failed to load server-gateway-client:', err);
    }

    // 2. 延迟启动定时同步和心跳（等待服务完全就绪）
    setTimeout(async () => {
      try {
        const { startAllAutoSync } = await import('./src/shared/lib/openclaw/auto-sync-scheduler');
        const count = await startAllAutoSync();
        console.log(`[Instrumentation] Auto-sync schedulers started: ${count} workspace(s)`);
      } catch (err) {
        console.error('[Instrumentation] Failed to start auto-sync schedulers:', err);
      }

      try {
        const { startAllHeartbeats } = await import('./src/shared/lib/openclaw/index-manager');
        const count = await startAllHeartbeats();
        console.log(`[Instrumentation] Heartbeats started: ${count} workspace(s)`);
      } catch (err) {
        console.error('[Instrumentation] Failed to start heartbeats:', err);
      }

      // 3. 启动 Skill 快照定时任务（安全审计）
      try {
        const { startSkillSnapshotScheduler } = await import('./src/shared/lib/skill-snapshot-scheduler');
        // 默认 6 小时间隔，可通过环境变量 SKILL_SNAPSHOT_INTERVAL_HOURS 配置
        const intervalHours = parseInt(process.env.SKILL_SNAPSHOT_INTERVAL_HOURS || '6', 10);
        startSkillSnapshotScheduler(intervalHours);
        console.log(`[Instrumentation] Skill snapshot scheduler started: interval=${intervalHours}h`);
      } catch (err) {
        console.error('[Instrumentation] Failed to start skill snapshot scheduler:', err);
      }
    }, 3000); // 3 秒后启动，确保数据库连接已就绪
  }
}
