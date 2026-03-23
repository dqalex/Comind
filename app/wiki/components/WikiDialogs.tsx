'use client';

import { useTranslation } from 'react-i18next';
import { Button, Input, Select } from '@/shared/ui';
import ConfirmDialog from '@/shared/layout/ConfirmDialog';
import { Share2, Copy, Check, Send } from 'lucide-react';
import dynamic from 'next/dynamic';
import type { Document } from '@/db/schema';
import type { RenderTemplate } from '@/db/schema';

const ExportModal = dynamic(() => import('@/features/document-editor/ExportModal'), { ssr: false });

interface WikiDialogsProps {
  // 删除确认
  deleteAction: { isOpen: boolean; cancel: () => void; confirm: (fn: () => Promise<void>) => void; isLoading: boolean };
  onDelete: () => Promise<void>;
  // 分享
  showShareDialog: boolean;
  setShowShareDialog: (v: boolean) => void;
  selectedDoc: Document | undefined;
  shareUrl: string;
  copySuccess: boolean;
  setCopySuccess: (v: boolean) => void;
  onCopyLink: () => void;
  // 交付
  showDeliverDialog: boolean;
  setShowDeliverDialog: (v: boolean) => void;
  deliverReviewerId: string;
  setDeliverReviewerId: (v: string) => void;
  deliverDescription: string;
  setDeliverDescription: (v: string) => void;
  submittingDelivery: boolean;
  onSubmitDelivery: () => void;
  members: { id: string; name: string; type: string }[];
  // 导出
  showExportModal: boolean;
  setShowExportModal: (v: boolean) => void;
  studioHtmlContent: string;
  currentRenderTemplate: RenderTemplate | null;
}

export default function WikiDialogs({
  deleteAction, onDelete,
  showShareDialog, setShowShareDialog, selectedDoc, shareUrl, copySuccess, setCopySuccess, onCopyLink,
  showDeliverDialog, setShowDeliverDialog, deliverReviewerId, setDeliverReviewerId, deliverDescription, setDeliverDescription, submittingDelivery, onSubmitDelivery, members,
  showExportModal, setShowExportModal, studioHtmlContent, currentRenderTemplate,
}: WikiDialogsProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* 删除确认 */}
      <ConfirmDialog
        isOpen={deleteAction.isOpen}
        onClose={deleteAction.cancel}
        onConfirm={() => deleteAction.confirm(onDelete)}
        title={t('wiki.confirmDelete')}
        message={t('wiki.deleteWarning')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        isLoading={deleteAction.isLoading}
      />

      {/* 分享链接对话框 */}
      {showShareDialog && selectedDoc && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="share-doc-title">
          <div className="rounded-2xl p-6 w-96 shadow-float" style={{ background: 'var(--surface)' }}>
            <h3 id="share-doc-title" className="font-display font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Share2 className="w-4 h-4" /> {t('wiki.shareLink')}
            </h3>
            <div className="mb-4">
              <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>{selectedDoc.title}</p>
              <div className="flex items-center gap-2">
                <Input
                  value={shareUrl}
                  readOnly
                  className="flex-1 text-xs bg-slate-50 dark:bg-slate-800"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button size="sm" variant={copySuccess ? 'primary' : 'secondary'} onClick={onCopyLink} className="px-3">
                  {copySuccess ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
              {copySuccess && <p className="text-xs text-primary-600 mt-2">{t('wiki.linkCopied')}</p>}
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => { setShowShareDialog(false); setCopySuccess(false); }}>{t('common.close')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* 提交交付对话框 */}
      {showDeliverDialog && selectedDoc && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="deliver-doc-title">
          <div className="rounded-2xl p-6 w-96 shadow-float" style={{ background: 'var(--surface)' }}>
            <h3 id="deliver-doc-title" className="font-display font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Send className="w-4 h-4 text-emerald-500" /> {t('wiki.submitDelivery', { defaultValue: '提交交付' })}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.docTitle')}</label>
                <Input value={selectedDoc.title} readOnly className="text-sm bg-slate-50 dark:bg-slate-800" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.selectReviewer', { defaultValue: '选择审批人' })}</label>
                <Select value={deliverReviewerId} onChange={e => setDeliverReviewerId(e.target.value)} className="text-sm">
                  <option value="">{t('wiki.pleaseSelectReviewer', { defaultValue: '请选择审批人...' })}</option>
                  {members.filter(m => m.type === 'ai').map(m => (
                    <option key={m.id} value={m.id}>{m.name} (AI)</option>
                  ))}
                  {members.filter(m => m.type === 'human').map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.deliveryDescription', { defaultValue: '交付说明（可选）' })}</label>
                <textarea
                  value={deliverDescription}
                  onChange={e => setDeliverDescription(e.target.value)}
                  placeholder={t('wiki.deliveryDescriptionPlaceholder', { defaultValue: '描述交付内容和审核要求...' })}
                  className="w-full p-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                  style={{ color: 'var(--text-primary)' }}
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button size="sm" variant="secondary" onClick={() => { setShowDeliverDialog(false); setDeliverReviewerId(''); setDeliverDescription(''); }}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" onClick={onSubmitDelivery} disabled={!deliverReviewerId || submittingDelivery} className="bg-emerald-500 text-white hover:bg-emerald-600">
                {submittingDelivery ? t('common.loading') : t('wiki.submitDelivery', { defaultValue: '提交交付' })}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Content Studio 导出对话框 */}
      {showExportModal && (
        <ExportModal
          open={showExportModal}
          onClose={() => setShowExportModal(false)}
          htmlContent={studioHtmlContent}
          exportConfig={currentRenderTemplate?.exportConfig as import('@/features/document-editor/ExportModal').ExportConfig | undefined}
          fileName={selectedDoc?.title || 'export'}
        />
      )}
    </>
  );
}
