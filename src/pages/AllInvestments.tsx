import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUserId, getUserById, getUserInvestments, calcProfit, formatTZS } from "@/lib/storage";
import { Investment, User } from "@/types";
import { ArrowLeft, TrendingUp } from "lucide-react";
import bgImg from "@/assets/bg-gradient.jpg";

function formatCountdown(inv: Investment): string {
  const remaining = Math.max(0, new Date(inv.end_time).getTime() - Date.now());
  const days = Math.floor(remaining / 86400000);
  const h = Math.floor((remaining % 86400000) / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return `${days} D ${String(h).padStart(2, "0")} H ${String(m).padStart(2, "0")} M ${String(s).padStart(2, "0")} S`;
}

function progressPct(inv: Investment): number {
  const start = new Date(inv.start_time).getTime();
  const end = new Date(inv.end_time).getTime();
  return Math.min(Math.round(((Date.now() - start) / (end - start)) * 100), 100);
}

function timerColor(pct: number): string {
  if (pct < 33) return "#F44336";   // Red - early stage
  if (pct < 66) return "#FFB300";   // Yellow - mid stage
  return "#00C853";                  // Green - near end
}

export default function AllInvestments() {
  const navigate = useNavigate();
  const uid = getCurrentUserId();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [profits, setProfits] = useState<Record<string, number>>({});
  const [pcts, setPcts] = useState<Record<string, number>>({});
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!uid) { navigate("/auth"); return; }
    Promise.all([getUserById(uid), getUserInvestments(uid)]).then(([u, invs]) => {
      setUser(u);
      const active = invs.filter(i => i.is_active && !i.is_claimed);
      setInvestments(active);
    });
  }, [uid, navigate]);

  useEffect(() => {
    const update = () => {
      const profitMap: Record<string, number> = {};
      const pctMap: Record<string, number> = {};
      const cdMap: Record<string, string> = {};
      investments.forEach(inv => {
        profitMap[inv.id] = calcProfit(inv);
        pctMap[inv.id] = progressPct(inv);
        cdMap[inv.id] = formatCountdown(inv);
      });
      setProfits(profitMap);
      setPcts(pctMap);
      setCountdowns(cdMap);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [investments]);

  const isVip = user?.vip_member ?? false;

  return (
    <div className="min-h-screen pb-8"
      style={{ backgroundImage: `url(${bgImg})`, backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="px-4 pt-6">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-blue-300 mb-5">
          <ArrowLeft size={20} /> <span className="font-semibold">Rudi</span>
        </button>
        <h2 className="text-xl font-black text-white tracking-widest mb-4">UWEKEZAJI WOTE UNAOENDELEA</h2>

        {investments.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="text-blue-300/50 font-semibold">Hakuna uwekezaji unaoendelea.</p>
            <button onClick={() => navigate("/invest")} className="mt-4 btn-primary px-6 py-3 font-bold">
              Wekeza Sasa
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {investments.map(inv => {
              const profit = profits[inv.id] ?? calcProfit(inv);
              const pct = pcts[inv.id] ?? progressPct(inv);
              const countdown = countdowns[inv.id] ?? formatCountdown(inv);
              const isEnded = Date.now() >= new Date(inv.end_time).getTime();
              const showActions = isEnded || isVip;
              const color = timerColor(pct);

              return (
                <div key={inv.id} className="glass-card p-3 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center flex-shrink-0">
                      <TrendingUp size={16} className="text-white" />
                    </div>
                    <p className="text-white text-xs font-bold">Uwekezaji #{inv.id.slice(-4)}</p>
                    <span className="ml-auto text-[9px] text-blue-300/50">{new Date(inv.start_time).toLocaleDateString("sw-TZ")}</span>
                  </div>

                  <div className="glass-card-dark rounded-xl p-3 space-y-1.5 mb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-blue-300/60 font-semibold w-28">UMEWEKEZA</span>
                      <span className="text-white text-xs font-black tabular-nums">{formatTZS(inv.amount)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-blue-300/60 font-semibold w-28">FAIDA HADI SASA</span>
                      <span className="profit-green text-xs font-black tabular-nums">{formatTZS(profit)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-blue-300/60 font-semibold w-28">MDA ULIOBAKI</span>
                      {/* Digital clock style countdown with dynamic color */}
                      <span className="text-[10px] font-black tabular-nums whitespace-nowrap font-mono px-2 py-0.5 rounded-lg"
                        style={{
                          color,
                          background: `${color}18`,
                          border: `1px solid ${color}40`,
                          textShadow: `0 0 8px ${color}80`,
                        }}>
                        {isEnded ? "✅ IMEISHA" : countdown}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar with dynamic color */}
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-0.5">
                    <div className="h-2 rounded-full"
                      style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}99, ${color})` }} />
                  </div>
                  <p className="text-[9px] text-blue-300/40 mt-0.5 mb-2">MAENDELEO: {pct}%</p>

                  {showActions && (
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => navigate(`/claim/${inv.id}`)}
                        className="flex-1 py-2 rounded-xl font-bold text-xs"
                        style={{ background: "linear-gradient(135deg,#00c853,#69f0ae)", color: "#000" }}>
                        CHUKUA FAIDA
                      </button>
                      <button onClick={() => navigate(`/reinvest/${inv.id}`)}
                        className="flex-1 py-2 rounded-xl font-bold text-xs text-white"
                        style={{ background: "linear-gradient(135deg,#1e6fff,#5500cc)" }}>
                        ENDELEA KUWEKEZA
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
