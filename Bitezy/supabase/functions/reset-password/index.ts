import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, name, password } = await req.json()

    if (!RESEND_API_KEY) {
      throw new Error('Missing RESEND_API_KEY secret')
    }

    // Call Resend API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Bitezy <onboarding@resend.dev>', // MUST stay this for testing!
        to: [email],
        subject: 'Bitezy: Your secret password is here! 🧐',
        text: `Hey ${name}! Memory glitch? Hunger is a real brain drain. Your Bitezy password is: ${password}. Bite in seconds!`,
        html: `
          <div style="font-family: 'Helvetica', 'Arial', sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 0; overflow: hidden;">
            <div style="background-color: #02844F; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 900;">Bitezy</h1>
            </div>
            <div style="padding: 30px; text-align: center;">
              <h2 style="color: #02844F; font-size: 20px; font-weight: 800; margin-bottom: 15px;">Hey ${name}!</h2>
              <p style="font-size: 15px; color: #64748B; line-height: 1.5; margin-bottom: 25px;">
                Memory glitch? Hunger is a real brain drain. We've secured your password right here:
              </p>
              
              <div style="background: #F1F5F9; border: 2px dashed #02844F; border-radius: 12px; padding: 25px; text-align: center;">
                <span style="font-size: 11px; color: #94A3B8; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 5px;">YOUR PASSWORD</span>
                <span style="font-size: 32px; font-weight: 900; color: #1E293B; letter-spacing: 3px;">${password}</span>
              </div>

              <p style="font-size: 13px; color: #94A3B8; margin-top: 25px; font-weight: 600;">
                Don't keep the snacks waiting. Let's go! 🥨
              </p>
            </div>
            <div style="padding: 15px; text-align: center; border-top: 1px solid #f1f5f9; background-color: #fafbfc;">
              <p style="font-size: 10px; color: #CBD5E1; font-weight: 800; letter-spacing: 1px; margin: 0;">BITEZY 2026 • BITE IN SECONDS</p>
            </div>
          </div>
        `,
      }),
    })

    const resData = await res.json()

    // If Resend rejected the request, return that error explicitly
    if (!res.ok) {
      return new Response(JSON.stringify({ error: resData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: res.status,
      })
    }

    return new Response(JSON.stringify(resData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
