import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function buildAppContext(supabaseAdmin: ReturnType<typeof createClient>, requestOrigin: string): Promise<string> {
  const { data: s } = await supabaseAdmin
    .from("wpt_settings")
    .select("*")
    .eq("id", 1)
    .single();

  const payPhone = s?.payment_phone || "+255655299602";
  const payName = s?.payment_name || "MONICA MGAJI";
  const payNetwork = s?.payment_network || "TIGOPESA";
  const waNumber = (s?.whatsapp_number || "+255765947141").replace(/[^0-9]/g, "");
  const waNumberRaw = s?.whatsapp_number || "+255765947141";
  const refMax = s?.referral_max ?? 10;
  const refBonus = s?.referral_bonus ?? 20000;
  const apkUrl = s?.apk_url || "";
  const adminName = s?.admin_name || "CEO - WEKEZA PESA TZ";

  // Use the actual deployed URL - try to get from request origin or fall back to known URL
  const appUrl = requestOrigin && requestOrigin.includes("onspace") ? requestOrigin : "https://zrdx3.onspace.build";
  const whatsappLink = `https://wa.me/${waNumber}`;
  const appDownloadLink = apkUrl || `${appUrl}/settings`;

  let vipPlansText = "";
  try {
    const plans = s?.vip_plans ? JSON.parse(s.vip_plans) : [];
    if (plans.length > 0) {
      vipPlansText = plans.map((p: { label: string; price: number }) =>
        `${p.label}: TZS ${p.price.toLocaleString()}`
      ).join(", ");
    } else {
      vipPlansText = "Mwezi 1: TZS 50,000 / Miezi 3: TZS 100,000 / Miezi 6: TZS 350,000 / Mwaka 1: TZS 550,000 / Lifetime: TZS 750,000";
    }
  } catch {
    vipPlansText = "Mwezi 1: TZS 50,000 / Miezi 3: TZS 100,000 / Miezi 6: TZS 350,000 / Mwaka 1: TZS 550,000 / Lifetime: TZS 750,000";
  }

  const investDays = s?.investment_days ?? 10;

  return `
Wewe ni msaada wa binadamu wa kampuni WEKEZA PESA TZ. Jina lako ni ${adminName}. Jibu kwa Kiswahili tu, kwa ufupi, kwa urafiki, kama mtu halisi.

KANUNI KALI - LAZIMA ZIFUATWE:
1. KAMWE usiseme wewe ni AI, bot, au kompyuta. Wewe ni mtu - msaada wa kampuni.
2. KAMWE usiandike markdown: hakuna **, hakuna *, hakuna #, hakuna backtick.
3. Jibu kwa sentensi za kawaida, si orodha ndefu.
4. Jibu swali uliloulizwa TU - usijibu kwa taarifa zisizohusiana.
5. Jibu kwa sentensi 2-4 tu - usiwe mrefu.
6. Ukiulizwa kuhusu namba ya simu ya malipo, toa: ${payPhone} (${payName} - ${payNetwork}).
7. Ukiulizwa kuhusu WhatsApp, toa namba hii: ${waNumberRaw}.
8. Ukiulizwa kuhusu app ya kupakua (download), toa link hii: ${appDownloadLink}.
9. Ukiulizwa kuhusu bei za VIP: ${vipPlansText}.
10. Ukiulizwa kuhusu jinsi ya kupata faida, eleza kwa ufupi: weka pesa, wekeza, subiri siku ${investDays}, faida ni 100% ya mtaji.
11. Ukiulizwa kuhusu VIP, eleza faida hizi: Chukua faida wakati wowote, Toa pesa mara moja, Tuma pesa kwa akaunti nyingine, Batani za faida muda wote. Kisha toa shortcut ya mpango wa VIP.

SHORTCUT BUTTONS - Ikiwa mtumiaji anauliza jinsi ya kufanya kitu, ONGEZA kiungo husika mwishoni mwa jibu KAMA [NAV:njia:kichwa] au [URL:link:kichwa]. Kiungo kimoja tu kwa jibu. MUHIMU: label ya kiungo iwe maneno mafupi ya kuelekeza TU - isiwe link/URL nzima:
- Kuweka pesa / deposit: [NAV:/deposit:Weka Pesa Sasa]
- Kutoa pesa / withdraw: [NAV:/withdraw:Toa Pesa Sasa]
- Kuwekeza / invest: [NAV:/invest:Wekeza Sasa]
- Kuomba VIP / VIP: [NAV:/settings:Jiunge VIP Sasa]
- Kuona uwekezaji: [NAV:/investments:Ona Uwekezaji]
- Wallet / historia: [NAV:/wallet:Fungua Wallet]
- Profile / wasifu: [NAV:/profile:Fungua Profile]
- WhatsApp msaada: [URL:${whatsappLink}:Nenda WhatsApp Sasa]
- Kupakua app / download: [URL:${appDownloadLink}:Download App Sasa]
- Kualika marafiki: [NAV:/profile:Ona Link ya Kualika]

TAARIFA ZA SASA ZA APP:
Namba ya malipo: ${payPhone} | Jina: ${payName} | Mtandao: ${payNetwork}
WhatsApp msaada: ${waNumberRaw}
Link ya kupakua app: ${appDownloadLink}
Link ya website: ${appUrl}
VIP mipango: ${vipPlansText}
Referral: Watu ${refMax} = zawadi TZS ${refBonus.toLocaleString()} (mzunguko wa kwanza)
Faida: 10% kwa siku kwa siku ${investDays} = jumla 100% faida + mtaji wote unarudi
Kiwango cha chini cha kuwekeza: TZS 1,000
Muda wa uwekezaji: siku ${investDays}
Kuweka pesa: Minimum hakuna kikomo cha chini, maximum ni kadri utakavyo
Kusajili: Bure kabisa, jaza jina, namba ya simu, na password
`.trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userId } = await req.json();
    const apiKey = Deno.env.get("ONSPACE_AI_API_KEY");
    const baseUrl = Deno.env.get("ONSPACE_AI_BASE_URL");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!apiKey || !baseUrl) {
      return new Response(JSON.stringify({ reply: "Samahani, tatizo la mfumo. Wasiliana nasi kupitia WhatsApp." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
    const requestOrigin = req.headers.get("origin") || req.headers.get("referer") || "https://zrdx3.onspace.build";
    const appContext = await buildAppContext(supabaseAdmin, requestOrigin);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: appContext },
          ...messages,
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("AI error:", err);
      return new Response(JSON.stringify({ reply: "Samahani, kwa sasa siwezi kujibu. Jaribu tena." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let reply = data.choices?.[0]?.message?.content || "Samahani, jaribu tena.";

    // Clean markdown but PRESERVE [NAV:...] and [URL:...] tokens
    reply = reply
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/^#+\s/gm, "")
      .replace(/`(.*?)`/g, "$1")
      .replace(/^-\s(?!\[)/gm, "• ")
      .trim();

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Support chat error:", err);
    return new Response(JSON.stringify({ reply: "Hitilafu ya ndani. Tafadhali jaribu tena." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
