<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $input = $request->all();
        if (isset($input['email']) && is_string($input['email'])) {
            $input['email'] = strtolower(trim($input['email']));
        }

        try {
            $validator = Validator::make($input, [
                'name' => ['required', 'string', 'max:255'],
                'email' => ['required', 'string', 'email', 'max:255', Rule::unique('pgsql.users', 'email')],
                'password' => ['required', 'string', 'max:255', Password::min(8)],
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'The provided registration data is invalid.',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $user = User::on('pgsql')->create($validator->validated());
        } catch (QueryException $exception) {
            if (in_array((string) $exception->getCode(), ['23000', '23505'], true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'An account with this email address already exists.',
                ], 422);
            }

            return $this->databaseUnavailable();
        }

        return response()->json([
            'success' => true,
            'data' => $this->profile($user),
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $input = $request->all();
        if (isset($input['email']) && is_string($input['email'])) {
            $input['email'] = strtolower(trim($input['email']));
        }

        try {
            $validator = Validator::make($input, [
                'email' => ['required', 'string', 'email', 'max:255'],
                'password' => ['required', 'string', 'max:255'],
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'The provided login data is invalid.',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $credentials = $validator->validated();
            $user = User::on('pgsql')->where('email', $credentials['email'])->first();
        } catch (QueryException) {
            return $this->databaseUnavailable();
        }

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'The provided credentials are invalid.',
            ], 401);
        }

        try {
            $token = $user->createToken('api-access', ['*'], now()->addHours(12));
        } catch (QueryException) {
            return $this->databaseUnavailable();
        }

        return response()->json([
            'success' => true,
            'token' => $token->plainTextToken,
            'token_type' => 'Bearer',
            'expires_at' => $token->accessToken->expires_at?->toISOString(),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->profile($request->user()),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully.',
        ]);
    }

    private function profile(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'email_verified_at' => $user->email_verified_at,
        ];
    }

    private function databaseUnavailable(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'Authentication service is temporarily unavailable.',
        ], 503);
    }
}
