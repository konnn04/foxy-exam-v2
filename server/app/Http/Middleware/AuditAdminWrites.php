<?php

namespace App\Http\Middleware;

use App\Support\Audit;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Writes one audit line for every SUCCESSFUL admin mutation that has no dedicated Audit::record call:
 * plans, invoices, courses, exams, question banks and their questions. A rejected request (validation error, 4xx/5xx,
 * flashed error) leaves no line. Actions that audit themselves (users, organizations, faces, site...) are not listed here.
 */
class AuditAdminWrites
{
    /** regex on the path (after /admin or /lecturer)  =>  [action, label]. First match wins. */
    private const RULES = [
        '#^plans$#' => ['plan.create', 'Tạo gói cước'],
        '#^plans/(\d+)/update$#' => ['plan.update', 'Cập nhật gói cước'],
        '#^plans/(\d+)/delete$#' => ['plan.delete', 'Xóa gói cước'],
        '#^invoices/(\d+)/confirm$#' => ['plan.invoice_paid', 'Xác nhận thanh toán hóa đơn'],
        '#^courses$#' => ['course.create', 'Tạo khóa học'],
        '#^courses/(\d+)/update$#' => ['course.update', 'Cập nhật khóa học'],
        '#^courses/(\d+)/delete$#' => ['course.delete', 'Xóa khóa học'],
        '#^exams$#' => ['exam.create', 'Tạo kỳ thi'],
        '#^exams/(\d+)/update$#' => ['exam.update', 'Cập nhật kỳ thi'],
        '#^exams/(\d+)/delete$#' => ['exam.delete', 'Xóa kỳ thi'],
        '#^exams/(\d+)/attempts/(\d+)/delete$#' => ['exam.attempt_delete', 'Xóa lượt làm bài'],
        '#^question-sets$#' => ['bank.create', 'Tạo ngân hàng đề'],
        '#^question-sets/(\d+)/update$#' => ['bank.update', 'Cập nhật ngân hàng đề'],
        '#^question-sets/(\d+)/delete$#' => ['bank.delete', 'Xóa ngân hàng đề'],
        '#^question-sets/(\d+)/import-questions$#' => ['bank.import', 'Nhập câu hỏi vào ngân hàng đề'],
        '#^question-sets/(\d+)/classical-questions$#' => ['bank.question_save', 'Lưu câu hỏi'],
        '#^question-sets/(\d+)/programming-problems$#' => ['bank.problem_save', 'Lưu bài lập trình'],
        '#^classical-questions/(\d+)/delete$#' => ['bank.question_delete', 'Xóa câu hỏi'],
        '#^programming-problems/(\d+)/delete$#' => ['bank.problem_delete', 'Xóa bài lập trình'],
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (!$request->isMethod('POST') || $response->getStatusCode() >= 400 || !$request->user()) {
            return $response;
        }
        if ($request->hasSession() && ($request->session()->get('errors')?->any() || $request->session()->has('error'))) {
            return $response;
        }

        $path = $request->path();
        if (!preg_match('#^(?:admin|lecturer)/(.+)$#', $path, $m)) {
            return $response;
        }

        foreach (self::RULES as $pattern => [$action, $label]) {
            if (preg_match($pattern, $m[1], $ids)) {
                $target = explode('.', $action)[0];
                $id = $ids[1] ?? null;
                Audit::record($action, $id ? "{$label} #{$id}" : $label, $target, $id);
                break;
            }
        }

        return $response;
    }
}
