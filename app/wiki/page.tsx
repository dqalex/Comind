'use client';

import { useTranslation } from 'react-i18next';
import AppShell from '@/shared/layout/AppShell';
import Header from '@/shared/layout/Header';
import { Button } from '@/shared/ui';
import { Plus } from 'lucide-react';
import { useWikiPage } from './hooks/useWikiPage';
import { useAuthStore } from '@/domains';
import WikiSidebar from './components/WikiSidebar';
import WikiDocEditor from './components/WikiDocEditor';
import WikiCreateDocDialog from './components/WikiCreateDocDialog';
import WikiDialogs from './components/WikiDialogs';
import { TemplateApplyDialog } from './components/TemplateApplyDialog';

export default function WikiPage() {
  const { t } = useTranslation();
  const wiki = useWikiPage();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  return (
    <AppShell>
      <Header title={t('wiki.title')} showProjectSelector />
      <div className="flex h-[calc(100vh-64px)] overflow-x-auto">
        {/* 左侧列表 */}
        <WikiSidebar
          documents={wiki.documents}
          filteredDocs={wiki.filteredDocs}
          docsByType={wiki.docsByType}
          searchInput={wiki.searchInput}
          onSearchInput={wiki.handleSearchInput}
          filterType={wiki.filterType}
          onFilterType={wiki.setFilterType}
          selectedDocId={wiki.selectedDocId}
          onSelectDoc={wiki.setSelectedDocId}
          collapsedTypes={wiki.collapsedTypes}
          onToggleCollapse={wiki.toggleCollapse}
          onNewDoc={() => wiki.setShowNewDocDialog(true)}
          typeLabels={wiki.typeLabels}
        />

        {/* 右侧编辑区 */}
        <div className="flex-1 flex flex-col">
          <WikiDocEditor
            selectedDoc={wiki.selectedDoc}
            editTitle={wiki.editTitle}
            setEditTitle={wiki.setEditTitle}
            editContent={wiki.editContent}
            onTitleSave={wiki.handleTitleSave}
            onContentChange={wiki.handleContentChange}
            onSaveStudioHtml={wiki.handleSaveStudioHtml}
            studioHtmlContent={wiki.studioHtmlContent}
            showTagEditor={wiki.showTagEditor}
            setShowTagEditor={wiki.setShowTagEditor}
            showKnowledgeGraph={wiki.showKnowledgeGraph}
            setShowKnowledgeGraph={wiki.setShowKnowledgeGraph}
            docRelations={wiki.docRelations}
            isEditingOpenclaw={wiki.isEditingOpenclaw}
            setIsEditingOpenclaw={wiki.setIsEditingOpenclaw}
            openclawEditContent={wiki.openclawEditContent}
            setOpenclawEditContent={wiki.setOpenclawEditContent}
            savingOpenclaw={wiki.savingOpenclaw}
            onSaveOpenclaw={wiki.handleSaveOpenclaw}
            onCancelOpenclawEdit={wiki.handleCancelOpenclawEdit}
            onShare={() => wiki.setShowShareDialog(true)}
            onChat={wiki.handleChatAboutDoc}
            onDeliver={() => wiki.setShowDeliverDialog(true)}
            onDelete={() => wiki.deleteAction.requestConfirm(true)}
            onExport={() => wiki.setShowExportModal(true)}
            onSelectDoc={wiki.setSelectedDocId}
            onNewDoc={() => wiki.setShowNewDocDialog(true)}
            projects={wiki.projects}
            renderTemplates={wiki.renderTemplates}
            currentRenderTemplate={wiki.currentRenderTemplate}
            typeLabels={wiki.typeLabels}
            onTypeChange={wiki.handleTypeChange}
            onRenderTemplateChange={wiki.handleRenderTemplateChange}
            onToggleProjectTag={wiki.handleToggleProjectTag}
            textSelection={wiki.textSelection}
            setTextSelection={wiki.setTextSelection}
            onApplyTemplate={() => wiki.setShowApplyTemplateDialog(true)}
            isAdmin={isAdmin}
          />
        </div>
      </div>

      {/* 新建文档对话框 */}
      {wiki.showNewDocDialog && (
        <WikiCreateDocDialog
          newDocTitle={wiki.newDocTitle}
          setNewDocTitle={wiki.setNewDocTitle}
          newDocSource={wiki.newDocSource}
          setNewDocSource={wiki.setNewDocSource}
          newDocType={wiki.newDocType}
          setNewDocType={wiki.setNewDocType}
          newDocProjectTags={wiki.newDocProjectTags}
          setNewDocProjectTags={wiki.setNewDocProjectTags}
          newDocRenderTemplateId={wiki.newDocRenderTemplateId}
          setNewDocRenderTemplateId={wiki.setNewDocRenderTemplateId}
          templatePreviewMode={wiki.templatePreviewMode}
          setTemplatePreviewMode={wiki.setTemplatePreviewMode}
          projects={wiki.projects}
          renderTemplates={wiki.renderTemplates}
          typeLabels={wiki.typeLabels}
          onSubmit={wiki.handleCreateDoc}
          onClose={() => wiki.setShowNewDocDialog(false)}
        />
      )}

      {/* 其他对话框 */}
      <WikiDialogs
        deleteAction={wiki.deleteAction}
        onDelete={wiki.handleDelete}
        showShareDialog={wiki.showShareDialog}
        setShowShareDialog={wiki.setShowShareDialog}
        selectedDoc={wiki.selectedDoc}
        shareUrl={wiki.getShareUrl()}
        copySuccess={wiki.copySuccess}
        setCopySuccess={wiki.setCopySuccess}
        onCopyLink={wiki.handleCopyLink}
        showDeliverDialog={wiki.showDeliverDialog}
        setShowDeliverDialog={wiki.setShowDeliverDialog}
        deliverReviewerId={wiki.deliverReviewerId}
        setDeliverReviewerId={wiki.setDeliverReviewerId}
        deliverDescription={wiki.deliverDescription}
        setDeliverDescription={wiki.setDeliverDescription}
        submittingDelivery={wiki.submittingDelivery}
        onSubmitDelivery={wiki.handleSubmitDelivery}
        members={wiki.members}
        showExportModal={wiki.showExportModal}
        setShowExportModal={wiki.setShowExportModal}
        studioHtmlContent={wiki.studioHtmlContent}
        currentRenderTemplate={wiki.currentRenderTemplate}
      />

      {/* 套模板对话框 */}
      {wiki.showApplyTemplateDialog && wiki.selectedDoc && (
        <TemplateApplyDialog
          isOpen={wiki.showApplyTemplateDialog}
          onClose={() => wiki.setShowApplyTemplateDialog(false)}
          sourceDoc={wiki.selectedDoc}
          renderTemplates={wiki.renderTemplates}
          projects={wiki.projects}
          onSubmit={wiki.handleApplyTemplate}
        />
      )}
    </AppShell>
  );
}
