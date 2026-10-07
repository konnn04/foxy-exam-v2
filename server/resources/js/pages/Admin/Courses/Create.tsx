import React from 'react';
import { type TeamItem } from '@/components/team-switcher';
import { CourseForm } from '@/components/foxy/entity-forms';

interface Props {
  user: any;
  teams: TeamItem[];
  teachers: { id: number; name: string }[];
  organizations?: { id: number; name: string; code: string }[];
}

export default function CreateCourse({ user, teams, teachers, organizations }: Props) {
  return <CourseForm user={user} teams={teams} teachers={teachers} organizations={organizations} course={null} />;
}
