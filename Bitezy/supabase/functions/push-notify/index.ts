import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { user_id, title, body, data } = await req.json()
    console.log(`🔔 Sending Push Notification to user ${user_id}: ${title}`);

    // 1. Get the user's push token
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('expo_push_token')
      .eq('id', user_id)
      .single()

    if (userError || !userData?.expo_push_token) {
      console.error(`❌ Push Error: No token for user ${user_id}`);
      throw new Error('User not found or no push token available')
    }

    const expoPushToken = userData.expo_push_token

    // 2. Send to Expo Push API
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: expoPushToken,
        sound: 'joy.mp3', // Matches bundled filename in app.json
        title: title,
        body: body,
        data: data || {},
        priority: 'high',
        ttl: 20000, 
        channelId: 'default',
      }),
    })

    const resData = await res.json()

    return new Response(JSON.stringify(resData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
