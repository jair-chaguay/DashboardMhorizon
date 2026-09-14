<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Lead;
use Illuminate\Support\Facades\Log;

class MailchimpWebhookController extends Controller
{
    public function handle(Request $request)
    {
        if($request->isMethod('head')) {
            return response('', 200);
        }

        $payload = $request->input('madrill_events');
        if($payload){
            return response()->json(['error'=>'No payload'], 400);
        }

        $events = json_decode($payload, true);

        foreach ($events as $event){
            $eventType = $event['event'];
            $email = $event['msg']['email'];

            $lead = Lead::firstOrCreate(
                ['email'=>$email],
                ['fase'=>1, 'status'=>'Ingresado por Webhook']
            );

            if ($eventType === 'open'){
                $lead->increment('opens');
                $lead->last_interaction_at = now();
            } elseif($eventType === 'click'){
                $lead->increment('clicks');
                $lead->last_interaction_at = now();
            }

            Log::info("Mailchimp Event: {$eventType} registrado para {$email}");
        }
        return response()->json(['status' => 'success']);
    }
}
