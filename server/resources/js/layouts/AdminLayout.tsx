import React from 'react';
import { Head, router } from '@inertiajs/react';
import { ArrowLeft, Bell, ChevronRight, Search } from 'lucide-react';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { type TeamItem } from '@/components/team-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { FxSidebar } from '@/components/foxy/fx-sidebar';
import { initials } from '@/components/foxy/domain';
import { useTenant } from '@/hooks/use-tenant';
import type { NavTab } from '@/types/navigation';

interface AdminLayoutProps {
  user?: {
    id: number;
    name: string;
    username: string;
    email?: string;
    role: string;
    organization?: { id: number; name: string; code: string; type?: string; plan?: string };
  };
  /** Accepted for backwards compatibility; the switcher searches organizations on the server. */
  teams?: TeamItem[];
  activeTeam?: TeamItem;
  currentTab?: NavTab;
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
  backUrl?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export default function AdminLayout({ user, currentTab = 'overview', title, breadcrumbs = [], backUrl, children }: AdminLayoutProps) {
  // The active organization and what this user may do in it come from the server (shared Inertia props)
  const { current, isPlatform, can, isSuperAdmin } = useTenant();

  const displayUser = {
    name: user?.name ?? 'Admin',
    email: user?.email || 'admin@foxyexam.com',
    role: user?.role ?? (isSuperAdmin ? 'SUPER_ADMIN' : 'ORG_ADMIN'),
  };

  const goHome = () => router.visit(isPlatform ? '/admin/organizations' : '/admin');
  const crumbRoot = isPlatform ? 'Nền tảng' : current.code;
  const trail = breadcrumbs.length > 0 ? breadcrumbs : [{ label: title }];

  return (
    <SidebarProvider>
      <Head title={`${title} | Foxy Exam`} />

      <FxSidebar
        user={displayUser}
        activeTeam={current}
        can={can}
        isPlatform={isPlatform}
        currentTab={currentTab}
        onNavigate={(_tab, href) => router.visit(href)}
      />

      <SidebarInset className="flex min-h-svh min-w-0 flex-col bg-background text-sm">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/72 px-4 backdrop-blur-[14px]">
          <SidebarTrigger className="-ml-1 size-7" />
          <div className="mr-2 h-4 w-px bg-border" />
          {backUrl && (
            <button
              type="button"
              title="Quay lại"
              onClick={() => router.visit(backUrl)}
              className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
            </button>
          )}
          <nav className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground">
            <button type="button" className="hidden cursor-pointer whitespace-nowrap hover:text-foreground sm:inline" onClick={goHome}>
              {crumbRoot}
            </button>
            {trail.map((b, i) => {
              const last = i === trail.length - 1;
              return (
                <React.Fragment key={`${b.label}-${i}`}>
                  <ChevronRight className="hidden size-3.5 shrink-0 opacity-50 sm:block" />
                  {b.href && !last ? (
                    <button type="button" className="cursor-pointer truncate hover:text-foreground" onClick={() => router.visit(b.href!)}>
                      {b.label}
                    </button>
                  ) : (
                    <span className={last ? 'truncate text-foreground' : 'truncate'}>{b.label}</span>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
          {can.academic && (
            <>
              <div className="hidden h-9 w-60 items-center gap-2 rounded-lg border border-border bg-sidebar/60 px-2.5 text-[13px] text-muted-foreground lg:flex">
                <Search className="size-3.5 opacity-60" />
                <span className="min-w-0 flex-1 truncate">Tìm kỳ thi, thí sinh, bài toán…</span>
                <kbd className="rounded border border-border px-[5px] py-px font-mono text-[11px]">⌘K</kbd>
              </div>
              <button
                type="button"
                title="Vi phạm chờ duyệt"
                onClick={() => router.visit('/admin/live')}
                className="relative flex size-9 cursor-pointer items-center justify-center rounded-lg hover:bg-muted"
              >
                <Bell className="size-4" />
                <span className="absolute right-[9px] top-2 size-[7px] rounded-full border-2 border-background bg-danger" />
              </button>
            </>
          )}
          <ThemeToggle className="size-9 rounded-lg" />
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{initials(displayUser.name)}</div>
        </header>

        <main className="flex flex-1 flex-col p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-5 rounded-xl bg-muted/50 p-5">{children}</div>
        </main>
        <footer className="border-t border-border p-4 text-center text-[13px] text-muted-foreground">© {new Date().getFullYear()} Foxy Exam. All rights reserved.</footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
