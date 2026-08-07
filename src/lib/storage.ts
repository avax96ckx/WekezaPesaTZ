import { supabase } from "./supabase";
import { User, Investment, DepositRequest, WithdrawRequest, AppSettings, VipRequest, Transfer } from "@/types";

const ADMIN_PHONE = "+255746715235";
const ADMIN_PASSWORD = "avax1975";

// ── Format ─────────────────────────────────────────────
export function formatTZS(amount: number): string {
  return `TZS ${Math.floor(amount).toLocaleString("en-TZ")}`;
}

// ── Session ────────────────────────────────────────────
export function getCurrentUserId(): string | null {
  return localStorage.getItem("wpt_uid");
}
export function setCurrentUserId(id: string | null) {
  if (id) localStorage.setItem("wpt_uid", id);
  else localStorage.removeItem("wpt_uid");
}
export function isAdminLoggedIn(): boolean {
  return localStorage.getItem("wpt_admin") === "true";
}
export function setAdminLoggedIn(v: boolean) {
  if (v) localStorage.setItem("wpt_admin", "true");
  else localStorage.removeItem("wpt_admin");
}

// ── Generate account ID ────────────────────────────────
function genAccountId(): string {
  return "WPT" + String(Math.floor(100000 + Math.random() * 900000));
}

