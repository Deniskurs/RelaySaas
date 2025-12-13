// Supabase Edge Function: Stripe Webhook Handler
// Handles subscription events from Stripe
//
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
// Webhook URL: https://your-project.supabase.co/functions/v1/stripe-webhook
//
// Required secrets (set via Supabase Dashboard > Project Settings > Edge Functions):
// - STRIPE_SECRET_KEY
// - STRIPE_WEBHOOK_SECRET

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.5.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Plan mapping from Stripe price IDs to subscription tiers
const PRICE_TO_TIER: Record<string, string> = {
  "price_1Sdwp9AKcZSTaYXWXBjDvJQo": "pro",      // Pro Monthly
  "price_1Sdwp8AKcZSTaYXWgUr6CQj1": "pro",      // Pro Annual
  "price_1Sdwr3AKcZSTaYXWjvtbcHFn": "premium",  // Premium Monthly
  "price_1Sdwr3AKcZSTaYXWrgQR9CDi": "premium",  // Premium Annual
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeSecretKey || !webhookSecret) {
      throw new Error("Missing Stripe configuration");
    }
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Initialize Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the raw body and signature
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      throw new Error("Missing Stripe signature");
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret,
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing event: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(supabase, stripe, session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(supabase, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabase, subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(supabase, invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(supabase, invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// =============================================================================
// Event Handlers
// =============================================================================

async function handleCheckoutComplete(
  supabase: any,
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  console.log("Checkout completed:", session.id);

  const userId = session.metadata?.user_id;
  const customerId = session.customer as string;

  if (!userId) {
    console.error("No user_id in session metadata");
    return;
  }

  // Update profile with customer ID if not already set
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      stripe_customer_id: customerId,
    })
    .eq("id", userId);

  if (updateError) {
    console.error("Error updating customer ID:", updateError);
  }

  // The subscription update will be handled by customer.subscription.created event
  console.log(`Customer ${customerId} linked to user ${userId}`);
}

async function handleSubscriptionUpdate(
  supabase: any,
  subscription: Stripe.Subscription
) {
  console.log("Subscription update:", subscription.id, subscription.status);

  const customerId = subscription.customer as string;

  // Get the price ID from the subscription
  const priceId = subscription.items.data[0]?.price.id;
  const tier = PRICE_TO_TIER[priceId] || "free";

  // Get user_id from subscription metadata or customer
  let userId = subscription.metadata?.user_id;

  if (!userId) {
    // Look up user by customer ID
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .single();

    if (profile) {
      userId = profile.id;
    } else {
      console.error("Could not find user for customer:", customerId);
      return;
    }
  }

  // Map Stripe status to our status
  let subscriptionStatus = "active";
  if (subscription.status === "past_due") {
    subscriptionStatus = "past_due";
  } else if (subscription.status === "canceled" || subscription.status === "unpaid") {
    subscriptionStatus = "canceled";
  } else if (subscription.status === "trialing") {
    subscriptionStatus = "trialing";
  }

  // Update profile
  const { error } = await supabase
    .from("profiles")
    .update({
      subscription_tier: tier,
      subscription_status: subscriptionStatus,
      stripe_customer_id: customerId,
      subscription_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
    })
    .eq("id", userId);

  if (error) {
    console.error("Error updating subscription:", error);
  } else {
    console.log(`Updated user ${userId} to ${tier} tier (${subscriptionStatus})`);
  }
}

async function handleSubscriptionDeleted(
  supabase: any,
  subscription: Stripe.Subscription
) {
  console.log("Subscription deleted:", subscription.id);

  const customerId = subscription.customer as string;

  // Look up user by customer ID
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!profile) {
    console.error("Could not find user for customer:", customerId);
    return;
  }

  // Downgrade to free tier
  const { error } = await supabase
    .from("profiles")
    .update({
      subscription_tier: "free",
      subscription_status: "canceled",
      subscription_expires_at: null,
    })
    .eq("id", profile.id);

  if (error) {
    console.error("Error downgrading subscription:", error);
  } else {
    console.log(`Downgraded user ${profile.id} to free tier`);
  }
}

async function handlePaymentSucceeded(
  supabase: any,
  invoice: Stripe.Invoice
) {
  console.log("Payment succeeded:", invoice.id);

  // Payment succeeded - subscription should be active
  // Most handling done by subscription.updated event
  // Could add logic here to send receipt email, etc.
}

async function handlePaymentFailed(
  supabase: any,
  invoice: Stripe.Invoice
) {
  console.log("Payment failed:", invoice.id);

  const customerId = invoice.customer as string;

  // Look up user by customer ID
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!profile) {
    console.error("Could not find user for customer:", customerId);
    return;
  }

  // Update status to past_due
  const { error } = await supabase
    .from("profiles")
    .update({
      subscription_status: "past_due",
    })
    .eq("id", profile.id);

  if (error) {
    console.error("Error updating payment failed status:", error);
  } else {
    console.log(`Marked user ${profile.id} as past_due`);
    // Could add email notification here
  }
}
