import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore, useUIStore } from '@/domains';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button, Input } from '@/shared/ui';
import { Loader2, Folder, Globe, Users, Lock } from 'lucide-react';
import clsx from 'clsx';

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateProjectDialog({ open, onOpenChange, onSuccess }: CreateProjectDialogProps) {
  const { t } = useTranslation();
  // 精确 selector 订阅
  const createProject = useProjectStore((s) => s.createProject);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const expandProject = useUIStore((s) => s.expandProject);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'team' | 'public'>('private');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const project = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
      });

      if (project) {
        setCurrentProject(project.id);
        expandProject(project.id);
        onOpenChange(false);
        setName('');
        setDescription('');
        setVisibility('private');
        onSuccess?.();
      } else {
        setError(t('common.error'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const VisibilityOption = ({ 
    value, 
    icon: Icon, 
    label, 
    desc 
  }: { 
    value: 'private' | 'team' | 'public'; 
    icon: any; 
    label: string; 
    desc: string 
  }) => (
    <div 
      onClick={() => setVisibility(value)}
      className={clsx(
        "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
        visibility === value 
          ? "border-primary-500 bg-primary-50/50 dark:bg-primary-900/10 ring-1 ring-primary-500" 
          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
      )}
    >
      <div className={clsx(
        "p-2 rounded-md",
        visibility === value ? "bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
      )}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="text-sm font-medium mb-0.5">{label}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{desc}</div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('projects.newProject')}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('projects.name')}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('projects.namePlaceholder')}
              autoFocus
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('projects.description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('projects.descPlaceholder')}
              className="w-full px-3 py-2 rounded-lg border border-input bg-transparent text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px] resize-none"
            />
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium mb-2.5">{t('projects.visibility')}</label>
            <div className="space-y-2">
              <VisibilityOption 
                value="private" 
                icon={Lock} 
                label={t('projects.visPrivate')} 
                desc={t('projects.visPrivateDesc')} 
              />
              <VisibilityOption 
                value="team" 
                icon={Users} 
                label={t('projects.visTeam')} 
                desc={t('projects.visTeamDesc')} 
              />
              <VisibilityOption 
                value="public" 
                icon={Globe} 
                label={t('projects.visPublic')} 
                desc={t('projects.visPublicDesc')} 
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('common.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
