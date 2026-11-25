<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\ServiceEndpoints;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SeoAndServiceEndpointsTest extends TestCase
{
    use RefreshDatabase;

    public function test_robots_txt_hides_private_areas_and_points_to_the_sitemap(): void
    {
        $body = $this->get('/robots.txt')->assertOk()->assertHeader('Content-Type', 'text/plain; charset=UTF-8')->getContent();

        $this->assertStringContainsString('Disallow: /admin', $body);
        $this->assertStringContainsString('Disallow: /api', $body);
        $this->assertStringContainsString('Sitemap: ' . url('/sitemap.xml'), $body);
    }

    public function test_sitemap_lists_only_public_pages(): void
    {
        $xml = $this->get('/sitemap.xml')->assertOk()->getContent();

        foreach (['/pricing', '/features', '/about', '/download'] as $path) {
            $this->assertStringContainsString('<loc>' . url($path) . '</loc>', $xml);
        }
        $this->assertStringNotContainsString('/admin', $xml);
        $this->assertStringNotContainsString('/login', $xml);
    }

    public function test_stored_service_address_overrides_env_and_can_be_removed(): void
    {
        $this->assertSame([], ServiceEndpoints::save(['ai_face' => 'https://ai-face.example.edu.vn/']));
        ServiceEndpoints::apply();
        $this->assertSame('https://ai-face.example.edu.vn', config('services.ai_face.url'));

        $this->assertSame([], ServiceEndpoints::save(['ai_face' => '']));
        $this->assertSame('', collect(ServiceEndpoints::forEditor())->firstWhere('key', 'ai_face')['value']);
    }

    public function test_service_address_must_be_a_real_url(): void
    {
        $errors = ServiceEndpoints::save(['ai_face' => 'javascript:alert(1)', 'livekit' => 'wss://live.example.edu.vn']);

        $this->assertArrayHasKey('ai_face', $errors);
        $this->assertArrayHasKey('ai_face', ServiceEndpoints::save(['ai_face' => 'http://169.254.169.254/latest']));
        $this->assertNotContains('rt_ingest_internal', array_column(ServiceEndpoints::forEditor(), 'key'));
        $this->assertNotContains('rt_record_internal', array_column(ServiceEndpoints::forEditor(), 'key'));
        $this->assertArrayNotHasKey('livekit', $errors);
    }
}
