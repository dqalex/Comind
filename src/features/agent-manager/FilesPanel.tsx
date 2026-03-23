'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGatewayStore } from '@/core/gateway/store';
import { getGatewayProxyClient } from '@/lib/gateway-proxy';
import { Button } from '@/shared/ui';
import clsx from 'clsx';
import { FileText, Loader2, Settings2, Save, AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';

const MarkdownEditor = dynamic(() => import('@/shared/editor/MarkdownEditor'), { ssr: false });

interface FilesPanelProps {
  agentId: string;
}

export default function FilesPanel({ agentId }: FilesPanelProps) {
  const { t } = useTranslation();
  // v3.0: 仅支持 server_proxy 模式
  const connectionMode = useGatewayStore((s) => s.connectionMode);
  const serverProxyConnected = useGatewayStore((s) => s.serverProxyConnected);
  const [files, setFiles] = useState<{ name: string; path: string; missing?: boolean; size?: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  const isMdFile = selectedFile?.endsWith('.md') ?? false;
  const isServerProxy = connectionMode === 'server_proxy' && serverProxyConnected;
  const proxyClient = useMemo(() => isServerProxy ? getGatewayProxyClient() : null, [isServerProxy]);

  useEffect(() => {
    if (!proxyClient) return;
    setLoading(true);
    proxyClient.getAgentFiles(agentId)
      .then((r: { files?: { name: string; path: string; missing: boolean; size?: number; updatedAtMs?: number }[] }) => {
        setFiles(r.files || []);
      })
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [agentId, proxyClient]);

  const handleSelectFile = async (fileName: string) => {
    if (!proxyClient) return;
    setSelectedFile(fileName);
    setEditing(false);
    try {
      const r = await proxyClient.getAgentFile(agentId, fileName);
      const content = r.file?.content || '';
      setFileContent(content);
      setEditContent(content);
    } catch {
      setFileContent(t('agents.fileReadError'));
    }
  };

  const handleSave = async () => {
    if (!proxyClient || !selectedFile) return;
    setSaving(true);
    try {
      await proxyClient.setAgentFile(agentId, selectedFile, editContent);
      setFileContent(editContent);
      setEditing(false);
    } catch (e) {
      console.error('Save file error:', e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
      </div>
    );
  }

  if (!isServerProxy) {
    return (
      <div className="flex items-center justify-center py-12 text-sm" style={{ color: 'var(--text-tertiary)' }}>
        {t('agents.gatewayNotConnected')}
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full max-w-4xl">
      <div className="w-52 flex-shrink-0 space-y-0.5">
        <h3 className="section-title text-[11px] mb-2">{t('agents.workspaceFiles', { count: files.length })}</h3>
        {files.map(f => (
          <button
            key={f.name}
            onClick={() => handleSelectFile(f.name)}
            className={clsx(
              'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors text-[13px]',
              selectedFile === f.name
                ? 'bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
            )}
            style={selectedFile !== f.name ? { color: 'var(--text-secondary)' } : undefined}
          >
            <FileText className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{f.name}</span>
            {f.missing && <AlertCircle className="w-3 h-3 text-amber-400 flex-shrink-0" />}
          </button>
        ))}
        {files.length === 0 && (
          <div className="text-xs py-6 text-center" style={{ color: 'var(--text-tertiary)' }}>{t('agents.noFiles')}</div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {selectedFile ? (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{selectedFile}</span>
              <div className="flex items-center gap-1.5">
                {editing ? (
                  <>
                    <Button size="sm" className="flex items-center gap-1 text-xs" disabled={saving} onClick={handleSave}>
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      {t('agents.save')}
                    </Button>
                    <Button size="sm" variant="secondary" className="text-xs" onClick={() => { setEditing(false); setEditContent(fileContent); }}>
                      {t('common.cancel')}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="secondary" className="text-xs flex items-center gap-1" onClick={() => setEditing(true)}>
                    <Settings2 className="w-3 h-3" /> {t('agents.edit')}
                  </Button>
                )}
              </div>
            </div>
            {isMdFile ? (
              <div className="flex-1 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)', minHeight: '300px' }}>
                <MarkdownEditor
                  value={editing ? editContent : fileContent}
                  onChange={(v) => editing && setEditContent(v)}
                  readOnly={!editing}
                  placeholder={t('agents.markdownContent')}
                />
              </div>
            ) : (
              <textarea
                value={editing ? editContent : fileContent}
                onChange={e => editing && setEditContent(e.target.value)}
                readOnly={!editing}
                className="flex-1 w-full rounded-lg p-3 text-xs font-mono resize-none outline-none"
                style={{
                  background: 'var(--surface-hover)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  minHeight: '300px',
                }}
              />
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('agents.selectFileToView')}
          </div>
        )}
      </div>
    </div>
  );
}
