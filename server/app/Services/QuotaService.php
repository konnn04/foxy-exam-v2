<?php

namespace App\Services;

use App\Models\Exam;
use App\Models\Organization;
use App\Models\OrganizationUsage;
use App\Models\Plan;

class QuotaService
{
    /**
     * Get the active plan of an organization, or fallback to the default FREE plan.
     */
    public function getActivePlan(Organization $org): Plan
    {
        $activeSubscription = $org->activeSubscription()->with('plan')->first();

        if ($activeSubscription && $activeSubscription->plan) {
            return $activeSubscription->plan;
        }

        // Fallback to FREE plan
        return Plan::where('name', 'FREE')->first() ?? new Plan([
            'name' => 'FREE',
            'display_name' => 'Gói Trải Nghiệm',
            'max_exams_per_month' => 1,
            'max_students_per_exam' => 20,
            'storage_limit_gb' => 1,
            'has_ai_proctoring' => false,
            'has_code_replay' => false,
        ]);
    }

    /**
     * Get or create usage tracker for current month.
     */
    public function getCurrentUsage(Organization $org): OrganizationUsage
    {
        $monthYear = now()->format('Y-m');

        return OrganizationUsage::firstOrCreate(
            [
                'organization_id' => $org->id,
                'month_year' => $monthYear,
            ],
            [
                'exams_created_count' => 0,
                'total_attempts_count' => 0,
                'storage_used_bytes' => 0,
            ]
        );
    }

    /**
     * Check if the organization can create a new exam this month.
     */
    public function canCreateExam(Organization $org): array
    {
        $plan = $this->getActivePlan($org);
        $usage = $this->getCurrentUsage($org);

        $limit = $plan->max_exams_per_month;
        $current = $usage->exams_created_count;

        if ($current >= $limit) {
            return [
                'allowed' => false,
                'message' => "Tổ chức của bạn đã đạt giới hạn {$limit} bài thi/tháng của gói {$plan->display_name}. Vui lòng nâng cấp lên gói Pro!",
                'current' => $current,
                'limit' => $limit,
            ];
        }

        return [
            'allowed' => true,
            'message' => 'Hợp lệ',
            'current' => $current,
            'limit' => $limit,
        ];
    }

    /**
     * Increment exam count after creation.
     */
    public function recordExamCreated(Organization $org): void
    {
        $usage = $this->getCurrentUsage($org);
        $usage->increment('exams_created_count');
    }

    /**
     * Check if more students can join the exam.
     */
    public function canJoinExam(Exam $exam): array
    {
        $org = $exam->organization;
        $plan = $this->getActivePlan($org);

        $currentStudents = $exam->attempts()->count();
        $limit = $plan->max_students_per_exam;

        if ($currentStudents >= $limit) {
            return [
                'allowed' => false,
                'message' => "Phòng thi đã đạt giới hạn tối đa {$limit} thí sinh của gói {$plan->display_name}.",
                'current' => $currentStudents,
                'limit' => $limit,
            ];
        }

        return [
            'allowed' => true,
            'message' => 'Hợp lệ',
            'current' => $currentStudents,
            'limit' => $limit,
        ];
    }

    /**
     * Check if organization has access to a specific feature flag.
     */
    public function hasFeature(Organization $org, string $feature): bool
    {
        $plan = $this->getActivePlan($org);

        return match ($feature) {
            'ai_proctoring' => (bool) $plan->has_ai_proctoring,
            'code_replay' => (bool) $plan->has_code_replay,
            default => false,
        };
    }
}
