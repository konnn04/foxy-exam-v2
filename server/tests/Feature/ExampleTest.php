<?php

namespace Tests\Feature;

use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    /**
     * A basic test example.
     */
    public function test_the_application_returns_a_successful_response(): void
    {
        $this->seed(DatabaseSeeder::class);
        $response = $this->get('/');

        $response->assertStatus(200);
    }

    public function test_login_page_loads_without_memory_loop(): void
    {
        $this->seed(DatabaseSeeder::class);
        $response = $this->get('/login');

        $response->assertStatus(200);
    }

    public function test_legacy_docs_url_redirects_to_scramble_api_docs(): void
    {
        $response = $this->get('/docs');

        $response->assertRedirect('/docs/api');
    }

    public function test_auto_generated_scramble_docs_load(): void
    {
        $jsonRes = $this->get('/docs/api.json');
        $jsonRes->assertStatus(200)
            ->assertJsonPath('openapi', '3.1.0');

        $uiRes = $this->get('/docs/api');
        $uiRes->assertStatus(200);
    }
}
