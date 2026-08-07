
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAllUsers, getAllDeposits, getAllWithdrawals,
  approveDeposit, rejectDeposit, approveWithdrawal, rejectWithdrawal,
  getAppSettings, saveAppSettings, isAdminLoggedIn, setAdminLoggedIn,
  updateUser, formatTZS, uploadApk,
  getAllVipRequests, approveVipRequest, rejectVipRequest,
  getAllTransfers, approveTransfer, rejectTransfer,
  changeUserPassword, sendNotification, sendBroadcastNotification,
  applyAppTheme,
} from "@/lib/storage";
import { User, DepositRequest, WithdrawRequest, AppSettings, VipRequest, Transfer, VipPlan } from "@/types";
import {
  Users, ArrowDownToLine, ArrowUpFromLine, Settings, LogOut,
  CheckCircle, XCircle, Lock, Unlock, Trash2, Upload, Eye, RefreshCw, Loader2, Crown, Send, Plus, Minus, Bell, Key,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import bgImg from "@/assets/bg-gradient.jpg";

type Tab = "takwimu" | "users" | "deposits" | "withdrawals" | "vip" | "transfers" | "investments_mgmt" | "notifications" | "sms" | "sounds" | "settings" | "theme";

type ManagedInvestment = {
  id: string; user_id: string; amount: number;
  start_time: string; end_time: string;
  is_active: boolean; is_claimed: boolean;
  total_earned: number; created_at: string;
};

const DEFAULT_PLANS: VipPlan[] = [
  { id: "monthly", label: "Mwezi 1", price: 50000, months: 1 },
  { id: "quarterly", label: "Miezi 3", price: 100000, months: 3 },
  { id: "biannual", label: "Miezi 6", price: 350000, months: 6 },
  { id: "annual", label: "Mwaka 1", price: 550000, months: 12 },
  { id: "lifetime", label: "Lifetime", price: 750000, months: 0 },
];

export default function Admin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("takwimu");
  const [users, setUsers] = useState<User[]>([]);
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawRequest[]>([]);
  const [vipRequests, setVipRequests] = useState<VipRequest[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editPhone, setEditPhone] = useState("");
  const [editBalance, setEditBalance] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [viewScreenshot, setViewScreenshot] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [payPhone, setPayPhone] = useState("");
  const [payNet, setPayNet] = useState("");
  const [payName, setPayName] = useState("");
  const [waNum, setWaNum] = useState("");
  const [apkUrl, setApkUrl] = useState("");
  const [vipPlans, setVipPlans] = useState<VipPlan[]>(DEFAULT_PLANS);
  const [refMax, setRefMax] = useState(10);
  const [refBonus, setRefBonus] = useState(20000);
  const [apkUploading, setApkUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const apkFileRef = useRef<HTMLInputElement>(null);

  // Theme
  const [primaryColor, setPrimaryColor] = useState("#1e6fff");
  const [accentColor, setAccentColor] = useState("#5500cc");
  const [fontSize, setFontSize] = useState("medium");
  const [fontFamily, setFontFamily] = useState("Inter");

  // Admin profile
  const [adminName, setAdminName] = useState("CEO - WEKEZA PESA TZ");
  const [adminPhoto, setAdminPhoto] = useState("");
  const [adminPhotoFile, setAdminPhotoFile] = useState<File | null>(null);
  const [adminPhotoPreview, setAdminPhotoPreview] = useState("");
  const [uploadingAdminPhoto, setUploadingAdminPhoto] = useState(false);
  const adminPhotoRef = useRef<HTMLInputElement>(null);

  // Notification form
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifTarget, setNotifTarget] = useState<"all" | string>("all");
  const [sendingNotif, setSendingNotif] = useState(false);

  // SMS
  const [smsMessage, setSmsMessage] = useState("");
  const [smsTarget, setSmsTarget] = useState<"all" | string>("all");
  const [sendingSms, setSendingSms] = useState(false);

  // Sounds
  const [investDays, setInvestDays] = useState(10);
  const [investDaysInput, setInvestDaysInput] = useState("");
  const [notifSoundUrl, setNotifSoundUrl] = useState("");
  const [soundFile, setSoundFile] = useState<File | null>(null);
  const soundFileRef = useRef<HTMLInputElement>(null);

  const [uploadingSound, setUploadingSound] = useState(false);
  const [managedInvestments, setManagedInvestments] = useState<Array<{
    user: User;
    investments: ManagedInvestment[];
  }>>([]);
  // Platform stats for Takwimu tab
  const [platformStats, setPlatformStats] = useState({
    totalUsers: 0, totalBalance: 0, totalEarnings: 0,
    activeInvestments: 0, vipMembers: 0,
    todayDeposits: 0, todayWithdrawals: 0, todayVip: 0,
  });
  const [selectedManagedUser, setSelectedManagedUser] = useState<string | null>(null);
  const [adjustDays, setAdjustDays] = useState<Record<string, string>>({});
  const [adjustHours, setAdjustHours] = useState<Record<string, string>>({});
  const [adjustingInv, setAdjustingInv] = useState<string | null>(null);

  // Pending badges for real-time
  const [pendingDeposits, setPendingDeposits] = useState(0);
  const [pendingWithdrawals, setPendingWithdrawals] = useState(0);
  const [pendingVip, setPendingVip] = useState(0);
  const [pendingTransfers, setPendingTransfers] = useState(0);

  if (!isAdminLoggedIn()) { navigate("/auth"); return null; }

  const loadPlatformStats = useCallback(async () => {
    const [usersResult, depsResult, wdsResult, vipResult, invResult] = await Promise.all([
      supabase.from("wpt_users").select("balance,total_earnings,vip_member,is_blocked"),
      supabase.from("wpt_deposits").select("status"),
      supabase.from("wpt_withdrawals").select("status"),
      supabase.from("wpt_vip_requests").select("status"),
      supabase.from("wpt_investments").select("id").eq("is_active", true).eq("is_claimed", false),
    ]);
    const uList = (usersResult.data || []) as { balance: number; total_earnings: number; vip_member: boolean }[];
    setPlatformStats({
      totalUsers: uList.length,
      totalBalance: uList.reduce((a, u) => a + (u.balance || 0), 0),
      totalEarnings: uList.reduce((a, u) => a + (u.total_earnings || 0), 0),
      activeInvestments: (invResult.data || []).length,
      vipMembers: uList.filter(u => u.vip_member).length,
      todayDeposits: (depsResult.data || []).filter((d: { status: string }) => d.status === "pending").length,
      todayWithdrawals: (wdsResult.data || []).filter((w: { status: string }) => w.status === "pending").length,
      todayVip: (vipResult.data || []).filter((v: { status: string }) => v.status === "pending").length,
    });
  }, []);

  const pollPending = useCallback(async () => {
    const [d, w, v, t] = await Promise.all([
      getAllDeposits(), getAllWithdrawals(), getAllVipRequests(), getAllTransfers(),
    ]);
    setPendingDeposits(d.filter(x => x.status === "pending").length);
    setPendingWithdrawals(w.filter(x => x.status === "pending").length);
    setPendingVip(v.filter(x => x.status === "pending").length);
    setPendingTransfers(t.filter(x => x.status === "pending").length);
  }, []);

  const loadManagedInvestments = useCallback(async () => {
    const { data: invData } = await supabase
      .from("wpt_investments")
      .select("*")
      .eq("is_active", true)
      .eq("is_claimed", false)
      .order("created_at", { ascending: false });
    if (!invData || invData.length === 0) { setManagedInvestments([]); return; }
    const userIds = [...new Set(invData.map((i: ManagedInvestment) => i.user_id))];
    const { data: usersData } = await supabase.from("wpt_users").select("*").in("id", userIds);
    const userMap: Record<string, User> = {};
    (usersData || []).forEach((u: User) => { userMap[u.id] = u; });
    const grouped: Record<string, ManagedInvestment[]> = {};
    for (const inv of invData) {
      if (!grouped[inv.user_id]) grouped[inv.user_id] = [];
      grouped[inv.user_id].push(inv);
    }
    setManagedInvestments(
      Object.entries(grouped)
        .map(([uid, invs]) => ({ user: userMap[uid], investments: invs }))
        .filter(g => g.user)
    );
  }, []);

  const handleAdjustInvestment = async (invId: string, days: number, hours: number) => {
    if (days === 0 && hours === 0) { toast.error("Weka siku au masaa ya kubadilisha."); return; }
    setAdjustingInv(invId);
    const { data: inv } = await supabase.from("wpt_investments").select("end_time").eq("id", invId).single();
    if (!inv) { setAdjustingInv(null); return; }
    const newEnd = new Date(new Date(inv.end_time).getTime() + (days * 86400000) + (hours * 3600000));
    await supabase.from("wpt_investments").update({ end_time: newEnd.toISOString() }).eq("id", invId);
    toast.success(`Muda umebadilishwa kikamilifu!`);
    await loadManagedInvestments();
    setAdjustingInv(null);
  };

  const handleStopInvestment = async (invId: string) => {
    await supabase.from("wpt_investments").update({
      is_active: false,
      end_time: new Date().toISOString(),
    }).eq("id", invId);
    toast.success("Uwekezaji umesimamishwa.");
    await loadManagedInvestments();
  };

  const handleDeleteInvestment = async (invId: string) => {
    await supabase.from("wpt_investments").delete().eq("id", invId);
    toast.success("Uwekezaji umefutwa.");
    await loadManagedInvestments();
  };

  const loadAll = async () => {
    setLoading(true);
    const [u, d, w, s, vr, tr] = await Promise.all([
      getAllUsers(), getAllDeposits(), getAllWithdrawals(), getAppSettings(),
      getAllVipRequests(), getAllTransfers(),
    ]);
    setUsers(u);
    setDeposits(d);
    setWithdrawals(w);
    setSettings(s);
    setVipRequests(vr);
    setTransfers(tr);
    setPayPhone(s.payment_phone);
    setPayNet(s.payment_network);
    setPayName(s.payment_name);
    setWaNum(s.whatsapp_number);
    setApkUrl(s.apk_url || "");
    setVipPlans(s.vip_plans?.length ? s.vip_plans : DEFAULT_PLANS);
    setRefMax(s.referral_max ?? 10);
    setRefBonus(s.referral_bonus ?? 20000);
    setPrimaryColor(s.primary_color || "#1e6fff");
    setAccentColor(s.accent_color || "#5500cc");
    setFontSize(s.font_size || "medium");
    setFontFamily(s.font_family || "Inter");
    setAdminName(s.admin_name || "CEO - WEKEZA PESA TZ");
    setAdminPhoto(s.admin_photo || "");
    setAdminPhotoPreview(s.admin_photo || "");
    setInvestDays(s.investment_days ?? 10);
    setInvestDaysInput(String(s.investment_days ?? 10));
    setNotifSoundUrl((s as AppSettings & { notification_sound?: string }).notification_sound || "");
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    loadManagedInvestments();
    loadPlatformStats();
    // Auto-refresh every 5 seconds (pending badges + investments if on that tab)
    const interval = setInterval(() => {
      pollPending();
      loadPlatformStats();
    }, 5000);
    return () => clearInterval(interval);
  }, [pollPending, loadManagedInvestments, loadPlatformStats]);

  // Refresh investments tab when switched to
  useEffect(() => {
    if (tab === "investments_mgmt") loadManagedInvestments();
  }, [tab, loadManagedInvestments]);

  const handleLogout = () => { setAdminLoggedIn(false); navigate("/auth"); };

  const handleBlockToggle = async (u: User) => {
    await updateUser({ id: u.id, is_blocked: !u.is_blocked });
    toast.success(u.is_blocked ? "Mtumiaji amefunguliwa." : "Mtumiaji amezuiwa.");
    if (!u.is_blocked) {
      await sendNotification(u.id, "⚠️ Akaunti Imezuiwa", "Akaunti yako imezuiwa na admin. Wasiliana na msaada kwa maelezo.", "error");
    } else {
      await sendNotification(u.id, "✅ Akaunti Imefunguliwa", "Akaunti yako imefunguliwa. Unaweza kutumia app kawaida.", "success");
    }
    setSelectedUser(null);
    loadAll();
  };

  const handleDelete = async (u: User) => {
    await supabase.from("wpt_users").delete().eq("id", u.id);
    toast.success("Akaunti imefutwa.");
    setSelectedUser(null);
    loadAll();
  };

  const handleChangePhone = async (u: User) => {
    if (!editPhone.trim()) { toast.error("Weka namba mpya."); return; }
    await updateUser({ id: u.id, phone: editPhone.trim() });
    toast.success("Namba imebadilishwa.");
    setSelectedUser(null);
    setEditPhone("");
    loadAll();
  };

  const handleEditBalance = async (u: User) => {
    const bal = parseInt(editBalance);
    if (isNaN(bal) || bal < 0) { toast.error("Weka salio sahihi."); return; }
    await updateUser({ id: u.id, balance: bal });
    toast.success("Salio limebadilishwa.");
    setSelectedUser(null);
    setEditBalance("");
    loadAll();
  };

  const handleChangePassword = async (u: User) => {
    if (!editPassword.trim() || editPassword.length < 4) { toast.error("Password lazima iwe na angalau herufi 4."); return; }
    await changeUserPassword(u.id, editPassword.trim());
    toast.success("Password imebadilishwa.");
    setEditPassword("");
  };

  const handleToggleVip = async (u: User) => {
    await updateUser({ id: u.id, vip_member: !u.vip_member });
    if (!u.vip_member) {
      await sendNotification(u.id, "🎉 Hongera! Wewe ni VIP Member!", "Admin amekuweka VIP. Sasa unaweza kuchukua faida wakati wowote na kutuma pesa!", "success");
    } else {
      await sendNotification(u.id, "👑 VIP Imeondolewa", "VIP yako imeondolewa na admin. Wasiliana na msaada kwa maelezo.", "warning");
    }
    toast.success(u.vip_member ? "VIP imeondolewa." : "VIP imewashwa.");
    setSelectedUser(null);
    loadAll();
  };

  const handleSaveSettings = async () => {
    let finalAdminPhoto = adminPhoto;
    if (adminPhotoFile) {
      setUploadingAdminPhoto(true);
      const { uploadProfilePhoto } = await import("@/lib/storage");
      const url = await uploadProfilePhoto(adminPhotoFile, "admin");
      setUploadingAdminPhoto(false);
      if (url) { finalAdminPhoto = url; setAdminPhoto(url); setAdminPhotoPreview(url); }
    }
    const s = {
      payment_phone: payPhone, payment_network: payNet, payment_name: payName,
      whatsapp_number: waNum, apk_url: apkUrl,
      vip_plans: vipPlans, referral_max: refMax, referral_bonus: refBonus,
      primary_color: primaryColor, accent_color: accentColor,
      font_size: fontSize, font_family: fontFamily,
      admin_name: adminName, admin_photo: finalAdminPhoto,
      investment_days: investDays,
    } as AppSettings;
    await saveAppSettings(s);
    applyAppTheme(s);
    toast.success("Mipangilio imehifadhiwa!");
  };

  const handleApkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".apk") && file.type !== "application/vnd.android.package-archive") {
      toast.error("Tafadhali chagua faili la APK tu.");
      return;
    }
    setApkUploading(true);
    toast.loading("Inapakia APK...");
    const url = await uploadApk(file);
    toast.dismiss();
    setApkUploading(false);
    if (!url) { toast.error("Imeshindwa kupakia APK."); return; }
    setApkUrl(url);
    await saveAppSettings({ payment_phone: payPhone, payment_network: payNet, payment_name: payName, whatsapp_number: waNum, apk_url: url, vip_plans: vipPlans, referral_max: refMax, referral_bonus: refBonus });
    await sendBroadcastNotification("📱 App Mpya Imepatikana!", "Toleo jipya la WEKEZA PESA TZ limepatikana. Pakua sasa kutoka kwenye 'Download App' ili upate maboresho ya hivi karibuni!", "info");
    toast.success("APK imepakiwa! Arifa imetumwa kwa watumiaji wote.");
  };

  const handleSendNotification = async () => {
    if (!notifTitle.trim() || !notifMessage.trim()) { toast.error("Jaza kichwa na ujumbe wa arifa."); return; }
    setSendingNotif(true);
    if (notifTarget === "all") {
      await sendBroadcastNotification(notifTitle, notifMessage, "info");
      toast.success(`Arifa imetumwa kwa watumiaji wote!`);
    } else {
      await sendNotification(notifTarget, notifTitle, notifMessage, "info");
      const targetUser = users.find(u => u.id === notifTarget);
      toast.success(`Arifa imetumwa kwa ${targetUser?.name || "mtumiaji"}!`);
    }
    setNotifTitle("");
    setNotifMessage("");
    setSendingNotif(false);
  };

  const updatePlan = (idx: number, field: keyof VipPlan, value: string | number) => {
    setVipPlans(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const badgeNum = (n: number) => n > 0 ? (
    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 flex items-center justify-center text-[8px] font-black text-white">{n}</span>
  ) : null;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "takwimu", label: "Takwimu", icon: <span style={{fontSize:11}}>📊</span> },
    { key: "users", label: "Watu", icon: <Users size={13} /> },
    { key: "deposits", label: "Amana", icon: <div className="relative inline-block"><ArrowDownToLine size={13} />{badgeNum(pendingDeposits)}</div> },
    { key: "withdrawals", label: "Toa", icon: <div className="relative inline-block"><ArrowUpFromLine size={13} />{badgeNum(pendingWithdrawals)}</div> },
    { key: "vip", label: "VIP", icon: <div className="relative inline-block"><Crown size={13} />{badgeNum(pendingVip)}</div> },
    { key: "transfers", label: "Tuma", icon: <div className="relative inline-block"><Send size={13} />{badgeNum(pendingTransfers)}</div> },
    { key: "investments_mgmt", label: "Invest", icon: <span style={{fontSize:11}}>📈</span> },
    { key: "notifications", label: "Arifa", icon: <Bell size={13} /> },
    { key: "sms", label: "SMS", icon: <span style={{fontSize:11}}>📱</span> },
    { key: "sounds", label: "Sauti", icon: <span style={{fontSize:11}}>🔔</span> },
    { key: "settings", label: "Set", icon: <Settings size={13} /> },
    { key: "theme", label: "Rangi", icon: <span style={{fontSize:12}}>🎨</span> },
  ];

  return (
    <div className="min-h-screen pb-8"
      style={{ backgroundImage: `url(${bgImg})`, backgroundSize: "cover", backgroundPosition: "center" }}>

      {/* Screenshot Modal */}
      {viewScreenshot && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setViewScreenshot(null)}>
          <img src={viewScreenshot} alt="Screenshot" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center">
          <div className="w-full max-w-sm glass-card p-5 rounded-t-3xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-white font-black text-lg mb-0.5">{selectedUser.name}</h3>
            <p className="text-blue-300/50 text-xs mb-3 font-mono">{selectedUser.account_id}</p>
            <div className="space-y-1.5 text-sm mb-4">
              <div className="flex justify-between"><span className="text-blue-300/60">Simu:</span><span className="text-white">{selectedUser.phone}</span></div>
              <div className="flex justify-between"><span className="text-blue-300/60">Salio:</span><span className="profit-green font-bold">{formatTZS(selectedUser.balance)}</span></div>
              <div className="flex justify-between"><span className="text-blue-300/60">Faida:</span><span className="profit-green font-bold">{formatTZS(selectedUser.total_earnings)}</span></div>
              <div className="flex justify-between"><span className="text-blue-300/60">VIP:</span>
                <span className={selectedUser.vip_member ? "text-yellow-400 font-bold" : "text-blue-300/40"}>{selectedUser.vip_member ? "✓ VIP Member" : "Kawaida"}</span></div>
              <div className="flex justify-between"><span className="text-blue-300/60">Hali:</span>
                <span className={selectedUser.is_blocked ? "text-red-400" : "text-green-400"}>{selectedUser.is_blocked ? "Amezuiwa" : "Hai"}</span></div>
              <div className="flex justify-between"><span className="text-blue-300/60">Alisajiliwa:</span>
                <span className="text-white text-xs">{new Date(selectedUser.created_at).toLocaleDateString("sw-TZ")}</span></div>
            </div>
            <div className="mb-3">
              <label className="text-blue-200 text-xs font-semibold mb-1 block">BADILISHA SALIO</label>
              <div className="flex gap-2">
                <input className="inp flex-1 text-sm py-2" type="number" placeholder="Salio jipya..."
                  value={editBalance} onChange={e => setEditBalance(e.target.value)} />
                <button onClick={() => handleEditBalance(selectedUser)} className="btn-primary px-4 py-2 text-xs font-bold rounded-xl">OK</button>
              </div>
            </div>
            <div className="mb-3">
              <label className="text-blue-200 text-xs font-semibold mb-1 block">BADILISHA NAMBA YA SIMU</label>
              <div className="flex gap-2">
                <input className="inp flex-1 text-sm py-2" placeholder="Namba mpya..."
                  value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                <button onClick={() => handleChangePhone(selectedUser)} className="btn-primary px-4 py-2 text-xs font-bold rounded-xl">OK</button>
              </div>
            </div>
            <div className="mb-4">
              <label className="text-blue-200 text-xs font-semibold mb-1 block">BADILISHA NAMBA YA SIRI</label>
              <div className="flex gap-2">
                <input className="inp flex-1 text-sm py-2" type="password" placeholder="Password mpya..."
                  value={editPassword} onChange={e => setEditPassword(e.target.value)} />
                <button onClick={() => handleChangePassword(selectedUser)}
                  className="px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1"
                  style={{ background: "linear-gradient(135deg,#FF8F00,#FFB300)", color: "#000" }}>
                  <Key size={12} />OK
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button onClick={() => handleBlockToggle(selectedUser)}
                className={`py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1 ${selectedUser.is_blocked ? "bg-green-600/80 text-white" : "bg-yellow-600/80 text-white"}`}>
                {selectedUser.is_blocked ? <><Unlock size={12} />Fungua</> : <><Lock size={12} />Zuia</>}
              </button>
              <button onClick={() => handleToggleVip(selectedUser)}
                className={`py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1 ${selectedUser.vip_member ? "bg-red-700/80 text-white" : "bg-yellow-500/80 text-black"}`}>
                <Crown size={12} />{selectedUser.vip_member ? "Ondoa VIP" : "Weka VIP"}
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(selectedUser)}
                className="flex-1 py-3 rounded-xl font-bold text-xs bg-red-600/80 text-white flex items-center justify-center gap-1">
                <Trash2 size={12} />Futa
              </button>
              <button onClick={() => { setSelectedUser(null); setEditPassword(""); }}
                className="flex-1 py-3 rounded-xl font-bold text-xs bg-blue-900/60 text-white">
                Funga
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-black text-white tracking-widest">ADMIN PANEL</h1>
            <p className="text-blue-300/60 text-xs">Udhibiti wa Kamili • Auto-refresh 5s</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadAll} className="p-2 rounded-lg bg-blue-600/30"><RefreshCw size={16} className="text-blue-300" /></button>
            <button onClick={handleLogout} className="flex items-center gap-1 text-red-400 text-sm font-semibold"><LogOut size={16} />Toka</button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="glass-card p-3 text-center">
            <p className="text-xl font-black text-white">{users.length}</p>
            <p className="text-blue-300/60 text-[10px]">Watumiaji</p>
          </div>
          <div className="glass-card p-3 text-center">
            <p className="text-xl font-black profit-green">{deposits.filter(d => d.status === "pending").length}</p>
            <p className="text-blue-300/60 text-[10px]">Amana</p>
          </div>
          <div className="glass-card p-3 text-center">
            <p className="text-xl font-black text-yellow-400">{vipRequests.filter(v => v.status === "pending").length}</p>
            <p className="text-blue-300/60 text-[10px]">VIP</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl overflow-x-auto mb-4 bg-black/20 p-1 gap-0.5">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-shrink-0 px-2 py-2 rounded-lg text-[9px] font-bold flex flex-col items-center justify-center gap-0.5 min-w-[44px]
                ${tab === t.key ? "bg-blue-600 text-white" : "text-blue-300/60"}`}>
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* TAKWIMU TAB */}
        {!loading && tab === "takwimu" && (
          <div className="space-y-3">
            <div className="glass-card p-4">
              <p className="text-white font-black text-sm mb-3 flex items-center gap-2"><span>📊</span> Takwimu za Mfumo</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="glass-card-dark p-3 rounded-xl text-center">
                  <p className="text-2xl font-black text-white">{platformStats.totalUsers}</p>
                  <p className="text-blue-300/60 text-[10px] mt-0.5">Watumiaji Wote</p>
                </div>
                <div className="glass-card-dark p-3 rounded-xl text-center">
                  <p className="text-lg font-black text-yellow-400 tabular-nums">{formatTZS(platformStats.totalBalance)}</p>
                  <p className="text-blue-300/60 text-[10px] mt-0.5">Salio la Mfumo</p>
                </div>
                <div className="glass-card-dark p-3 rounded-xl text-center">
                  <p className="text-2xl font-black" style={{color:"#00C853"}}>{platformStats.activeInvestments}</p>
                  <p className="text-blue-300/60 text-[10px] mt-0.5">Uwekezaji Hai</p>
                </div>
                <div className="glass-card-dark p-3 rounded-xl text-center">
                  <p className="text-2xl font-black text-yellow-400">{platformStats.vipMembers}</p>
                  <p className="text-blue-300/60 text-[10px] mt-0.5">VIP Members</p>
                </div>
              </div>
            </div>
            <div className="glass-card p-4">
              <p className="text-white font-black text-xs mb-3 tracking-widest">📈 MAOMBI YA LEO YANAYOSUBIRI</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between glass-card-dark p-3 rounded-xl">
                  <span className="text-blue-200/70 text-sm">💰 Amana zinazosub.</span>
                  <span className={`font-black text-lg ${platformStats.todayDeposits > 0 ? "text-yellow-400" : "text-white/40"}`}>{platformStats.todayDeposits}</span>
                </div>
                <div className="flex items-center justify-between glass-card-dark p-3 rounded-xl">
                  <span className="text-blue-200/70 text-sm">💸 Malipo yanayosub.</span>
                  <span className={`font-black text-lg ${platformStats.todayWithdrawals > 0 ? "text-red-400" : "text-white/40"}`}>{platformStats.todayWithdrawals}</span>
                </div>
                <div className="flex items-center justify-between glass-card-dark p-3 rounded-xl">
                  <span className="text-blue-200/70 text-sm">👑 VIP yanayosub.</span>
                  <span className={`font-black text-lg ${platformStats.todayVip > 0 ? "text-orange-400" : "text-white/40"}`}>{platformStats.todayVip}</span>
                </div>
              </div>
            </div>
            <div className="glass-card p-4">
              <p className="text-white font-black text-xs mb-3 tracking-widest">💹 FAIDA YA JUMLA (MFUMO)</p>
              <p className="text-3xl font-black profit-green tabular-nums">{formatTZS(platformStats.totalEarnings)}</p>
              <p className="text-blue-300/40 text-xs mt-1">Jumla ya faida iliyopatikana na watumiaji wote</p>
              <p className="text-blue-300/40 text-[10px] mt-3">⟳ Inabadilika kila sekunde 5</p>
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {!loading && tab === "users" && (
          <div className="space-y-2">
            {users.length === 0 && <p className="text-center text-blue-300/50 py-8">Hakuna watumiaji bado.</p>}
            {users.map(u => (
              <div key={u.id} className="glass-card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center font-black text-white flex-shrink-0">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-bold text-sm truncate">{u.name}</p>
                    {u.vip_member && <Crown size={12} className="text-yellow-400 flex-shrink-0" />}
                    {u.is_blocked && <span className="text-xs text-red-400 font-bold">AMEZUIWA</span>}
                  </div>
                  <p className="text-blue-300/60 text-xs">{u.phone} • <span className="font-mono">{u.account_id}</span></p>
                  <div className="flex gap-3 mt-0.5">
                    <span className="text-xs profit-green font-bold">{formatTZS(u.balance)}</span>
                    <span className="text-xs text-blue-300/50">{new Date(u.created_at).toLocaleDateString("sw-TZ")}</span>
                  </div>
                </div>
                <button onClick={() => { setSelectedUser(u); setEditPhone(u.phone); setEditBalance(String(u.balance)); setEditPassword(""); }}
                  className="p-2 rounded-lg bg-blue-600/30">
                  <Eye size={16} className="text-blue-300" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* DEPOSITS TAB */}
        {!loading && tab === "deposits" && (
          <div className="space-y-3">
                {deposits.length === 0 && <p className="text-center text-blue-300/50 py-8">Hakuna amana bado.</p>}
            {deposits.map(d => (
              <div key={d.id} className="glass-card p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-white font-bold text-sm">{d.user_name}</p>
                    <p className="text-blue-300/60 text-xs">{new Date(d.created_at).toLocaleString("sw-TZ")}</p>
                  </div>
                  <div className="text-right">
                    <p className="profit-green font-black">{formatTZS(d.amount)}</p>
                    <span className={`text-xs font-bold ${d.status === "pending" ? "text-yellow-400" : d.status === "approved" ? "text-green-400" : "text-red-400"}`}>
                      {d.status === "pending" ? "INASUBIRI" : d.status === "approved" ? "IMETHIBITISHWA" : "IMEKATALIWA"}
                    </span>
                  </div>
                </div>
                {d.screenshot && (
                  <button onClick={() => setViewScreenshot(d.screenshot || null)}
                    className="flex items-center gap-1 text-blue-400 text-xs mb-3 underline">
                    <Eye size={12} />Ona Screenshot
                  </button>
                )}
                {d.status === "pending" && (
                  <div className="flex gap-2">
                    <button onClick={() => approveDeposit(d.id).then(loadAll)}
                      className="flex-1 py-2 rounded-xl bg-green-600/80 text-white font-bold text-xs flex items-center justify-center gap-1">
                      <CheckCircle size={14} />Thibitisha
                    </button>
                    <button onClick={() => rejectDeposit(d.id).then(loadAll)}
                      className="flex-1 py-2 rounded-xl bg-red-600/80 text-white font-bold text-xs flex items-center justify-center gap-1">
                      <XCircle size={14} />Kataa
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* WITHDRAWALS TAB */}
        {!loading && tab === "withdrawals" && (
          <div className="space-y-3">
                {withdrawals.length === 0 && <p className="text-center text-blue-300/50 py-8">Hakuna malipo bado.</p>}
            {withdrawals.map(w => (
              <div key={w.id} className="glass-card p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-white font-bold text-sm">{w.user_name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-blue-300/60 text-xs">{w.phone}</p>
                      <button
                        onClick={() => { navigator.clipboard.writeText(w.phone); toast.success("Namba imenakiliwa!"); }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold"
                        style={{ background: "rgba(30,111,255,0.25)", color: "#6aa3ff" }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        COPY
                      </button>
                    </div>
                    <p className="text-blue-300/60 text-xs">{w.network} • Jina: {w.recipient_name}</p>
                    <p className="text-blue-300/60 text-xs">{new Date(w.created_at).toLocaleString("sw-TZ")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-red-400 font-black">{formatTZS(w.amount)}</p>
                    <span className={`text-xs font-bold ${w.status === "pending" ? "text-yellow-400" : w.status === "approved" ? "text-green-400" : "text-red-400"}`}>
                      {w.status === "pending" ? "INASUBIRI" : w.status === "approved" ? "IMETHIBITISHWA" : "IMEKATALIWA"}
                    </span>
                  </div>
                </div>
                {w.status === "pending" && (
                  <div className="flex gap-2">
                    <button onClick={() => approveWithdrawal(w.id).then(loadAll)}
                      className="flex-1 py-2 rounded-xl bg-green-600/80 text-white font-bold text-xs flex items-center justify-center gap-1">
                      <CheckCircle size={14} />Thibitisha
                    </button>
                    <button onClick={() => rejectWithdrawal(w.id).then(loadAll)}
                      className="flex-1 py-2 rounded-xl bg-red-600/80 text-white font-bold text-xs flex items-center justify-center gap-1">
                      <XCircle size={14} />Kataa
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* VIP TAB */}
        {!loading && tab === "vip" && (
          <div className="space-y-3">
            {vipRequests.length === 0 && <p className="text-center text-blue-300/50 py-8">Hakuna maombi ya VIP bado.</p>}
            {vipRequests.map(v => (
              <div key={v.id} className="glass-card p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Crown size={16} className="text-yellow-400" />
                      <p className="text-white font-bold text-sm">{v.user_name}</p>
                    </div>
                    <p className="text-blue-300/60 text-xs">{v.phone}</p>
                    {v.plan_label && <p className="text-yellow-400/80 text-xs font-semibold">Mpango: {v.plan_label}</p>}
                    <p className="text-blue-300/60 text-xs">{new Date(v.created_at).toLocaleString("sw-TZ")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-yellow-400 font-black">{formatTZS(v.amount)}</p>
                    <span className={`text-xs font-bold ${v.status === "pending" ? "text-yellow-400" : v.status === "approved" ? "text-green-400" : "text-red-400"}`}>
                      {v.status === "pending" ? "INASUBIRI" : v.status === "approved" ? "IMETHIBITISHWA" : "IMEKATALIWA"}
                    </span>
                  </div>
                </div>
                {v.status === "pending" && (
                  <div className="flex gap-2">
                    <button onClick={() => approveVipRequest(v.id).then(loadAll)}
                      className="flex-1 py-2 rounded-xl font-bold text-xs text-black flex items-center justify-center gap-1"
                      style={{ background: "linear-gradient(135deg,#FFB300,#FF8F00)" }}>
                      <CheckCircle size={14} />Thibitisha VIP
                    </button>
                    <button onClick={() => rejectVipRequest(v.id).then(loadAll)}
                      className="flex-1 py-2 rounded-xl bg-red-600/80 text-white font-bold text-xs flex items-center justify-center gap-1">
                      <XCircle size={14} />Kataa
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TRANSFERS TAB */}
        {!loading && tab === "transfers" && (
          <div className="space-y-3">
            {transfers.length === 0 && <p className="text-center text-blue-300/50 py-8">Hakuna mihamala ya pesa bado.</p>}
            {transfers.map(tr => (
              <div key={tr.id} className="glass-card p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-white font-bold text-sm">{tr.sender_name} → {tr.receiver_name}</p>
                    <p className="text-blue-300/60 text-xs">{tr.receiver_phone}</p>
                    <p className="text-blue-300/60 text-xs">{new Date(tr.created_at).toLocaleString("sw-TZ")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-yellow-400 font-black">{formatTZS(tr.amount)}</p>
                    <span className={`text-xs font-bold ${tr.status === "pending" ? "text-yellow-400" : tr.status === "approved" ? "text-green-400" : "text-red-400"}`}>
                      {tr.status === "pending" ? "INASUBIRI" : tr.status === "approved" ? "IMETHIBITISHWA" : "IMEKATALIWA"}
                    </span>
                  </div>
                </div>
                {tr.status === "pending" && (
                  <div className="flex gap-2">
                    <button onClick={() => approveTransfer(tr.id).then(loadAll)}
                      className="flex-1 py-2 rounded-xl bg-green-600/80 text-white font-bold text-xs flex items-center justify-center gap-1">
                      <CheckCircle size={14} />Thibitisha
                    </button>
                    <button onClick={() => rejectTransfer(tr.id).then(loadAll)}
                      className="flex-1 py-2 rounded-xl bg-red-600/80 text-white font-bold text-xs flex items-center justify-center gap-1">
                      <XCircle size={14} />Kataa
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* INVESTMENTS MANAGEMENT TAB */}
        {!loading && tab === "investments_mgmt" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-white font-black text-sm">📈 Uwekezaji Unaoendelea</p>
              <button onClick={loadManagedInvestments} className="p-2 rounded-lg bg-blue-600/20">
                <RefreshCw size={14} className="text-blue-300" />
              </button>
            </div>
            <div className="glass-card-dark p-3 rounded-xl mb-2">
              <p className="text-blue-300/60 text-xs">Jumla ya watumiaji wenye uwekezaji hai: <span className="text-white font-bold">{managedInvestments.length}</span></p>
            </div>
            {managedInvestments.length === 0 && (
              <p className="text-center text-blue-300/50 py-8">Hakuna uwekezaji unaoendelea.</p>
            )}
            {managedInvestments.map(({ user: u, investments: invs }) => (
              <div key={u.id} className="glass-card overflow-hidden">
                <button
                  onClick={() => setSelectedManagedUser(selectedManagedUser === u.id ? null : u.id)}
                  className="w-full flex items-center gap-3 p-3">
                  <div className="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center font-black text-white text-sm flex-shrink-0">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-white font-bold text-sm">{u.name}</p>
                    <p className="text-blue-300/50 text-xs">{u.phone} • {invs.length} uwekezaji • {formatTZS(u.balance)}</p>
                  </div>
                  <span className="text-blue-300/40 text-xs">{selectedManagedUser === u.id ? "▲" : "▼"}</span>
                </button>

                {selectedManagedUser === u.id && (
                  <div className="border-t border-blue-500/20 divide-y divide-blue-500/10">
                    {invs.map(inv => {
                      const isEnded = Date.now() >= new Date(inv.end_time).getTime();
                      const remaining = Math.max(0, new Date(inv.end_time).getTime() - Date.now());
                      const daysLeft = Math.floor(remaining / 86400000);
                      const hoursLeft = Math.floor((remaining % 86400000) / 3600000);
                      const minsLeft = Math.floor((remaining % 3600000) / 60000);
                      return (
                        <div key={inv.id} className="p-3">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="text-white font-bold text-sm">{formatTZS(inv.amount)}</p>
                              <p className="text-xs mt-0.5">
                                {isEnded ? (
                                  <span className="text-yellow-400">⚠️ Imeisha - Inasubiri kudaiwa</span>
                                ) : (
                                  <span className="text-green-400">⏱ {daysLeft}d {hoursLeft}h {minsLeft}m zimebaki</span>
                                )}
                              </p>
                              <p className="text-blue-300/40 text-[10px]">
                                {new Date(inv.start_time).toLocaleDateString("sw-TZ")} → {new Date(inv.end_time).toLocaleDateString("sw-TZ")}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleStopInvestment(inv.id)}
                                className="px-2 py-1.5 rounded-lg text-xs font-bold"
                                style={{ background: "rgba(255,179,0,0.2)", color: "#FFB300" }}>
                                Simamisha
                              </button>
                              <button
                                onClick={() => handleDeleteInvestment(inv.id)}
                                className="px-2 py-1.5 rounded-lg text-xs font-bold"
                                style={{ background: "rgba(244,67,54,0.2)", color: "#F44336" }}>
                                Futa
                              </button>
                            </div>
                          </div>
                          {/* Adjust time */}
                          <div className="glass-card-dark rounded-xl p-2.5">
                            <p className="text-blue-200/60 text-[10px] font-semibold mb-2">ONGEZA / PUNGUZA MUDA:</p>
                            <div className="flex gap-2 items-end">
                              <div className="flex-1">
                                <p className="text-blue-300/40 text-[9px] mb-1">Siku</p>
                                <input
                                  className="inp py-1.5 text-sm text-center w-full"
                                  type="number" placeholder="0"
                                  value={adjustDays[inv.id] || ""}
                                  onChange={e => setAdjustDays(prev => ({ ...prev, [inv.id]: e.target.value }))}
                                />
                              </div>
                              <div className="flex-1">
                                <p className="text-blue-300/40 text-[9px] mb-1">Masaa</p>
                                <input
                                  className="inp py-1.5 text-sm text-center w-full"
                                  type="number" placeholder="0"
                                  value={adjustHours[inv.id] || ""}
                                  onChange={e => setAdjustHours(prev => ({ ...prev, [inv.id]: e.target.value }))}
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <button
                                  disabled={adjustingInv === inv.id}
                                  onClick={() => handleAdjustInvestment(
                                    inv.id,
                                    Math.abs(parseInt(adjustDays[inv.id] || "0") || 0),
                                    Math.abs(parseInt(adjustHours[inv.id] || "0") || 0)
                                  )}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                                  style={{ background: "linear-gradient(135deg,#1e6fff,#5500cc)" }}>
                                  {adjustingInv === inv.id ? "..." : "+ Ongeza"}
                                </button>
                                <button
                                  disabled={adjustingInv === inv.id}
                                  onClick={() => handleAdjustInvestment(
                                    inv.id,
                                    -(Math.abs(parseInt(adjustDays[inv.id] || "0") || 0)),
                                    -(Math.abs(parseInt(adjustHours[inv.id] || "0") || 0))
                                  )}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold"
                                  style={{ background: "rgba(244,67,54,0.25)", color: "#F44336" }}>
                                  {adjustingInv === inv.id ? "..." : "- Punguza"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {!loading && tab === "notifications" && (
          <div className="space-y-4">
            <div className="glass-card p-5 space-y-4">
              <p className="text-white font-black text-base flex items-center gap-2">
                <Bell size={18} className="text-yellow-400" /> Tuma Arifa
              </p>
              <div>
                <label className="text-blue-200 text-xs font-semibold mb-1 block">TUMA KWA</label>
                <select className="inp" value={notifTarget} onChange={e => setNotifTarget(e.target.value)}>
                  <option value="all">Watumiaji Wote (Broadcast)</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.phone})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-blue-200 text-xs font-semibold mb-1 block">KICHWA CHA ARIFA</label>
                <input className="inp" placeholder="Mfano: 🎉 Habari Mpya!"
                  value={notifTitle} onChange={e => setNotifTitle(e.target.value)} />
              </div>
              <div>
                <label className="text-blue-200 text-xs font-semibold mb-1 block">UJUMBE</label>
                <textarea className="inp" rows={3} placeholder="Andika ujumbe wako hapa..."
                  value={notifMessage} onChange={e => setNotifMessage(e.target.value)}
                  style={{ resize: "none" }} />
              </div>
              <button onClick={handleSendNotification} disabled={sendingNotif}
                className="btn-primary w-full py-4 font-bold flex items-center justify-center gap-2">
                {sendingNotif ? <><Loader2 size={18} className="animate-spin" />Inatumwa...</> : <><Send size={18} />TUMA ARIFA</>}
              </button>
            </div>
          </div>
        )}

        {/* SOUNDS TAB */}
        {!loading && tab === "sounds" && (
          <div className="space-y-4">
            <div className="glass-card p-5 space-y-3">
              <p className="text-white font-black text-base flex items-center gap-2">
                <span>📱</span> Sauti za Mfumo
              </p>
              <p className="text-blue-300/60 text-xs">Chagua sauti ya arifa kutoka kwenye orodha hii au pakia yako mwenyewe.</p>
              <div className="space-y-2">
                <div>
              <label className="text-blue-200 text-xs font-semibold mb-1 block">SIKU ZA UWEKEZAJI (KIMALIZIO)</label>
              <div className="flex items-center gap-3">
                <input className="inp flex-1" type="number" min={1} max={365}
                  value={investDaysInput}
                  onChange={e => {
                    setInvestDaysInput(e.target.value);
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val > 0) setInvestDays(val);
                  }} />
                <span className="text-blue-300/60 text-sm font-semibold">siku</span>
              </div>
              <p className="text-blue-300/40 text-xs mt-1">Sasa hivi: siku {investDays}. Mabadiliko yataathiri uwekezaji mpya pekee.</p>
            </div>
            {[
                  { label: "iPhone Ding (Kawaida)", url: "https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3" },
                  { label: "iPhone Message Tone", url: "https://www.soundjay.com/misc/sounds/bell-ringing-01.mp3" },
                  { label: "Soft Notification", url: "https://www.soundjay.com/misc/sounds/bell-ringing-04.mp3" },
                ].map(s => (
                  <div key={s.url} className="glass-card-dark p-3 rounded-xl flex items-center gap-3">
                    <span className="text-lg">🔔</span>
                    <span className="text-white text-sm font-semibold flex-1">{s.label}</span>
                    <button onClick={() => { try { new Audio(s.url).play(); } catch {} }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                      style={{ background: "rgba(30,111,255,0.3)" }}>▶ Jaribu</button>
                    <button
                      onClick={async () => {
                        setNotifSoundUrl(s.url);
                        await saveAppSettings({
                          payment_phone: payPhone, payment_network: payNet, payment_name: payName,
                          whatsapp_number: waNum, apk_url: apkUrl, vip_plans: vipPlans,
                          referral_max: refMax, referral_bonus: refBonus,
                          primary_color: primaryColor, accent_color: accentColor,
                          font_size: fontSize, font_family: fontFamily,
                          admin_name: adminName, admin_photo: adminPhoto,
                          notification_sound: s.url,
                        } as AppSettings & { notification_sound: string });
                        toast.success("Sauti imechaguliwa na kuhifadhiwa!");
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold"
                      style={{ background: notifSoundUrl === s.url ? "#00C853" : "rgba(0,200,83,0.3)", color: notifSoundUrl === s.url ? "#000" : "#00C853" }}>
                      {notifSoundUrl === s.url ? "✓ Imechaguliwa" : "Chagua"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card p-5 space-y-4">
              <p className="text-white font-black text-base flex items-center gap-2">
                <span>🎵</span> Pakia Sauti Yako
              </p>
              {notifSoundUrl && !["https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3","https://www.soundjay.com/misc/sounds/bell-ringing-01.mp3","https://www.soundjay.com/misc/sounds/bell-ringing-04.mp3"].includes(notifSoundUrl) && (
                <div className="glass-card-dark p-3 rounded-xl">
                  <p className="text-green-400 text-xs font-bold mb-2">✅ Sauti iliyopakiwa:</p>
                  <audio controls src={notifSoundUrl} className="w-full" style={{ height: 36 }} />
                </div>
              )}
              <input ref={soundFileRef} type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/m4a,audio/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setSoundFile(f); }} />
              <button onClick={() => soundFileRef.current?.click()}
                className="w-full py-4 border-2 border-dashed border-blue-500/40 rounded-2xl flex items-center justify-center gap-3">
                <span className="text-2xl">🎵</span>
                <span className="text-blue-300 font-semibold text-sm">{soundFile ? soundFile.name : "Bonyeza kuchagua faili la sauti"}</span>
              </button>
              {soundFile && (
                <div className="glass-card-dark p-3 rounded-xl">
                  <audio controls src={URL.createObjectURL(soundFile)} className="w-full" style={{ height: 36 }} />
                </div>
              )}
              <button
                disabled={!soundFile || uploadingSound}
                onClick={async () => {
                  if (!soundFile) return;
                  setUploadingSound(true);
                  const arrayBuffer = await soundFile.arrayBuffer();
                  const blob = new Blob([arrayBuffer], { type: "application/octet-stream" });
                  const ext = soundFile.name.split(".").pop() || "mp3";
                  const path = `notification-sound.${ext}`;
                  const { error: upErr } = await supabase.storage.from("wpt-profiles").upload(path, blob, { upsert: true, contentType: "application/octet-stream" });
                  if (upErr) { toast.error("Imeshindwa kupakia: " + upErr.message); setUploadingSound(false); return; }
                  const { data: urlData } = supabase.storage.from("wpt-profiles").getPublicUrl(path);
                  const url = urlData.publicUrl;
                  setNotifSoundUrl(url);
                  setSoundFile(null);
                  await saveAppSettings({
                    payment_phone: payPhone, payment_network: payNet, payment_name: payName,
                    whatsapp_number: waNum, apk_url: apkUrl, vip_plans: vipPlans,
                    referral_max: refMax, referral_bonus: refBonus,
                    primary_color: primaryColor, accent_color: accentColor,
                    font_size: fontSize, font_family: fontFamily,
                    admin_name: adminName, admin_photo: adminPhoto,
                    notification_sound: url,
                  } as AppSettings & { notification_sound: string });
                  toast.success("Sauti ya arifa imehifadhiwa!");
                  setUploadingSound(false);
                }}
                className="btn-primary w-full py-4 font-bold flex items-center justify-center gap-2 disabled:opacity-40">
                {uploadingSound ? <><Loader2 size={18} className="animate-spin" />Inapakia...</> : <>🔔 PAKIA NA HIFADHI SAUTI</>}
              </button>
              {notifSoundUrl && (
                <button onClick={() => { try { new Audio(notifSoundUrl).play(); } catch {} }}
                  className="w-full py-3 rounded-2xl font-bold text-sm"
                  style={{ background: "rgba(30,111,255,0.2)", color: "#6aa3ff", border: "1px solid rgba(30,111,255,0.3)" }}>
                  ▶ Jaribu Sauti ya Sasa
                </button>
              )}
            </div>
          </div>
        )}

        {/* SMS TAB */}
        {!loading && tab === "sms" && (
          <div className="space-y-4">
            <div className="glass-card p-5 space-y-4">
              <p className="text-white font-black text-base flex items-center gap-2"><span>📱</span> Tuma SMS ya Kawaida</p>
              <div className="glass-card-dark p-3 rounded-xl">
                <p className="text-blue-300/70 text-xs">SMS zitatumwa kwa jina <span className="text-white font-bold">WEKEZA</span>.</p>
              </div>
              <div>
                <label className="text-blue-200 text-xs font-semibold mb-1 block">TUMA KWA</label>
                <select className="inp" value={smsTarget} onChange={e => setSmsTarget(e.target.value)}>
                  <option value="all">Watumiaji Wote ({users.length} watu)</option>
                  {users.map(u => (
                    <option key={u.id} value={u.phone}>{u.name} ({u.phone})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-blue-200 text-xs font-semibold mb-1 block">UJUMBE WA SMS</label>
                <textarea className="inp" rows={4} placeholder="Andika ujumbe hapa..."
                  value={smsMessage} onChange={e => setSmsMessage(e.target.value)} style={{ resize: "none" }} />
                <p className="text-blue-300/40 text-xs mt-1">Herufi: {smsMessage.length}/160</p>
              </div>
              <button
                onClick={async () => {
                  if (!smsMessage.trim()) { toast.error("Andika ujumbe wa SMS."); return; }
                  setSendingSms(true);
                  const phones = smsTarget === "all" ? users.map(u => u.phone) : [smsTarget];
                  const { data, error } = await import("@/lib/supabase").then(m => m.supabase.functions.invoke("send-sms", { body: { to: phones, message: smsMessage } }));
                  setSendingSms(false);
                  if (error || !data?.success) { toast.error("Imeshindwa kutuma SMS: " + (data?.error || error?.message || "Hitilafu")); }
                  else { toast.success(`SMS imetumwa kwa ${phones.length} mtu/watu!`); setSmsMessage(""); }
                }}
                disabled={sendingSms}
                className="btn-primary w-full py-4 font-bold flex items-center justify-center gap-2">
                {sendingSms ? <><Loader2 size={18} className="animate-spin" />Inatuma SMS...</> : <>📤 TUMA SMS</>}
              </button>
            </div>
            <div className="glass-card p-5 space-y-3">
              <p className="text-white font-black text-base flex items-center gap-2"><span>⏰</span> Vikumbusho vya Kila Siku</p>
              <div className="glass-card-dark p-3 rounded-xl">
                <p className="text-blue-300/70 text-xs">Tuma SMS za ukumbusho kwa watumiaji ambao bado hawajaweka pesa au hawajawekeza.</p>
              </div>
              <button
                onClick={async () => {
                  setSendingSms(true);
                  const { data, error } = await import("@/lib/supabase").then(m => m.supabase.functions.invoke("daily-reminders", { body: {} }));
                  setSendingSms(false);
                  if (error || !data?.success) { toast.error("Imeshindwa kutuma vikumbusho: " + (error?.message || "Hitilafu")); }
                  else { toast.success(`Vikumbusho vimetumwa kwa ${data?.sent || 0} watu!`); }
                }}
                disabled={sendingSms}
                className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-black"
                style={{ background: "linear-gradient(135deg,#FFB300,#FF8F00)" }}>
                {sendingSms ? <><Loader2 size={18} className="animate-spin text-black" />Inatuma...</> : <>⏰ TUMA VIKUMBUSHO SASA</>}
              </button>
            </div>
          </div>
        )}

        {/* THEME TAB */}
        {!loading && tab === "theme" && (
          <div className="space-y-4">
            <div className="glass-card p-5 space-y-4">
              <p className="text-white font-black text-base">👤 Wasifu wa Msaada (Chat)</p>
              <p className="text-blue-300/50 text-xs">Jina na picha hii itaonekana kwenye ukurasa wa Msaada.</p>
              <div className="flex items-center gap-4">
                <div className="relative">
                  {adminPhotoPreview ? (
                    <img src={adminPhotoPreview} alt="Admin" className="w-16 h-16 rounded-full object-cover border-2 border-blue-500" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center text-white font-black text-2xl border-2 border-blue-500">
                      {adminName.charAt(0)}
                    </div>
                  )}
                  <button onClick={() => adminPhotoRef.current?.click()}
                    className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center border-2 border-white">
                    {uploadingAdminPhoto ? <Loader2 size={12} className="text-white animate-spin" /> : <span className="text-white text-xs">📷</span>}
                  </button>
                </div>
                <div className="flex-1">
                  <label className="text-blue-200 text-xs font-semibold mb-1 block">JINA LA MSAADA</label>
                  <input className="inp text-sm py-2" value={adminName}
                    onChange={e => setAdminName(e.target.value)} placeholder="CEO - WEKEZA PESA TZ" />
                </div>
              </div>
              <input ref={adminPhotoRef} type="file" accept="image/*" className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]; if (!file) return;
                  setAdminPhotoFile(file);
                  const reader = new FileReader();
                  reader.onload = ev => setAdminPhotoPreview(ev.target?.result as string);
                  reader.readAsDataURL(file);
                }} />
            </div>
            <div className="glass-card p-5 space-y-4">
              <p className="text-white font-black text-base">🎨 Rangi na Fonti</p>
              <div>
                <label className="text-blue-200 text-xs font-semibold mb-1 block">RANGI KUU (PRIMARY)</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                    className="w-12 h-10 rounded-xl border-0 cursor-pointer" />
                  <input className="inp flex-1 text-sm py-2" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} placeholder="#1e6fff" />
                </div>
              </div>
              <div>
                <label className="text-blue-200 text-xs font-semibold mb-1 block">RANGI YA PILI (ACCENT)</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
                    className="w-12 h-10 rounded-xl border-0 cursor-pointer" />
                  <input className="inp flex-1 text-sm py-2" value={accentColor} onChange={e => setAccentColor(e.target.value)} placeholder="#5500cc" />
                </div>
              </div>
              <div>
                <label className="text-blue-200 text-xs font-semibold mb-1 block">UKUBWA WA FONTI</label>
                <select className="inp" value={fontSize} onChange={e => setFontSize(e.target.value)}>
                  <option value="small">Ndogo (13px)</option>
                  <option value="medium">Wastani (15px)</option>
                  <option value="large">Kubwa (17px)</option>
                </select>
              </div>
              <div>
                <label className="text-blue-200 text-xs font-semibold mb-1 block">AINA YA FONTI</label>
                <select className="inp" value={fontFamily} onChange={e => setFontFamily(e.target.value)}>
                  <option value="Inter">Inter (Kawaida)</option>
                  <option value="Roboto">Roboto</option>
                  <option value="Poppins">Poppins</option>
                  <option value="Ubuntu">Ubuntu</option>
                </select>
              </div>
              <button onClick={handleSaveSettings} className="btn-primary w-full py-4 font-bold">
                HIFADHI RANGI NA FONTI
              </button>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {!loading && tab === "settings" && settings && (
          <div className="space-y-4">
            <div className="glass-card p-5 space-y-4">
              <p className="text-white font-black text-base">Mipangilio ya App</p>
              <div>
              <label className="text-blue-200 text-xs font-semibold mb-1 block">SIKU ZA UWEKEZAJI (KIMALIZIO)</label>
              <div className="flex items-center gap-3">
                <input className="inp flex-1" type="number" min={1} max={365}
                  value={investDaysInput}
                  onChange={e => {
                    setInvestDaysInput(e.target.value);
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val > 0) setInvestDays(val);
                  }} />
                <span className="text-blue-300/60 text-sm font-semibold">siku</span>
              </div>
              <p className="text-blue-300/40 text-xs mt-1">Sasa hivi: siku {investDays}. Mabadiliko yataathiri uwekezaji mpya pekee.</p>
            </div>
            {[
                { label: "NAMBA YA MALIPO", val: payPhone, set: setPayPhone, ph: "+255..." },
                { label: "MTANDAO WA MALIPO", val: payNet, set: setPayNet, ph: "TIGOPESA / MPESA..." },
                { label: "JINA LA MPOKEAJI WA MALIPO", val: payName, set: setPayName, ph: "Jina la mpokeaji..." },
                { label: "NAMBA YA WHATSAPP (MSAADA)", val: waNum, set: setWaNum, ph: "+255..." },
              ].map(({ label, val, set, ph }) => (
                <div key={label}>
                  <label className="text-blue-200 text-xs font-semibold mb-1 block">{label}</label>
                  <input className="inp" value={val} onChange={e => set(e.target.value)} placeholder={ph} />
                </div>
              ))}
            </div>
            <div className="glass-card p-5">
              <p className="text-green-400 font-black text-sm mb-3">🎁 Mipangilio ya Referral</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-blue-200 text-xs font-semibold mb-1 block">IDADI YA MARAFIKI</label>
                  <input className="inp text-sm" type="number" min={1} value={refMax}
                    onChange={e => setRefMax(parseInt(e.target.value) || 10)} />
                </div>
                <div>
                  <label className="text-blue-200 text-xs font-semibold mb-1 block">ZAWADI (TZS)</label>
                  <input className="inp text-sm" type="number" min={0} value={refBonus}
                    onChange={e => setRefBonus(parseInt(e.target.value) || 20000)} />
                </div>
              </div>
            </div>
            <div className="glass-card p-5">
              <p className="text-yellow-400 font-black text-sm mb-3">⭐ Mipango ya VIP</p>
              <div className="space-y-3">
                {vipPlans.map((plan, idx) => (
                  <div key={plan.id} className="glass-card-dark p-3 rounded-xl">
                    <div className="flex gap-2 mb-2">
                      <input className="inp flex-1 text-sm py-2" placeholder="Jina la mpango"
                        value={plan.label} onChange={e => updatePlan(idx, "label", e.target.value)} />
                      <input className="inp w-28 text-sm py-2" type="number" placeholder="Bei (TZS)"
                        value={plan.price} onChange={e => updatePlan(idx, "price", parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-300/60 text-xs">Miezi:</span>
                      <input className="inp flex-1 text-sm py-2" type="number" placeholder="0 = Lifetime"
                        value={plan.months} onChange={e => updatePlan(idx, "months", parseInt(e.target.value) || 0)} />
                      <button onClick={() => setVipPlans(prev => prev.filter((_, i) => i !== idx))}
                        className="p-2 rounded-lg bg-red-600/30">
                        <Minus size={14} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
                <button onClick={() => setVipPlans(prev => [...prev, { id: `plan_${Date.now()}`, label: "Mpango Mpya", price: 0, months: 1 }])}
                  className="w-full py-3 border-2 border-dashed border-blue-500/30 rounded-xl flex items-center justify-center gap-2 text-blue-400 text-sm font-semibold">
                  <Plus size={16} />Ongeza Mpango
                </button>
              </div>
            </div>
            <div className="glass-card p-5">
              <label className="text-blue-200 text-xs font-semibold mb-2 block">APK YA APP</label>
              {apkUrl && (
                <div className="glass-card-dark p-3 rounded-xl mb-3 flex items-center gap-2">
                  <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
                  <p className="text-green-400 text-xs font-semibold truncate">APK imepakiwa</p>
                  <a href={apkUrl} target="_blank" className="text-blue-400 text-xs underline ml-auto flex-shrink-0">Pakua</a>
                </div>
              )}
              <input ref={apkFileRef} type="file" accept=".apk,application/vnd.android.package-archive" className="hidden" onChange={handleApkUpload} />
              <button onClick={() => apkFileRef.current?.click()} disabled={apkUploading}
                className="w-full py-4 border-2 border-dashed border-blue-500/40 rounded-2xl flex items-center justify-center gap-3">
                {apkUploading
                  ? <><Loader2 size={20} className="text-blue-400 animate-spin" /><span className="text-blue-300 font-semibold text-sm">Inapakia APK...</span></>
                  : <><Upload size={20} className="text-blue-400" /><span className="text-blue-300 font-semibold text-sm">Bonyeza kupakia APK mpya</span></>}
              </button>
              <p className="text-blue-300/40 text-xs mt-1">Au weka URL ya APK:</p>
              <input className="inp mt-1" value={apkUrl} onChange={e => setApkUrl(e.target.value)} placeholder="https://... (URL ya APK)" />
            </div>
            <button onClick={handleSaveSettings} className="btn-primary w-full py-4 font-bold">
              HIFADHI MIPANGILIO
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
