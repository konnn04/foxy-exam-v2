<?php

namespace App\Support;

use App\Models\Course;
use Illuminate\Support\Facades\DB;

class Roster
{
    /** Students enrolled in the course, optionally filtered by name / username / email. */
    public static function of(Course $course, string $q = ''): array
    {
        $q = trim($q);

        return $course->students()
            ->when($q !== '', fn ($w) => $w->where(fn ($x) => $x
                ->where('users.name', 'like', "%{$q}%")
                ->orWhere('users.username', 'like', "%{$q}%")
                ->orWhere('users.email', 'like', "%{$q}%")))
            ->orderBy('users.name')
            ->limit(5000)
            ->get(['users.id', 'users.name', 'users.username', 'users.email'])
            ->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'username' => $u->username, 'email' => $u->email])
            ->all();
    }

    /** Keep only ids that are really enrolled in the course (the form is not trusted). */
    public static function onlyEnrolled(int $courseId, array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        return DB::table('course_enrollments')->where('course_id', $courseId)->whereIn('user_id', $ids)->pluck('user_id')->all();
    }
}
