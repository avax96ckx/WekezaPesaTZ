import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCurrentUserId, getUserById, getUserInvestments,
  calcProfit, formatTZS, updateUser,
  getAppSettings, getReferralStats, claimReferralBonus,
  getUserNotifications, deleteUserNotifications,
  getNotificationLastCleared, setNotificationLastCleared,
  applyAppTheme,
  AppNotification,
} from "@/lib/storage";
import { User, Investment, AppSettings } from "@/types";
import { ReferralStats } from "@/lib/storage";
import {
  TrendingUp, ArrowUpFromLine, Wallet, PlusCircle,
  ChevronRight, X, Crown, Copy, Gift, CheckCircle2, Bell, RefreshCw,
} from "lucide-react";
import BottomNav from "@/components/layout/BottomNav";
import BadgeIcon, { BADGE_OPTIONS } from "@/components/features/BadgeIcon";
import bgImg from "@/assets/bg-gradient.jpg";
import { toast } from "sonner";

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [profits, setProfits] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [bgRefreshing, setBgRefreshing] = useState(false);
  const [showBadgePicker, setShowBadgePicker] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [refStats, setRefStats] = useState<ReferralStats | null>(null);
  const [claimingBonus, setClaimingBonus] = useState(false);
  const [referralLink, setReferralLink] = useState("");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [blockedUser, setBlockedUser] = useState<{ name: string; waNum: string } | null>(null);
  const [showQR, setShowQR] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    const uid = getCurrentUserId();
    if (!uid) { navigate("/auth"); return; }
    if (!silent) setLoading(true);
    else setBgRefreshing(true);

    const [u, s] = await Promise.all([getUserById(uid), getAppSettings()]);
    if (!u) { navigate("/auth"); return; }
    // Blocked check - show overlay immediately
    if (u.is_blocked) {
      setUser(u); setSettings(s);
      setBlockedUser({ name: u.name, waNum: s.whatsapp_number });
      if (!silent) setLoading(false); else setBgRefreshing(false);
      return;
    }
    setBlockedUser(null);
    setUser(u);
    setSettings(s);
    applyAppTheme(s);
    setReferralLink(`${window.location.origin}/auth?ref=${u.account_id || ""}`);
    const invs = await getUserInvestments(uid);
    const active = invs.filter(i => i.is_active && !i.is_claimed);
    setInvestments(active);
    const map: Record<string, number> = {};
    active.forEach(inv => { map[inv.id] = calcProfit(inv); });
    setProfits(map);
    const stats = await getReferralStats(uid, s.referral_max ?? 10, s.referral_bonus ?? 20000);
    setRefStats(stats);
    const cleared = getNotificationLastCleared();
    const notifs = await getUserNotifications(uid, cleared);
    setNotifications(prev => {
      const prevIds = new Set(prev.map(n => n.id));
      const newOnes = notifs.filter(n => !prevIds.has(n.id));
      if (newOnes.length > 0 && silent) {
        // Play sound if configured - fetch fresh settings sound url
        const soundUrl = s?.notification_sound || (s as AppSettings & { notification_sound?: string }).notification_sound;
        if (soundUrl && soundUrl.trim() !== "") {
          try {
            const audio = new Audio(soundUrl);
            audio.volume = 1.0;
            const playPromise = audio.play();
            if (playPromise) playPromise.catch(e => console.log("Sound play failed:", e));
          } catch (e) { console.log("Sound error:", e); }
        }
        // Browser push notification
        if ("Notification" in window && Notification.permission === "granted") {
          newOnes.forEach(n => {
            try {
              new Notification(n.title, {
                body: n.message,
                icon: "/favicon.ico",
                tag: n.id,
              });
            } catch (e) { console.log("Push notification error:", e); }
          });
        }
      }
      return notifs;
    });
    if (!silent) setLoading(false);
    else setBgRefreshing(false);
  }, [navigate]);

  useEffect(() => {
    loadData();
    // Request browser notification permission proactively
    if ("Notification" in window && Notification.permission === "default") {
      // Request immediately on user interaction / page load
      Notification.requestPermission().then(perm => {
        console.log("Notification permission:", perm);
        if (perm === "granted") {
          // Show welcome push to confirm it works
          try {
            new Notification("WEKEZA PESA TZ", {
              body: "Arifa za app zimewashwa. Utapata taarifa muhimu hapa!",
              icon: "/favicon.ico",
            });
          } catch {}
        }
      });
    }
  }, [loadData]);

  // Live profit ticker every second
  useEffect(() => {
    const interval = setInterval(() => {
      setInvestments(prev => {
        const map: Record<string, number> = {};
        prev.forEach(inv => { map[inv.id] = calcProfit(inv); });
        setProfits(map);
        return prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => { loadData(true); }, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleSelectBadge = async (badgeId: string) => {
    if (!user) return;
    await updateUser({ id: user.id, badge_type: badgeId });
    setUser(prev => prev ? { ...prev, badge_type: badgeId } : prev);
    setShowBadgePicker(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success("Kiungo kmenakiliwa!");
  };

  const handleShareLink = () => {
    if (navigator.share) {
      navigator.share({ title: "WEKEZA PESA TZ", text: "Jiunge nami kwenye WEKEZA PESA TZ upate zawadi!", url: referralLink });
    } else {
      handleCopyLink();
    }
  };

  const handleClaimBonus = async () => {
    if (!user || !refStats) return;
    if (!refStats.readyToClaim) {
      if (!refStats.myInvEnded) {
        toast.error("Lazima uwekeze na uwekezaji wako uishe kwanza!");
      } else if (!refStats.allReferralsEnded) {
        toast.error(`Marafiki ${refStats.readyCount}/${refStats.currentMax} wamekamilisha uwekezaji. Subiri!`);
      } else {
        toast.error(`Unahitaji marafiki ${refStats.currentMax - refStats.count} zaidi wajiunga!`);
      }
      return;
    }
    setClaimingBonus(true);
    await claimReferralBonus(user.id, refStats.cycle, refStats.currentBonus);
    toast.success(`TZS ${refStats.currentBonus.toLocaleString()} imeingia kwenye akaunti yako!`);
    await loadData();
    setClaimingBonus(false);
  };

  const handleCloseNotifications = async () => {
    const uid = getCurrentUserId();
    if (!uid) return;
    const ids = notifications.map(n => n.id);
    setNotificationLastCleared();
    setShowNotifications(false);
    setNotifications([]);
    if (ids.length > 0) {
      await deleteUserNotifications(uid, ids);
    }
  };

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center"
      style={{ backgroundImage: `url(${bgImg})`, backgroundSize: "cover" }}>
      <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user || !settings) return null;

  // ── BLOCKED USER OVERLAY ── (must be before refStats check)
  if (blockedUser) {
    const waNum = (blockedUser.waNum || "+255765947141").replace(/[^0-9]/g, "");
    return (
      <div className="fixed inset-0" style={{ backgroundImage: `url(${bgImg})`, backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="absolute inset-0" style={{ backdropFilter: "blur(14px)", background: "rgba(0,0,10,0.8)" }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 z-10">
          <div className="glass-card p-8 rounded-3xl flex flex-col items-center text-center max-w-sm w-full">
            <div className="text-7xl mb-4">🚫</div>
            <h2 className="text-white font-black text-xl tracking-widest mb-3">AKAUNTI YAKO IMEZUILIWA</h2>
            <p className="text-blue-200/80 text-sm leading-relaxed mb-6">
              Akaunti yako imezuiwa na msimamizi. Wasiliana na admin kupitia WhatsApp ili kupata msaada na kufunguliwa.
            </p>
            <button
              onClick={() => window.open(`https://wa.me/${waNum}`, "_blank")}
              className="w-full py-4 rounded-2xl font-black text-base text-white flex items-center justify-center gap-3"
              style={{ background: "#25d366" }}>
              <svg width="24" height="24" viewBox="0 0 48 48" fill="none">
                <path fillRule="evenodd" clipRule="evenodd" d="M24 4C12.954 4 4 12.954 4 24C4 27.614 4.974 31.002 6.674 33.924L4.1 43.8L14.22 41.274C17.044 42.794 20.42 43.7 24 43.7C35.046 43.7 44 34.746 44 23.7C44 12.654 35.046 4 24 4Z" fill="white"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M18.5 15.5C18.1 14.7 17.5 14.7 17.1 14.7C16.7 14.7 16.3 14.7 15.9 14.7C15.5 14.7 14.8 14.9 14.3 15.4C13.8 15.9 12.5 17.2 12.5 19.8C12.5 22.4 14.3 24.9 14.6 25.3C14.9 25.7 18.4 31.4 23.9 33.6C28.4 35.4 29.4 35.1 30.4 35C31.4 34.9 33.7 33.7 34.2 32.4C34.7 31.1 34.7 30 34.5 29.7C34.3 29.5 34 29.4 33.5 29.1C33 28.9 30.4 27.6 30 27.4C29.5 27.3 29.2 27.2 28.9 27.7C28.5 28.2 27.5 29.4 27.2 29.7C26.9 30 26.6 30.1 26.1 29.8C25.6 29.6 24.1 29.1 22.2 27.4C20.8 26.1 19.8 24.5 19.5 24C19.2 23.5 19.5 23.2 19.7 22.9C20 22.6 20.2 22.4 20.5 22.1C20.7 21.8 20.8 21.6 21 21.3C21.1 21 21 20.7 20.9 20.5C20.7 20.2 19.8 17.6 19.3 16.5L18.5 15.5Z" fill="#25d366"/>
              </svg>
              WASILIANA NA ADMIN (WhatsApp)
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!refStats) return null;

  const isVip = user.vip_member;
  const totalProfit = Object.values(profits).reduce((a, b) => a + b, 0);
  const hasBlueTick = user.blue_tick && user.balance > 0;
  const notifCount = notifications.length;

  const refMax = refStats.currentMax;
  const refBonus = refStats.currentBonus;
  const refCount = refStats.count;
  const refPct = Math.min(Math.round((refCount / refMax) * 100), 100);
  const refFull = refCount >= refMax;

  const formatTime = (inv: Investment) => {
    const remaining = Math.max(0, new Date(inv.end_time).getTime() - Date.now());
    const days = Math.floor(remaining / 86400000);
    const h = Math.floor((remaining % 86400000) / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    return `${days}D ${String(h).padStart(2, "0")}H ${String(m).padStart(2, "0")}M ${String(s).padStart(2, "0")}S`;
  };

  const progressPct = (inv: Investment) => {
    const start = new Date(inv.start_time).getTime();
    const end = new Date(inv.end_time).getTime();
    return Math.min(Math.round(((Date.now() - start) / (end - start)) * 100), 100);
  };

  const firstInv = investments[0] ?? null;

  const notifColors: Record<string, string> = {
    success: "#00C853", error: "#F44336", warning: "#FFB300", info: "#2196F3",
  };

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ backgroundImage: `url(${bgImg})`, backgroundSize: "cover", backgroundPosition: "center" }}
    >
      {/* QR Code Modal */}
      {showQR && (
        <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center px-6" onClick={() => setShowQR(false)}>
          <div className="glass-card p-6 rounded-3xl flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-black text-sm tracking-widest mb-4">QR CODE YA KUALIKA</h3>
            <div className="p-4 bg-white rounded-2xl mb-4">
              <QRCodeSVG value={referralLink} size={180} />
            </div>
            <p className="text-blue-300/60 text-xs text-center mb-4">Mtu akiscan QR code hii atasajiliwa chini yako</p>
            <button onClick={() => setShowQR(false)}
              className="w-full py-3 rounded-2xl font-bold text-sm text-white"
              style={{ background: "linear-gradient(135deg,#1e6fff,#5500cc)" }}>
              Funga
            </button>
          </div>
        </div>
      )}

      {/* Badge Picker Modal */}
      {showBadgePicker && (
        <div className="absolute inset-0 bg-black/85 z-50 flex items-end justify-center">
          <div className="w-full max-w-sm glass-card p-4 rounded-t-3xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-black text-xs tracking-widest">CHAGUA BADGE YAKO</h3>
              <button onClick={() => setShowBadgePicker(false)}><X size={16} className="text-blue-300" /></button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {BADGE_OPTIONS.map(badge => (
                <button key={badge.id} onClick={() => handleSelectBadge(badge.id)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 ${user.badge_type === badge.id ? "border-white bg-white/15" : "border-transparent bg-white/5"}`}>
                  <BadgeIcon type={badge.id} size={26} />
                  <span className="text-white text-[8px] font-bold text-center leading-tight">{badge.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Notifications Panel */}
      {showNotifications && (
        <div className="absolute inset-0 bg-black/90 z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 pt-6 pb-3 border-b border-blue-500/20">
            <h3 className="text-white font-black text-base tracking-widest">ARIFA ZAKO</h3>
            <button onClick={handleCloseNotifications}
              className="flex items-center gap-2 text-blue-300 text-sm font-semibold">
              <X size={18} /> Funga & Futa
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {notifications.length === 0 ? (
              <div className="text-center py-12">
                <Bell size={40} className="text-blue-300/30 mx-auto mb-3" />
                <p className="text-blue-300/50 font-semibold">Hakuna arifa mpya</p>
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id} className="glass-card p-4 rounded-2xl border-l-4"
                  style={{ borderLeftColor: notifColors[n.type] || "#2196F3" }}>
                  <p className="text-white font-black text-sm mb-1">{n.title}</p>
                  <p className="text-blue-200/80 text-xs leading-relaxed">{n.message}</p>
                  <p className="text-blue-300/40 text-[10px] mt-2">
                    {new Date(n.created_at).toLocaleString("sw-TZ")}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Background refresh dot */}
      {bgRefreshing && (
        <div className="absolute top-2 right-2 z-40">
          <div className="w-2 h-2 rounded-full bg-blue-400 opacity-60" />
        </div>
      )}

      {/* ── TITLE ── */}
      <div className="flex-shrink-0 pt-2 pb-0.5 text-center">
        <h1 className="text-2xl font-black text-white tracking-widest"
          style={{ textShadow: "0 0 20px rgba(100,150,255,0.8)" }}>
          WEKEZA PESA TZ
        </h1>
      </div>

      {/* ── CONTENT ── */}
      <div className="flex-1 flex flex-col px-3 gap-1.5 overflow-hidden min-h-0">

        {/* 1. Profile Card */}
        <div className="glass-card flex items-center gap-2.5 px-3 py-2 flex-shrink-0">
          <button onClick={() => navigate("/profile")} className="flex-shrink-0">
            {user.photo_url
              ? <img src={user.photo_url} alt="Profile" className="w-11 h-11 rounded-full object-cover border-2 border-blue-500" />
              : <div className="w-11 h-11 rounded-full bg-blue-700 flex items-center justify-center text-base font-bold text-white border-2 border-blue-500">
                  {user.name.charAt(0).toUpperCase()}
                </div>}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-black text-white text-base uppercase tracking-wide truncate">{user.name}</span>
              {hasBlueTick && (
                <button onClick={() => setShowBadgePicker(true)} className="flex-shrink-0">
                  <BadgeIcon type={user.badge_type || "blue_burst"} size={17} />
                </button>
              )}
              {isVip && (
                <span className="flex items-center gap-0.5 text-yellow-400 text-[10px] font-black px-1.5 py-0.5 rounded-full border border-yellow-500/40 bg-yellow-900/30">
                  <Crown size={9} />VIP
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => loadData(false)} className="p-1.5 rounded-lg bg-blue-600/20">
              <RefreshCw size={14} className={`text-blue-300 ${bgRefreshing ? "animate-spin" : ""}`} />
            </button>
            <button onClick={() => setShowNotifications(true)} className="relative p-1.5 rounded-lg bg-blue-600/20">
              <Bell size={14} className="text-blue-300" />
              {notifCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white"
                  style={{ background: "#F44336" }}>
                  {notifCount > 9 ? "9+" : notifCount}
                </span>
              )}
            </button>
            <button onClick={() => navigate("/profile")}>
              <ChevronRight size={15} className="text-blue-300/50" />
            </button>
          </div>
        </div>

        {/* 2. Balance Card */}
        <div className="glass-card px-4 py-2 flex-shrink-0">
          <p className="text-blue-200/60 text-[9px] font-semibold tracking-widest text-center">SALIO LA AKAUNTI</p>
          <p className="text-[32px] font-black text-white text-center tracking-wide leading-tight">{formatTZS(user.balance)}</p>
          <div className="glass-card-dark mt-1 px-3 py-1.5 text-center rounded-xl">
            <p className="text-blue-200/60 text-[9px] font-semibold tracking-widest">FAIDA YA UWEKEZAJI</p>
            <p className="text-xl font-black profit-green profit-glow tabular-nums">
              {formatTZS(user.total_earnings + totalProfit)}
            </p>
          </div>
        </div>

        {/* 3. Action Buttons */}
        <div className="flex justify-around flex-shrink-0 py-0.5">
          {[
            { icon: <TrendingUp size={20} className="text-white" />, label: "WEKEZA", to: "/invest" },
            { icon: <ArrowUpFromLine size={20} className="text-white" />, label: "TOA PESA", to: "/withdraw" },
            { icon: <Wallet size={20} className="text-white" />, label: "WALLET", to: "/wallet" },
            { icon: <PlusCircle size={20} className="text-white" />, label: "WEKA PESA", to: "/deposit" },
          ].map(btn => (
            <button key={btn.label} onClick={() => navigate(btn.to)} className="flex flex-col items-center gap-1">
              <div className="action-btn-circle" style={{ width: 50, height: 50 }}>{btn.icon}</div>
              <span className="text-white text-[9px] font-bold tracking-wide">{btn.label}</span>
            </button>
          ))}
        </div>

        {/* 4. Investment Card - TALLER, more prominent */}
        <div className="glass-card px-3 py-2.5 flex-shrink-0" style={{ minHeight: 0, flex: "0 0 auto" }}>
          <div className="flex items-center justify-between mb-1.5">
            <p className="font-black text-white text-[11px] tracking-widest">UWEKEZAJI UNAOENDELEA</p>
            {investments.length > 1 && (
              <button onClick={() => navigate("/investments")}
                className="text-blue-400 text-[10px] font-bold underline">
                ONA ZAIDI ({investments.length})
              </button>
            )}
          </div>

          {!firstInv ? (
            <div className="text-center py-2">
              <p className="text-blue-300/50 font-semibold text-[10px] mb-1.5">HAKUNA UWEKEZAJI</p>
              <button onClick={() => navigate("/invest")}
                className="btn-primary px-5 py-2 text-[10px] font-bold">Wekeza Sasa</button>
            </div>
          ) : (() => {
            const profit = profits[firstInv.id] ?? calcProfit(firstInv);
            const pct = progressPct(firstInv);
            const isEnded = Date.now() >= new Date(firstInv.end_time).getTime();
            const showActions = isEnded || isVip;
            return (
              <div className="glass-card-dark rounded-xl px-3 py-2.5">
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="text-center">
                    <p className="text-[9px] text-blue-300/50 font-semibold">UMEWEKEZA</p>
                    <p className="text-white text-sm font-black tabular-nums">{formatTZS(firstInv.amount)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-blue-300/50 font-semibold">FAIDA SASA</p>
                    <p className="profit-green text-sm font-black tabular-nums">{formatTZS(profit)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-blue-300/50 font-semibold">JUMLA</p>
                    <p className="text-yellow-400 text-sm font-black tabular-nums">{formatTZS(firstInv.amount + profit)}</p>
                  </div>
                </div>
                <div className="text-center mb-2">
                  <p className="text-[9px] text-blue-300/50 font-semibold mb-0.5">MUDA ULIOBAKI</p>
                  <p className="text-white text-base font-black tabular-nums tracking-widest">
                    {isEnded ? "✅ IMEISHA" : formatTime(firstInv)}
                  </p>
                </div>
                <div className="progress-bar-bg h-1.5 mb-1">
                  <div className="progress-bar-fill h-1.5" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[9px] text-blue-300/40 text-center mb-1.5">MAENDELEO: {pct}%</p>
                {showActions && (
                  <div className="flex gap-2">
                    <button onClick={() => navigate(`/claim/${firstInv.id}`)}
                      className="flex-1 py-2 rounded-xl font-bold text-xs"
                      style={{ background: "linear-gradient(135deg,#00c853,#69f0ae)", color: "#000" }}>
                      CHUKUA FAIDA
                    </button>
                    <button onClick={() => navigate(`/reinvest/${firstInv.id}`)}
                      className="flex-1 py-2 rounded-xl font-bold text-xs text-white"
                      style={{ background: "linear-gradient(135deg,#1e6fff,#5500cc)" }}>
                      WEKEZA TENA
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* 5. Referral Card - just above nav */}
        <div className="glass-card px-3 py-2 flex-1 min-h-0 flex flex-col">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#00C853,#69F0AE)" }}>
              <Gift size={13} className="text-black" />
            </div>
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <button onClick={handleShareLink}
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg,#00C853,#69F0AE)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
              </button>
              <p className="font-black text-white text-[11px] tracking-wide truncate">
                PATA TZS {refBonus.toLocaleString()}/= BURE
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={handleCopyLink}
                className="flex items-center gap-1 px-2 py-1 rounded-lg"
                style={{ background: "rgba(30,80,200,0.4)" }}>
                <Copy size={10} className="text-blue-300" />
                <span className="text-blue-300 text-[9px] font-bold">COPY LINK</span>
              </button>
            </div>
          </div>

          <div className="glass-card-dark rounded-xl px-3 py-2 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-blue-300/60 text-[9px] font-semibold">WALIOJIUNGA</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-black text-xs tabular-nums">{refCount}/{refMax}</span>
                  <span className="text-[10px] font-black"
                    style={{ color: refFull ? "#00C853" : "#FFB300" }}>{refPct}%</span>
                </div>
              </div>

              <div className="progress-bar-bg h-1.5 mb-1.5">
                <div className="h-1.5 rounded-full"
                  style={{
                    width: `${refPct}%`,
                    background: refFull
                      ? "linear-gradient(90deg,#00c853,#69f0ae)"
                      : "linear-gradient(90deg,#FFB300,#FF8F00)"
                  }} />
              </div>
            </div>

            {/* Always show referral link */}
            <div className="flex items-center gap-1.5 bg-black/30 rounded-xl px-2 py-1.5">
              <span className="text-blue-300/50 text-[9px] truncate flex-1 min-w-0">{referralLink}</span>
              <button onClick={handleCopyLink}
                className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg"
                style={{ background: "rgba(30,80,200,0.5)" }}>
                <Copy size={11} className="text-blue-300" />
                <span className="text-blue-300 text-[9px] font-bold">COPY</span>
              </button>
              <button onClick={handleShareLink}
                className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg"
                style={{ background: "rgba(0,200,83,0.2)" }}>
                <span className="text-green-400 text-[9px] font-bold">SHARE</span>
              </button>
              <button onClick={() => setShowQR(true)}
                className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg"
                style={{ background: "rgba(85,0,204,0.3)" }}>
                <span className="text-purple-300 text-[9px] font-bold">QR</span>
              </button>
            </div>
            {refFull && refStats.readyToClaim && (
              <button onClick={handleClaimBonus} disabled={claimingBonus}
                className="w-full py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 mt-1"
                style={{ background: "linear-gradient(135deg,#00C853,#69F0AE)", color: "#000" }}>
                <CheckCircle2 size={13} />
                {claimingBonus ? "Inapakia..." : `DAI TZS ${refBonus.toLocaleString()}!`}
              </button>
            )}
          </div>
        </div>

      </div>

      {/* ── BOTTOM NAV ── */}
      <div className="flex-shrink-0">
        <BottomNav />
      </div>
    </div>
  );
}
