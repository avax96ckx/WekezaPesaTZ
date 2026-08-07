import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCurrentUserId, getUserById, setCurrentUserId, getAppSettings,
  createVipRequest, getUserVipRequest, formatTZS,
} from "@/lib/storage";
import { User, AppSettings, VipRequest, VipPlan } from "@/types";
import {
  User as UserIcon, Moon, Bell, HelpCircle,
  Download, LogOut, ChevronRight, Crown, Copy, CheckCircle2, Check, X, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import bgImg from "@/assets/bg-gradient.jpg";
import BottomNav from "@/components/layout/BottomNav";

export default function Settings() {
  const navigate = useNavigate();
  const uid = getCurrentUserId();
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [showVipModal, setShowVipModal] = useState(false);
  const [showVipPayment, setShowVipPayment] = useState(false);
  const [vipRequest, setVipRequest] = useState<VipRequest | null>(null);
  const [submittingVip, setSubmittingVip] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<VipPlan | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [waNum, setWaNum] = useState("+255765947141");

  useEffect(() => {
    if (!uid) { navigate("/auth"); return; }
    Promise.all([getUserById(uid), getAppSettings()]).then(async ([u, s]) => {
      if (!u) { navigate("/auth"); return; }
      if (u.is_blocked) {
        setBlocked(true);
        setWaNum(s.whatsapp_number || "+255765947141");
        return;
      }
      setUser(u);
      setSettings(s);
      if (s.vip_plans?.length) setSelectedPlan(s.vip_plans[0]);
      if (!u.vip_member) {
        const req = await getUserVipRequest(uid);
        setVipRequest(req);
      }
    });
  }, [uid, navigate]);

  if (blocked) {
    const num = waNum.replace(/[^0-9]/g, "");
    return (
      <div className="fixed inset-0" style={{ backgroundImage: `url(${bgImg})`, backgroundSize: "cover" }}>
        <div className="absolute inset-0" style={{ backdropFilter: "blur(14px)", background: "rgba(0,0,10,0.8)" }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 z-10">
          <div className="glass-card p-8 rounded-3xl flex flex-col items-center text-center max-w-sm w-full">
            <div className="text-7xl mb-4">🚫</div>
            <h2 className="text-white font-black text-xl tracking-widest mb-3">AKAUNTI YAKO IMEZUILIWA</h2>
            <p className="text-blue-200/80 text-sm leading-relaxed mb-6">Akaunti yako imezuiwa na msimamizi. Wasiliana na admin.</p>
            <button onClick={() => window.open(`https://wa.me/${num}`, "_blank")}
              className="w-full py-4 rounded-2xl font-black text-base text-white flex items-center justify-center gap-3"
              style={{ background: "#25d366" }}>
              <svg width="22" height="22" viewBox="0 0 48 48" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M24 4C12.954 4 4 12.954 4 24C4 27.614 4.974 31.002 6.674 33.924L4.1 43.8L14.22 41.274C17.044 42.794 20.42 43.7 24 43.7C35.046 43.7 44 34.746 44 23.7C44 12.654 35.046 4 24 4Z" fill="white"/><path fillRule="evenodd" clipRule="evenodd" d="M18.5 15.5C18.1 14.7 17.5 14.7 17.1 14.7C16.7 14.7 16.3 14.7 15.9 14.7C15.5 14.7 14.8 14.9 14.3 15.4C13.8 15.9 12.5 17.2 12.5 19.8C12.5 22.4 14.3 24.9 14.6 25.3C14.9 25.7 18.4 31.4 23.9 33.6C28.4 35.4 29.4 35.1 30.4 35C31.4 34.9 33.7 33.7 34.2 32.4C34.7 31.1 34.7 30 34.5 29.7C34.3 29.5 34 29.4 33.5 29.1C33 28.9 30.4 27.6 30 27.4C29.5 27.3 29.2 27.2 28.9 27.7C28.5 28.2 27.5 29.4 27.2 29.7C26.9 30 26.6 30.1 26.1 29.8C25.6 29.6 24.1 29.1 22.2 27.4C20.8 26.1 19.8 24.5 19.5 24C19.2 23.5 19.5 23.2 19.7 22.9C20 22.6 20.2 22.4 20.5 22.1C20.7 21.8 20.8 21.6 21 21.3C21.1 21 21 20.7 20.9 20.5C20.7 20.2 19.8 17.6 19.3 16.5L18.5 15.5Z" fill="#25d366"/></svg>
              WASILIANA NA ADMIN
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    setCurrentUserId(null);
    toast.success("Umetoka kikamilifu.");
    navigate("/auth");
  };

  const handleDownload = () => {
    if (settings?.apk_url) {
      window.open(settings.apk_url, "_blank");
    } else {
      toast.info("APK bado haipatikani. Wasiliana na msaada.");
    }
  };

  const handleHelp = () => {
    if (!settings) return;
    const num = settings.whatsapp_number.replace(/[^0-9]/g, "");
    window.open(`https://wa.me/${num}`, "_blank");
  };

  const handleSubmitVip = async () => {
    if (!user || !selectedPlan) return;
    setSubmittingVip(true);
    await createVipRequest(user.id, user.name, user.phone, selectedPlan.id, selectedPlan.label, selectedPlan.price);
    setSubmittingVip(false);
    setShowVipPayment(false);
    setShowVipModal(false);
    const req = await getUserVipRequest(user.id);
    setVipRequest(req);
    toast.success("Ombi la VIP limetumwa! Admin atakagua hivi karibuni.");
  };

  const copyPaymentPhone = () => {
    if (settings) {
      navigator.clipboard.writeText(settings.payment_phone);
      toast.success("Namba imenakiliwa!");
    }
  };

  if (!user || !settings) return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ backgroundImage: `url(${bgImg})`, backgroundSize: "cover" }}>
      <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const plans = settings.vip_plans || [];

  return (
    <div className="min-h-screen pb-24"
      style={{ backgroundImage: `url(${bgImg})`, backgroundSize: "cover", backgroundPosition: "center" }}>

      {/* VIP Plan + Benefits Modal */}
      {showVipModal && !showVipPayment && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center px-4">
          <div className="w-full max-w-sm glass-card rounded-3xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#FFB300,#FF8F00)" }}>
                <Crown size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-white font-black text-base tracking-widest">V.I.P MEMBER</h3>
                <p className="text-yellow-400 font-bold text-[11px]">Chagua Mpango Wako</p>
              </div>
              <button onClick={() => setShowVipModal(false)} className="ml-auto p-1">
                <X size={18} className="text-blue-300" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {[
                "Chukua faida wakati wowote",
                "Toa pesa mara moja",
                "Tuma pesa kwa akaunti nyingine",
                "Batani za faida muda wote",
              ].map((b, i) => (
                <div key={i} className="flex items-center gap-1.5 glass-card-dark rounded-xl px-2.5 py-2">
                  <Check size={11} className="text-yellow-400 flex-shrink-0" />
                  <p className="text-white text-[10px] font-medium leading-tight">{b}</p>
                </div>
              ))}
            </div>

            <p className="text-blue-200/70 text-[10px] font-semibold mb-1.5">CHAGUA MPANGO:</p>
            <div className="space-y-1.5 mb-3">
              {plans.map(plan => (
                <button key={plan.id} onClick={() => setSelectedPlan(plan)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border-2 ${
                    selectedPlan?.id === plan.id
                      ? "border-yellow-400 bg-yellow-900/30"
                      : "border-blue-500/20 bg-white/5"
                  }`}>
                  <div className="flex items-center gap-2">
                    {selectedPlan?.id === plan.id
                      ? <Check size={12} className="text-yellow-400" />
                      : <span className="w-3" />}
                    <span className="text-white font-bold text-xs">{plan.label}</span>
                  </div>
                  <span className={`font-black text-xs ${selectedPlan?.id === plan.id ? "text-yellow-400" : "text-white"}`}>
                    {formatTZS(plan.price)}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowVipModal(false)}
                className="flex-1 py-3 rounded-2xl font-bold text-sm bg-blue-900/50 text-blue-300">
                Sio Sasa
              </button>
              <button onClick={() => setShowVipPayment(true)} disabled={!selectedPlan}
                className="flex-1 py-3 rounded-2xl font-black text-sm text-black"
                style={{ background: "linear-gradient(135deg,#FFB300,#FF8F00)" }}>
                JIUNGE VIP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIP Payment Modal */}
      {showVipPayment && selectedPlan && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center px-4">
          <div className="w-full max-w-sm glass-card rounded-3xl p-4">
            <button onClick={() => setShowVipPayment(false)} className="text-blue-300 text-sm mb-3 flex items-center gap-1">
              <ArrowLeft size={16} /> Rudi
            </button>
            <h3 className="text-white font-black text-base tracking-widest mb-0.5">LIPA NA UJIUNGA VIP</h3>
            <p className="text-yellow-400 text-xs font-bold mb-3">{selectedPlan.label} — {formatTZS(selectedPlan.price)}</p>

            <div className="space-y-2.5 mb-4">
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center text-[10px] font-bold text-black flex-shrink-0">1</span>
                <p className="text-blue-200 text-xs">Tuma <span className="text-yellow-400 font-black">{formatTZS(selectedPlan.price)}</span> kwenye {settings.payment_network}:</p>
              </div>
              <div className="glass-card-dark p-3 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-white font-black text-base tracking-widest">{settings.payment_phone}</p>
                  <p className="text-blue-300/70 text-[10px]">{settings.payment_name} • {settings.payment_network}</p>
                </div>
                <button onClick={copyPaymentPhone} className="p-2 rounded-lg bg-blue-600/30">
                  <Copy size={14} className="text-blue-300" />
                </button>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center text-[10px] font-bold text-black flex-shrink-0">2</span>
                <p className="text-blue-200 text-xs">Baada ya kutuma, bonyeza <span className="text-white font-bold">"Wasilisha Ombi"</span></p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center text-[10px] font-bold text-black flex-shrink-0">3</span>
                <p className="text-blue-200 text-xs">Admin atakagua na kukufanya VIP member hivi karibuni</p>
              </div>
            </div>

            <button onClick={handleSubmitVip} disabled={submittingVip}
              className="w-full py-4 rounded-2xl font-black text-base text-white flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg,#FFB300,#FF8F00)" }}>
              <CheckCircle2 size={18} />
              {submittingVip ? "Inatumwa..." : "WASILISHA OMBI"}
            </button>
          </div>
        </div>
      )}

      <div className="px-4 pt-6">
        <h2 className="text-xl font-black text-white tracking-widest mb-6">MIPANGILIO</h2>

        <button className="glass-card p-4 mb-4 flex items-center gap-4 w-full text-left" onClick={() => navigate("/profile")}>
          {user.photo_url
            ? <img src={user.photo_url} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-blue-500" />
            : <div className="w-14 h-14 rounded-full bg-blue-700 flex items-center justify-center text-xl font-black text-white border-2 border-blue-500">
              {user.name.charAt(0).toUpperCase()}
            </div>}
          <div className="flex-1">
            <p className="text-white font-bold">{user.name}</p>
            <p className="text-blue-300/60 text-xs">{user.phone}</p>
            {user.vip_member && (
              <div className="flex items-center gap-1 mt-1">
                <Crown size={12} className="text-yellow-400" />
                <span className="text-yellow-400 text-xs font-black">V.I.P MEMBER</span>
              </div>
            )}
          </div>
          <ChevronRight size={16} className="text-blue-300/40 flex-shrink-0" />
        </button>

        {/* VIP Section */}
        {!user.vip_member ? (
          <button
            onClick={() => setShowVipModal(true)}
            className="w-full p-4 rounded-2xl mb-4 flex items-center gap-3"
            style={{ background: "linear-gradient(135deg,#FF8F00,#FFB300,#FF8F00)" }}
            disabled={vipRequest?.status === "pending"}
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Crown size={20} className="text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-white font-black text-sm">
                {vipRequest?.status === "pending" ? "VIP OMBI LINASUBIRI..." : "UNLOCK V.I.P"}
              </p>
              <p className="text-white/80 text-xs">
                {vipRequest?.status === "pending" ? "Admin anakagua ombi lako" : "Jiunge na VIP kupata faida za kipekee"}
              </p>
            </div>
            {vipRequest?.status !== "pending" && <ChevronRight size={20} className="text-white/80" />}
          </button>
        ) : (
          <div className="w-full p-4 rounded-2xl mb-4 flex items-center gap-3"
            style={{ background: "linear-gradient(135deg,#FF8F00,#FFB300)" }}>
            <Crown size={24} className="text-white flex-shrink-0" />
            <div>
              <p className="text-white font-black text-sm">V.I.P MEMBER HAI</p>
              <p className="text-white/80 text-xs">Unafurahia faida zote za VIP</p>
            </div>
          </div>
        )}

        <div className="glass-card overflow-hidden mb-4">
          <SettingItem icon={<UserIcon size={18} className="text-blue-400" />} label="Wasifu Wangu" onClick={() => navigate("/profile")} />
          <SettingToggle icon={<Moon size={18} className="text-purple-400" />} label="Giza Mode" value={darkMode}
            onChange={() => { setDarkMode(!darkMode); toast.info("Giza mode: " + (!darkMode ? "Imewashwa" : "Imezimwa")); }} />
          <SettingToggle icon={<Bell size={18} className="text-yellow-400" />} label="Arifa" value={notifications}
            onChange={() => setNotifications(!notifications)} />
          <SettingItem icon={<HelpCircle size={18} className="text-green-400" />} label="Msaada (WhatsApp)" onClick={handleHelp} />
          <SettingItem icon={<Download size={18} className="text-blue-400" />} label="Pakua App (APK)" onClick={handleDownload} />
        </div>

        <button onClick={handleLogout}
          className="w-full py-4 rounded-2xl font-bold text-red-400 border border-red-500/30 bg-red-900/20 flex items-center justify-center gap-2">
          <LogOut size={18} />TOKA AKAUNTI
        </button>
      </div>
      <BottomNav />
    </div>
  );
}

function SettingItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between px-4 py-4 border-b border-blue-500/10 last:border-0">
      <div className="flex items-center gap-3">{icon}<span className="text-white font-semibold text-sm">{label}</span></div>
      <ChevronRight size={16} className="text-blue-300/40" />
    </button>
  );
}

function SettingToggle({ icon, label, value, onChange }: { icon: React.ReactNode; label: string; value: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-4 border-b border-blue-500/10">
      <div className="flex items-center gap-3">{icon}<span className="text-white font-semibold text-sm">{label}</span></div>
      <button onClick={onChange} className={`w-12 h-6 rounded-full relative ${value ? "bg-blue-600" : "bg-blue-900/50"}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white ${value ? "translate-x-6" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}
