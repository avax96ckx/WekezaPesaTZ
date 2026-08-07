import { corsHeaders } from "../_shared/cors.ts";

const SENDER_ID = "WEKEZA";

async function sendAfricasTalkingSMS(to: string[], message: string): Promise<{ success: boolean; error?: string }> {
  const apiKey = Deno.env.get("AFRICASTALKING_API_KEY");
  const username = Deno.env.get("AFRICASTALKING_USERNAME");

  if (!apiKey || !username) {
    return { success: false, error: "Africa's Talking credentials not configured" };
  }

  // Format phone numbers - Africa's Talking needs international format
  const formatted = to.map(p => {
    const clean = p.replace(/[^0-9+]/g, "");
    if (clean.startsWith("+")) return clean;
    if (clean.startsWith("255")) return `+${clean}`;
    if (clean.startsWith("0")) return `+255${clean.slice(1)}`;
    return `+255${clean}`;
  }).filter(p => p.length >= 12);

  if (formatted.length === 0) return { success: false, error: "No valid phone numbers" };

  // Africa's Talking has a limit of 1000 numbers per request, chunk if needed
  const chunks: string[][] = [];
  for (let i = 0; i < formatted.length; i += 100) {
    chunks.push(formatted.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    const body = new URLSearchParams({
      username,
      to: chunk.join(","),
      message,
      from: SENDER_ID,
    });

    const response = await fetch("https://api.africastalking.com/version1/messaging", {
      method: "POST",
      headers: {
        "apiKey": apiKey,
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Africa's Talking SMS error:", err);
      return { success: false, error: `SMS API error: ${err}` };
    }

    const result = await response.json();
    console.log("SMS sent:", JSON.stringify(result));
  }

  return { success: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, message, type } = await req.json();
    // to: string[] of phone numbers
    // message: string
    // type: 'single' | 'broadcast'

    if (!to || !Array.isArray(to) || to.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "No recipients provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!message || message.trim().length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Message is empty" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prefix message with brand name if not already included
    const fullMessage = message.includes("WEKEZA PESA TZ") ? message : `WEKEZA PESA TZ:\n${message}`;

    const result = await sendAfricasTalkingSMS(to, fullMessage);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Send SMS error:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
