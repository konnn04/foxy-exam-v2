<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    //

    /**
     * Act as `$user` while the ACTIVE organization is a school (default HCMUS).
     * A Super Admin who has not switched into a school is in the ROOT/platform context,
     * where courses, exams and question banks do not exist (see EnforceContextScope).
     */
    protected function asSchoolAdmin(\App\Models\User $user, string $orgCode = 'HCMUS'): static
    {
        $org = \App\Models\Organization::where('code', $orgCode)->firstOrFail();

        return $this->actingAs($user)->withSession(['foxy_active_org_id' => $org->id]);
    }
}
