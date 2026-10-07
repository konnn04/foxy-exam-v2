<?php

namespace Database\Seeders;

use App\Models\ClassicalQuestion;
use App\Models\ClassicalQuestionAnswer;
use App\Models\Course;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Organization;
use App\Models\ProgrammingProblem;
use App\Models\QuestionSet;
use App\Models\Submission;
use App\Models\TestCase;
use App\Models\User;
use App\Models\Violation;
use Database\Seeders\Support\SchoolData;
use Illuminate\Support\Facades\Hash;

/**
 * Fills ONE organization with a realistic classroom: lecturers, students, courses, four question
 * banks (2 phổ thông + 2 lập trình), one exam per bank in a different lifecycle stage, plus
 * attempts / violations so the proctoring dashboards are not empty after a reset.
 */
class SchoolSeeder
{
    private string $teacherHash;
    private string $studentHash;

    private int $seed = 1;

    public function __construct()
    {
        // bcrypt once per password — hashing 150 users separately would take ~10s
        $this->teacherHash = Hash::make('teacher123');
        $this->studentHash = Hash::make('student123');
    }

    /** Deterministic pseudo-random so a re-seed yields the same data. */
    private function pick(array $list, int $i): mixed
    {
        return $list[($i * 7 + $this->seed) % count($list)];
    }

    /**
     * @param array{teachers: Collection|array, students: Collection|array}|null $people existing staff to reuse
     */
    public function people(Organization $org, string $code, string $domain, int $teachers, int $students, int $mssvBase, array $keep = []): array
    {
        $n = SchoolData::names();
        $this->seed = crc32($code) % 11;
        $mk = function (string $username, string $role, int $i, string $email, string $hash) use ($org, $n) {
            $last = $this->pick($n['last'], $i);
            $mid = $this->pick($n['middle'], $i + 3);
            $first = $this->pick($n['first'], $i + 5);

            return User::create([
                'organization_id' => $org->id,
                'username' => $username,
                'name' => "$last $mid $first",
                'first_name' => $first,
                'middle_name' => $mid,
                'last_name' => $last,
                'email' => $email,
                'password' => $hash,
                'role' => $role,
                'status' => 'ACTIVE',
                'date_of_birth' => $role === 'STUDENT' ? (2002 + $i % 3) . '-0' . (1 + $i % 9) . '-1' . ($i % 9) : (1978 + $i % 14) . '-0' . (1 + $i % 9) . '-2' . ($i % 8),
                'avatar' => 'https://api.dicebear.com/7.x/bottts/svg?seed=' . $username,
            ]);
        };

        $tea = collect($keep['teachers'] ?? []);
        for ($i = $tea->count() + 1; $i <= $teachers; $i++) {
            $u = sprintf('gv_%s_%02d', strtolower($code), $i);
            $tea->push($mk($u, 'TEACHER', $i, "$u@$domain", $this->teacherHash));
        }
        $stu = collect($keep['students'] ?? []);
        for ($i = $stu->count() + 1; $i <= $students; $i++) {
            $u = (string) ($mssvBase + $i);
            $stu->push($mk($u, 'STUDENT', $i + 40, "$u@student.$domain", $this->studentHash));
        }

        return ['teachers' => $tea, 'students' => $stu];
    }

    /** Three courses; each student studies two of them. */
    public function courses(Organization $org, string $code, $teachers, $students, array $defs): array
    {
        $courses = [];
        foreach ($defs as $i => [$ccode, $name, $desc]) {
            $courses[] = Course::create([
                'organization_id' => $org->id,
                'code' => $ccode,
                'name' => $name,
                'description' => $desc,
                'teacher_id' => $teachers[$i % $teachers->count()]->id,
            ]);
        }
        foreach ($students->values() as $i => $s) {
            $s->enrolledCourses()->syncWithoutDetaching([
                $courses[$i % count($courses)]->id,
                $courses[($i + 1) % count($courses)]->id,
            ]);
        }

        return $courses;
    }

