'use client';

import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui';
import {
  TOOL_SECTIONS,
  PROFILE_OPTIONS,
  normalizeToolName,
  isAllowedByPolicy,
  resolveToolProfilePolicy,
} from '@/shared/lib/tool-policy';
import { Loader2, RefreshCw, Save, ToggleLeft, ToggleRight } from 'lucide-react';

interface ToolsPanelProps {
  agentId: string;
  configForm: Record<string, unknown> | null;
  configLoading: boolean;
  configSaving: boolean;
  configDirty: boolean;
  onConfigReload: () => Promise<void>;
  onConfigSave: () => Promise<void>;
  onConfigLoad: () => Promise<void>;
  onConfigUpdate: (updater: (form: Record<string, unknown>) => Record<string, unknown>) => void;
}

export default function ToolsPanel({ agentId, configForm, configLoading, configSaving, configDirty, onConfigReload, onConfigSave, onConfigLoad, onConfigUpdate }: ToolsPanelProps) {
  const { t } = useTranslation();
  // Resolve agent config from the configForm
  const cfg = configForm as { agents?: { list?: { id: string; tools?: { profile?: string; allow?: string[]; alsoAllow?: string[]; deny?: string[] } }[] }; tools?: { profile?: string; allow?: string[] } } | null;
  const agentEntry = cfg?.agents?.list?.find(a => a?.id === agentId);
  const agentTools = agentEntry?.tools ?? {};
  const globalTools = cfg?.tools ?? {};
  const profile = agentTools.profile ?? globalTools.profile ?? 'full';
  const profileSource = agentTools.profile ? t('agents.agentOverride') : globalTools.profile ? t('agents.globalDefault') : t('agents.systemDefault');
  const hasAgentAllow = Array.isArray(agentTools.allow) && agentTools.allow.length > 0;
  const hasGlobalAllow = Array.isArray(globalTools.allow) && globalTools.allow.length > 0;
  const editable = Boolean(configForm) && !configLoading && !configSaving && !hasAgentAllow;

  const alsoAllow = hasAgentAllow ? [] : (Array.isArray(agentTools.alsoAllow) ? agentTools.alsoAllow : []);
  const deny = hasAgentAllow ? [] : (Array.isArray(agentTools.deny) ? agentTools.deny : []);

  const basePolicy = hasAgentAllow
    ? { allow: agentTools.allow ?? [], deny: agentTools.deny ?? [] }
    : resolveToolProfilePolicy(profile);

  const toolIds = TOOL_SECTIONS.flatMap(s => s.tools.map(t => t.id));

  const resolveAllowed = (toolId: string) => {
    const baseAllowed = isAllowedByPolicy(toolId, basePolicy);
    const extraAllowed = alsoAllow.length > 0 && alsoAllow.some(a => normalizeToolName(a) === normalizeToolName(toolId));
    const denied = deny.length > 0 && deny.some(d => normalizeToolName(d) === normalizeToolName(toolId));
    const allowed = (baseAllowed || extraAllowed) && !denied;
    return { allowed, baseAllowed };
  };

  const enabledCount = toolIds.filter(id => resolveAllowed(id).allowed).length;

  const updateOverrides = (nextAlsoAllow: string[], nextDeny: string[]) => {
    onConfigUpdate(form => {
      const f = form as Record<string, unknown>;
      const agents = (f.agents ?? {}) as Record<string, unknown>;
      const list = (Array.isArray(agents.list) ? [...agents.list] : []) as Record<string, unknown>[];
      const idx = list.findIndex((a: Record<string, unknown>) => a?.id === agentId);
      const entry: Record<string, unknown> = idx >= 0 ? { ...list[idx] } : { id: agentId };
      const tools = { ...((entry.tools ?? {}) as Record<string, unknown>) };
      if (nextAlsoAllow.length > 0) tools.alsoAllow = nextAlsoAllow;
      else delete tools.alsoAllow;
      if (nextDeny.length > 0) tools.deny = nextDeny;
      else delete tools.deny;
      entry.tools = tools;
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);
      return { ...f, agents: { ...agents, list } };
    });
  };

  const updateTool = (toolId: string, nextEnabled: boolean) => {
    const nextAllow = new Set(alsoAllow.map(e => normalizeToolName(e)).filter(Boolean));
    const nextDenySet = new Set(deny.map(e => normalizeToolName(e)).filter(Boolean));
    const { baseAllowed } = resolveAllowed(toolId);
    const normalized = normalizeToolName(toolId);
    if (nextEnabled) {
      nextDenySet.delete(normalized);
      if (!baseAllowed) nextAllow.add(normalized);
    } else {
      nextAllow.delete(normalized);
      nextDenySet.add(normalized);
    }
    updateOverrides([...nextAllow], [...nextDenySet]);
  };

  const updateAll = (nextEnabled: boolean) => {
    const nextAllow = new Set(alsoAllow.map(e => normalizeToolName(e)).filter(Boolean));
    const nextDenySet = new Set(deny.map(e => normalizeToolName(e)).filter(Boolean));
    for (const toolId of toolIds) {
      const { baseAllowed } = resolveAllowed(toolId);
      const normalized = normalizeToolName(toolId);
      if (nextEnabled) {
        nextDenySet.delete(normalized);
        if (!baseAllowed) nextAllow.add(normalized);
      } else {
        nextAllow.delete(normalized);
        nextDenySet.add(normalized);
      }
    }
    updateOverrides([...nextAllow], [...nextDenySet]);
  };

  const setProfile = (profileId: string | null) => {
    onConfigUpdate(form => {
      const f = form as Record<string, unknown>;
      const agents = (f.agents ?? {}) as Record<string, unknown>;
      const list = (Array.isArray(agents.list) ? [...agents.list] : []) as Record<string, unknown>[];
      const idx = list.findIndex((a: Record<string, unknown>) => a?.id === agentId);
      const entry: Record<string, unknown> = idx >= 0 ? { ...list[idx] } : { id: agentId };
      const tools = { ...((entry.tools ?? {}) as Record<string, unknown>) };
      if (profileId) {
        tools.profile = profileId;
        delete tools.alsoAllow;
        delete tools.deny;
      } else {
        delete tools.profile;
      }
      entry.tools = tools;
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);
      return { ...f, agents: { ...agents, list } };
    });
  };

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('agents.toolPermissions')}</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              {t('agents.toolPermissionsDesc')}
              <span className="font-mono ml-1">{t('agents.enabledCount', { count: enabledCount, total: toolIds.length })}</span>
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              size="sm"
              variant="secondary"
              className="text-xs disabled:opacity-40"
              disabled={!editable}
              onClick={() => updateAll(true)}
            >
              {t('agents.enableAll')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="text-xs disabled:opacity-40"
              disabled={!editable}
              onClick={() => updateAll(false)}
            >
              {t('agents.disableAll')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="text-xs disabled:opacity-40 flex items-center gap-1"
              disabled={configLoading}
              onClick={onConfigReload}
            >
              <RefreshCw className="w-3 h-3" />
              {t('agents.reloadConfig')}
            </Button>
            <Button
              size="sm"
              className="text-xs disabled:opacity-40 flex items-center gap-1"
              disabled={configSaving || !configDirty}
              onClick={onConfigSave}
            >
              {configSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              {configSaving ? t('agents.saving') : t('agents.saveConfig')}
            </Button>
          </div>
        </div>

        {/* Callouts */}
        {!configForm && (
          <div className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}>
            <button onClick={onConfigLoad} className="text-primary-500 hover:underline font-medium">{t('agents.loadGatewayConfig')}</button> {t('agents.loadConfigHint')}
          </div>
        )}
        {hasAgentAllow && (
          <div className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}>
            {t('agents.agentAllowlistHint')}
          </div>
        )}
        {hasGlobalAllow && (
          <div className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}>
            {t('agents.globalAllowHint')}
          </div>
        )}

        {/* Meta: Profile / Source / Status */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg p-3 border" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
            <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{t('agents.preset')}</div>
            <div className="text-sm font-semibold font-mono mt-0.5" style={{ color: 'var(--text-primary)' }}>{profile}</div>
          </div>
          <div className="rounded-lg p-3 border" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
            <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{t('agents.source')}</div>
            <div className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>{profileSource}</div>
          </div>
          {configDirty && (
            <div className="rounded-lg p-3 border" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
              <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{t('agents.status')}</div>
              <div className="text-sm font-mono mt-0.5 text-amber-500">{t('agents.unsaved')}</div>
            </div>
          )}
        </div>

        {/* Quick Presets */}
        <div className="mt-4">
          <div className="text-[11px] font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>{t('agents.quickPreset')}</div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {PROFILE_OPTIONS.map(opt => (
              <Button
                key={opt.id}
                size="sm"
                variant={profile === opt.id ? 'primary' : 'secondary'}
                className="text-xs disabled:opacity-40"
                disabled={!editable}
                onClick={() => setProfile(opt.id)}
              >
                {opt.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="secondary"
              className="text-xs disabled:opacity-40"
              disabled={!editable}
              onClick={() => setProfile(null)}
            >
              {t('agents.inheritGlobal')}
            </Button>
          </div>
        </div>
      </div>

      {/* Tool Grid */}
      <div className="mt-5 space-y-3">
        {TOOL_SECTIONS.map(section => (
          <div key={section.id} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <div className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                {section.label}
              </span>
            </div>
            <div className="grid gap-px" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', background: 'var(--border)' }}>
              {section.tools.map(tool => {
                const { allowed } = resolveAllowed(tool.id);
                return (
                  <div
                    key={tool.id}
                    className="flex items-center justify-between px-4 py-3"
                    style={{ background: 'var(--surface)' }}
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>
                        {tool.label}
                      </div>
                      <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                        {tool.description}
                      </div>
                    </div>
                    <button
                      onClick={() => updateTool(tool.id, !allowed)}
                      disabled={!editable}
                      className="p-0.5 flex-shrink-0 ml-3 disabled:opacity-40"
                      title={allowed ? t('agents.disable') : t('agents.enable')}
                    >
                      {allowed ? (
                        <ToggleRight className="w-6 h-6 text-green-500" />
                      ) : (
                        <ToggleLeft className="w-6 h-6" style={{ color: 'var(--text-tertiary)' }} />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
