import React from 'react';
import AdminLayout from '@/layouts/AdminLayout';
import { DashboardOverview, type OverviewData } from '@/components/foxy/dashboard-overview';
import { OrganizationsTab, UsersTab, CoursesTab, ExamsTab, QuestionSetsTab, SaasPlansTab, SettingsTab, type QuestionSetRow } from '@/components/admin/tabs';
import type { ListMeta } from '@/components/admin/tabs/organizations-tab';
import { useTenant } from '@/hooks/use-tenant';
import type { UserItem, OrganizationItem, CourseItem, ExamItem, PlanItem, InvoiceItem } from '@/types/admin';
import type { NavTab } from '@/types/navigation';

interface Props {
  user: {
    id: number;
    name: string;
    username: string;
    email: string;
    role: string;
    organization: { id: number; name: string; code: string; type?: string; plan?: string };
  };
  selectedOrgId?: number;
  isSuperAdmin: boolean;
  currentSection: NavTab;
  organization?: { id: number; name: string; code: string; type?: string; status?: string; is_public?: boolean };
  organizations?: OrganizationItem[];
  plans?: PlanItem[];
  listMeta?: ListMeta;
  myOrgQuota?: { plan_name: string; exams_used: number; exams_limit: number; students_limit: number; has_ai: boolean; has_code_replay?: boolean };
  usersList?: UserItem[];
  courses?: CourseItem[];
  exams?: ExamItem[];
  setCounts?: { CLASSICAL: number; PROGRAMMING: number };
  questionSets?: QuestionSetRow[];
  invoices?: InvoiceItem[];
  overview?: OverviewData | null;
}

const EMPTY_META: ListMeta = { total: 0, page: 1, last_page: 1, per_page: 10, filters: {} };

const TITLE: Partial<Record<NavTab, string>> = {
  overview: 'Tổng quan',
  organizations: 'Tổ chức',
  users: 'Người dùng',
  courses: 'Khóa học',
  'problem-banks': 'Ngân hàng đề',
  exams: 'Kỳ thi',
  'saas-plans': 'Gói cước',
  settings: 'Cài đặt',
};

/**
 * Every list section of the portal. Which sections are reachable is decided by the server for the
 * ACTIVE organization (capabilities); this page only renders the section the server loaded.
 */
export default function AdminDashboard({
  user,
  currentSection,
  organization,
  organizations = [],
  plans = [],
  listMeta = EMPTY_META,
  myOrgQuota,
  usersList = [],
  courses = [],
  exams = [],
  setCounts,
  questionSets = [],
  invoices = [],
  overview,
  isSuperAdmin,
}: Props) {
  const { current, isPlatform, can } = useTenant();
  const section = currentSection;

  return (
    <AdminLayout user={user} currentTab={section} title={TITLE[section] ?? 'Tổng quan'}>
      {section === 'overview' && overview && <DashboardOverview overview={overview} quota={myOrgQuota} orgName={current.name} userName={user.name} />}

      {section === 'organizations' && can.organizations && <OrganizationsTab organizations={organizations} plans={plans} listMeta={listMeta} />}

      {section === 'users' && can.users && (
        <UsersTab
          users={usersList}
          listMeta={listMeta}
          currentUserId={user.id}
          isSuperAdmin={isSuperAdmin}
          activeTeamName={current.name}
          activeTeam={current}
          isRootContext={isPlatform}
        />
      )}

      {section === 'courses' && can.academic && <CoursesTab courses={courses} />}

      {section === 'problem-banks' && can.academic && <QuestionSetsTab questionSets={questionSets} courses={courses} />}

      {section === 'exams' && can.academic && <ExamsTab exams={exams} setCounts={setCounts} />}


      {section === 'saas-plans' && (
        <SaasPlansTab plans={plans} canManage={can.managePlans} myOrgQuota={myOrgQuota} currentOrgPlan={current.plan} invoices={invoices} isSuperAdmin={isSuperAdmin} />
      )}

      {section === 'settings' && can.orgSettings && <SettingsTab organization={organization ?? current} />}
    </AdminLayout>
  );
}
