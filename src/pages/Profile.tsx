import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCurrentUserId, getUserById, updateUser, uploadProfilePhoto,
  changeUserPassword, formatTZS, getUserInvestments, calcProfit,
  getReferralStats, getAppSettings,
} from "@/lib/storage";
import { User, Investment } from "@/types";
import { ArrowLeft, Camera, Loader2, X, Copy, Crown, Share2, Key, TrendingUp, Calendar } from "lucide-react";
import { toast } from "sonner";
import BadgeIcon, { BADGE_OPTIONS } from "@/components/features/BadgeIcon";
import bgImg from "@/assets/bg-gradient.jpg";

export default function Profile() {
  const navigate = useNavigate();
  const uid = getCurrentUserId();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [showBadgePicker, setShowBadgePicker] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState("blue_burst");
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [referralCount, setReferralCount] = useState(0);
  const [referralLink, setReferralLink] = useState("");
  const [refStats, setRefStats] = useState<{ currentBonus: number; currentMax: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!uid) { navigate("/auth"); return; }
    const load = async () => {
      const [u, s] = await Promise.all([getUserById(uid), getAppSettings()]);
      if (!u) { navigate("/auth"); return; }
      setUser(u);
      setName(u.name);
      setPhotoPreview(u.photo_url || "");
      setSelectedBadge(u.badge_type || "blue_burst");
      const invs = await getUserInvestments(uid);
      setInvestments(invs);
      const stats = await getReferralStats(uid, s.referral_max ?? 10, s.referral_bonus ?? 20000);
      setReferralCount(stats.count);
      setRefStats({ currentBonus: stats.currentBonus, currentMax: stats.currentMax });
      setReferralLink(`${window.location.origin}/auth?ref=${u.account_id || ""}`);
    };
    load();
  }, [uid, navigate]);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error("Picha ni kubwa sana. Chagua chini ya 3MB."); return; }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!name.trim()) { toast.error("Jaza jina lako."); return; }
    setSaving(true);
    let finalPhotoUrl = user.photo_url || "";
    if (photoFile) {
      setUploading(true);
      toast.loading("Inapakia picha...");
      const url = await uploadProfilePhoto(photoFile, user.id);
      setUploading(false);
      toast.dismiss();
      if (!url) { toast.error("Imeshindwa kupakia picha. Jaribu tena."); setSaving(false); return; }
      finalPhotoUrl = url;
    }
    await updateUser({ id: user.id, name: name.trim(), photo_url: finalPhotoUrl, badge_type: selectedBadge });
    setSaving(false);
    toast.success("Wasifu umehifadhiwa!");
    navigate("/");
  };

  const handleChangePassword = async () => {
    if (!user) return;
    if (!newPassword || newPassword.length < 4) { toast.error("Password lazima iwe na angalau herufi 4."); return; }
    if (newPassword !== confirmPassword) { toast.error("Password hazilingani. Jaribu tena."); return; }
    setSavingPassword(true);
    await changeUserPassword(user.id, newPassword);
    setSavingPassword(false);
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Password imebadilishwa kikamilifu!");
  };

  const copyAccountId = () => {
    if (user?.account_id) {
      navigator.clipboard.writeText(user.account_id);
      toast.success("Account ID imenakiliwa!");
    }
  };

  const shareProfile = () => {
    const link = `${window.location.origin}/auth?ref=${user?.account_id || ""}`;
    const text = `Jiunge nami kwenye WEKEZA PESA TZ na upate faida ya 10% kwa siku! Tumia kiungo changu: ${link}`;
    if (navigator.share) {
      navigator.share({ title: "WEKEZA PESA TZ - Jiunge Nami!", text, url: link });
    } else {
      navigator.clipboard.writeText(link);
      toast.success("Kiungo kmenakiliwa!");
    }
  };

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ backgroundImage: `url(${bgImg})`, backgroundSize: "cover" }}>
      <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const hasBlueTick = user.blue_tick && user.balance > 0;
  const activeInvestments = investments.filter(i => i.is_active && !i.is_claimed);
  const completedInvestments = investments.filter(i => i.is_claimed);
  const totalInvested = investments.reduce((a, i) => a + i.amount, 0);
  const liveProfit = activeInvestments.reduce((a, i) => a + calcProfit(i), 0);
  const memberSince = new Date(user.created_at).toLocaleDateString("sw-TZ", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen pb-8"
      style={{ backgroundImage: `url(${bgImg})`, backgroundSize: "cover", backgroundPosition: "center" }}>

      {/* Badge Picker Modal */}
      {showBadgePicker && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-end justify-center">
          <div className="w-full max-w-sm glass-card p-5 rounded-t-3xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-black text-sm tracking-widest">CHAGUA BADGE YAKO</h3>
              <button onClick={() => setShowBadgePicker(false)}><X size={20} className="text-blue-300" /></button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {BADGE_OPTIONS.map(badge => (
                <button key={badge.id}
                  onClick={() => { setSelectedBadge(badge.id); setShowBadgePicker(false); }}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border-2 ${selectedBadge === badge.id ? "border-white bg-white/15" : "border-transparent bg-white/5"}`}>
                  <BadgeIcon type={badge.id} size={32} />
                  <span className="text-white text-[9px] font-bold text-center leading-tight">{badge.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="px-4 pt-6">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-blue-300 mb-4">
          <ArrowLeft size={20} /> <span className="font-semibold">Rudi Nyumbani</span>
        </button>

        <h2 className="text-xl font-black text-white tracking-widest mb-4">WASIFU WANGU</h2>

        {/* Profile Photo & Identity */}
        <div className="glass-card p-5 mb-3">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-shrink-0">
              {photoPreview
                ? <img src={photoPreview} alt="Profile" className="w-20 h-20 rounded-full object-cover border-4 border-blue-500" />
                : <div className="w-20 h-20 rounded-full bg-blue-700 flex items-center justify-center text-3xl font-black text-white border-4 border-blue-500">
                    {name.charAt(0).toUpperCase()}
                  </div>}
              <button onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center border-2 border-white">
                {uploading ? <Loader2 size={14} className="text-white animate-spin" /> : <Camera size={14} className="text-white" />}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-white font-black text-lg">{user.name}</span>
                {hasBlueTick && <BadgeIcon type={user.badge_type || "blue_burst"} size={20} />}
                {user.vip_member && (
                  <span className="flex items-center gap-1 text-yellow-400 text-xs font-black px-2 py-0.5 rounded-full border border-yellow-500/40 bg-yellow-900/30">
                    <Crown size={11} />VIP
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-blue-300/40 text-xs">
                <Calendar size={11} />
                <span>Mwanachama tangu {memberSince}</span>
              </div>
            </div>
          </div>

          {/* Account ID row */}
          <div className="glass-card-dark p-3 rounded-2xl mb-3">
            <p className="text-blue-200/50 text-[9px] font-semibold tracking-widest mb-1">ACCOUNT ID YAKO</p>
            <div className="flex items-center gap-2">
              <span className="text-white font-black text-xl tracking-widest flex-1">{user.account_id || "—"}</span>
              <button onClick={copyAccountId} className="p-2 rounded-xl bg-blue-600/30">
                <Copy size={16} className="text-blue-300" />
              </button>
              <button onClick={shareProfile} className="p-2 rounded-xl bg-green-600/20 flex items-center gap-1.5 px-3">
                <Share2 size={16} className="text-green-400" />
                <span className="text-green-400 text-xs font-bold">SHARE</span>
              </button>
            </div>
            <p className="text-blue-300/30 text-[9px] mt-1">Toa ID hii kwa mtu anayetaka kukutumia pesa</p>
          </div>
        </div>

        {/* Quick link to Wallet stats */}
        <button onClick={() => navigate("/wallet")}
          className="glass-card p-3 mb-3 flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-green-400" />
            <span className="text-white font-bold text-sm">Tazama Takwimu za Kamili</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-blue-300/50 text-xs">Wallet</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-300/40"><path d="M9 18l6-6-6-6"/></svg>
          </div>
        </button>

        {/* Referral Card */}
        <div className="glass-card p-4 mb-3" style={{ border: "1px solid rgba(0,200,83,0.2)" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#00C853,#69F0AE)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-white font-black text-sm">ZAWADI YA KUALIKA MARAFIKI</p>
              <p className="text-green-400 text-xs font-semibold">Pata TZS {refStats?.currentBonus?.toLocaleString() || "20,000"} kwa kila {refStats?.currentMax || 10} marafiki</p>
            </div>
          </div>
          <div className="glass-card-dark rounded-xl p-3 mb-3">
            <p className="text-blue-200/50 text-[9px] font-semibold tracking-widest mb-1.5">LINK YAKO YA KUALIKA</p>
            <div className="flex items-center gap-2">
              <span className="text-blue-300/70 text-xs truncate flex-1">{referralLink || `${window.location.origin}/auth?ref=${user.account_id}`}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const link = referralLink || `${window.location.origin}/auth?ref=${user.account_id}`;
                navigator.clipboard.writeText(link);
                toast.success("Kiungo kmenakiliwa!");
              }}
              className="flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-sm"
              style={{ background: "rgba(30,111,255,0.25)", color: "#6aa3ff", border: "1px solid rgba(30,111,255,0.3)" }}>
              <Copy size={15} />
              NAKILI LINK
            </button>
            <button
              onClick={shareProfile}
              className="flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-sm"
              style={{ background: "rgba(0,200,83,0.2)", color: "#00C853", border: "1px solid rgba(0,200,83,0.3)" }}>
              <Share2 size={15} />
              SHARE
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-blue-300/50 text-[10px]">Marafiki waliojiunga:</span>
            <span className="text-white font-black text-sm">{referralCount} / {refStats?.currentMax || 10}</span>
          </div>
        </div>

        {/* Edit Name & Badge */}
        <div className="glass-card p-4 mb-3 space-y-4">
          <p className="text-white font-black text-sm tracking-widest">HARIRI TAARIFA</p>
          <div>
            <label className="text-blue-200 text-xs font-semibold mb-1 block">JINA KAMILI</label>
            <input className="inp" value={name} onChange={e => setName(e.target.value)} placeholder="Jina lako kamili" />
          </div>

          {hasBlueTick && (
            <div>
              <label className="text-blue-200 text-xs font-semibold mb-2 block">BADGE YA UTHIBITISHO</label>
              <button onClick={() => setShowBadgePicker(true)}
                className="inp flex items-center gap-3 w-full text-left" style={{ cursor: "pointer" }}>
                <BadgeIcon type={selectedBadge} size={28} />
                <span className="text-white font-semibold text-sm flex-1">
                  {BADGE_OPTIONS.find(b => b.id === selectedBadge)?.label || "Bluu"}
                </span>
                <span className="text-blue-400 text-xs font-bold">BADILISHA ›</span>
              </button>
            </div>
          )}

          <button className="btn-primary w-full py-4 font-bold flex items-center justify-center gap-2" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 size={18} className="animate-spin" />Inahifadhiwa...</> : "HIFADHI MABADILIKO"}
          </button>
        </div>

        {/* Change Password */}
        <div className="glass-card p-4 mb-3 space-y-4">
          <div className="flex items-center gap-2">
            <Key size={16} className="text-yellow-400" />
            <p className="text-white font-black text-sm tracking-widest">BADILISHA PASSWORD</p>
          </div>
          <div>
            <label className="text-blue-200 text-xs font-semibold mb-1 block">PASSWORD MPYA</label>
            <input className="inp" type="password" placeholder="Password mpya (angalau herufi 4)"
              value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          </div>
          <div>
            <label className="text-blue-200 text-xs font-semibold mb-1 block">THIBITISHA PASSWORD</label>
            <input className="inp" type="password" placeholder="Rudia password mpya"
              value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
          </div>
          <button onClick={handleChangePassword} disabled={savingPassword}
            className="w-full py-4 rounded-2xl font-bold text-black flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,#FFB300,#FF8F00)" }}>
            {savingPassword ? <><Loader2 size={18} className="animate-spin text-black" />Inabadilisha...</> : <><Key size={18} />BADILISHA PASSWORD</>}
          </button>
        </div>
      </div>
    </div>
  );
}
