<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TestCase extends Model
{
    use HasFactory;

    protected $fillable = [
        'programming_problem_id',
        'input_data',
        'expected_output',
        'is_sample',
        'score_weight',
    ];

    protected $casts = [
        'is_sample' => 'boolean',
        'score_weight' => 'float',
    ];

    public function problem(): BelongsTo
    {
        return $this->belongsTo(ProgrammingProblem::class, 'programming_problem_id');
    }
}
