import * as React from 'react';
import { router } from '@inertiajs/react';
import { Check, ChevronsUpDown, Loader2, Search, ShieldCheck } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import { Pill } from './ui';
import { PLAN_TONE } from './domain';
import { cn } from '@/lib/utils';
import type { TeamItem } from '@/types/navigation';

interface OrgOption extends TeamItem {
  status?: string;
}

interface SearchResult {
  data: OrgOption[];
  has_more: boolean;
  root: OrgOption;
}

/** Brand block. For a Super Admin it opens a searchable switcher (server-side search: there may be thousands of schools). */
export function OrgSwitcher({ active, canSwitch, isPlatform }: { active: TeamItem; canSwitch: boolean; isPlatform: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [items, setItems] = React.useState<OrgOption[]>([]);
  const [root, setRoot] = React.useState<OrgOption | null>(null);
  const [page, setPage] = React.useState(1);
  const [more, setMore] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [hi, setHi] = React.useState(0);
  const reqId = React.useRef(0);

  const subtitle = isPlatform ? 'Foxy Platform · Toàn hệ thống' : active.name;

  const load = React.useCallback(async (query: string, pg: number) => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const res = await fetch(`/admin/switcher/organizations?q=${encodeURIComponent(query)}&page=${pg}`, {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(String(res.status));
      const json: SearchResult = await res.json();
      if (id !== reqId.current) return; // a newer query superseded this one
      setRoot(json.root);
      setMore(json.has_more);
      setItems((prev) => (pg === 1 ? json.data : [...prev, ...json.data]));
    } catch {
      if (id === reqId.current) setItems([]);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  // open -> load first page; typing -> debounce
  React.useEffect(() => {
    if (!open) return;
    setPage(1);
    const t = setTimeout(() => load(q.trim(), 1), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [open, q, load]);

  React.useEffect(() => {
    if (!open) {
      setQ('');
      setHi(0);
    }
  }, [open]);

  const showRoot = !!root && (!q.trim() || /root|foxy|platform|nền tảng|quản trị/i.test(q));
  const options: OrgOption[] = [...(showRoot && root ? [root] : []), ...items];

  const choose = (o: OrgOption) => {
    setOpen(false);
    if (o.id === active.id) return;
    router.post('/admin/switch-organization', { org_id: o.id, redirect_to: window.location.pathname });
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHi((h) => Math.min(options.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter' && options[hi]) {
      e.preventDefault();
      choose(options[hi]);
    }
  };

  const brand = (
    <SidebarMenuButton size="lg" className={cn('gap-2 rounded-lg p-2 data-[state=open]:bg-sidebar-accent', !canSwitch && 'cursor-default')}>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white">
        <img src="/logo.png" alt="Foxy Exam" className="size-6 object-contain" />
      </div>
      <div className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
        <span className="text-sm font-semibold uppercase tracking-[0.02em]">Foxy Exam</span>
        <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
      </div>
      {canSwitch && <ChevronsUpDown className="size-4 opacity-60 group-data-[collapsible=icon]:hidden" />}
    </SidebarMenuButton>
  );

  if (!canSwitch) return brand;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{brand}</PopoverTrigger>
      <PopoverContent align="start" side="right" sideOffset={8} className="w-[340px] p-0" onKeyDown={onKey}>
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Search className="size-4 shrink-0 opacity-60" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setHi(0);
            }}
            placeholder="Tìm tổ chức theo tên hoặc mã…"
            className="h-6 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {loading && <Loader2 className="size-3.5 shrink-0 animate-spin opacity-60" />}
        </div>

        <div className="max-h-[360px] overflow-y-auto p-1.5">
          {showRoot && root && (
            <>
              <Row o={root} active={active.id === root.id} hi={hi === 0} onPick={choose} onHover={() => setHi(0)} root />
              {items.length > 0 && <div className="px-2 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tổ chức đối tác</div>}
            </>
          )}
          {items.map((o, i) => {
            const idx = i + (showRoot && root ? 1 : 0);
            return <Row key={o.id} o={o} active={active.id === o.id} hi={hi === idx} onPick={choose} onHover={() => setHi(idx)} />;
          })}
          {!loading && options.length === 0 && <div className="px-3 py-8 text-center text-[13px] text-muted-foreground">Không tìm thấy tổ chức nào.</div>}
          {more && (
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                const n = page + 1;
                setPage(n);
                load(q.trim(), n);
              }}
              className="mt-1 w-full cursor-pointer rounded-md py-2 text-center text-[13px] font-medium text-brand-fg hover:bg-muted disabled:opacity-50"
            >
              Tải thêm
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Row({ o, active, hi, onPick, onHover, root }: { o: OrgOption; active: boolean; hi: boolean; onPick: (o: OrgOption) => void; onHover: () => void; root?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onPick(o)}
      onMouseEnter={onHover}
      className={cn('flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-left', hi && 'bg-muted')}
    >
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg font-mono text-[10px] font-bold', root ? 'bg-primary/20 text-brand-fg' : 'bg-muted')}>
        {root ? <ShieldCheck className="size-4" /> : o.code.slice(0, 4)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{root ? 'Root Admin' : o.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{root ? 'Quản trị nền tảng · tổ chức, gói cước, tài khoản' : o.code}</span>
      </span>
      {!root && o.plan && (
        <Pill size="sm" tone={PLAN_TONE[o.plan.toUpperCase()] ?? 'neutral'}>
          {o.plan}
        </Pill>
      )}
      {o.status && o.status !== 'ACTIVE' && !root && (
        <Pill size="sm" tone="danger">
          {o.status === 'SUSPENDED' ? 'Khóa' : 'Hết hạn'}
        </Pill>
      )}
      {active && <Check className="size-4 shrink-0 text-primary" />}
    </button>
  );
}
