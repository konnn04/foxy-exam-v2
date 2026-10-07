<?php

namespace App\Http\Middleware;

use App\Services\Realtime;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Service-to-service calls (realtime worker -> core) carry an HMAC over "<timestamp>.<body>". */
class VerifyInternalSignature
{
    public function __construct(private Realtime $realtime)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        if (!$this->realtime->verifyRequest($request)) {
            return response()->json(['success' => false, 'message' => 'Invalid signature.'], 401);
        }

        return $next($request);
    }
}
