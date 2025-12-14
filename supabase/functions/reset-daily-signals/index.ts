// Supabase Edge Function: Reset Monthly Signals
// Runs on the 1st of each month at midnight UTC to reset the monthly signal counter for all users
//
// Deploy: supabase functions deploy reset-daily-signals
// Schedule: Use Supabase Dashboard > Database > Extensions > pg_cron
//           Cron: '0 0 1 * *' (1st of every month at 00:00 UTC)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get Supabase credentials from environment
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }

    // Create admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the start of current month at midnight UTC
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      1, 0, 0, 0
    ));

    // Reset signal counts for users whose reset time is before this month
    // Note: signals_used_today column is repurposed for monthly tracking
    const { data, error, count } = await supabase
      .from("profiles")
      .update({
        signals_used_today: 0,
        signals_reset_at: now.toISOString(),
      })
      .lt("signals_reset_at", startOfMonth.toISOString())
      .select("id");

    if (error) {
      console.error("Reset error:", error);
      throw error;
    }

    const usersReset = data?.length || 0;
    console.log(`Reset monthly signals for ${usersReset} users`);

    // Also check for expired Pro Days and update tier if needed
    const { data: expiredProDays, error: proError } = await supabase
      .from("profiles")
      .select("id, pro_day_expires_at")
      .not("pro_day_expires_at", "is", null)
      .lt("pro_day_expires_at", now.toISOString());

    if (!proError && expiredProDays && expiredProDays.length > 0) {
      console.log(`Found ${expiredProDays.length} expired Pro Day users`);
      // Pro Day expiration is handled automatically by the effective_tier calculation
      // No action needed here, but you could send notifications
    }

    return new Response(
      JSON.stringify({
        success: true,
        users_reset: usersReset,
        reset_type: "monthly",
        timestamp: now.toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
