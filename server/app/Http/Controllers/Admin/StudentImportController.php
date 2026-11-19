<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Audit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Inertia\Inertia;

/**
 * Bulk import of students into the ACTIVE school. The browser reads the spreadsheet (xlsx / csv / pasted cells) and sends
 * plain rows; the server never trusts a preview: commit() validates every row again from scratch.
 */
class StudentImportController extends Controller
{
    public const MAX_ROWS = 200; // per request: each new account hashes a password

    private function guard(): TenantContext
    {
        $tenant = app(TenantContext::class);
        abort_unless($tenant->capabilities()['orgSettings'], 403, 'Chỉ quản trị viên của trường mới nhập danh sách sinh viên.');

        return $tenant;
    }

    public function page()
    {
        $tenant = $this->guard();
        $u = Auth::user();

        return Inertia::render('Admin/Import/Students', [
            'user' => ['id' => $u->id, 'name' => $u->name, 'username' => $u->username, 'email' => $u->email, 'role' => $u->role],
            'teams' => [],
            'courses' => Course::where('organization_id', $tenant->id())->orderBy('code')->get(['id', 'code', 'name'])->map(fn ($c) => ['code' => $c->code, 'name' => $c->name]),
            'maxRows' => self::MAX_ROWS,
        ]);
    }

    /** @return array{rows: list<array<string,mixed>>, summary: array<string,int>} */
    private function evaluate(Request $request, int $orgId, string $orgCode): array
    {
        $in = $request->validate([
            'rows' => ['required', 'array', 'min:1', 'max:' . self::MAX_ROWS],
            'rows.*' => ['array'],
            'default_course' => ['nullable', 'string', 'max:50'],
        ]);

        $courses = Course::where('organization_id', $orgId)->get(['id', 'code'])->keyBy(fn ($c) => strtoupper($c->code));
        $existing = User::where('organization_id', $orgId)->whereIn('username', collect($in['rows'])->pluck('username')->filter()->map(fn ($v) => trim((string) $v))->all())->get()->keyBy('username');

        $seen = [];
        $emailsInFile = [];
        $rows = [];
        foreach ($in['rows'] as $i => $raw) {
            $username = trim((string) ($raw['username'] ?? ''));
            $name = trim((string) ($raw['name'] ?? ''));
            $email = strtolower(trim((string) ($raw['email'] ?? '')));
            $password = (string) ($raw['password'] ?? '');
            $courseCode = strtoupper(trim((string) ($raw['course'] ?? ($in['default_course'] ?? ''))));
            $errors = [];

            if ($username === '') {
                $errors[] = 'Thiếu mã sinh viên / tên đăng nhập.';
            } elseif (!preg_match('/^[A-Za-z0-9._@-]{1,100}$/', $username)) {
                $errors[] = 'Tên đăng nhập chỉ gồm chữ, số và . _ - @';
            } elseif (isset($seen[$username])) {
                $errors[] = "Trùng với dòng {$seen[$username]} trong tệp.";
            } else {
                $seen[$username] = $i + 1;
            }
            if ($email !== '') {
                if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                    $errors[] = 'Email không hợp lệ.';
                } elseif (isset($emailsInFile[$email])) {
                    $errors[] = "Email trùng với dòng {$emailsInFile[$email]} trong tệp.";
                } else {
                    $emailsInFile[$email] = $i + 1;
                }
            }
            if ($password !== '' && mb_strlen($password) < 6) {
                $errors[] = 'Mật khẩu tối thiểu 6 ký tự.';
            }
            $course = null;
            if ($courseCode !== '') {
                $course = $courses[$courseCode] ?? null;
                if (!$course) {
                    $errors[] = "Không có khóa học mã {$courseCode}.";
                }
            }

            $user = $existing[$username] ?? null;
            $status = 'new';
            if ($user) {
                if ($user->role !== 'STUDENT') {
                    $errors[] = 'Tên đăng nhập này đang dùng cho tài khoản không phải sinh viên.';
                } else {
                    $status = 'exists';
                }
            }
            if (!$user && $email !== '' && User::where('email', $email)->exists()) {
                $errors[] = 'Email đã được dùng bởi tài khoản khác.';
            }

            $rows[] = [
                'line' => $i + 1, 'username' => $username, 'name' => $name !== '' ? $name : $username, 'email' => $email,
                'password' => $password, 'course' => $courseCode, 'course_id' => $course?->id,
                'status' => $errors ? 'error' : $status, 'errors' => $errors, 'user_id' => $user?->id,
            ];
        }

        $summary = ['new' => 0, 'exists' => 0, 'error' => 0];
        foreach ($rows as $r) {
            $summary[$r['status']]++;
        }

        return ['rows' => $rows, 'summary' => $summary];
    }

    public function preview(Request $request)
    {
        $tenant = $this->guard();
        $result = $this->evaluate($request, $tenant->id(), $tenant->current()->code);

        // never echo passwords back
        return response()->json([
            'summary' => $result['summary'],
            'rows' => array_map(fn ($r) => collect($r)->except(['password', 'course_id', 'user_id'])->all(), $result['rows']),
        ]);
    }

    public function commit(Request $request)
    {
        $tenant = $this->guard();
        $orgId = $tenant->id();
        $orgCode = strtolower(preg_replace('/[^A-Za-z0-9]/', '', $tenant->current()->code));
        $result = $this->evaluate($request, $orgId, $orgCode);

        $created = 0;
        $enrolled = 0;
        $credentials = [];

        foreach ($result['rows'] as $r) {
            if ($r['status'] === 'error') {
                continue;
            }

            if ($r['status'] === 'new') {
                $plain = $r['password'] !== '' ? $r['password'] : Str::password(10, symbols: false);
                $email = $r['email'] !== '' ? $r['email'] : strtolower(preg_replace('/[^A-Za-z0-9._-]/', '', $r['username'])) . "@{$orgCode}.students.local";
                $user = User::create([
                    'organization_id' => $orgId, 'username' => $r['username'], 'name' => $r['name'], 'email' => $email,
                    'password' => $plain, 'role' => 'STUDENT', 'status' => 'ACTIVE',
                ]);
                $created++;
                if ($r['password'] === '') {
                    $credentials[] = ['username' => $r['username'], 'name' => $r['name'], 'password' => $plain];
                }
                $userId = $user->id;
            } else {
                $userId = $r['user_id'];
            }

            if ($r['course_id']) {
                $changes = Course::find($r['course_id'])->students()->syncWithoutDetaching([$userId]);
                $enrolled += count($changes['attached']);
            }
        }

        Audit::record('user.import', "Nhập sinh viên: {$created} tài khoản mới, {$enrolled} lượt ghi danh", null, null, [
            'created' => $created, 'enrolled' => $enrolled, 'skipped_errors' => $result['summary']['error'],
        ]);

        return response()->json(['created' => $created, 'enrolled' => $enrolled, 'errors' => $result['summary']['error'], 'credentials' => $credentials]);
    }
}
