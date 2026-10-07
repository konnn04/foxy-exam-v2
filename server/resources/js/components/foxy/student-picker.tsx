import { useEffect, useMemo, useState } from 'react';
import { FxButton, FxInput } from '@/components/foxy/ui';
import { useMore } from '@/hooks/use-more';
import { cn } from '@/lib/utils';

interface Student {
  id: number;
  name: string;
  username: string;
  email: string | null;
}

/**
 * Roster of the exam's course with a tick per student. Everyone is ticked by default;
 * unticked students are stored as excluded and cannot see or start the exam.
 */
export function StudentPicker({
  courseId,
  excluded,
  onChange,
}: {
  courseId: number;
  excluded: number[];
  onChange: (ids: number[]) => void;
}) {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let live = true;
    setStudents(null);
    if (!courseId) return;
    fetch(`/admin/courses/${courseId}/roster`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => live && setStudents(rows))
      .catch(() => live && setStudents([]));
    return () => {
      live = false;
    };
  }, [courseId]);

  const skip = useMemo(() => new Set(excluded), [excluded]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (students ?? []).filter((s) => !needle || `${s.name} ${s.username} ${s.email ?? ''}`.toLowerCase().includes(needle));
  }, [students, q]);
  const more = useMore(filtered.length, 50, [q, students]);

  const total = students?.length ?? 0;
  const allowed = total - (students ?? []).filter((s) => skip.has(s.id)).length;

  const setMany = (ids: number[], allow: boolean) => {
    const next = new Set(excluded);
    ids.forEach((id) => (allow ? next.delete(id) : next.add(id)));
    onChange([...next]);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[160px] flex-1">
          <FxInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên / MSSV" />
        </div>
        <FxButton onClick={() => setMany(filtered.map((s) => s.id), true)}>Chọn tất cả</FxButton>
        <FxButton onClick={() => setMany(filtered.map((s) => s.id), false)}>Bỏ chọn</FxButton>
      </div>
      <div className="text-xs text-muted-foreground">
        {students === null ? 'Đang tải danh sách…' : `${allowed}/${total} thí sinh được dự thi${total - allowed > 0 ? ` · ${total - allowed} bị cấm thi` : ''}`}
      </div>
      <div className="max-h-[420px] overflow-y-auto rounded-[10px] border border-border">
        {students !== null && filtered.length === 0 && <div className="px-3 py-6 text-center text-xs text-muted-foreground">Không có thí sinh phù hợp.</div>}
        {filtered.slice(0, more.count).map((s) => {
          const on = !skip.has(s.id);
          return (
            <label key={s.id} className={cn('flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 hover:bg-surface', !on && 'opacity-60')}>
              <input type="checkbox" checked={on} onChange={() => setMany([s.id], !on)} className="size-3.5 accent-[var(--primary)]" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{s.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{s.username}</span>
            </label>
          );
        })}
        {more.hasMore && <div ref={more.sentinel} className="py-3 text-center text-xs text-muted-foreground">Đang tải thêm…</div>}
      </div>
    </div>
  );
}
