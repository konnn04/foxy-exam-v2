<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'ai_worker' => [
        'url' => env('AI_WORKER_URL'),
        'timeout' => (float) env('AI_WORKER_TIMEOUT', 2.0),
        // false = candidates may start exams that ask for face monitoring even when the AI worker is offline / absent
        'enforce' => (bool) env('AI_ENFORCE', true),
    ],

    // Realtime plane (Go services in /realtime). Leave RT_JWT_SECRET empty to run without it.
    'realtime' => [
        'jwt_secret' => env('RT_JWT_SECRET'),
        'internal_secret' => env('RT_INTERNAL_SECRET'),
        'ingest_url' => env('RT_INGEST_URL', 'http://localhost:8081'),                    // what FoxyClient calls
        'ingest_internal_url' => env('RT_INGEST_INTERNAL_URL', 'http://localhost:8081'),  // what the core calls
        'hub_url' => env('RT_HUB_URL', 'ws://localhost:8082'),                            // what the proctor UI connects to
        'record_url' => env('RT_RECORD_URL', 'http://localhost:8083'),
        'livekit' => [
            'url' => env('LIVEKIT_PUBLIC_URL'),       // wss://... reachable by the client
            'api_key' => env('LIVEKIT_API_KEY'),
            'api_secret' => env('LIVEKIT_API_SECRET'),
        ],
    ],

];
