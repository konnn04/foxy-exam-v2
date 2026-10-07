import * as React from 'react';
import { router, usePage } from '@inertiajs/react';
import {
  BookOpenText,
  Building2,
  ClipboardList,
  Eye,
  EllipsisVertical,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  Library,
  LogOut,
  Package,
  ShieldAlert,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { NavTab, TeamItem } from '@/types/navigation';
import { cn } from '@/lib/utils';
import { initials } from './domain';
import { OrgSwitcher } from './org-switcher';
import type { Capabilities } from '@/hooks/use-tenant';

interface NavItem {
  id: NavTab;
  label: string;
  icon: LucideIcon;
  href: string;
  count?: number;
}

/**
 * Navigation comes from the SERVER's capabilities for the ACTIVE organization, never from the
 * account's role alone: a Root Admin who switched into a school sees exactly what that school's
 * Org Admin sees, and in the ROOT context only the three platform pages exist.
 */
function navFor(can: Capabilities, isPlatform: boolean, pending: number): { label: string; items: NavItem[] }[] {
  if (isPlatform) {
    return [
      {
        label: 'Nền tảng',
        items: [
          { id: 'organizations', label: 'Tổ chức', icon: Building2, href: '/admin/organizations' },
          { id: 'saas-plans', label: 'Gói cước', icon: Package, href: '/admin/saas-plans' },
          { id: 'users', label: 'Tài khoản hệ thống', icon: Users, href: '/admin/users' },
        ],
      },
    ];
  }

  const org: NavItem[] = [{ id: 'overview', label: 'Tổng quan', icon: LayoutDashboard, href: '/admin' }];
  if (can.users) org.push({ id: 'users', label: 'Giảng viên & Sinh viên', icon: Users, href: '/admin/users' });
  org.push({ id: 'courses', label: 'Khóa học', icon: GraduationCap, href: '/admin/courses' });
  if (can.quota) org.push({ id: 'saas-plans', label: 'Quota & Gói cước', icon: Gauge, href: '/admin/saas-plans' });

  const groups = [
    { label: 'Tổ chức', items: org },
    {
      label: 'Kỳ thi',
      items: [
        { id: 'exams' as NavTab, label: 'Kỳ thi', icon: ClipboardList, href: '/admin/exams' },
        { id: 'problem-banks' as NavTab, label: 'Ngân hàng đề', icon: Library, href: '/admin/problem-banks' },
        { id: 'live' as NavTab, label: 'Giám sát kỳ thi', icon: Eye, href: '/admin/live', count: pending },
      ],
    },
  ];
  if (can.orgSettings) groups.push({ label: 'Cấu hình', items: [{ id: 'settings', label: 'Cài đặt tổ chức', icon: SlidersHorizontal, href: '/admin/settings' }] });
  return groups;
}

function roleChip(role: string, isPlatform: boolean, activeCode: string) {
  if (isPlatform) return { text: 'Root Admin', hint: false };
  if (role === 'SUPER_ADMIN') return { text: `Root Admin · đang xem ${activeCode}`, hint: true };
  if (role === 'TEACHER') return { text: 'Giảng viên', hint: false };
  return { text: 'Org Admin', hint: false };
}

export interface FxSidebarUser {
  name: string;
  email?: string;
  role: string;
}

export function FxSidebar({
  user,
  activeTeam,
  can,
  isPlatform,
  currentTab,
  onNavigate,
}: {
  user: FxSidebarUser;
  activeTeam: TeamItem;
  can: Capabilities;
  isPlatform: boolean;
  currentTab?: NavTab;
  onNavigate: (tab: NavTab, href: string) => void;
}) {
  const { props } = usePage<{ navCounts?: { pendingViolations?: number } | null }>();
  const { isMobile } = useSidebar();
  const groups = navFor(can, isPlatform, props.navCounts?.pendingViolations ?? 0);
  const chip = roleChip(user.role, isPlatform, activeTeam.code);

  return (
    <Sidebar collapsible="icon" className="select-none border-r border-sidebar-border">
      <SidebarHeader className="gap-1 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <OrgSwitcher active={activeTeam} canSwitch={can.switchOrganization} isPlatform={isPlatform} />
          </SidebarMenuItem>
        </SidebarMenu>
        <div
          className={cn(
            'mx-2 mb-1 mt-2 flex items-center gap-1.5 truncate rounded-lg px-2 py-1.5 text-xs font-semibold group-data-[collapsible=icon]:hidden',
            chip.hint ? 'bg-warning/12 text-warning-fg' : 'bg-primary/12 text-brand-fg',
          )}
        >
          <span className={cn('size-1.5 shrink-0 rounded-full', chip.hint ? 'bg-warning' : 'bg-primary')} />
          <span className="truncate">{chip.text}</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {groups.map((g) => (
          <SidebarGroup key={g.label} className="py-2">
            <SidebarGroupLabel className="h-8 px-2 text-xs font-medium text-muted-foreground">{g.label}</SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
              {g.items.map((it) => {
                const on = currentTab === it.id;
                return (
                  <SidebarMenuItem key={it.id}>
                    <SidebarMenuButton
                      isActive={on}
                      tooltip={it.label}
                      onClick={() => onNavigate(it.id, it.href)}
                      className={cn('h-8 cursor-pointer gap-2 rounded-md px-2 text-sm', on ? 'bg-sidebar-accent font-medium' : 'font-normal hover:bg-sidebar-accent/60')}
                    >
                      <it.icon className="size-4 shrink-0 opacity-85" />
                      <span className="flex-1 truncate">{it.label}</span>
                      {!!it.count && (
                        <span className="rounded-full bg-danger/20 px-1.5 py-px text-[11px] font-semibold text-danger-fg group-data-[collapsible=icon]:hidden">{it.count}</span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="mt-1 border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="gap-2 rounded-lg p-2 data-[state=open]:bg-sidebar-accent">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold">{initials(user.name)}</div>
                  <div className="grid min-w-0 flex-1 leading-[1.3] group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-[13px] font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </div>
                  <EllipsisVertical className="size-4 opacity-60 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-56 rounded-lg" side={isMobile ? 'bottom' : 'right'} align="end" sideOffset={4}>
                <DropdownMenuLabel className="font-normal">
                  <div className="text-sm font-medium">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => window.open('/docs/api', '_blank')}>
                  <BookOpenText className="size-4" /> Tài liệu API
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer gap-2 text-danger-fg" onClick={() => router.post('/logout')}>
                  <LogOut className="size-4" /> Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
