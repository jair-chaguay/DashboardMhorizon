<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Lead;

class LeadController extends Controller
{
    public function index(){
        $leads = Lead::orderBy('updated_at', 'desc')->get();
        return response()->json($leads);
    }
}
