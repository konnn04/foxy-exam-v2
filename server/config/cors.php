<?php

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => [],
    'allowed_origins_patterns' => array_filter(explode(',', (string) env(
        'CORS_ORIGIN_PATTERNS',
        '#^https?://(localhost|127\.0\.0\.1|tauri\.localhost)(:\d+)?$#,#^tauri://localhost$#'
    ))),
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 600,
    'supports_credentials' => false,
];
