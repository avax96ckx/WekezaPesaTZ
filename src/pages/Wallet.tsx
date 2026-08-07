import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCurrentUserId, getUserById, getUserDeposits, getUserWithdrawals,
  getUserInvestments, getUserTransfers, calcProfit, formatTZS, getAppSettings,
} from "@/lib/storage";
import { User, Investment, Transfer } from "@/types";
import {
  ArrowLeft, Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine,
  TrendingUp, Send, Clock, CheckCircle, XCircle, RefreshCw
} from "lucide-react";
import BottomNav from "@/components/layout/BottomNav";
import bgImg from "@/assets/bg-gradient.jpg";

type TxItem = {
  id: string;
  type: "deposit" | "withdrawal" | "investment" | "transfer_sent" | "transfer_received";
  amount: number;
  status: string;
  label: string;
  sublabel?: string;
  date: string;
};

const txConfig: Record<string, { icon: React.ReactNode; color: string; sign: string; bg: string }> = {
  deposit: { icon: <ArrowDownToLine size={16} />, color: "#00C853", sign: "+", bg: "rgba(0,200,83,0.15)" },
  withdrawal: { icon: <ArrowUpFromLine size={16} />, color: "#F44336", sign: "-", bg: "rgba(244,67,54,0.15)" },
  investment: { icon: <TrendingUp size={16} />, color: "#2196F3", sign: "-", bg: "rgba(33,150,243,0.15)" },
  transfer_sent: { icon: <Send size={16} />, color: "#FF8F00", sign: "-", bg: "rgba(255,143,0,0.15)" },
  transfer_received: { icon: <ArrowDownToLine size={16} />, color: "#00C853", sign: "+", bg: "rgba(0,200,83,0.15)" },
};

