import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCurrentUserId, getUserById, getInvestmentById, reinvestInvestment, formatTZS, calcProfit } from "@/lib/storage";
import { Investment } from "@/types";
import { TrendingUp } from "lucide-react";
import { toast } from "sonner";
import bgImg from "@/assets/bg-gradient.jpg";

export default function Reinvest() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const uid = getCurrentUserId();
  const [inv, setInv] = useState<Investment | null>(null);
  const [isVip, setIsVip] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !id) { navigate("/auth"); return; }
    Promise.all([getInvestmentById(id), getUserById(uid)]).then(([found, user]) => {
      if (!found || found.user_id !== uid) { navigate("/"); return; }
      setInv(found);
      setIsVip(user?.vip_member || false);
      setLoading(false);
    });
  }, [id, uid, navigate]);

  const handleReinvest = async () => {
    if (!inv || !uid) return;
    const isEnded = Date.now() >= new Date(inv.end_time).getTime();
    if (!isVip && !isEnded) {
      toast.error("Uwekezaji bado haujaisha. Jiunge VIP ili uwekeze tena wakati wowote.");
      return;
    }
    setSubmitting(true);
    // Total = principal + accrued profit (capped at 100%)
    const profit = Math.min(calcProfit(inv), inv.amount);
    const totalReinvest = inv.amount + profit;
    await reinvestInvestment(inv.id, uid, totalReinvest);
    setSubmitting(false);
    toast.success(`Uwekezaji wa TZS ${totalReinvest.toLocaleString()} umeanzishwa!`);
    navigate("/");
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ backgroundImage: `url(${bgImg})`, backgroundSize: "cover" }}>
      <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!inv) return null;

  const isEnded = Date.now() >= new Date(inv.end_time).getTime();
  const canReinvest = isVip || isEnded;
  const profit = Math.min(calcProfit(inv), inv.amount);
  const totalReinvest = inv.amount + profit;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 fade-in"
      style={{ backgroundImage: `url(${bgImg})`, backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="w-full max-w-sm glass-card p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center mx-auto mb-4">
          <TrendingUp size={32} className="text-white" />
        </div>
        <h2 className="text-xl font-black text-white mb-1">ENDELEA KUWEKEZA</h2>
        {isVip && !isEnded && (
          <p className="text-yellow-400 text-xs font-bold mb-4">⭐ VIP: Unaweza kuwekeza tena mapema</p>
        )}
        <div className="glass-card-dark p-4 rounded-xl mb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-blue-300/60">Mtaji (asili):</span>
            <span className="text-white font-bold">{formatTZS(inv.amount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-blue-300/60">Faida iliyokusanywa:</span>
            <span className="profit-green font-bold">+ {formatTZS(profit)}</span>
          </div>
          <div className="h-px bg-blue-500/20 my-1" />
          <div className="flex justify-between text-sm">
            <span className="text-yellow-400/80 font-bold">JUMLA UTAKAYOWEKEZA:</span>
            <span className="text-yellow-400 font-black text-base">{formatTZS(totalReinvest)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-blue-300/60">Faida ya kila siku:</span>
            <span className="profit-green font-bold">10%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-blue-300/60">Faida baada ya muda:</span>
            <span className="profit-green font-bold">{formatTZS(totalReinvest)}</span>
          </div>
        </div>
        {!canReinvest && (
          <p className="text-yellow-400/80 text-xs mb-4 bg-yellow-900/20 rounded-xl p-3">
            ⚠️ Uwekezaji bado haujaisha. Jiunge VIP ili uwekeze tena wakati wowote.
          </p>
        )}
        <button onClick={handleReinvest} disabled={submitting || !canReinvest}
          className="btn-primary w-full py-4 font-bold text-base mb-3"
          style={!canReinvest ? { opacity: 0.4, cursor: "not-allowed" } : {}}>
          {submitting ? "Inawekeza..." : `WEKEZA TZS ${totalReinvest.toLocaleString()}`}
        </button>
        <button onClick={() => navigate("/")} className="w-full py-3 text-blue-300 font-semibold text-sm">
          Rudi Nyumbani
        </button>
      </div>
    </div>
  );
}
