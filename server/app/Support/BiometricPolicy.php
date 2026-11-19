<?php

namespace App\Support;

use App\Models\BiometricConsent;
use App\Models\User;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * The text a candidate agrees to before any biometric processing, and the proof that they did.
 * Bump VERSION when the text changes materially: the consent is tied to a login, so everyone agrees again anyway.
 */
final class BiometricPolicy
{
    public const VERSION = '2026-10';

    public static function sections(?string $locale = 'vi'): array
    {
        $locale = strtolower((string) $locale);
        if ($locale === 'en') {
            return self::sectionsEn();
        }

        return self::sectionsVi();
    }

    public static function sectionsVi(): array
    {
        return [
            ['title' => 'Dữ liệu được xử lý', 'body' => 'Ảnh khuôn mặt tham chiếu bạn đăng ký, hình ảnh từ camera và camera phụ trong lúc thi, ảnh chụp màn hình và đặc trưng khuôn mặt (vector số) dùng để so khớp. Hệ thống cũng ghi lại thông tin thiết bị: hệ điều hành, tên máy, mức dùng CPU/RAM, địa chỉ IP và mã nhận dạng thiết bị đã băm.'],
            ['title' => 'Mục đích', 'body' => 'Chỉ để xác minh danh tính thí sinh và phát hiện gian lận trong kỳ thi bạn tham gia. Không dùng để quảng cáo, không bán hay chia sẻ cho bên thứ ba ngoài đơn vị tổ chức thi và nhà cung cấp hạ tầng lưu trữ của họ.'],
            ['title' => 'Ai được xem', 'body' => 'Giảng viên, giám thị và quản trị viên của tổ chức tổ chức kỳ thi, theo quy chế thi của tổ chức đó.'],
            ['title' => 'Thời gian lưu giữ', 'body' => 'Bản ghi và ảnh minh chứng được lưu theo thời hạn mà tổ chức cấu hình, sau đó bị xoá. Ảnh khuôn mặt tham chiếu được giữ đến khi bạn hoặc tổ chức yêu cầu xoá.'],
            ['title' => 'Quyền của bạn', 'body' => 'Bạn có thể xem dữ liệu của mình, yêu cầu thay ảnh khuôn mặt (giảng viên sẽ duyệt) hoặc yêu cầu xoá bằng cách liên hệ đơn vị tổ chức thi. Nếu không đồng ý, bạn không thể tham gia kỳ thi có giám sát bằng khuôn mặt.'],
            ['title' => 'Xác nhận mỗi lần đăng nhập', 'body' => 'Do tính chất nhạy cảm của dữ liệu sinh trắc học, bạn được hỏi lại sự đồng ý ở mỗi lần đăng nhập. Mỗi lần đồng ý đều được ghi lại cùng thời điểm, địa chỉ IP và phiên bản chính sách.'],
        ];
    }

    public static function sectionsEn(): array
    {
        return [
            ['title' => 'Processed Data', 'body' => 'Your registered reference face photo, video streams from the primary webcam and secondary mobile camera during exams, screen captures, and facial feature embeddings (numerical vectors) used for verification. The system also logs device telemetries: operating system, computer name, CPU/RAM usage, IP address, and hashed machine identifier.'],
            ['title' => 'Purpose of Processing', 'body' => 'Strictly to verify candidate identity and prevent academic dishonesty during your enrolled exams. Never used for advertising, nor sold or shared with any third party outside the exam-hosting institution and their authorized secure infrastructure providers.'],
            ['title' => 'Access & Authorized Viewers', 'body' => 'Instructors, invigilators, and authorized institution administrators in accordance with the institution’s official academic examination regulations.'],
            ['title' => 'Retention Period', 'body' => 'Audit logs and evidence media are retained according to the retention window configured by the institution, after which they are permanently purged. Your reference face portrait is stored until you or the institution requests deletion.'],
            ['title' => 'Your Rights', 'body' => 'You may inspect your stored data, request an update to your reference face photo (subject to instructor review), or request deletion by contacting your institution. If consent is declined, you cannot participate in exams requiring facial proctoring.'],
            ['title' => 'Consent Required at Each Login', 'body' => 'Given the sensitive nature of biometric data, your explicit consent is requested at each login session. Each recorded consent includes the precise timestamp, IP address, and policy version.'],
        ];
    }

    /** The consent given with the token of this request (a real bearer token), or null. */
    public static function forRequest(Request $request): ?BiometricConsent
    {
        $user = $request->user();
        if (!$user) {
            return null;
        }
        $token = $user->currentAccessToken();
        if (!$token instanceof PersonalAccessToken) {
            return null;
        }

        return BiometricConsent::where('user_id', $user->id)->where('token_id', $token->id)->where('policy_version', self::VERSION)->latest('id')->first();
    }

    public static function record(Request $request, User $user, string $source = 'login'): BiometricConsent
    {
        $token = $user->currentAccessToken();

        return BiometricConsent::create([
            'user_id' => $user->id,
            'token_id' => $token instanceof PersonalAccessToken ? $token->id : null,
            'policy_version' => self::VERSION,
            'source' => $source,
            'ip' => $request->ip(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 255),
            'accepted_at' => now(),
        ]);
    }
}
