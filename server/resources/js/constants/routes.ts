/**
 * Named Routes & Endpoints
 * Eliminates magic route strings throughout web pages
 */

export const ADMIN_ROUTES = {
  DASHBOARD: '/admin',
  ORGANIZATIONS: {
    NEW: '/admin/organizations/new',
    EDIT: (id: number | string) => `/admin/organizations/${id}/edit`,
    UPDATE: (id: number | string) => `/admin/organizations/${id}/update`,
    DELETE: (id: number | string) => `/admin/organizations/${id}/delete`,
  },
  USERS: {
    NEW: '/admin/users/new',
    EDIT: (id: number | string) => `/admin/users/${id}/edit`,
    UPDATE: (id: number | string) => `/admin/users/${id}/update`,
    DELETE: (id: number | string) => `/admin/users/${id}/delete`,
  },
  COURSES: {
    NEW: '/admin/courses/new',
    SHOW: (id: number | string) => `/admin/courses/${id}`,
    EDIT: (id: number | string) => `/admin/courses/${id}/edit`,
    UPDATE: (id: number | string) => `/admin/courses/${id}/update`,
    DELETE: (id: number | string) => `/admin/courses/${id}/delete`,
  },
  EXAMS: {
    NEW: (courseId?: number) => courseId ? `/admin/exams/new?course_id=${courseId}` : '/admin/exams/new',
    SHOW: (id: number | string) => `/admin/exams/${id}`,
    EDIT: (id: number | string) => `/admin/exams/${id}/edit`,
    UPDATE: (id: number | string) => `/admin/exams/${id}/update`,
    DELETE: (id: number | string) => `/admin/exams/${id}/delete`,
  },
  PROBLEMS: {
    NEW: (examId?: number) => examId ? `/admin/problems/new?exam_id=${examId}` : '/admin/problems/new',
    EDIT: (id: number | string) => `/admin/problems/${id}/edit`,
    UPDATE: (id: number | string) => `/admin/problems/${id}/update`,
    DELETE: (id: number | string) => `/admin/problems/${id}/delete`,
  },
} as const;

export const API_ENDPOINTS = {
  STUDENT: {
    LOGIN: '/api/v1/student/login',
    PAPER: '/api/v1/student/paper',
    HEARTBEAT: '/api/v1/student/heartbeat',
    OP_LOG: '/api/v1/student/op-log',
    VIOLATION: '/api/v1/student/violation',
    SUBMIT: '/api/v1/student/submit',
    FINISH: '/api/v1/student/finish',
  },
  ADMIN: {
    QUOTA: '/api/v1/admin/quota',
    EXAMS: '/api/v1/admin/exams',
    VIOLATIONS: (examId: number | string) => `/api/v1/admin/exams/${examId}/violations`,
  },
} as const;
