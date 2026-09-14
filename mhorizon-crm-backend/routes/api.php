<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\MailchimpWebhookController;
use App\Http\Controllers\Api\LeadController;

Route::match(['head', 'post'], '/webhooks/mailchimp', [MailchimpWebhookController::class, 'handle']);
Route::get('/leads', [LeadController::class, 'index']);

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');
