'use client';

import { useEffect } from 'react';
import { useGatewayStore } from '@/core/gateway/store';
import { WifiOff, Settings } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

/**
 * 统一的 Gateway 断连空状态引导组件
 * 所有 Gateway 依赖页面使用此组件包裹
 *
 * 直接读取 gateway store 状态（DataProvider 已在应用启动时初始化）
 * 不再主动 fetch /api/gateway/config，避免 ~1s 的页面阻塞
 *
 * v3.0: 仅支持 server_proxy 模式（多用户安全要求）
 * 连接确认后会自动触发数据加载（如果尚未加载）
 */
export default function GatewayRequired({
  children,
  feature,
}: {
  children?: React.ReactNode;
  feature?: string;
}) {
  const { t } = useTranslation();
  const featureLabel = feature || t('gatewayRequired.gatewayFeature');
  const serverProxyConnected = useGatewayStore((s) => s.serverProxyConnected);
  const agentsList = useGatewayStore((s) => s.agentsList);

  // 连接成功且数据未加载时，触发数据加载
  useEffect(() => {
    if (!serverProxyConnected) return;
    // 数据已加载则跳过
    if (agentsList.length > 0) return;
    const gwStore = useGatewayStore.getState();
    Promise.allSettled([
      gwStore.refreshAgents(),
      gwStore.refreshHealth(),
      gwStore.refreshCronJobs(),
      gwStore.refreshSessions(),
      gwStore.refreshSkills(),
      gwStore.loadConfig(),
    ]).catch(() => {});
  }, [serverProxyConnected, agentsList.length]);

  if (serverProxyConnected) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center h-[60vh] px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <WifiOff className="w-8 h-8" style={{ color: 'var(--text-tertiary)' }} />
      </div>
      <h3 className="font-display font-semibold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
        {t('gatewayRequired.notConnected')}
      </h3>
      <p className="text-sm mb-4 max-w-xs" style={{ color: 'var(--text-tertiary)' }}>
        {t('gatewayRequired.featureRequiresGateway', { feature: featureLabel })}
      </p>
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="btn btn-sm btn-primary">
          {t('gatewayRequired.goToDashboard')}
        </Link>
        <Link href="/settings" className="btn btn-sm btn-secondary flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5" /> {t('gatewayRequired.settings')}
        </Link>
      </div>
    </div>
  );
}
