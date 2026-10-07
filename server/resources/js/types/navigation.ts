/**
 * Navigation & Sidebar Types
 */

import { LucideIcon } from 'lucide-react';

export type NavTab = 
  | 'overview'
  | 'organizations'
  | 'users'
  | 'courses'
  | 'problem-banks'
  | 'exams'
  | 'reports'
  | 'saas-plans'
  | 'billing'
  | 'settings'
  | 'live';

export interface TeamItem {
  id: number;
  name: string;
  code: string;
  type?: string;
  plan?: string;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface NavMainItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  items?: {
    title: string;
    url: string;
  }[];
}
