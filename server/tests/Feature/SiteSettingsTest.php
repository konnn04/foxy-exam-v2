<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SiteSettingsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    private function root(): User
    {
        return User::where('role', 'SUPER_ADMIN')->firstOrFail();
    }

    public function test_public_pages_receive_defaults_and_overrides(): void
    {
        $site = fn () => $this->get('/')->assertOk()->viewData('page')['props']['site'];

        $this->assertSame('EXAM GUARD', $site()['brand.name']);
        $this->assertArrayNotHasKey('hero.title.vi', $site());

        SiteSettings::save(['brand.name' => 'Foxy School', 'hero.title.vi' => 'Tiêu đề riêng']);

        $this->assertSame('Foxy School', $site()['brand.name']);
        $this->assertSame('Tiêu đề riêng', $site()['hero.title.vi']);
    }

    public function test_empty_value_restores_built_in_text_and_unsafe_input_is_rejected(): void
    {
        SiteSettings::save(['hero.title.vi' => 'Tạm thời', 'media.dashboard' => 'javascript:alert(1)', 'nope.key' => 'x', 'hero.badge.en' => '<b>Hi</b>']);
        SiteSettings::save(['hero.title.vi' => '']);

        $all = SiteSettings::all();
        $this->assertArrayNotHasKey('hero.title.vi', $all);
        $this->assertSame('/images/mockups/dashboard-proctor.png', $all['media.dashboard']);
        $this->assertArrayNotHasKey('nope.key', $all);
        $this->assertSame('Hi', $all['hero.badge.en']);
    }

    public function test_only_platform_super_admin_can_edit(): void
    {
        $this->actingAs($this->root())->get('/admin/site')->assertOk()->assertInertia(fn ($p) => $p->component('Admin/Site/Edit'));
        $this->actingAs($this->root())->post('/admin/site', ['values' => ['brand.name' => 'Saved']])->assertRedirect();
        $this->assertSame('Saved', SiteSettings::all()['brand.name']);

        $teacher = User::where('username', 'teacher_ou')->firstOrFail();
        $this->actingAs($teacher)->post('/admin/site', ['values' => ['brand.name' => 'Hacked']])->assertForbidden();
        $this->assertSame('Saved', SiteSettings::all()['brand.name']);
    }

    public function test_terms_keep_their_length_and_line_breaks_but_lose_markup(): void
    {
        $terms = "## 1. Muc dich
" . str_repeat('Noi dung dai. ', 200) . "

<script>x</script>## 2. Quyen";
        SiteSettings::save(['legal.terms.vi' => $terms]);

        $saved = SiteSettings::all()['legal.terms.vi'];
        $this->assertGreaterThan(1000, mb_strlen($saved));
        $this->assertStringContainsString("

", $saved);
        $this->assertStringNotContainsString('<script>', $saved);
    }

    public function test_guests_cannot_edit(): void
    {
        $this->post('/admin/site', ['values' => []])->assertRedirect('/login');
    }
}
