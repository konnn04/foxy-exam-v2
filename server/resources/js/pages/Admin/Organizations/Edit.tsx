import React from 'react';
import { type TeamItem } from '@/components/team-switcher';
import { OrganizationForm, type OrgFormData } from '@/components/foxy/entity-forms';

export default function EditOrganization({ user, teams, plans, organization }: { user: any; teams: TeamItem[]; plans: any[]; organization: OrgFormData }) {
  return <OrganizationForm user={user} teams={teams} plans={plans} organization={organization} />;
}
