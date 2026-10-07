/**
 * User Roles and RBAC Constants
 */

import { UserRole } from '../types/enums';

export const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN' as UserRole,
  ORG_ADMIN: 'ORG_ADMIN' as UserRole,
  TEACHER: 'TEACHER' as UserRole,
  STUDENT: 'STUDENT' as UserRole,
} as const;

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Quản trị Nền tảng (Root)',
  ORG_ADMIN: 'Quản trị Trường (Org Admin)',
  TEACHER: 'Giảng viên',
  STUDENT: 'Thí sinh / Sinh viên',
};

export const ROLE_BADGE_CLASSES: Record<UserRole, string> = {
  SUPER_ADMIN: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  ORG_ADMIN: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  TEACHER: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  STUDENT: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
};
