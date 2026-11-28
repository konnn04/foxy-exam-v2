<?php

return [
    'precheck' => [
        // POST /student/exams/{exam}/start needs a token from a passed precheck (new attempt and every resume)
        'required' => (bool) env('PRECHECK_REQUIRED', true),
        // accept "warn" on required checks (the DEV bypass of a development client); never on in production
        'allow_dev' => (bool) env('PRECHECK_ALLOW_DEV', env('APP_ENV') === 'local'),
        // minutes between passing the precheck and pressing "Bắt đầu"
        'ttl' => (int) env('PRECHECK_TTL_MINUTES', 15),
    ],
];
