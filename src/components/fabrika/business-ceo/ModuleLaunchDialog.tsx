'use client';

import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { BusinessCeoModuleDefinition } from '@/lib/business-ceo-dashboard';

import { ModuleVisual } from './ModuleVisual';
import styles from './BusinessCeoDashboard.module.css';

export function ModuleLaunchDialog({
  module,
  onOpenChange,
}: {
  module: BusinessCeoModuleDefinition | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(module)} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialogContent} showCloseButton={false}>
        {module ? (
          <>
            <DialogHeader className={styles.dialogHeader}>
              <DialogTitle className={styles.dialogTitle}>{module.title}</DialogTitle>
              <DialogDescription className={styles.dialogDescription}>
                {module.description}
              </DialogDescription>
              <DialogClose className={styles.dialogClose} aria-label="Pencereyi kapat">
                <X aria-hidden="true" />
              </DialogClose>
            </DialogHeader>
            <div className={styles.dialogBody}>
              <div
                className={styles.moduleDialogVisual}
                data-accent={module.accent}
              >
                <ModuleVisual moduleKey={module.key} />
              </div>
              <p className={styles.moduleDialogHint}>
                Bu modül mevcut şirket kayıtlarınızı kullanır. Açıldığında kaldığınız
                yerden devam edebilirsiniz.
              </p>
            </div>
            <div className={styles.dialogFooter}>
              <DialogClose className={styles.dialogCloseSecondary}>Vazgeç</DialogClose>
              <Link className={styles.dialogAction} href={module.href}>
                {module.actionLabel}
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
