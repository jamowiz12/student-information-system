<?php

namespace App\Http\Controllers;

use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use PDOException;

class StudentController extends Controller
{
    public function index(Request $request)
    {
        $validator = Validator::make($request->query(), [
            'source' => ['required', 'in:cloud,physical'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'The source parameter must be either cloud or physical.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $source = $validator->validated()['source'];
        $connection = $source === 'cloud' ? 'pgsql' : 'local_mysql';

        try {
            $students = DB::connection($connection)
                ->table('students')
                ->orderBy('id')
                ->get();
        } catch (QueryException|PDOException) {
            return response()->json([
                'success' => false,
                'source' => $source,
                'message' => 'Unable to retrieve student records from the selected database.',
            ], 503);
        }

        return response()->json([
            'success' => true,
            'source' => $source,
            'count' => $students->count(),
            'data' => $students,
        ]);
    }
}
