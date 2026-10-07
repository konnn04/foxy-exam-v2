import React from 'react';
import { type TeamItem } from '@/components/team-switcher';
import { UserForm } from '@/components/foxy/entity-forms';

interface Props {
  user: any;
  teams: TeamItem[];
  currentScopeOrg?: { id: number; name: string; code: string };
  isRootContext?: boolean;
  organizations: { id: number; name: string; code: string }[];
}

export default function CreateUser(props: Props) {
  return <UserForm {...props} target={null} />;
}