    public function classicalSet(Organization $org, Course $course, User $by, string $code, string $name, string $bank, string $desc): QuestionSet
    {
        $set = QuestionSet::create([
            'organization_id' => $org->id, 'course_id' => $course->id, 'name' => $name, 'code' => $code,
            'type' => 'CLASSICAL', 'description' => $desc, 'status' => 'PUBLISHED', 'max_score' => 10.0, 'created_by' => $by->id,
        ]);
        foreach (SchoolData::classical($bank) as $i => $spec) {
            $this->question($set, $spec, $i + 1, null, $by);
        }

        return $set;
    }

    private function question(QuestionSet $set, array $spec, int $order, ?int $parentId, User $by): void
    {
        $q = ClassicalQuestion::create([
            'question_set_id' => $set->id,
            'parent_id' => $parentId,
            'type' => $spec['type'],
            'content' => $spec['content'],
            'explanation' => $spec['explanation'] ?? null,
            'points' => $spec['points'],
            'difficulty' => $spec['difficulty'],
            'is_true' => $spec['is_true'] ?? null,
            'settings' => $spec['settings'] ?? null,
            'order' => $order,
            'created_by' => $by->id,
        ]);
        foreach ($spec['answers'] ?? [] as $i => [$text, $ok]) {
            ClassicalQuestionAnswer::create(['classical_question_id' => $q->id, 'content' => $text, 'is_correct' => $ok, 'order' => $i + 1]);
        }
        foreach ($spec['children'] ?? [] as $i => $child) {
            $this->question($set, $child, $i + 1, $q->id, $by);
        }
    }

    public function programmingSet(Organization $org, Course $course, User $by, string $code, string $name, string $bank, string $desc): QuestionSet
    {
        $set = QuestionSet::create([
            'organization_id' => $org->id, 'course_id' => $course->id, 'name' => $name, 'code' => $code,
            'type' => 'PROGRAMMING', 'description' => $desc, 'status' => 'PUBLISHED', 'max_score' => 10.0, 'created_by' => $by->id,
        ]);
        foreach (SchoolData::programming($bank) as $i => $p) {
            $problem = ProgrammingProblem::create([
                'question_set_id' => $set->id,
                'title' => 'Bài ' . ($i + 1) . ': ' . $p['title'],
                'description' => $p['description'],
                'difficulty' => $p['difficulty'],
                'time_limit_ms' => $p['time_limit_ms'],
                'memory_limit_mb' => 256,
                'allowed_languages' => ['cpp', 'python'],
                'starter_templates' => [
                    'cpp' => "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Viết lời giải ở đây\n    return 0;\n}",
                    'python' => "def main():\n    # Viết lời giải ở đây\n    pass\n\nif __name__ == '__main__':\n    main()",
                ],
                'order' => $i + 1,
            ]);
            foreach ($p['cases'] as [$in, $out, $sample]) {
                TestCase::create([
                    'programming_problem_id' => $problem->id, 'input_data' => $in, 'expected_output' => $out,
                    'is_sample' => $sample, 'score_weight' => round(10 / max(1, count($p['cases'])), 2),
                ]);
            }
        }

        return $set;
    }

    /**
     * @param 'ENDED'|'IN_PROGRESS'|'PUBLISHED'|'DRAFT' $status
     */
    public function exam(Organization $org, Course $course, QuestionSet $set, User $by, string $code, string $title, string $status, $proctors, array $extra = []): Exam
    {
        $isCode = $set->type === 'PROGRAMMING';
        [$start, $end] = match ($status) {
            'ENDED' => [now()->subDays(3)->setTime(8, 0), now()->subDays(3)->setTime(10, 0)],
            'IN_PROGRESS' => [now()->subMinutes(30), now()->addHours(2)],
            'PUBLISHED' => [now()->addDays(4)->setTime(13, 30), now()->addDays(4)->setTime(15, 30)],
            default => [null, null],
        };

        $exam = Exam::create(array_merge([
            'organization_id' => $org->id,
            'course_id' => $course->id,
            'question_set_id' => $set->id,
            'title' => $title,
            'code' => $code,
            'description' => $isCode ? 'Kỳ thi lập trình thực hành, giám sát bằng FoxyClient.' : 'Kỳ thi trắc nghiệm và tự luận trên máy.',
            'type' => $isCode ? 'PROGRAMMING' : 'QUIZ',
            'status' => $status,
            'start_time' => $start,
            'end_time' => $end,
            'duration_minutes' => $isCode ? 90 : 60,
            'max_attempts' => 1,
            'monitoring_config' => $isCode
                ? ['type' => 'PROGRAMMING', 'prevent_tab_switch' => true, 'ai_face_check' => true, 'prevent_paste' => true, 'max_paste_chars' => 80, 'track_keystroke_dynamics' => true]
                : ['type' => 'CLASSICAL', 'prevent_tab_switch' => true, 'ai_face_check' => true, 'is_shuffle_questions' => true, 'is_shuffle_answers' => true, 'is_hide_score' => false, 'is_allow_review' => true, 'number_questions_per_page' => 1, 'require_mic' => false],
            'created_by' => $by->id,
        ], $extra));

        $exam->proctors()->sync(collect($proctors)->pluck('id')->push($by->id)->unique()->all());

        return $exam;
    }

