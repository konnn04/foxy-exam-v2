<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class OrganizationTenantAndLoginTest extends TestCase
{
    use RefreshDatabase;

    protected Organization $publicOrg;
    protected Organization $privateOrg;
    protected User $userOrg1;
    protected User $userOrg2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->publicOrg = Organization::create([
            'name' => 'Public University',
            'code' => 'PUB_UNI',
            'slug' => 'pub-uni',
            'type' => 'UNIVERSITY',
            'status' => 'ACTIVE',
            'is_public' => true,
        ]);

        $this->privateOrg = Organization::create([
            'name' => 'Private Academy',
            'code' => 'PRIV_ACAD',
            'slug' => 'priv-acad',
            'type' => 'CENTER',
            'status' => 'ACTIVE',
            'is_public' => false,
        ]);

        // Same username 'john_doe' in two different organizations!
        $this->userOrg1 = User::create([
            'organization_id' => $this->publicOrg->id,
            'username' => 'john_doe',
            'name' => 'John Public',
            'email' => 'john.public@test.com',
            'password' => Hash::make('secret123'),
            'role' => 'STUDENT',
            'status' => 'ACTIVE',
        ]);

        $this->userOrg2 = User::create([
            'organization_id' => $this->privateOrg->id,
            'username' => 'john_doe',
            'name' => 'John Private',
            'email' => 'john.private@test.com',
            'password' => Hash::make('secret456'),
            'role' => 'STUDENT',
            'status' => 'ACTIVE',
        ]);
    }

    public function test_can_fetch_only_public_active_organizations(): void
    {
        $response = $this->getJson('/api/v1/public/organizations');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $data = $response->json('data');
        $codes = array_column($data, 'code');

        $this->assertContains('PUB_UNI', $codes);
        $this->assertNotContains('PRIV_ACAD', $codes);
    }

    public function test_login_with_org_code_scopes_to_correct_tenant(): void
    {
        // Login to Public Org with username 'john_doe' and password 'secret123'
        $resp1 = $this->postJson('/api/v1/auth/login', [
            'org_code' => 'PUB_UNI',
            'username' => 'john_doe',
            'password' => 'secret123',
        ]);

        $resp1->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.user.name', 'John Public')
            ->assertJsonPath('data.user.organization.id', $this->publicOrg->id);

        // Login to Private Org with same username 'john_doe' and password 'secret456'
        $resp2 = $this->postJson('/api/v1/auth/login', [
            'org_code' => 'PRIV_ACAD',
            'username' => 'john_doe',
            'password' => 'secret456',
        ]);

        $resp2->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.user.name', 'John Private')
            ->assertJsonPath('data.user.organization.id', $this->privateOrg->id);

        // Wrong password for public org
        $respFail = $this->postJson('/api/v1/auth/login', [
            'org_code' => 'PUB_UNI',
            'username' => 'john_doe',
            'password' => 'wrong_pass',
        ]);
        $respFail->assertStatus(401);

        // Non-existent org code
        $respOrgFail = $this->postJson('/api/v1/auth/login', [
            'org_code' => 'NON_EXISTENT_ORG',
            'username' => 'john_doe',
            'password' => 'secret123',
        ]);
        $respOrgFail->assertStatus(404);
    }

    public function test_student_login_endpoint_supports_org_code(): void
    {
        $response = $this->postJson('/api/v1/student/login', [
            'org_code' => 'PUB_UNI',
            'username' => 'john_doe',
            'password' => 'secret123',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.user.username', 'john_doe')
            ->assertJsonPath('data.user.organization.code', 'PUB_UNI');
    }

    public function test_organization_admin_can_update_settings(): void
    {
        $orgAdmin = User::create([
            'organization_id' => $this->publicOrg->id,
            'username' => 'admin_pub',
            'name' => 'Admin Public',
            'email' => 'admin.pub@test.com',
            'password' => Hash::make('admin123'),
            'role' => 'ORG_ADMIN',
            'status' => 'ACTIVE',
        ]);

        $response = $this->actingAs($orgAdmin)
            ->post('/admin/organization/settings', [
                'org_id' => $this->publicOrg->id,
                'name' => 'Public University Updated',
                'code' => 'PUB_UNI_2',
                'type' => 'CENTER',
                'is_public' => false,
            ]);

        $response->assertRedirect();
        
        $this->publicOrg->refresh();
        $this->assertEquals('Public University Updated', $this->publicOrg->name);
        $this->assertEquals('PUB_UNI_2', $this->publicOrg->code);
        $this->assertEquals('CENTER', $this->publicOrg->type);
        $this->assertFalse($this->publicOrg->is_public);
    }
}
