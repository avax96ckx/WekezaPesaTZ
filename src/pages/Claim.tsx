import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCurrentUserId, getUserById, getInvestmentById, claimInvestment, calcProfit, formatTZS } from "@/lib/storage";
import { Investment } from "@/types";
import { CheckCircle } from "lucide-react";
import { toast } from "sonner";
import bgImg from "@/assets/bg-gradient.jpg";

export default function Claim() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const uid = getCurrentUserId();
  const [inv, setInv] = useState<Investment | null>(null);
  const [isVip, setIsVip] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentProfit, setCurrentProfit] = useState(0);
  const [userBalance, setUserBalance] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!uid || !id) { navigate("/auth"); return; }
    Promise.all([getInvestmentById(id), getUserById(uid)]).then(([found, user]) => {
      if (!found || found.user_id !== uid) { navigate("/"); return; }
      setInv(found);
      setIsVip(user?.vip_member || false);
      setUserBalance(user?.balance || 0);
      setCurrentProfit(calcProfit(found));
      setLoading(false);
    });
  }, [id, uid, navigate]);

  // Live profit ticker for VIP
  useEffect(() => {
    if (!inv || !isVip) return;
    const interval = setInterval(() => setCurrentProfit(calcProfit(inv)), 1000);
    return () => clearInterval(interval);
  }, [inv, isVip]);

  const handleClaim = async () => {
    if (!inv || !uid || submitting) return;
    // Disable immediately to prevent double-click
    setSubmitting(true);
    try {
      await claimInvestment(inv.id, uid);
      setClaimed(true);
      toast.success("Faida na mtaji vyote vimeingia kwenye akaunti yako!");
    } catch (e) {
      console.error("Claim error:", e);
      toast.error("Hitilafu imetokea. Jaribu tena.");
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ backgroundImage: `url(${bgImg})`, backgroundSize: "cover" }}>
      <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!inv) return null;

  const isEnded = Date.now() >= new Date(inv.end_time).getTime();
  const canClaim = isVip || isEnded;
  // profit accrued so far (capped at full amount on completion)
  const profit = isEnded ? inv.amount : currentProfit;
  // total returned = principal + profit
  const totalReturn = inv.amount + profit;

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundImage: `url(${bgImg})`, backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="w-full max-w-sm">
        {claimed ? (
          <div className="glass-card p-8 text-center">
            <CheckCircle size={60} className="text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-white mb-2">Hongera! 🎉</h2>
            <p className="text-blue-200 mb-4">Mtaji na faida vimeingia kwenye akaunti yako:</p>
            <div className="glass-card-dark p-4 rounded-2xl mb-4 space-y-2 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-blue-300/60">Mtaji uliorudishwa:</span>
                <span className="text-white font-bold">{formatTZS(inv.amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-300/60">Faida iliyopatikana:</span>
                <span className="profit-green font-bold">{formatTZS(profit)}</span>
              </div>
              <div className="border-t border-blue-500/20 pt-2 flex justify-between">
                <span className="text-white font-black text-sm">Jumla Iliyoingia:</span>
                <span className="profit-green font-black text-lg">{formatTZS(totalReturn)}</span>
              </div>
            </div>
            <p className="text-blue-300/50 text-xs mb-6">Salio jipya linajumuisha mtaji + faida</p>
            <button onClick={() => navigate("/")} className="btn-primary w-full py-4 font-bold">RUDI NYUMBANI</button>
          </div>
        ) : (
          <div className="glass-card p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-white" />
            </div>
            <h2 className="text-xl font-black text-white mb-1">CHUKUA FAIDA YAKO</h2>
            {isVip && !isEnded && (
              <p className="text-yellow-400 text-xs font-bold mb-4">⭐ VIP: Unachukua faida mapema</p>
            )}
            <div className="glass-card-dark p-4 rounded-xl mb-4 space-y-2 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-blue-300/60">Mtaji:</span>
                <span className="text-white font-bold">{formatTZS(inv.amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-300/60">{isEnded ? "Faida (100%):" : "Faida hadi sasa:"}</span>
                <span className="profit-green font-bold">{formatTZS(profit)}</span>
              </div>
              <div className="border-t border-blue-500/20 pt-2 flex justify-between">
                <span className="text-white font-black text-sm">Utapata:</span>
                <span className="profit-green font-black text-xl">{formatTZS(totalReturn)}</span>
              </div>
            </div>
            <p className="text-green-400/70 text-xs mb-4 bg-green-900/20 rounded-xl p-2">
              ✅ Mtaji ({formatTZS(inv.amount)}) + Faida ({formatTZS(profit)}) = {formatTZS(totalReturn)}
            </p>
            {!canClaim && (
              <p className="text-yellow-400/80 text-xs mb-4 bg-yellow-900/20 rounded-xl p-3">
                ⚠️ Uwekezaji bado haujaisha. Jiunge VIP ili uchukue faida wakati wowote.
              </p>
            )}
            <button onClick={handleClaim} disabled={!canClaim || submitting}
              className="w-full py-4 rounded-2xl font-bold text-base mb-3 flex items-center justify-center gap-2"
              style={canClaim && !submitting
                ? { background: "linear-gradient(135deg,#00c853,#69f0ae)", color: "#000" }
                : { background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)", cursor: "not-allowed" }}>
              {submitting ? (
                <><div className="w-5 h-5 border-3 border-black/40 border-t-black rounded-full animate-spin" style={{borderWidth:3}} />Inachukua...</>
              ) : "CHUKUA MTAJI + FAIDA"}
            </button>
            <button onClick={() => navigate("/")} className="w-full py-3 text-blue-300 font-semibold text-sm">
              Rudi Nyumbani
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
