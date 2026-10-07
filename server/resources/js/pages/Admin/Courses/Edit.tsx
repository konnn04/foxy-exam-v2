import React from 'react';
import { type TeamItem } from '@/components/team-switcher';
import { CourseForm, type CourseFormData } from '@/components/foxy/entity-forms';

interface Props {
  user: any;
  teams: TeamItem[];
  course: CourseFormData;
  teachers: { id: number; name: string }[];
}

export default function EditCourse({ user, teams, course, teachers }: Props) {
  return <CourseForm user={user} teams={teams} teachers={teachers} course={course} />;
}
