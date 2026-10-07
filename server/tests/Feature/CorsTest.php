<?php

namespace Tests\Feature;

use Tests\TestCase;

class CorsTest extends TestCase
{
    public function test_desktop_client_origins_pass_preflight(): void
    {
        foreach (['http://localhost:1420', 'http://tauri.localhost', 'tauri://localhost'] as $origin) {
            $res = $this->call('OPTIONS', '/api/v1/student/courses', [], [], [], [
                'HTTP_ORIGIN' => $origin,
                'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'GET',
                'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'authorization,x-foxy-attempt',
            ]);
            $this->assertSame($origin, $res->headers->get('Access-Control-Allow-Origin'), $origin);
        }
    }

    public function test_foreign_origin_is_not_allowed(): void
    {
        $res = $this->call('OPTIONS', '/api/v1/student/courses', [], [], [], [
            'HTTP_ORIGIN' => 'https://evil.example',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'GET',
        ]);
        $this->assertNull($res->headers->get('Access-Control-Allow-Origin'));
    }
}
