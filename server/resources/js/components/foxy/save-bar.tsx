import { router } from '@inertiajs/react';
import { Loader2, Save, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDialog } from '@/components/foxy/dialogs';
import { cn } from '@/lib/utils';

/** Has `value` changed since the page loaded (or since the last successful save)? */
export function useDirty<T>(value: T) {
  const snapshot = useRef(JSON.stringify(value));
  const current = JSON.stringify(value);
  const [, bump] = useState(0);
  return {
    dirty: current !== snapshot.current,
    /** call after a successful save: the current value becomes the new baseline */
    markSaved: useCallback(() => {
      snapshot.current = JSON.stringify(value);
      bump((n) => n + 1);
    }, [value]),
  };
}

/**
 * Leaving a page with unsaved changes asks first: browser navigation (reload / close tab) and Inertia visits.
 * `paused` lets a save that redirects deliberately go through.
 */
export function useUnsavedGuard(dirty: boolean, paused = false) {
  const dialog = useDialog();
  const skip = useRef(false);

  useEffect(() => {
    if (!dirty) return;
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', before);
    return () => window.removeEventListener('beforeunload', before);
  }, [dirty]);

  useEffect(() => {
    if (!dirty || paused) return;
    return router.on('before', (event) => {
      const visit = event.detail.visit;
      // only real navigations away: saves are POSTs, partial reloads keep the page
      if (skip.current || visit.method !== 'get' || (visit.only?.length ?? 0) > 0 || visit.prefetch) return;
      event.preventDefault();
      void dialog
        .confirm({ title: 'Có thay đổi chưa lưu', text: 'Rời trang này thì các thay đổi chưa lưu sẽ mất.', confirmLabel: 'Rời đi', cancelLabel: 'Ở lại', tone: 'warning' })
        .then((leave) => {
          if (!leave) return;
          skip.current = true;
          router.visit(visit.url.href, { method: 'get', preserveScroll: visit.preserveScroll, preserveState: visit.preserveState, replace: visit.replace });
        });
    });
  }, [dirty, paused, dialog]);
}

/** Floating bar at the bottom: appears only while there is something to save. */
export function SaveBar({ visible, processing, onSave, onCancel, saveLabel = 'Lưu thay đổi' }: { visible: boolean; processing?: boolean; onSave: () => void; onCancel: () => void; saveLabel?: string }) {
  return (
    <div className={cn('pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 transition-all duration-200', visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0')} aria-hidden={!visible}>
      <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 shadow-lg">
        <span className="text-[13px] text-muted-foreground">Bạn có thay đổi chưa lưu</span>
        <button type="button" disabled={processing || !visible} onClick={onCancel} className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-medium hover:bg-surface disabled:opacity-50">
          <Undo2 className="size-3.5" /> Hủy
        </button>
        <button type="button" disabled={processing || !visible} onClick={onSave} className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60">
          {processing ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} {saveLabel}
        </button>
      </div>
    </div>
  );
}

/** Drops local edits by loading the page again. */
export const discardChanges = () => router.visit(window.location.pathname + window.location.search, { preserveState: false, preserveScroll: true, replace: true });
