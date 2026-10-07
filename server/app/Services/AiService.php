<?php

namespace App\Services;

use App\Models\Exam;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

class AiService
{
    /**
     * Biến phục vụ giả lập trạng thái cho Unit / Feature Test.
     * @var bool|null
     */
    protected static ?bool $fakeStatus = null;

    /**
     * Giả lập trạng thái của AI Service trong môi trường kiểm thử.
     */
    public static function fakeAvailable(?bool $isAvailable): void
    {
        static::$fakeStatus = $isAvailable;
    }

    /**
     * Đặt lại trạng thái giả lập.
     */
    public static function resetFake(): void
    {
        static::$fakeStatus = null;
    }

    /**
     * Kiểm tra xem AI Worker có đang hoạt động và phản hồi hay không.
     */
    public static function isAvailable(): bool
    {
        // 1. Kiểm tra trạng thái fake nếu đang chạy test
        if (static::$fakeStatus !== null) {
            return static::$fakeStatus;
        }

        // 2. Nếu đang chạy test suite mặc định và chưa set AI_WORKER_URL, cho phép pass để không phá vỡ các test cũ
        if (app()->environment('testing') && empty(config('services.ai_worker.url'))) {
            return true;
        }

        return static::getStatus() === 'ONLINE';
    }

    /**
     * Lấy chuỗi trạng thái chi tiết của máy chủ AI ('ONLINE', 'OFFLINE', 'UNCONFIGURED').
     */
    public static function getStatus(): string
    {
        if (static::$fakeStatus !== null) {
            return static::$fakeStatus ? 'ONLINE' : 'OFFLINE';
        }

        if (app()->environment('testing') && empty(config('services.ai_worker.url'))) {
            return 'ONLINE';
        }

        $endpoint = rtrim((string) config('services.ai_worker.url', env('AI_WORKER_URL')), '/');

        if (empty($endpoint)) {
            return 'UNCONFIGURED';
        }

        // Đọc cache ngắn hạn (10s) để tránh spam kết nối tới laptop / tunnel
        $cacheKey = 'foxy_ai_worker_health_status';
        $cachedStatus = Cache::get($cacheKey);
        if ($cachedStatus !== null) {
            return $cachedStatus;
        }

        $timeout = (float) config('services.ai_worker.timeout', 2.0);

        try {
            $response = Http::timeout($timeout)->get("{$endpoint}/health");

            if ($response->successful()) {
                Cache::put($cacheKey, 'ONLINE', now()->addSeconds(10));
                return 'ONLINE';
            }
        } catch (Throwable) {
            // Không kết nối được tới laptop / tunnel
        }

        Cache::put($cacheKey, 'OFFLINE', now()->addSeconds(5));
        return 'OFFLINE';
    }

    /**
     * Kiểm tra điều kiện tiên quyết về AI cho một kỳ thi cụ thể.
     * 
     * @return array{required: bool, available: bool, status: string, message: string}
     */
    public static function checkExamRequirement(Exam $exam): array
    {
        $monitoringConfig = $exam->monitoring_config ?? [];
        $aiFaceRequired = !empty($monitoringConfig['ai_face_check']);

        if (!$aiFaceRequired) {
            return [
                'required' => false,
                'available' => true,
                'status' => 'NOT_REQUIRED',
                'message' => 'Kỳ thi không yêu cầu tính năng giám sát AI.',
            ];
        }

        $isAvailable = static::isAvailable();
        $status = static::getStatus();

        if ($isAvailable) {
            return [
                'required' => true,
                'available' => true,
                'status' => $status,
                'message' => 'Dịch vụ AI giám sát khuôn mặt hoạt động bình thường.',
            ];
        }

        return [
            'required' => true,
            'available' => false,
            'status' => $status,
            'message' => 'Dịch vụ AI giám sát (khuôn mặt) hiện không khả dụng. Kỳ thi yêu cầu giám sát AI nên thí sinh không thể bắt đầu làm bài lúc này. Vui lòng liên hệ giám thị phòng thi.',
        ];
    }
}
