<?php

namespace App\Http\Middleware;

use App\Support\BiometricPolicy;
use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

/**
 * Biometric processing needs the candidate's agreement in THIS login (the consent is tied to the bearer token).
 * Requests without a real bearer token (session callers, tests acting as a user) are not subject to it.
 */
class RequireBiometricConsent
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (config('services.biometric_consent') && $user && $user->role === 'STUDENT' && $user->currentAccessToken() instanceof PersonalAccessToken && BiometricPolicy::forRequest($request) === null) {
            return response()->json([
                'success' => false,
                'code' => 'BIOMETRIC_CONSENT_REQUIRED',
                'message' => 'Bạn cần đồng ý chính sách xử lý dữ liệu sinh trắc học để tiếp tục.',
                'policy_version' => BiometricPolicy::VERSION,
            ], 403);
        }

        return $next($request);
    }
}
