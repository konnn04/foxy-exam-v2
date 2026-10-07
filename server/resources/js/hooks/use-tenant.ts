import { usePage, router } from '@inertiajs/react';
import type { TeamItem } from '@/types/navigation';

export interface TenantCurrent {
  id: number;
  name: string;
  code: string;
  type?: string;
  status?: string;
  plan?: string;
}

/** What the signed-in user may do in the ACTIVE organization (decided by the server). */
export interface Capabilities {
  organizations: boolean;
  managePlans: boolean;
  billing: boolean;
  users: boolean;
  academic: boolean;
  quota: boolean;
  orgSettings: boolean;
  switchOrganization: boolean;
}

export interface TenantData {
  current: TenantCurrent;
  is_root: boolean;
  /** Super Admin currently working AS the platform (ROOT org). */
  is_platform: boolean;
  can: Capabilities;
  teams: TeamItem[];
}

const NO_CAPS: Capabilities = {
  organizations: false,
  managePlans: false,
  billing: false,
  users: false,
  academic: false,
  quota: false,
  orgSettings: false,
  switchOrganization: false,
};

export interface SharedUser {
  id: number;
  name: string;
  username: string;
  email?: string;
  role: string;
  avatar?: string;
  organization?: {
    id: number;
    name: string;
    code: string;
    type?: string;
    plan?: string;
  } | null;
}

export interface PageSharedProps {
  auth?: {
    user: SharedUser | null;
  };
  tenant?: TenantData | null;
  [key: string]: any;
}

export function useTenant() {
  const { props } = usePage<PageSharedProps>();
  const tenant = props.tenant;
  const user = props.auth?.user;

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  
  // Single source of truth for active tenant from server
  const currentTenant: TeamItem = tenant?.current ? {
    id: tenant.current.id,
    name: tenant.current.name,
    code: tenant.current.code,
    type: tenant.current.type,
    plan: tenant.current.plan || 'FREE',
  } : (user?.organization ? {
    id: user.organization.id,
    name: user.organization.name,
    code: user.organization.code,
    type: user.organization.type,
    plan: user.organization.plan || 'FREE',
  } : {
    id: 1,
    name: 'Root Platform',
    code: 'ROOT',
    type: 'SYSTEM',
    plan: 'ENTERPRISE',
  });

  const isRoot = tenant?.is_root ?? false;
  const isPlatform = tenant?.is_platform ?? false;
  const can = tenant?.can ?? NO_CAPS;

  const teams: TeamItem[] = [currentTenant];

  /**
   * Safely switch organization context.
   * Sends POST /admin/switch-organization which updates the Laravel session,
   * sets the secure cookie, and safely updates the URL without losing context.
   */
  const switchOrganization = (orgId: number, redirectTo?: string) => {
    if (!isSuperAdmin) {
      return;
    }

    router.post('/admin/switch-organization', {
      org_id: orgId,
      redirect_to: redirectTo || window.location.pathname,
    }, {
      preserveScroll: true,
      preserveState: false,
    });
  };

  return {
    tenant,
    current: currentTenant,
    isRoot,
    isPlatform,
    can,
    isSuperAdmin,
    teams,
    switchOrganization,
  };
}