    /** Candidates + a few violations so the dashboards have something to show. */
    public function attempts(Exam $exam, $students, int $count, bool $live): void
    {
        // 'student01' is the fixture the API tests log in with; keep it free of dangling attempts
        $enrolled = $students
            ->filter(fn (User $s) => $s->username !== 'student01' && $s->enrolledCourses()->whereKey($exam->course_id)->exists())
            ->values()->take($count);
        $problems = $exam->questionSet?->type === 'PROGRAMMING' ? $exam->questionSet->programmingProblems : collect();
        $types = ['TAB_SWITCH', 'WINDOW_LOST_FOCUS', 'BULK_PASTE', 'NO_FACE_DETECTED', 'DEVTOOLS_OPENED', 'MULTIPLE_PEOPLE'];

        foreach ($enrolled as $i => $s) {
            $inProgress = $live && $i % 3 !== 2;
            $started = $inProgress ? now()->subMinutes(5 + $i * 2) : ($exam->start_time ?? now()->subDay())->copy()->addMinutes($i);
            $risk = $i % 4 === 0 ? 55 + $i : ($i % 3 === 0 ? 20 : 0);
            $attempt = ExamAttempt::create([
                'exam_id' => $exam->id,
                'user_id' => $s->id,
                'attempt_number' => 1,
                'status' => $inProgress ? 'IN_PROGRESS' : 'SUBMITTED',
                'started_at' => $started,
                'submitted_at' => $inProgress ? null : $started->copy()->addMinutes(35 + $i * 2),
                'score' => $inProgress ? 0 : round(4 + (($i * 13) % 55) / 10, 1),
                'risk_score' => $risk,
                'is_flagged' => $risk >= 50,
                'device_info' => ['os' => 'Windows 11', 'client' => 'FoxyClient 1.0'],
            ]);

            if ($risk > 0) {
                foreach (range(0, $risk >= 50 ? 2 : 0) as $k) {
                    $type = $types[($i + $k) % count($types)];
                    Violation::create([
                        'exam_attempt_id' => $attempt->id,
                        'violation_type' => $type,
                        'severity' => in_array($type, ['MULTIPLE_PEOPLE', 'BULK_PASTE'], true) ? 'HIGH' : 'MEDIUM',
                        'details' => ['note' => 'Ghi nhận tự động bởi FoxyClient'],
                        'is_reviewed' => !$live && $k === 0,
                        'is_false_positive' => false,
                        'timestamp' => $started->copy()->addMinutes(8 + $k * 6),
                    ]);
                }
            }

            if ($problems->isNotEmpty() && !$inProgress) {
                foreach ($problems as $pi => $problem) {
                    $ok = ($i + $pi) % 3 !== 0;
                    Submission::create([
                        'exam_attempt_id' => $attempt->id,
                        'programming_problem_id' => $problem->id,
                        'language' => 'python',
                        'source_code' => "def main():\n    print(sum(map(int, input().split())))\n\nmain()\n",
                        'passed_cases_count' => $ok ? 3 : 1,
                        'total_cases_count' => 3,
                        'score' => $ok ? 5 : 1.5,
                        'status' => $ok ? 'ACCEPTED' : 'WRONG_ANSWER',
                        'submitted_at' => $attempt->submitted_at,
                    ]);
                }
            }
        }
    }
}
