import React from 'react';
import { type TeamItem } from '@/components/team-switcher';
import { OrganizationForm } from '@/components/foxy/entity-forms';

export default function CreateOrganization({ user, teams, plans }: { user: any; teams: TeamItem[]; plans: any[] }) {
  return <OrganizationForm user={user} teams={teams} plans={plans} organization={null} />;
}
