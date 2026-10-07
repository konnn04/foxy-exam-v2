import React from 'react';
import { type TeamItem } from '@/components/team-switcher';
import { UserForm, type UserFormData } from '@/components/foxy/entity-forms';

interface Props {
  user: any;
  teams: TeamItem[];
  currentScopeOrg?: { id: number; name: string; code: string };
  isRootContext?: boolean;
  targetUser: UserFormData;
  organizations: { id: number; name: string; code: string }[];
}

export default function EditUser({ targetUser, ...props }: Props) {
  return <UserForm {...props} target={targetUser} />;
}