function statusBadge(status: string) {
  if (status === "approved" || status === "claimed") return { color: "#00C853", bg: "rgba(0,200,83,0.15)", label: "Imekamilika", icon: <CheckCircle size={10} /> };
  if (status === "active") return { color: "#2196F3", bg: "rgba(33,150,243,0.15)", label: "Inaendelea", icon: <TrendingUp size={10} /> };
  if (status === "pending") return { color: "#FFB300", bg: "rgba(255,179,0,0.15)", label: "Inasubiri", icon: <Clock size={10} /> };
  if (status === "rejected") return { color: "#F44336", bg: "rgba(244,67,54,0.15)", label: "Imekataliwa", icon: <XCircle size={10} /> };
  if (status === "ended") return { color: "#78909C", bg: "rgba(120,144,156,0.15)", label: "Imeisha", icon: <CheckCircle size={10} /> };
  return { color: "#78909C", bg: "rgba(120,144,156,0.15)", label: status, icon: <Clock size={10} /> };
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return `Leo ${d.toLocaleTimeString("sw-TZ", { hour: "2-digit", minute: "2-digit" })}`;
  if (days === 1) return `Jana ${d.toLocaleTimeString("sw-TZ", { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString("sw-TZ", { day: "2-digit", month: "short", year: "numeric" });
}

const TYPE_LABELS: Record<string, string> = {
  deposit: "Amana",
  withdrawal: "Malipo",
  investment: "Uwekezaji",
  transfer_sent: "Tuma",
  transfer_received: "Pokea",
};

export default function Wallet() {
  const navigate = useNavigate();
  const uid = getCurrentUserId();
  const [user, setUser] = useState<User | null>(null);
  const [txs, setTxs] = useState<TxItem[]>([]);
  const [liveProfit, setLiveProfit] = useState(0);
  const [activeInvs, setActiveInvs] = useState<Investment[]>([]);
  const [totalDeposited, setTotalDeposited] = useState(0);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [totalInvested, setTotalInvested] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | TxItem["type"]>("all");
  const [blocked, setBlocked] = useState(false);
  const [waNum, setWaNum] = useState("+255765947141");

  const loadData = async () => {
    if (!uid) { navigate("/auth"); return; }
    setLoading(true);
    const [u, deps, wds, invs, trs, s] = await Promise.all([
      getUserById(uid),
      getUserDeposits(uid),
      getUserWithdrawals(uid),
      getUserInvestments(uid),
      getUserTransfers(uid),
      getAppSettings(),
    ]);
    if (!u) { navigate("/auth"); return; }
    if (u.is_blocked) {
      setBlocked(true);
      setWaNum(s.whatsapp_number || "+255765947141");
      setLoading(false);
      return;
    }
    setUser(u);

    const active = invs.filter(i => i.is_active && !i.is_claimed);
    setActiveInvs(active);
    setLiveProfit(active.reduce((acc, inv) => acc + calcProfit(inv), 0));
    setTotalDeposited(deps.filter(d => d.status === "approved").reduce((a, d) => a + d.amount, 0));
    setTotalWithdrawn(wds.filter(w => w.status === "approved").reduce((a, w) => a + w.amount, 0));
    setTotalInvested(invs.reduce((a, i) => a + i.amount, 0));

    const items: TxItem[] = [
      ...deps.map(d => ({
        id: d.id, type: "deposit" as const, amount: d.amount, status: d.status,
        label: "Weka Pesa", sublabel: undefined, date: d.created_at,
      })),
      ...wds.map(w => ({
        id: w.id, type: "withdrawal" as const, amount: w.amount, status: w.status,
        label: "Toa Pesa", sublabel: `${w.network} • ${w.phone}`, date: w.created_at,
      })),
      ...invs.map(i => ({
        id: i.id, type: "investment" as const, amount: i.amount,
        status: i.is_claimed ? "claimed" : i.is_active ? "active" : "ended",
        label: "Uwekezaji", sublabel: `Faida: ${formatTZS(i.total_earned || calcProfit(i))}`, date: i.created_at,
      })),
      ...(trs as Transfer[]).map(tr => ({
        id: tr.id,
        type: (tr.sender_id === uid ? "transfer_sent" : "transfer_received") as "transfer_sent" | "transfer_received",
        amount: tr.amount, status: tr.status,
        label: tr.sender_id === uid ? `Tuma → ${tr.receiver_name}` : `Pokea ← ${tr.sender_name}`,
        sublabel: tr.sender_id === uid ? tr.receiver_phone : undefined,
        date: tr.created_at,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setTxs(items);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [uid]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveProfit(activeInvs.reduce((acc, inv) => acc + calcProfit(inv), 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeInvs]);

  if (blocked) {
    const num = waNum.replace(/[^0-9]/g, "");
    return (
      <div className="fixed inset-0" style={{ backgroundImage: `url(${bgImg})`, backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="absolute inset-0" style={{ backdropFilter: "blur(14px)", background: "rgba(0,0,10,0.8)" }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 z-10">
          <div className="glass-card p-8 rounded-3xl flex flex-col items-center text-center max-w-sm w-full">
            <div className="text-7xl mb-4">🚫</div>
            <h2 className="text-white font-black text-xl tracking-widest mb-3">AKAUNTI YAKO IMEZUILIWA</h2>
            <p className="text-blue-200/80 text-sm leading-relaxed mb-6">Akaunti yako imezuiwa na msimamizi. Wasiliana na admin kupitia WhatsApp.</p>
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

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ backgroundImage: `url(${bgImg})`, backgroundSize: "cover" }}>
      <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const filterTypes: Array<{ key: "all" | TxItem["type"]; label: string }> = [
    { key: "all", label: "Yote" },
    { key: "deposit", label: "Amana" },
    { key: "withdrawal", label: "Malipo" },
    { key: "investment", label: "Uwekezaji" },
    { key: "transfer_sent", label: "Tuma" },
    { key: "transfer_received", label: "Pokea" },
  ];

  const filteredTxs = filter === "all" ? txs : txs.filter(t => t.type === filter);

  return (
    <div className="min-h-screen pb-24"
      style={{ backgroundImage: `url(${bgImg})`, backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="px-4 pt-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-blue-300">
            <ArrowLeft size={20} /> <span className="font-semibold">Rudi</span>
          </button>
          <button onClick={loadData} className="p-2 rounded-xl bg-blue-600/20">
            <RefreshCw size={16} className="text-blue-300" />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <WalletIcon size={20} className="text-white" />
          </div>
          <h2 className="text-xl font-black text-white tracking-widest">WALLET</h2>
        </div>

        {/* Balance card */}
        <div className="glass-card p-5 mb-4 text-center">
          <p className="text-blue-200/70 text-xs font-semibold tracking-widest mb-1">SALIO LA AKAUNTI</p>
          <p className="text-4xl font-black text-white">{formatTZS(user.balance)}</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-blue-300/50 text-xs">Faida yote:</span>
            <span className="profit-green font-bold text-sm">{formatTZS(user.total_earnings + liveProfit)}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="glass-card p-3 text-center">
            <p className="font-black text-sm" style={{ color: "#2196F3" }}>{formatTZS(totalDeposited)}</p>
            <p className="text-blue-300/50 text-[9px] mt-0.5">Jumla Iliyowekwa</p>
          </div>
          <div className="glass-card p-3 text-center">
            <p className="font-black text-sm" style={{ color: "#F44336" }}>{formatTZS(totalWithdrawn)}</p>
            <p className="text-blue-300/50 text-[9px] mt-0.5">Jumla Iliyotolewa</p>
          </div>
          <div className="glass-card p-3 text-center">
            <p className="font-black text-sm" style={{ color: "#00C853" }}>{formatTZS(user.total_earnings + liveProfit)}</p>
            <p className="text-blue-300/50 text-[9px] mt-0.5">Jumla ya Faida</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
          {filterTypes.map(ft => (
            <button key={ft.key} onClick={() => setFilter(ft.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0 ${
                filter === ft.key
                  ? "text-white"
                  : "text-blue-300/60 bg-blue-900/30"
              }`}
              style={filter === ft.key ? { background: "linear-gradient(135deg,#1e6fff,#5500cc)" } : {}}>
              {ft.label}
              {ft.key !== "all" && (
                <span className="ml-1 opacity-60">
                  ({txs.filter(t => t.type === ft.key).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Transaction list */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white font-black text-xs tracking-widest">HISTORIA YA MIAMALA</p>
            <span className="text-blue-300/40 text-xs">{filteredTxs.length} muamala</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredTxs.length === 0 ? (
            <div className="text-center py-10">
              <WalletIcon size={36} className="text-blue-300/20 mx-auto mb-3" />
              <p className="text-blue-300/40 text-sm font-semibold">Hakuna muamala</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTxs.map(tx => {
                const cfg = txConfig[tx.type];
                const sts = statusBadge(tx.status);
                return (
                  <div key={tx.id} className="glass-card-dark rounded-2xl p-3 flex items-center gap-3">
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: cfg.bg, color: cfg.color }}>
                      {cfg.icon}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-bold text-sm truncate">{tx.label}</p>
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0 flex items-center gap-0.5"
                          style={{ color: sts.color, background: sts.bg }}>
                          {sts.icon}
                          {sts.label}
                        </span>
                      </div>
                      {tx.sublabel && (
                        <p className="text-blue-300/50 text-[10px] truncate mt-0.5">{tx.sublabel}</p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: "rgba(30,111,255,0.15)", color: "#6aa3ff" }}>
                          {TYPE_LABELS[tx.type]}
                        </span>
                        <span className="text-blue-300/40 text-[10px]">{formatDate(tx.date)}</span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right flex-shrink-0">
                      <p className="font-black text-sm" style={{ color: cfg.color }}>
                        {cfg.sign}{formatTZS(tx.amount)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
