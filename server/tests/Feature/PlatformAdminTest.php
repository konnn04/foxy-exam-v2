<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlatformAdminTest extends TestCase
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

    private function payload(array $over = []): array
    {
        return array_merge([
            'name' => 'ThS. Nguyễn Văn A', 'email' => 'a@school.edu.vn', 'phone' => '0901234567', 'organization' => 'ĐH Mẫu',
            'locale' => 'vi', 'terms_accepted' => true, 'terms_hash' => str_repeat('a', 64),
        ], $over);
    }

    public function test_a_pilot_request_is_stored_with_its_consent_and_the_root_admin_is_notified(): void
    {
        $this->postJson('/pilot-requests', $this->payload())->assertOk();

        $lead = Lead::firstOrFail();
        $this->assertSame('NEW', $lead->status);
        $this->assertSame(str_repeat('a', 64), $lead->terms_hash);
        $this->assertNotNull($lead->terms_accepted_at);
        $this->assertDatabaseHas('user_notifications', ['user_id' => $this->root()->id, 'type' => 'lead']);

        // pressing twice does not create a second row
        $this->postJson('/pilot-requests', $this->payload())->assertOk();
        $this->assertSame(1, Lead::count());
    }

    public function test_a_pilot_request_needs_consent_and_rejects_bots(): void
    {
        $this->postJson('/pilot-requests', $this->payload(['terms_accepted' => false]))->assertStatus(422);
        $this->postJson('/pilot-requests', $this->payload(['website' => 'http://spam']))->assertStatus(422);
        $this->postJson('/pilot-requests', $this->payload(['terms_hash' => 'nope']))->assertStatus(422);
        $this->assertSame(0, Lead::count());
    }

    public function test_only_the_platform_super_admin_reads_and_handles_leads(): void
    {
        $this->postJson('/pilot-requests', $this->payload());
        $lead = Lead::firstOrFail();

        $this->actingAs($this->root())->get('/admin/leads')->assertOk()->assertInertia(fn ($p) => $p->component('Admin/Leads/Index')->where('counts.NEW', 1));
        $this->actingAs($this->root())->post("/admin/leads/{$lead->id}", ['status' => 'CONTACTED', 'note' => 'Đã gọi'])->assertRedirect();
        $this->assertSame('CONTACTED', $lead->fresh()->status);
        $this->assertDatabaseHas('audit_logs', ['action' => 'lead.update', 'target_id' => (string) $lead->id]);

        $teacher = User::where('username', 'teacher_ou')->firstOrFail();
        $this->actingAs($teacher)->get('/admin/leads')->assertRedirect(); // wrong door: bounced home
        $this->actingAs($teacher)->post("/admin/leads/{$lead->id}", ['status' => 'SPAM'])->assertForbidden();
        $this->assertSame('CONTACTED', $lead->fresh()->status);
    }

    public function test_overview_and_health_render_for_the_platform_admin(): void
    {
        $this->actingAs($this->root())->get('/admin/platform')->assertOk()
            ->assertInertia(fn ($p) => $p->component('Admin/Platform/Overview')->has('stats.organizations')->has('series', 14));

        $this->actingAs($this->root())->get('/admin/platform/health.json')->assertOk()
            ->assertJsonFragment(['id' => 'database', 'status' => 'ok']);
        $this->actingAs($this->root())->get('/admin/platform/health')->assertOk()->assertInertia(fn ($p) => $p->component('Admin/Platform/Health'));
    }

    public function test_logins_are_audited_and_a_school_admin_sees_only_their_own_organization(): void
    {
        $this->post('/login', ['username' => 'admin_ou', 'password' => 'wrong-password']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'auth.login_failed']);

        $orgAdmin = User::where('username', 'admin_ou')->firstOrFail();
        AuditLog::create(['user_id' => $this->root()->id, 'user_name' => 'root', 'organization_id' => 1, 'action' => 'site.update', 'summary' => 'platform-only line']);
        AuditLog::create(['user_id' => $orgAdmin->id, 'user_name' => 'ou', 'organization_id' => $orgAdmin->organization_id, 'action' => 'user.create', 'summary' => 'own line']);

        $seen = fn () => collect($this->actingAs($orgAdmin)->get('/admin/audit-log')->assertOk()->viewData('page')['props']['rows']['data'])->pluck('summary')->all();
        $this->assertContains('own line', $seen());
        $this->assertNotContains('platform-only line', $seen());

        $all = collect($this->actingAs($this->root())->get('/admin/audit-log')->assertOk()->viewData('page')['props']['rows']['data'])->pluck('summary')->all();
        $this->assertContains('platform-only line', $all);

        $teacher = User::where('username', 'teacher_ou')->firstOrFail();
        $this->actingAs($teacher)->get('/admin/audit-log')->assertRedirect();
    }
}
