<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ApiAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $sqlite = config('database.connections.sqlite');
        foreach (['pgsql', 'local_mysql'] as $connection) {
            config([
                "database.connections.{$connection}" => array_merge(
                    $sqlite,
                    ['name' => $connection, 'database' => ':memory:'],
                ),
            ]);
            DB::purge($connection);
        }

        Artisan::call('migrate', ['--database' => 'pgsql', '--force' => true]);
    }

    public function test_registration_creates_a_safe_user_profile(): void
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Test Student',
            'email' => 'test@example.com',
            'password' => 'StrongPass123!',
        ]);

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', 'Test Student')
            ->assertJsonPath('data.email', 'test@example.com')
            ->assertJsonMissingPath('data.password')
            ->assertJsonMissingPath('token');

        $this->assertDatabaseHas('users', ['email' => 'test@example.com'], 'pgsql');
        $this->assertNotSame('StrongPass123!', User::on('pgsql')->first()->password);
    }

    public function test_registration_rejects_duplicate_email_addresses(): void
    {
        User::on('pgsql')->create([
            'name' => 'Existing User',
            'email' => 'existing@example.com',
            'password' => 'StrongPass123!',
        ]);

        $this->postJson('/api/register', [
            'name' => 'Duplicate User',
            'email' => 'existing@example.com',
            'password' => 'StrongPass123!',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_login_returns_a_token_for_valid_credentials(): void
    {
        User::on('pgsql')->create([
            'name' => 'Login User',
            'email' => 'login@example.com',
            'password' => 'StrongPass123!',
        ]);

        $this->postJson('/api/login', [
            'email' => 'login@example.com',
            'password' => 'StrongPass123!',
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('token_type', 'Bearer')
            ->assertJsonStructure(['token', 'expires_at']);
    }

    public function test_login_rejects_invalid_credentials_without_a_token(): void
    {
        User::on('pgsql')->create([
            'name' => 'Login User',
            'email' => 'login@example.com',
            'password' => 'StrongPass123!',
        ]);

        $this->postJson('/api/login', [
            'email' => 'login@example.com',
            'password' => 'WrongPass123!',
        ])->assertUnauthorized()
            ->assertJsonPath('success', false)
            ->assertJsonMissingPath('token');
    }

    public function test_authenticated_user_can_access_me(): void
    {
        $user = User::on('pgsql')->create([
            'name' => 'Profile User',
            'email' => 'profile@example.com',
            'password' => 'StrongPass123!',
        ]);
        $token = $user->createToken('test-token')->plainTextToken;

        $this->withToken($token)->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.email', 'profile@example.com')
            ->assertJsonMissingPath('data.password');
    }

    public function test_student_endpoint_rejects_unauthenticated_requests(): void
    {
        $this->getJson('/api/students?source=cloud')->assertUnauthorized();
    }

    public function test_authenticated_users_can_read_students_from_either_source(): void
    {
        foreach (['pgsql', 'local_mysql'] as $connection) {
            Schema::connection($connection)->create('students', function ($table): void {
                $table->id();
                $table->string('name');
            });
            DB::connection($connection)->table('students')->insert([
                ['name' => 'Student One'],
                ['name' => 'Student Two'],
            ]);
        }

        $user = User::on('pgsql')->create([
            'name' => 'Student API User',
            'email' => 'student-api@example.com',
            'password' => 'StrongPass123!',
        ]);
        $token = $user->createToken('test-token')->plainTextToken;

        foreach (['cloud', 'physical'] as $source) {
            $this->withToken($token)->getJson('/api/students?source='.$source)
                ->assertOk()
                ->assertJsonPath('success', true)
                ->assertJsonPath('source', $source)
                ->assertJsonPath('count', 2);
        }
    }

    public function test_login_is_rate_limited(): void
    {
        $credentials = [
            'email' => 'missing@example.com',
            'password' => 'StrongPass123!',
        ];

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/login', $credentials)->assertUnauthorized();
        }

        $this->postJson('/api/login', $credentials)->assertTooManyRequests();
    }

    public function test_logout_revokes_the_current_token(): void
    {
        $user = User::on('pgsql')->create([
            'name' => 'Logout User',
            'email' => 'logout@example.com',
            'password' => 'StrongPass123!',
        ]);
        $token = $user->createToken('test-token')->plainTextToken;

        $this->withToken($token)->postJson('/api/logout')
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseCount('personal_access_tokens', 0, 'pgsql');
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/me')->assertUnauthorized();
    }
}
