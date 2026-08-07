import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const atUsername = Deno.env.get("AFRICASTALKING_USERNAME") ?? "";
    const atApiKey = Deno.env.get("AFRICASTALKING_API_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all users
    const { data: users, error: usersError } = await supabase
      .from("wpt_users")
      .select("id, name, phone, balance, is_blocked")
      .eq("is_blocked", false);

    if (usersError || !users) {
      console.error("Error fetching users:", usersError);
      return new Response(JSON.stringify({ error: "Could not fetch users" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all user IDs who have deposits
    const { data: deposits } = await supabase
      .from("wpt_deposits")
      .select("user_id")
      .eq("status", "approved");

    // Get all user IDs who have investments
    const { data: investments } = await supabase
      .from("wpt_investments")
      .select("user_id");

    const depositUserIds = new Set((deposits || []).map((d: { user_id: string }) => d.user_id));
    const investUserIds = new Set((investments || []).map((i: { user_id: string }) => i.user_id));

    // Filter users who haven't deposited OR haven't invested
    const targetUsers = users.filter((u: { id: string; balance: number }) =>
      !depositUserIds.has(u.id) || !investUserIds.has(u.id)
    );

    if (targetUsers.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "No users to remind" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build message based on user status
    const results: { phone: string; status: string }[] = [];

    for (const user of targetUsers) {
      const hasDeposited = depositUserIds.has(user.id);
      const hasInvested = investUserIds.has(user.id);

      let message = "";
      if (!hasDeposited) {
        message = `Habari ${user.name}! Karibu tena WEKEZA PESA TZ. Bado hujaweka pesa kwenye akaunti yako. Weka pesa leo na uanze kupata faida ya 10% kwa siku kwa siku 10. Ingia kwenye app sasa!`;
      } else if (!hasInvested) {
        message = `Habari ${user.name}! Una pesa kwenye akaunti yako ya WEKEZA PESA TZ. Usiache zimelala - wekeza sasa na upate faida ya 10% kwa siku. Ingia app sasa ili uanze kupata faida!`;
      }

      if (!message) continue;

      // Send SMS via Africa's Talking
      const formData = new URLSearchParams();
      formData.append("username", atUsername);
      formData.append("to", user.phone);
      formData.append("message", message);
      formData.append("from", "WEKEZA");

      const smsResp = await fetch("https://api.africastalking.com/version1/messaging", {
        method: "POST",
        headers: {
          "apiKey": atApiKey,
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        body: formData.toString(),
      });

      if (smsResp.ok) {
        results.push({ phone: user.phone, status: "sent" });
        console.log(`Reminder sent to ${user.phone}`);
      } else {
        const errText = await smsResp.text();
        console.error(`Failed to send to ${user.phone}:`, errText);
        results.push({ phone: user.phone, status: "failed" });
      }

      // Small delay between sends to avoid rate limiting
      await new Promise(r => setTimeout(r, 200));
    }

    const sentCount = results.filter(r => r.status === "sent").length;
    console.log(`Daily reminders: ${sentCount}/${targetUsers.length} sent`);

    return new Response(JSON.stringify({
      success: true,
      sent: sentCount,
      total: targetUsers.length,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Daily reminder error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
