<?php

namespace Database\Seeders;

use App\Models\ClassicalQuestion;
use App\Models\ClassicalQuestionAnswer;
use App\Models\Course;
use App\Models\Exam;
use App\Models\Invoice;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\ProgrammingProblem;
use App\Models\QuestionSet;
use App\Models\Subscription;
use App\Models\TestCase;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Create SaaS Plans
        $freePlan = Plan::create([
            'name' => 'FREE',
            'display_name' => 'Gói Trải Nghiệm (Free)',
            'price' => 0,
            'billing_cycle' => 'MONTHLY',
            'max_exams_per_month' => 1,
            'max_students_per_exam' => 20,
            'storage_limit_gb' => 1,
            'has_ai_proctoring' => false,
            'has_code_replay' => false,
            'is_active' => true,
        ]);

        $proPlan = Plan::create([
            'name' => 'PRO',
            'display_name' => 'Gói Chuyên Nghiệp (Pro)',
            'price' => 1490000, // 1.490.000đ / tháng
            'billing_cycle' => 'MONTHLY',
            'max_exams_per_month' => 30,
            'max_students_per_exam' => 100,
            'storage_limit_gb' => 20,
            'has_ai_proctoring' => true,
            'has_code_replay' => true,
            'is_active' => true,
        ]);

        $enterprisePlan = Plan::create([
            'name' => 'ENTERPRISE',
            'display_name' => 'Gói Doanh Nghiệp / Đại Học (Enterprise)',
            'price' => 4990000,
            'billing_cycle' => 'YEARLY',
            'max_exams_per_month' => 9999,
            'max_students_per_exam' => 1000,
            'storage_limit_gb' => 500,
            'has_ai_proctoring' => true,
            'has_code_replay' => true,
            'is_active' => true,
        ]);

        // 2. Root Organization (Super Platform)
        $rootOrg = Organization::create([
            'name' => 'Foxy Platform Root',
            'code' => 'ROOT',
            'slug' => 'root',
            'type' => 'ROOT',
            'status' => 'ACTIVE',
        ]);

        Subscription::create([
            'organization_id' => $rootOrg->id,
            'plan_id' => $enterprisePlan->id,
            'starts_at' => now(),
            'ends_at' => null, // Lifetime
            'status' => 'ACTIVE',
        ]);

        // 3. Super Admin User
        $superAdmin = User::create([
            'organization_id' => $rootOrg->id,
            'username' => 'admin',
            'name' => 'Nguyễn Hoàng Admin',
            'first_name' => 'Admin',
            'middle_name' => 'Hoàng',
            'last_name' => 'Nguyễn',
            'date_of_birth' => '1990-01-15',
            'address' => '227 Nguyễn Văn Cừ, Phường 4, Quận 5, TP.HCM',
            'avatar' => 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
            'email' => 'admin@foxyexam.com',
            'password' => Hash::make('admin123'),
            'role' => 'SUPER_ADMIN',
            'status' => 'ACTIVE',
        ]);

        // 4. Demo School (Tenant 1)
        $hcmusOrg = Organization::create([
            'name' => 'Trường ĐH Khoa học Tự nhiên',
            'code' => 'HCMUS',
            'slug' => 'hcmus',
            'type' => 'UNIVERSITY',
            'status' => 'ACTIVE',
            'is_public' => true,
            'settings' => [
                'primary_color' => '#1d4ed8',
                'contact_email' => 'contact@hcmus.edu.vn',
            ],
        ]);

        Subscription::create([
            'organization_id' => $hcmusOrg->id,
            'plan_id' => $proPlan->id,
            'starts_at' => now(),
            'ends_at' => now()->addMonth(),
            'status' => 'ACTIVE',
            'auto_renew' => true,
        ]);

        // Sample Invoices for HCMUS
        Invoice::create([
            'invoice_code' => 'INV-2026-001',
            'organization_id' => $hcmusOrg->id,
            'plan_id' => $proPlan->id,
            'amount' => 1490000,
            'status' => 'PAID',
            'payment_method' => 'VNPAY',
            'transaction_id' => 'VNP2026090188992',
            'paid_at' => now()->subDays(15),
            'notes' => 'Thanh toán phí gói Pro 1 tháng qua cổng VNPAY QR',
        ]);

        Invoice::create([
            'invoice_code' => 'INV-2026-002',
            'organization_id' => $hcmusOrg->id,
            'plan_id' => $proPlan->id,
            'amount' => 1490000,
            'status' => 'PAID',
            'payment_method' => 'BANK_TRANSFER',
            'transaction_id' => 'VCB9920192837',
            'paid_at' => now()->subDays(2),
            'notes' => 'Gia hạn gói Pro qua chuyển khoản ngân hàng Vietcombank',
        ]);

        Invoice::create([
            'invoice_code' => 'INV-2026-003',
            'organization_id' => $hcmusOrg->id,
            'plan_id' => $enterprisePlan->id,
            'amount' => 4990000,
            'status' => 'PENDING',
            'payment_method' => 'MOMO',
            'transaction_id' => 'MOM20260920003',
            'paid_at' => null,
            'notes' => 'Đơn hàng nâng cấp lên Gói Enterprise chờ xác nhận chuyển khoản',
        ]);

        // 5. Org Admin User (Trưởng khoa / Quản trị trường)
        $orgAdmin = User::create([
            'organization_id' => $hcmusOrg->id,
            'username' => 'admin_hcmus',
            'name' => 'Trần Văn Quản Trị',
            'first_name' => 'Quản Trị',
            'middle_name' => 'Văn',
            'last_name' => 'Trần',
            'date_of_birth' => '1985-05-20',
            'address' => 'Linh Trung, TP. Thủ Đức, TP.HCM',
            'avatar' => 'https://api.dicebear.com/7.x/bottts/svg?seed=hcmus_admin',
            'email' => 'admin@hcmus.edu.vn',
            'password' => Hash::make('admin123'),
            'role' => 'ORG_ADMIN',
            'status' => 'ACTIVE',
        ]);

        // 6. Teacher User
        $teacher = User::create([
            'organization_id' => $hcmusOrg->id,
            'username' => 'teacher_hcmus',
            'name' => 'Nguyễn Văn A',
            'first_name' => 'A',
            'middle_name' => 'Văn',
            'last_name' => 'Nguyễn',
            'date_of_birth' => '1988-11-12',
            'address' => 'Phường 10, Quận 10, TP.HCM',
            'avatar' => 'https://api.dicebear.com/7.x/bottts/svg?seed=teacherA',
            'email' => 'teacher@hcmus.edu.vn',
            'password' => Hash::make('teacher123'),
            'role' => 'TEACHER',
            'status' => 'ACTIVE',
        ]);

        // 6. Student User
        $student = User::create([
            'organization_id' => $hcmusOrg->id,
            'username' => 'student01',
            'name' => 'Lê Thị Thu B',
            'first_name' => 'B',
            'middle_name' => 'Thị Thu',
            'last_name' => 'Lê',
            'date_of_birth' => '2004-09-01',
            'address' => 'Ký túc xá ĐHQG Khu B, Dĩ An, Bình Dương',
            'avatar' => 'https://api.dicebear.com/7.x/bottts/svg?seed=student01',
            'email' => 'student01@student.hcmus.edu.vn',
            'password' => Hash::make('student123'),
            'role' => 'STUDENT',
            'status' => 'ACTIVE',
        ]);

        // 7. Demo Course
        $course = Course::create([
            'organization_id' => $hcmusOrg->id,
            'code' => 'CS101',
            'name' => 'Nhập Môn Lập Trình C++',
            'description' => 'Khóa học lập trình căn bản với C++ và thuật toán.',
            'teacher_id' => $teacher->id,
        ]);

        // 8. Demo Programming Exam
        $exam = Exam::create([
            'organization_id' => $hcmusOrg->id,
            'course_id' => $course->id,
            'title' => 'Kỳ Thi Lập Trình C++ Cuối Kỳ',
            'code' => 'FOXY-2026', // Code for students to enter room
            'description' => 'Kỳ thi thực hành trên máy. Không sử dụng tài liệu ngoài, cấm sao chép mã nguồn.',
            'type' => 'PROGRAMMING',
            'status' => 'PUBLISHED',
            'start_time' => now()->subHour(),
            'end_time' => now()->addHours(3),
            'duration_minutes' => 90,
            // Cho phép thi lại vài lần khi seed/dev để tiện test (production
            // thường để 1, hoặc null nếu muốn không giới hạn).
            'max_attempts' => 3,
            'monitoring_config' => [
                'prevent_tab_switch' => true,
                'prevent_paste' => true,
                'max_paste_chars' => 80,
                'track_keystroke_dynamics' => true,
                'ai_face_check' => true,
            ],
            'created_by' => $teacher->id,
        ]);

        // 9. Question Set 1: PROGRAMMING (Bộ đề lập trình LeetCode / HackerRank)
        $progQuestionSet = QuestionSet::create([
            'organization_id' => $hcmusOrg->id,
            'course_id' => $course->id,
            'name' => 'Ngân hàng Thuật toán & Cấu trúc Dữ liệu C++',
            'code' => 'SET-PROG-01',
            'type' => 'PROGRAMMING',
            'description' => 'Tuyển tập các bài toán thuật toán chuẩn hóa, hỗ trợ chấm tự động bằng testcase thời gian thực.',
            'status' => 'PUBLISHED',
            'max_score' => 10.0,
            'created_by' => $teacher->id,
        ]);

        $exam->update(['question_set_id' => $progQuestionSet->id]);

        // Demo Programming Problem 1
        $problem1 = ProgrammingProblem::create([
            'question_set_id' => $progQuestionSet->id,
            'exam_id' => $exam->id,
            'title' => 'Bài 1: Tìm Phần Tử Lớn Nhất và Nhỏ Nhất',
            'description' => "### Mô tả bài toán\nCho một mảng gồm \$N\$ số nguyên. Hãy viết chương trình tìm giá trị nhỏ nhất và lớn nhất trong mảng.\n\n### Định dạng đầu vào\n- Dòng đầu tiên chứa số nguyên \$N\$ (\$1 \\le N \\le 10^5\$).\n- Dòng thứ hai chứa \$N\$ số nguyên cách nhau bởi dấu cách.\n\n### Định dạng đầu ra\n- In ra hai số nguyên cách nhau bởi dấu cách: giá trị nhỏ nhất và giá trị lớn nhất.",
            'difficulty' => 'EASY',
            'time_limit_ms' => 1000,
            'memory_limit_mb' => 256,
            'allowed_languages' => ['cpp', 'python'],
            'starter_templates' => [
                'cpp' => "#include <iostream>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    \n    // Viết giải thuật của bạn ở đây\n    \n    return 0;\n}",
                'python' => "import sys\n\ndef main():\n    # Viết giải thuật của bạn ở đây\n    pass\n\nif __name__ == '__main__':\n    main()",
            ],
            'order' => 1,
        ]);

        TestCase::create([
            'programming_problem_id' => $problem1->id,
            'input_data' => "5\n3 1 9 7 2",
            'expected_output' => "1 9",
            'is_sample' => true,
            'score_weight' => 5.0,
        ]);

        TestCase::create([
            'programming_problem_id' => $problem1->id,
            'input_data' => "4\n-10 -50 0 100",
            'expected_output' => "-50 100",
            'is_sample' => false,
            'score_weight' => 5.0,
        ]);

        // Demo Programming Problem 2 (LeetCode style Two Sum)
        $problem2 = ProgrammingProblem::create([
            'question_set_id' => $progQuestionSet->id,
            'exam_id' => null,
            'title' => 'Bài 2: Two Sum - Tìm Cặp Số Có Tổng Bằng Target',
            'description' => "### Mô tả bài toán\nCho một mảng số nguyên `nums` và một số nguyên `target`. Hãy tìm chỉ số của hai số sao cho tổng của chúng bằng `target`.\n\nGiả định rằng mỗi đầu vào sẽ có đúng một lời giải duy nhất, và bạn không được sử dụng cùng một phần tử hai lần.\n\n### Định dạng đầu vào\n- Dòng đầu tiên gồm số nguyên \$N\$ và số nguyên \$target\$.\n- Dòng thứ hai gồm \$N\$ số nguyên cách nhau bởi dấu cách.\n\n### Định dạng đầu ra\n- In ra hai chỉ số cách nhau bởi dấu cách (theo thứ tự tăng dần).",
            'difficulty' => 'MEDIUM',
            'time_limit_ms' => 1500,
            'memory_limit_mb' => 256,
            'allowed_languages' => ['cpp', 'python'],
            'starter_templates' => [
                'cpp' => "#include <iostream>\n#include <vector>\n#include <unordered_map>\nusing namespace std;\n\nint main() {\n    // Giải thuật Two Sum\n    return 0;\n}",
                'python' => "def two_sum(nums, target):\n    # Viết giải thuật ở đây\n    pass\n\nif __name__ == '__main__':\n    pass",
            ],
            'order' => 2,
        ]);

        TestCase::create([
            'programming_problem_id' => $problem2->id,
            'input_data' => "4 9\n2 7 11 15",
            'expected_output' => "0 1",
            'is_sample' => true,
            'score_weight' => 5.0,
        ]);

        TestCase::create([
            'programming_problem_id' => $problem2->id,
            'input_data' => "3 6\n3 2 4",
            'expected_output' => "1 2",
            'is_sample' => false,
            'score_weight' => 5.0,
        ]);

        // 10. Question Set 2: CLASSICAL (Bộ đề cổ điển: 5 loại câu hỏi)
        $classicalQuestionSet = QuestionSet::create([
            'organization_id' => $hcmusOrg->id,
            'course_id' => $course->id,
            'name' => 'Bộ Đề Thi Lý Thuyết Chuyên Ngành & Tiếng Anh Kỹ Thuật',
            'code' => 'SET-CLAS-01',
            'type' => 'CLASSICAL',
            'description' => 'Bộ đề chuẩn hóa bao gồm Trắc nghiệm 1 đáp án, nhiều đáp án, tự luận ngắn, tự luận dài và nhóm bài đọc tiếng Anh.',
            'status' => 'PUBLISHED',
            'max_score' => 10.0,
            'created_by' => $teacher->id,
        ]);

        // Type 1: SINGLE_CHOICE (2-4 lựa chọn, mặc định 4)
        $q1 = ClassicalQuestion::create([
            'question_set_id' => $classicalQuestionSet->id,
            'type' => 'SINGLE_CHOICE',
            'content' => 'Độ phức tạp thời gian trung bình của thuật toán Tìm kiếm Nhị phân (Binary Search) trên mảng đã sắp xếp là gì?',
            'explanation' => 'Tại mỗi bước lặp, không gian tìm kiếm giảm đi một nửa nên độ phức tạp thời gian là O(log N).',
            'points' => 1.5,
            'difficulty' => 'EASY',
            'order' => 1,
            'created_by' => $teacher->id,
        ]);

        ClassicalQuestionAnswer::create(['classical_question_id' => $q1->id, 'content' => 'O(1)', 'is_correct' => false, 'order' => 1]);
        ClassicalQuestionAnswer::create(['classical_question_id' => $q1->id, 'content' => 'O(log N)', 'is_correct' => true, 'order' => 2]);
        ClassicalQuestionAnswer::create(['classical_question_id' => $q1->id, 'content' => 'O(N)', 'is_correct' => false, 'order' => 3]);
        ClassicalQuestionAnswer::create(['classical_question_id' => $q1->id, 'content' => 'O(N^2)', 'is_correct' => false, 'order' => 4]);

        // Type 2: MULTIPLE_CHOICE (2-8 lựa chọn, chọn nhiều đáp án đúng)
        $q2 = ClassicalQuestion::create([
            'question_set_id' => $classicalQuestionSet->id,
            'type' => 'MULTIPLE_CHOICE',
            'content' => 'Trong các tính chất sau đây, đâu là các nguyên lý cốt lõi của Lập trình Hướng Đối Tượng (OOP)?',
            'explanation' => '4 nguyên lý của OOP là: Tính Đóng Gói (Encapsulation), Tính Kế Thừa (Inheritance), Tính Đa Hình (Polymorphism) và Tính Trừu Tượng (Abstraction).',
            'points' => 2.0,
            'difficulty' => 'MEDIUM',
            'order' => 2,
            'created_by' => $teacher->id,
        ]);

        ClassicalQuestionAnswer::create(['classical_question_id' => $q2->id, 'content' => 'Tính Đóng Gói (Encapsulation)', 'is_correct' => true, 'order' => 1]);
        ClassicalQuestionAnswer::create(['classical_question_id' => $q2->id, 'content' => 'Tính Đa Hình (Polymorphism)', 'is_correct' => true, 'order' => 2]);
        ClassicalQuestionAnswer::create(['classical_question_id' => $q2->id, 'content' => 'Tính Đơn Tuyến (Monothreading)', 'is_correct' => false, 'order' => 3]);
        ClassicalQuestionAnswer::create(['classical_question_id' => $q2->id, 'content' => 'Tính Bất Biến Cưỡng Chế (Forced Immutability)', 'is_correct' => false, 'order' => 4]);
        ClassicalQuestionAnswer::create(['classical_question_id' => $q2->id, 'content' => 'Tính Trừu Tượng (Abstraction)', 'is_correct' => true, 'order' => 5]);

        // Type 3: SHORT_ANSWER (Tự luận 1 dòng, < 300 ký tự)
        ClassicalQuestion::create([
            'question_set_id' => $classicalQuestionSet->id,
            'type' => 'SHORT_ANSWER',
            'content' => 'Từ khóa nào trong C++ được dùng để giải phóng vùng nhớ động đã cấp phát thông qua toán tử new?',
            'explanation' => 'Sử dụng từ khóa "delete" cho biến đơn hoặc "delete[]" cho mảng động.',
            'points' => 1.5,
            'difficulty' => 'EASY',
            'order' => 3,
            'created_by' => $teacher->id,
        ]);

        // Type 4: ESSAY (Tự luận 1 đoạn)
        ClassicalQuestion::create([
            'question_set_id' => $classicalQuestionSet->id,
            'type' => 'ESSAY',
            'content' => 'Trình bày sự khác biệt giữa Vùng nhớ Stack và Vùng nhớ Heap trong kiến trúc bộ nhớ tiến trình C++. Nêu ví dụ khi nào nên sử dụng mỗi loại vùng nhớ.',
            'explanation' => 'Thang điểm: 1 điểm cho phân biệt cơ chế phân bổ/thu hồi (tự động vs thủ công); 1 điểm cho tốc độ và dung lượng; 1 điểm cho ví dụ thực tế.',
            'points' => 2.5,
            'difficulty' => 'HARD',
            'order' => 4,
            'created_by' => $teacher->id,
        ]);

        // Type 5: GROUP_QUESTION (Nhóm câu hỏi - Reading Passage tiếng Anh chứa các câu con)
        $readingGroup = ClassicalQuestion::create([
            'question_set_id' => $classicalQuestionSet->id,
            'type' => 'GROUP_QUESTION',
            'content' => "Read the following technical passage and answer the questions below:\n\n\"Artificial Intelligence (AI) and Machine Learning (ML) have revolutionized software engineering. Automated testing platforms can now synthesize edge-case test suites in seconds, reducing regression testing overhead by over 70%. Furthermore, Large Language Models (LLMs) assist developers with context-aware code completion, cross-language translation, and architectural refactoring.\n\nHowever, continuous security audits remain essential. Automated generative models may inadvertently memorize and reproduce vulnerabilities from public repositories, or produce hallucinated library calls that introduce severe zero-day exploits if deployed without human oversight.\"",
            'explanation' => 'Đoạn văn đọc hiểu tiếng Anh chuyên ngành Công nghệ thông tin về ứng dụng và rủi ro của AI trong kiểm thử và viết mã nguồn.',
            'points' => 2.5,
            'difficulty' => 'MEDIUM',
            'order' => 5,
            'created_by' => $teacher->id,
        ]);

        // Child Question 5.1: SINGLE_CHOICE
        $q5_1 = ClassicalQuestion::create([
            'question_set_id' => $classicalQuestionSet->id,
            'parent_id' => $readingGroup->id,
            'type' => 'SINGLE_CHOICE',
            'content' => 'According to the first paragraph, what is one major advantage of modern automated testing platforms?',
            'explanation' => 'The passage states: "Automated testing platforms can now synthesize edge-case test suites in seconds, reducing regression testing overhead by over 70%."',
            'points' => 1.0,
            'difficulty' => 'MEDIUM',
            'order' => 1,
            'created_by' => $teacher->id,
        ]);

        ClassicalQuestionAnswer::create(['classical_question_id' => $q5_1->id, 'content' => 'They completely eliminate the need for human programmers.', 'is_correct' => false, 'order' => 1]);
        ClassicalQuestionAnswer::create(['classical_question_id' => $q5_1->id, 'content' => 'They synthesize edge-case test suites in seconds and reduce regression overhead.', 'is_correct' => true, 'order' => 2]);
        ClassicalQuestionAnswer::create(['classical_question_id' => $q5_1->id, 'content' => 'They guarantee 100% bug-free deployment without review.', 'is_correct' => false, 'order' => 3]);
        ClassicalQuestionAnswer::create(['classical_question_id' => $q5_1->id, 'content' => 'They replace hardware servers with cloud simulations.', 'is_correct' => false, 'order' => 4]);

        // Child Question 5.2: MULTIPLE_CHOICE (2 correct answers)
        $q5_2 = ClassicalQuestion::create([
            'question_set_id' => $classicalQuestionSet->id,
            'parent_id' => $readingGroup->id,
            'type' => 'MULTIPLE_CHOICE',
            'content' => 'According to the second paragraph, what risks do AI models pose in software development?',
            'explanation' => 'The text warns that AI models may reproduce vulnerabilities from training data or produce hallucinated library calls.',
            'points' => 1.5,
            'difficulty' => 'HARD',
            'order' => 2,
            'created_by' => $teacher->id,
        ]);

        ClassicalQuestionAnswer::create(['classical_question_id' => $q5_2->id, 'content' => 'Inadvertently reproducing security vulnerabilities from public repositories.', 'is_correct' => true, 'order' => 1]);
        ClassicalQuestionAnswer::create(['classical_question_id' => $q5_2->id, 'content' => 'Producing hallucinated library calls that could lead to exploits.', 'is_correct' => true, 'order' => 2]);
        ClassicalQuestionAnswer::create(['classical_question_id' => $q5_2->id, 'content' => 'Slowing down compiler execution speeds permanently.', 'is_correct' => false, 'order' => 3]);
        ClassicalQuestionAnswer::create(['classical_question_id' => $q5_2->id, 'content' => 'Causing physical hard drive fragmentation.', 'is_correct' => false, 'order' => 4]);

        // 11. Enroll demo student into the course
        $student->enrolledCourses()->syncWithoutDetaching([$course->id]);

        // 12. Demo Classical Quiz Exam
        Exam::create([
            'organization_id' => $hcmusOrg->id,
            'course_id' => $course->id,
            'question_set_id' => $classicalQuestionSet->id,
            'title' => 'Kỳ Thi Trắc Nghiệm & Lý Thuyết C++',
            'code' => 'CLAS-2026',
            'description' => 'Kỳ thi trắc nghiệm khách quan kết hợp tự luận ngắn và nhóm đọc hiểu tiếng Anh chuyên ngành.',
            'type' => 'QUIZ',
            'status' => 'PUBLISHED',
            'start_time' => now()->subHour(),
            'end_time' => now()->addHours(5),
            'duration_minutes' => 60,
            'monitoring_config' => [
                'prevent_tab_switch' => true,
                'prevent_paste' => true,
            ],
            'created_by' => $teacher->id,
        ]);

        // 13. More of everything: the HCMUS fixtures above stay as-is (tests and docs refer to them);
        //     the same generator then builds two further schools, each with its own staff and exam banks.
        $school = new SchoolSeeder();

        $people = $school->people($hcmusOrg, 'HCMUS', 'hcmus.edu.vn', 6, 40, 21120000, ['teachers' => [$teacher], 'students' => [$student]]);
        $extraCourses = $school->courses($hcmusOrg, 'HCMUS', $people['teachers'], $people['students'], [
            ['DB201', 'Cơ Sở Dữ Liệu', 'Mô hình quan hệ, SQL và chuẩn hóa lược đồ.'],
            ['DS202', 'Cấu Trúc Dữ Liệu & Giải Thuật', 'Mảng, danh sách, cây, đồ thị và các thuật toán sắp xếp.'],
        ]);
        $people['students']->each(fn (User $u) => $u->enrolledCourses()->syncWithoutDetaching([$course->id]));
        $this->fillSchool($school, $hcmusOrg, $people, [$course, ...$extraCourses], [
            'from' => 2, 'clas' => ['db', 'ds'], 'prog' => ['strings', 'arrays'], 'code' => 'HCMUS',
        ]);

        $this->extraSchool($school, $proPlan, [
            'name' => 'Trường ĐH Bách khoa TP.HCM', 'code' => 'HCMUT', 'type' => 'UNIVERSITY', 'public' => true,
            'domain' => 'hcmut.edu.vn', 'mssv' => 21100000, 'color' => '#0f766e',
            'courses' => [['IT201', 'Lập Trình Hướng Đối Tượng', 'Kế thừa, đa hình và các nguyên lý OOP.'], ['NW301', 'Mạng Máy Tính', 'Mô hình TCP/IP, định tuyến và bảo mật.'], ['AL205', 'Phân Tích Thuật Toán', 'Độ phức tạp và các kỹ thuật thiết kế thuật toán.']],
            'clas' => ['ds', 'net'], 'prog' => ['math', 'sorting'], 'plan' => $enterprisePlan,
        ]);
        $this->extraSchool($school, $proPlan, [
            'name' => 'Trung tâm Tin học & Anh ngữ FoxyLab', 'code' => 'FLAB', 'type' => 'CENTER', 'public' => false,
            'domain' => 'foxylab.vn', 'mssv' => 5000, 'color' => '#c2410c',
            'courses' => [['PY101', 'Python Cơ Bản', 'Làm quen lập trình với Python.'], ['EN110', 'Tiếng Anh Công Nghệ', 'Từ vựng và đọc hiểu cho người làm IT.'], ['SQ120', 'SQL Thực Hành', 'Truy vấn và thiết kế bảng.']],
            'clas' => ['en', 'db'], 'prog' => ['strings', 'math'], 'plan' => $proPlan,
        ]);
    }

    /** Organization #2/#3: org, subscription, admin, staff, students, courses and the four exam banks. */
    private function extraSchool(SchoolSeeder $school, Plan $defaultPlan, array $cfg): void
    {
        $org = Organization::create([
            'name' => $cfg['name'], 'code' => $cfg['code'], 'slug' => strtolower($cfg['code']), 'type' => $cfg['type'],
            'status' => 'ACTIVE', 'is_public' => $cfg['public'],
            'settings' => ['primary_color' => $cfg['color'], 'contact_email' => 'contact@' . $cfg['domain']],
        ]);
        Subscription::create([
            'organization_id' => $org->id, 'plan_id' => ($cfg['plan'] ?? $defaultPlan)->id,
            'starts_at' => now()->subDays(10), 'ends_at' => now()->addMonths(2), 'status' => 'ACTIVE', 'auto_renew' => true,
        ]);
        $lower = strtolower($cfg['code']);
        User::create([
            'organization_id' => $org->id, 'username' => 'admin_' . $lower, 'name' => 'Quản trị ' . $cfg['code'],
            'first_name' => $cfg['code'], 'middle_name' => 'Quản', 'last_name' => 'Trị',
            'email' => 'admin@' . $cfg['domain'], 'password' => Hash::make('admin123'), 'role' => 'ORG_ADMIN', 'status' => 'ACTIVE',
        ]);

        $people = $school->people($org, $cfg['code'], $cfg['domain'], 5, 36, $cfg['mssv']);
        $courses = $school->courses($org, $cfg['code'], $people['teachers'], $people['students'], $cfg['courses']);
        $this->fillSchool($school, $org, $people, $courses, ['from' => 1, 'clas' => $cfg['clas'], 'prog' => $cfg['prog'], 'code' => $cfg['code']]);
    }

    /**
     * Question banks 'from'..2 (classical + programming) and one exam per bank:
     * the first pair is finished (results) / live right now, the second pair is scheduled / draft.
     */
    private function fillSchool(SchoolSeeder $school, Organization $org, array $people, array $courses, array $cfg): void
    {
        $t = $people['teachers'];
        $code = $cfg['code'];
        $names = [
            'db' => 'Cơ sở dữ liệu & SQL', 'ds' => 'Cấu trúc dữ liệu & Giải thuật', 'net' => 'Mạng máy tính', 'en' => 'Tiếng Anh kỹ thuật',
            'strings' => 'Xử lý chuỗi', 'arrays' => 'Mảng & thống kê', 'math' => 'Toán học & Số học', 'sorting' => 'Sắp xếp & Tìm kiếm',
        ];

        foreach (range($cfg['from'], 2) as $n) {
            $first = $n === $cfg['from'];
            $by = $t[$n % $t->count()];
            $course = $courses[($n - 1) % count($courses)];
            $progCourse = $courses[$n % count($courses)];
            $cb = $cfg['clas'][$n - 1];
            $pb = $cfg['prog'][$n - 1];
            $num = sprintf('%02d', $n);

            $clas = $school->classicalSet($org, $course, $by, "SET-CLAS-$num", 'Đề trắc nghiệm · ' . $names[$cb], $cb,
                'Đủ các dạng câu hỏi: một/nhiều đáp án, đúng/sai, điền chỗ trống, trả lời ngắn, tự luận' . ($cb === 'en' ? ' và nhóm đọc hiểu.' : '.'));
            $prog = $school->programmingSet($org, $progCourse, $by, "SET-PROG-$num", 'Đề lập trình · ' . $names[$pb], $pb,
                'Bài tập lập trình có chấm tự động bằng test case.');

            $proctors = $t->take(3);
            $e1 = $school->exam($org, $course, $clas, $by, "FOXY-$code-C$num", ($first ? 'Kiểm tra giữa kỳ' : 'Thi cuối kỳ') . ' · ' . $names[$cb], $first ? 'ENDED' : 'PUBLISHED', $proctors);
            $e2 = $school->exam($org, $progCourse, $prog, $by, "FOXY-$code-P$num", ($first ? 'Thực hành lập trình' : 'Thi lập trình cuối kỳ') . ' · ' . $names[$pb], $first ? 'IN_PROGRESS' : 'DRAFT', $proctors);

            if ($first) {
                $school->attempts($e1, $people['students'], 14, false);
                $school->attempts($e2, $people['students'], 12, true);
            }
        }
    }
}