// ── File Upload Helpers ────────────────────────────────
export async function uploadScreenshot(file: File, userId: string): Promise<string | null> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("wpt-screenshots").upload(path, file, { upsert: true });
  if (error) { console.error("Screenshot upload error:", error); return null; }
  const { data } = supabase.storage.from("wpt-screenshots").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadProfilePhoto(file: File, userId: string): Promise<string | null> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/profile.${ext}`;
  const { error } = await supabase.storage.from("wpt-profiles").upload(path, file, { upsert: true });
  if (error) { console.error("Profile upload error:", error); return null; }
  const { data } = supabase.storage.from("wpt-profiles").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadApk(file: File): Promise<string | null> {
  const path = `app/wekeza-pesa.apk`;
  const { error } = await supabase.storage.from("wpt-apk").upload(path, file, { upsert: true });
  if (error) { console.error("APK upload error:", error); return null; }
  const { data } = supabase.storage.from("wpt-apk").getPublicUrl(path);
  await supabase.from("wpt_settings").update({ apk_updated_at: new Date().toISOString() }).eq("id", 1);
  return data.publicUrl;
}

// ── Users ──────────────────────────────────────────────
export async function registerUser(name: string, phone: string, password: string): Promise<User | string> {
  const { data: existing } = await supabase.from("wpt_users").select("id").eq("phone", phone).single();
  if (existing) return "Namba ya simu tayari imesajiliwa.";
  const accountId = genAccountId();
  const { data, error } = await supabase
    .from("wpt_users")
    .insert({ name, phone, password, balance: 0, total_earnings: 0, blue_tick: false, is_blocked: false, vip_member: false, account_id: accountId })
    .select()
    .single();
  if (error) return error.message;
  return data as User;
}

export async function loginUser(phone: string, password: string): Promise<User | "admin" | string> {
  if (phone === ADMIN_PHONE && password === ADMIN_PASSWORD) {
    setAdminLoggedIn(true);
    return "admin";
  }
  const { data, error } = await supabase
    .from("wpt_users")
    .select("*")
    .eq("phone", phone)
    .eq("password", password)
    .single();
  if (error || !data) return "Namba ya simu au password si sahihi.";
  // Blocked users can log in - the app will show the blocked overlay after login
  return data as User;
}

export async function verifyUserPassword(userId: string, password: string): Promise<boolean> {
  const { data } = await supabase.from("wpt_users").select("password").eq("id", userId).single();
  return data?.password === password;
}

export async function getUserById(id: string): Promise<User | null> {
  const { data } = await supabase.from("wpt_users").select("*").eq("id", id).single();
  return data as User | null;
}

export async function getUserByAccountId(accountId: string): Promise<User | null> {
  const { data } = await supabase.from("wpt_users").select("*").eq("account_id", accountId).single();
  return data as User | null;
}

export async function updateUser(user: Partial<User> & { id: string }): Promise<void> {
  await supabase.from("wpt_users").update(user).eq("id", user.id);
}

export async function changeUserPassword(userId: string, newPassword: string): Promise<void> {
  await supabase.from("wpt_users").update({ password: newPassword }).eq("id", userId);
}

export async function getAllUsers(): Promise<User[]> {
  const { data } = await supabase.from("wpt_users").select("*").order("created_at", { ascending: false });
  return (data || []) as User[];
}

// ── Investments ────────────────────────────────────────
export async function createInvestment(userId: string, amount: number, days?: number): Promise<Investment> {
  const now = new Date();
  // Use provided days or fetch from settings
  let investDays = days;
  if (!investDays) {
    const { data: s } = await supabase.from("wpt_settings").select("investment_days").eq("id", 1).single();
    investDays = s?.investment_days || 10;
  }
  const endTime = new Date(now.getTime() + investDays * 24 * 60 * 60 * 1000);
  const { data } = await supabase
    .from("wpt_investments")
    .insert({ user_id: userId, amount, start_time: now.toISOString(), end_time: endTime.toISOString(), daily_rate: 0.1, total_earned: 0, is_active: true, is_claimed: false })
    .select()
    .single();
  await sendNotification(userId, "📈 Uwekezaji Umeanza!", `Umewekeza TZS ${amount.toLocaleString()} na utapata faida ya 10% kwa siku kwa siku ${investDays}. Jumla utakayopata: TZS ${(amount * 2).toLocaleString()}!`, "success");
  return data as Investment;
}

export async function getUserInvestments(userId: string): Promise<Investment[]> {
  const { data } = await supabase.from("wpt_investments").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  return (data || []) as Investment[];
}

export async function getInvestmentById(id: string): Promise<Investment | null> {
  const { data } = await supabase.from("wpt_investments").select("*").eq("id", id).single();
  return data as Investment | null;
}

export async function claimInvestment(invId: string, userId: string): Promise<void> {
  const { data: inv } = await supabase.from("wpt_investments").select("*").eq("id", invId).single();
  if (!inv) return;
  // profit accrued (capped at full 100% = amount)
  const profit = Math.min(calcProfit(inv), inv.amount);
  // total returned to user = principal (mtaji) + profit (faida)
  const totalReturn = inv.amount + profit;
  await supabase.from("wpt_investments").update({ is_claimed: true, is_active: false, total_earned: profit }).eq("id", invId);
  const { data: user } = await supabase.from("wpt_users").select("balance, total_earnings").eq("id", userId).single();
  if (user) {
    // Add both principal AND profit back to balance
    await supabase.from("wpt_users").update({
      balance: user.balance + totalReturn,
      total_earnings: user.total_earnings + profit
    }).eq("id", userId);
  }
  await sendNotification(userId, "✅ Umefanikiwa Kuchukua!", `Mtaji TZS ${inv.amount.toLocaleString()} + Faida TZS ${profit.toLocaleString()} = TZS ${totalReturn.toLocaleString()} vimeingia kwenye akaunti yako!`, "success");
}

export async function reinvestInvestment(invId: string, userId: string, amount: number): Promise<void> {
  await supabase.from("wpt_investments").update({ is_claimed: true, is_active: false }).eq("id", invId);
  await createInvestment(userId, amount);
  const { data: st } = await supabase.from("wpt_settings").select("investment_days").eq("id", 1).single();
  const reinvestDays = st?.investment_days || 10;
  await sendNotification(userId, "🔄 Uwekezaji Mpya", `Umewekeza tena TZS ${amount.toLocaleString()} kwa siku ${reinvestDays} mpya!`, "info");
}

export function calcProfit(inv: Investment): number {
  const start = new Date(inv.start_time).getTime();
  const end = new Date(inv.end_time).getTime();
  const now = Date.now();
  const elapsed = now - start;
  const duration = end - start;
  const progress = Math.min(elapsed / duration, 1);
  return Math.floor(inv.amount * progress);
}

// ── Deposits ───────────────────────────────────────────
export async function createDeposit(userId: string, userName: string, amount: number, screenshotUrl: string): Promise<void> {
  await supabase.from("wpt_deposits").insert({ user_id: userId, user_name: userName, amount, screenshot: screenshotUrl, status: "pending" });
  await sendNotification(userId, "📥 Amana Imetumwa", `Amana yako ya TZS ${amount.toLocaleString()} imepokelewa. Subiri uthibitisho wa admin.`, "info");
}

export async function getAllDeposits(): Promise<DepositRequest[]> {
  const { data } = await supabase.from("wpt_deposits").select("*").order("created_at", { ascending: false });
  return (data || []) as DepositRequest[];
}

export async function getUserDeposits(userId: string): Promise<DepositRequest[]> {
  const { data } = await supabase.from("wpt_deposits").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  return (data || []) as DepositRequest[];
}

export async function approveDeposit(depId: string): Promise<void> {
  const { data: dep } = await supabase.from("wpt_deposits").select("*").eq("id", depId).single();
  if (!dep) return;
  await supabase.from("wpt_deposits").update({ status: "approved" }).eq("id", depId);
  const { data: user } = await supabase.from("wpt_users").select("balance, blue_tick, phone").eq("id", dep.user_id).single();
  if (user) {
    const newBal = user.balance + dep.amount;
    await supabase.from("wpt_users").update({ balance: newBal, blue_tick: newBal > 0 }).eq("id", dep.user_id);
  }
  await sendNotification(dep.user_id, "✅ Amana Imekubaliwa!", `Amana yako ya TZS ${dep.amount.toLocaleString()} imekubaliwa na imeingia kwenye akaunti yako.`, "success");
  // Auto SMS
  if (user?.phone) {
    await supabase.functions.invoke("send-sms", { body: { to: [user.phone], message: `Amana yako ya TZS ${dep.amount.toLocaleString()} imekubaliwa na imeingia kwenye akaunti yako. Ingia kwenye app kuwekeza sasa.` } });
  }
}

export async function rejectDeposit(depId: string): Promise<void> {
  const { data: dep } = await supabase.from("wpt_deposits").select("*").eq("id", depId).single();
  await supabase.from("wpt_deposits").update({ status: "rejected" }).eq("id", depId);
  if (dep) {
    await sendNotification(dep.user_id, "❌ Amana Imekataliwa", `Amana yako ya TZS ${dep.amount.toLocaleString()} imekataliwa. Wasiliana na msaada kwa maelezo.`, "error");
    const { data: u } = await supabase.from("wpt_users").select("phone").eq("id", dep.user_id).single();
    if (u?.phone) {
      await supabase.functions.invoke("send-sms", { body: { to: [u.phone], message: `Amana yako ya TZS ${dep.amount.toLocaleString()} imekataliwa. Tuma screenshot sahihi au wasiliana na msaada wetu.` } });
    }
  }
}

// ── Withdrawals ────────────────────────────────────────
export async function createWithdrawal(
  userId: string, userName: string, phone: string,
  recipientName: string, network: string, amount: number
): Promise<string | void> {
  if (amount < 2000) return "Kiwango cha chini cha kutoa ni TZS 2,000.";
  const { data: user } = await supabase.from("wpt_users").select("balance, vip_member").eq("id", userId).single();
  if (!user) return "Mtumiaji hakupatikana.";
  if (user.balance < amount) return "Salio halitosha.";
  await supabase.from("wpt_users").update({ balance: user.balance - amount }).eq("id", userId);
  await supabase.from("wpt_withdrawals").insert({ user_id: userId, user_name: userName, phone, recipient_name: recipientName, network, amount, status: "pending" });
  await sendNotification(userId, "💸 Ombi la Kutoa Pesa", `Ombi lako la kutoa TZS ${amount.toLocaleString()} limepokelewa. Subiri uthibitisho.`, "info");
}

export async function getAllWithdrawals(): Promise<WithdrawRequest[]> {
  const { data } = await supabase.from("wpt_withdrawals").select("*").order("created_at", { ascending: false });
  return (data || []) as WithdrawRequest[];
}

export async function getUserWithdrawals(userId: string): Promise<WithdrawRequest[]> {
  const { data } = await supabase.from("wpt_withdrawals").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  return (data || []) as WithdrawRequest[];
}

export async function approveWithdrawal(wdId: string): Promise<void> {
  const { data: wd } = await supabase.from("wpt_withdrawals").select("*").eq("id", wdId).single();
  await supabase.from("wpt_withdrawals").update({ status: "approved" }).eq("id", wdId);
  if (wd) {
    await sendNotification(wd.user_id, "✅ Pesa Imetumwa!", `TZS ${wd.amount.toLocaleString()} imetumwa kwenye ${wd.network} yako (${wd.phone}) kikamilifu.`, "success");
    await supabase.functions.invoke("send-sms", { body: { to: [wd.phone], message: `TZS ${wd.amount.toLocaleString()} imetumwa kwenye ${wd.network} yako (${wd.phone}) kikamilifu. Ahsante kwa kutumia WEKEZA PESA TZ.` } });
  }
}

export async function rejectWithdrawal(wdId: string): Promise<void> {
  const { data: wd } = await supabase.from("wpt_withdrawals").select("*").eq("id", wdId).single();
  if (!wd) return;
  await supabase.from("wpt_withdrawals").update({ status: "rejected" }).eq("id", wdId);
  const { data: user } = await supabase.from("wpt_users").select("balance").eq("id", wd.user_id).single();
  if (user) await supabase.from("wpt_users").update({ balance: user.balance + wd.amount }).eq("id", wd.user_id);
  await sendNotification(wd.user_id, "❌ Kutoa Pesa Kumekataliwa", `Ombi lako la kutoa TZS ${wd.amount.toLocaleString()} limekataliwa. Pesa imerudishwa kwenye akaunti yako.`, "error");
  await supabase.functions.invoke("send-sms", { body: { to: [wd.phone], message: `Ombi la kutoa TZS ${wd.amount.toLocaleString()} limekataliwa. Pesa imerudishwa kwenye akaunti yako. Wasiliana na msaada kwa maelezo.` } });
}

// ── VIP Requests ───────────────────────────────────────
export async function createVipRequest(userId: string, userName: string, phone: string, planId: string, planLabel: string, amount: number): Promise<void> {
  await supabase.from("wpt_vip_requests").insert({ user_id: userId, user_name: userName, phone, amount, plan_id: planId, plan_label: planLabel, status: "pending" });
  await sendNotification(userId, "👑 Ombi la VIP Limetumwa", `Ombi lako la kujiunga VIP (${planLabel}) limepokelewa. Subiri uthibitisho wa admin.`, "info");
}

export async function getAllVipRequests(): Promise<VipRequest[]> {
  const { data } = await supabase.from("wpt_vip_requests").select("*").order("created_at", { ascending: false });
  return (data || []) as VipRequest[];
}

export async function approveVipRequest(reqId: string): Promise<void> {
  const { data: req } = await supabase.from("wpt_vip_requests").select("*").eq("id", reqId).single();
  if (!req) return;
  await supabase.from("wpt_vip_requests").update({ status: "approved" }).eq("id", reqId);
  await supabase.from("wpt_users").update({ vip_member: true }).eq("id", req.user_id);
  await sendNotification(req.user_id, "🎉 Hongera! Wewe ni VIP Member!", `Umekuwa VIP Member (${req.plan_label})! Sasa unaweza kuchukua faida wakati wowote, toa pesa bila muda wa kusubiri, na tuma pesa kwa akaunti nyingine.`, "success");
  await supabase.functions.invoke("send-sms", { body: { to: [req.phone], message: `Hongera! Umekuwa VIP Member wa WEKEZA PESA TZ (${req.plan_label}). Sasa unaweza kuchukua faida wakati wowote na toa pesa bila kusubiri!` } });
}

export async function rejectVipRequest(reqId: string): Promise<void> {
  const { data: req } = await supabase.from("wpt_vip_requests").select("*").eq("id", reqId).single();
  await supabase.from("wpt_vip_requests").update({ status: "rejected" }).eq("id", reqId);
  if (req) {
    await sendNotification(req.user_id, "❌ Ombi la VIP Limekataliwa", `Ombi lako la VIP (${req.plan_label}) limekataliwa. Wasiliana na msaada kwa maelezo zaidi.`, "error");
    await supabase.functions.invoke("send-sms", { body: { to: [req.phone], message: `Ombi lako la VIP (${req.plan_label}) limekataliwa. Wasiliana na msaada wetu kupitia WhatsApp kwa maelezo zaidi.` } });
  }
}

export async function getUserVipRequest(userId: string): Promise<VipRequest | null> {
  const { data } = await supabase.from("wpt_vip_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).single();
  return data as VipRequest | null;
}

// ── Transfers (VIP feature) ────────────────────────────
export async function createTransfer(
  senderId: string, senderName: string,
  receiverAccountId: string, amount: number
): Promise<string | { receiver: User }> {
  if (amount < 1000) return "Kiwango cha chini cha kutuma ni TZS 1,000.";
  const { data: sender } = await supabase.from("wpt_users").select("balance, vip_member").eq("id", senderId).single();
  if (!sender) return "Mtumiaji hakupatikana.";
  if (!sender.vip_member) return "Lazima uwe VIP member kutuma pesa.";
  if (sender.balance < amount) return "Salio halitosha.";
  const { data: receiver } = await supabase.from("wpt_users").select("*").eq("account_id", receiverAccountId).single();
  if (!receiver) return "Account ID haijulikani. Hakikisha ID ni sahihi.";
  if (receiver.id === senderId) return "Huwezi kutuma pesa kwenye akaunti yako mwenyewe.";
  return { receiver: receiver as User };
}

export async function submitTransfer(
  senderId: string, senderName: string,
  receiverId: string, receiverName: string, receiverPhone: string,
  amount: number
): Promise<string | void> {
  const { data: sender } = await supabase.from("wpt_users").select("balance").eq("id", senderId).single();
  if (!sender || sender.balance < amount) return "Salio halitosha.";
  await supabase.from("wpt_users").update({ balance: sender.balance - amount }).eq("id", senderId);
  await supabase.from("wpt_transfers").insert({ sender_id: senderId, sender_name: senderName, receiver_id: receiverId, receiver_name: receiverName, receiver_phone: receiverPhone, amount, status: "pending" });
  await sendNotification(senderId, "📤 Kutuma Pesa", `Ombi la kutuma TZS ${amount.toLocaleString()} kwa ${receiverName} limepokelewa. Subiri uthibitisho.`, "info");
}

export async function getAllTransfers(): Promise<Transfer[]> {
  const { data } = await supabase.from("wpt_transfers").select("*").order("created_at", { ascending: false });
  return (data || []) as Transfer[];
}

export async function getUserTransfers(userId: string): Promise<Transfer[]> {
  const { data } = await supabase.from("wpt_transfers").select("*")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  return (data || []) as Transfer[];
}

export async function approveTransfer(transferId: string): Promise<void> {
  const { data: tr } = await supabase.from("wpt_transfers").select("*").eq("id", transferId).single();
  if (!tr) return;
  await supabase.from("wpt_transfers").update({ status: "approved" }).eq("id", transferId);
  const { data: receiver } = await supabase.from("wpt_users").select("balance").eq("id", tr.receiver_id).single();
  if (receiver) {
    await supabase.from("wpt_users").update({ balance: receiver.balance + tr.amount }).eq("id", tr.receiver_id);
  }
  await sendNotification(tr.sender_id, "✅ Pesa Imetumwa!", `TZS ${tr.amount.toLocaleString()} imetumwa kwa ${tr.receiver_name} kikamilifu.`, "success");
  await sendNotification(tr.receiver_id, "💰 Umepokea Pesa!", `${tr.sender_name} amekutumia TZS ${tr.amount.toLocaleString()} kwenye akaunti yako.`, "success");
}

export async function rejectTransfer(transferId: string): Promise<void> {
  const { data: tr } = await supabase.from("wpt_transfers").select("*").eq("id", transferId).single();
  if (!tr) return;
  await supabase.from("wpt_transfers").update({ status: "rejected" }).eq("id", transferId);
  const { data: sender } = await supabase.from("wpt_users").select("balance").eq("id", tr.sender_id).single();
  if (sender) {
    await supabase.from("wpt_users").update({ balance: sender.balance + tr.amount }).eq("id", tr.sender_id);
  }
  await sendNotification(tr.sender_id, "❌ Kutuma Pesa Kumekataliwa", `Kutuma TZS ${tr.amount.toLocaleString()} kwa ${tr.receiver_name} kumekataliwa. Pesa imerudishwa.`, "error");
}

// ── Referrals ─────────────────────────────────────────
export async function recordReferral(referrerId: string, referredUserId: string, cycle: number): Promise<void> {
  await supabase.from("wpt_referrals").insert({ referrer_id: referrerId, referred_user_id: referredUserId, cycle });
  const { data: referred } = await supabase.from("wpt_users").select("name").eq("id", referredUserId).single();
  const refName = referred?.name || "Mtu mpya";
  await sendNotification(referrerId, "🎉 Rafiki Amejiunga!", `${refName} amejiunga kupitia kiungo chako! Endelea kuwa na marafiki zaidi ili upate zawadi.`, "success");
}

export interface ReferralStats {
  count: number;
  cycle: number;
  currentMax: number;
  currentBonus: number;
  readyToClaim: boolean;
  myInvEnded: boolean;
  allReferralsInvested: boolean;
  allReferralsEnded: boolean;
  readyCount: number;
}

export async function getReferralStats(userId: string, baseMax = 10, baseBonus = 20000): Promise<ReferralStats> {
  const { data: claims } = await supabase
    .from("wpt_referral_claims")
    .select("cycle")
    .eq("user_id", userId)
    .order("cycle", { ascending: false })
    .limit(1);
  const lastCycle = claims?.[0]?.cycle ?? 0;
  const currentCycle = lastCycle + 1;

  const multiplier = Math.pow(2, currentCycle - 1);
  const currentMax = baseMax * multiplier;
  const currentBonus = baseBonus * multiplier;

  const { data: referrals } = await supabase
    .from("wpt_referrals")
    .select("referred_user_id")
    .eq("referrer_id", userId)
    .eq("cycle", currentCycle);
  const referredIds = (referrals || []).map((r: { referred_user_id: string }) => r.referred_user_id);
  // Cap count at currentMax - don't count beyond the target
  const rawCount = referredIds.length;
  const count = Math.min(rawCount, currentMax);

  const { data: myInvs } = await supabase
    .from("wpt_investments")
    .select("id, is_claimed, end_time")
    .eq("user_id", userId);
  const myInvEnded = (myInvs || []).some(
    (inv: { is_claimed: boolean; end_time: string }) =>
      inv.is_claimed || new Date(inv.end_time).getTime() <= Date.now()
  );

  // Only check up to currentMax referrals for completion
  const idsToCheck = referredIds.slice(0, currentMax);
  let readyCount = 0;
  if (idsToCheck.length > 0) {
    const { data: refInvs } = await supabase
      .from("wpt_investments")
      .select("user_id, is_claimed, end_time")
      .in("user_id", idsToCheck);

    const refInvMap: Record<string, boolean> = {};
    for (const inv of (refInvs || []) as { user_id: string; is_claimed: boolean; end_time: string }[]) {
      if (inv.is_claimed || new Date(inv.end_time).getTime() <= Date.now()) {
        refInvMap[inv.user_id] = true;
      }
    }
    readyCount = idsToCheck.filter((id: string) => refInvMap[id]).length;
  }

  const allReferralsInvested = count >= currentMax;
  const allReferralsEnded = readyCount >= currentMax;
  const readyToClaim = rawCount >= currentMax && allReferralsEnded && myInvEnded;

  return {
    count, cycle: currentCycle, currentMax, currentBonus,
    readyToClaim, myInvEnded, allReferralsInvested, allReferralsEnded, readyCount,
  };
}

export async function claimReferralBonus(userId: string, cycle: number, bonus: number): Promise<void> {
  await supabase.from("wpt_referral_claims").insert({ user_id: userId, cycle, bonus });
  const { data: user } = await supabase.from("wpt_users").select("balance").eq("id", userId).single();
  if (user) {
    await supabase.from("wpt_users").update({ balance: user.balance + bonus }).eq("id", userId);
  }
  await sendNotification(userId, "🎁 Zawadi ya Referral!", `TZS ${bonus.toLocaleString()} ya zawadi ya referral imeingia kwenye akaunti yako. Hongera!`, "success");
}

export async function getUserByReferrerAccountId(accountId: string): Promise<User | null> {
  const { data } = await supabase.from("wpt_users").select("*").eq("account_id", accountId).single();
  return data as User | null;
}

// ── Notifications ──────────────────────────────────────
export interface AppNotification {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  type: string;
  created_at: string;
}

export async function sendNotification(userId: string | null, title: string, message: string, type: string = "info"): Promise<void> {
  await supabase.from("wpt_notifications").insert({ user_id: userId, title, message, type });
}

export async function sendBroadcastNotification(title: string, message: string, type: string = "info"): Promise<void> {
  await supabase.from("wpt_notifications").insert({ user_id: null, title, message, type });
}

export async function getUserNotifications(userId: string, since?: string): Promise<AppNotification[]> {
  let query = supabase
    .from("wpt_notifications")
    .select("*")
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order("created_at", { ascending: false });
  if (since) {
    query = query.gt("created_at", since);
  }
  const { data } = await query;
  return (data || []) as AppNotification[];
}

export async function deleteUserNotifications(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await supabase.from("wpt_notifications").delete().in("id", ids).eq("user_id", userId);
  await supabase.from("wpt_notifications").delete().in("id", ids).is("user_id", null);
}

export function getNotificationLastCleared(): string {
  return localStorage.getItem("wpt_notif_cleared") || new Date(0).toISOString();
}

export function setNotificationLastCleared(): void {
  localStorage.setItem("wpt_notif_cleared", new Date().toISOString());
}

export function getApkLastSeen(): string {
  return localStorage.getItem("wpt_apk_seen") || new Date(0).toISOString();
}

export function setApkLastSeen(): void {
  localStorage.setItem("wpt_apk_seen", new Date().toISOString());
}

// ── Settings ───────────────────────────────────────────
export async function getAppSettings(): Promise<AppSettings> {
  const { data } = await supabase.from("wpt_settings").select("*").eq("id", 1).single();
  const defaultPlans = [
    { id: "monthly", label: "Mwezi 1", price: 50000, months: 1 },
    { id: "quarterly", label: "Miezi 3", price: 100000, months: 3 },
    { id: "biannual", label: "Miezi 6", price: 350000, months: 6 },
    { id: "annual", label: "Mwaka 1", price: 550000, months: 12 },
    { id: "lifetime", label: "Lifetime", price: 750000, months: 0 },
  ];
  if (!data) return {
    payment_phone: "+255655299602", payment_network: "TIGOPESA", payment_name: "MONICA MGAJI",
    whatsapp_number: "+255765947141", apk_url: "", vip_price: 50000, vip_benefits: "",
    vip_plans: defaultPlans, referral_max: 10, referral_bonus: 20000, apk_updated_at: undefined,
    primary_color: "#1e6fff", accent_color: "#5500cc", font_size: "medium", font_family: "Inter",
    notification_sound: "",
  };
  let plans = defaultPlans;
  try { if (data.vip_plans) plans = JSON.parse(data.vip_plans); } catch {}
  return {
    payment_phone: data.payment_phone,
    payment_network: data.payment_network,
    payment_name: data.payment_name,
    whatsapp_number: data.whatsapp_number,
    apk_url: data.apk_url || "",
    vip_price: data.vip_price || 50000,
    vip_benefits: data.vip_benefits || "",
    vip_plans: plans,
    referral_max: data.referral_max ?? 10,
    referral_bonus: data.referral_bonus ?? 20000,
    apk_updated_at: data.apk_updated_at || undefined,
    primary_color: data.primary_color || "#1e6fff",
    accent_color: data.accent_color || "#5500cc",
    font_size: data.font_size || "medium",
    font_family: data.font_family || "Inter",
    admin_name: data.admin_name || "CEO - WEKEZA PESA TZ",
    admin_photo: data.admin_photo || "",
    notification_sound: data.notification_sound || "",
    investment_days: data.investment_days ?? 10,
  };
}

export async function saveAppSettings(s: AppSettings): Promise<void> {
  await supabase.from("wpt_settings").upsert({
    id: 1,
    payment_phone: s.payment_phone,
    payment_network: s.payment_network,
    payment_name: s.payment_name,
    whatsapp_number: s.whatsapp_number,
    apk_url: s.apk_url || "",
    vip_price: s.vip_price || 50000,
    vip_benefits: s.vip_benefits || "",
    vip_plans: JSON.stringify(s.vip_plans || []),
    referral_max: s.referral_max ?? 10,
    referral_bonus: s.referral_bonus ?? 20000,
    primary_color: s.primary_color || "#1e6fff",
    accent_color: s.accent_color || "#5500cc",
    font_size: s.font_size || "medium",
    font_family: s.font_family || "Inter",
    admin_name: s.admin_name || "CEO - WEKEZA PESA TZ",
    admin_photo: s.admin_photo || "",
    notification_sound: s.notification_sound || "",
    investment_days: s.investment_days ?? 10,
  });
}

// ── SMS ───────────────────────────────────────────────
export async function sendSms(to: string[], message: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke("send-sms", {
    body: { to, message },
  });
  if (error || !data?.success) {
    console.error("SMS error:", error?.message || data?.error);
    return false;
  }
  return true;
}

// Apply theme to document
export function applyAppTheme(settings: AppSettings) {
  const root = document.documentElement;
  if (settings.primary_color) root.style.setProperty("--app-primary", settings.primary_color);
  if (settings.accent_color) root.style.setProperty("--app-accent", settings.accent_color);
  const fontSizeMap: Record<string, string> = { small: "13px", medium: "15px", large: "17px" };
  if (settings.font_size) root.style.setProperty("--app-font-size", fontSizeMap[settings.font_size] || "15px");
  if (settings.font_family) {
    const families: Record<string, string> = {
      Inter: "'Inter', sans-serif",
      Roboto: "'Roboto', sans-serif",
      Poppins: "'Poppins', sans-serif",
      Ubuntu: "'Ubuntu', sans-serif",
    };
    root.style.setProperty("--app-font-family", families[settings.font_family] || "'Inter', sans-serif");
  }
}
