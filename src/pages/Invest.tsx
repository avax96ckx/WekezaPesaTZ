import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUserId, getUserById, createInvestment, updateUser, formatTZS, getAppSettings } from "@/lib/storage";
import { User } from "@/types";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import bgImg from "@/assets/bg-gradient.jpg";

export default function Invest() {
  const navigate = useNavigate();
  const uid = getCurrentUserId();
  const [user, setUser] = useState<User | null>(null);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [investDays, setInvestDays] = useState(10);

  useEffect(() => {
    if (!uid) { navigate("/auth"); return; }
    getUserById(uid).then(u => { if (!u) navigate("/auth"); else setUser(u); });
  }, [uid, navigate]);

  useEffect(() => {
    getAppSettings().then(s => setInvestDays(s.investment_days || 10));
  }, []);

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ backgroundImage: `url(${bgImg})`, backgroundSize: "cover" }}>
      <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const num = parseInt(amount) || 0;
  const dailyProfit = Math.floor(num * 0.1);
  const totalProfit = num;

  const triggerNotification = async (title: string, body: string) => {
    // Request permission if not yet granted
    if ("Notification" in window) {
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
      if (Notification.permission === "granted") {
        try { new Notification(title, { body, icon: "/favicon.ico" }); } catch {}
      }
    }
    // Play sound if configured
    try {
      const s = await getAppSettings();
      const soundUrl = s.notification_sound;
      if (soundUrl && soundUrl.trim() !== "") {
        const audio = new Audio(soundUrl);
        audio.volume = 1.0;
        audio.play().catch(() => {});
      }
    } catch {}
  };

  const handleInvest = async () => {
    if (num < 1000) { toast.error("Kiwango cha chini ni TZS 1,000."); return; }
    if (num > 10000000) { toast.error("Kiwango cha juu ni TZS 10,000,000."); return; }
    if (user.balance < num) { toast.error("Salio halitooshi. Weka pesa kwanza."); return; }
    setSubmitting(true);
    const s = await getAppSettings();
    const investDays = s.investment_days || 10;
    await updateUser({ id: user.id, balance: user.balance - num });
    await createInvestment(user.id, num, investDays);
    setSubmitting(false);
    toast.success("Uwekezaji umeanzishwa!");
    triggerNotification("📈 Uwekezaji Umeanza!", `Umewekeza TZS ${num.toLocaleString()} - faida itaonekana kwa siku ${investDays}.`);
    navigate("/");
  };

  return (
    <div className="min-h-screen pb-8 fade-in"
      style={{ backgroundImage: `url(${bgImg})`, backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="px-4 pt-6">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-blue-300 mb-6">
          <ArrowLeft size={20} /> <span className="font-semibold">Rudi</span>
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <TrendingUp size={20} className="text-white" />
          </div>
          <h2 className="text-xl font-black text-white tracking-widest">WEKEZA PESA</h2>
        </div>

        <div className="glass-card p-4 mb-4">
          <p className="text-blue-200/70 text-xs font-semibold mb-1">SALIO LAKO</p>
          <p className="text-2xl font-black text-white">{formatTZS(user.balance)}</p>
        </div>

        <div className="glass-card p-4 mb-4">
          <p className="text-white font-bold mb-3">📊 Jinsi Uwekezaji Unavyofanya Kazi</p>
          <div className="space-y-2 text-sm">
            {[
              ["Faida ya kila siku:", "10%"],
              ["Muda wa uwekezaji:", `Siku ${investDays}`],
              ["Jumla ya faida:", "100%"],
              ["Kiwango cha chini:", "TZS 1,000"],
              ["Kiwango cha juu:", "TZS 10,000,000"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-blue-300/70">{k}</span>
                <span className={k === "Jumla ya faida:" ? "profit-green font-bold" : "text-white font-bold"}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-5">
          <label className="text-blue-200 text-xs font-semibold mb-2 block">KIASI CHA KUWEKEZA (TZS)</label>
          <input
            className="inp text-xl font-bold text-center mb-4"
            placeholder="1,000"
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />

          {num >= 1000 && (
            <div className="glass-card-dark p-3 rounded-xl mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-blue-300/70">Utawekeza:</span>
                <span className="text-white font-bold">{formatTZS(num)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-300/70">Faida ya kila siku:</span>
                <span className="profit-green font-bold">{formatTZS(dailyProfit)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-300/70">Faida baada ya siku {investDays}:</span>
                <span className="profit-green font-bold">{formatTZS(totalProfit)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 mb-4">
            {[1000, 5000, 10000, 50000, 100000, 500000].map(v => (
              <button key={v} onClick={() => setAmount(String(v))}
                className="py-2 rounded-xl text-xs font-bold text-blue-300 border border-blue-500/30 bg-blue-900/30">
                {formatTZS(v)}
              </button>
            ))}
          </div>

          <button className="btn-primary w-full py-4 font-bold text-base" onClick={handleInvest} disabled={submitting}>
            {submitting ? "Inawekezwa..." : "WEKEZA SASA"}
          </button>
        </div>
      </div>
    </div>
  );
}
