import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { loginUser, registerUser, setCurrentUserId, getCurrentUserId, isAdminLoggedIn, getUserByAccountId, getReferralStats, recordReferral, getAppSettings } from "@/lib/storage";
import { User } from "@/types";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import bgImg from "@/assets/bg-gradient.jpg";

export default function Auth() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [waNumber, setWaNumber] = useState("+255765947141");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref") || "";

  useEffect(() => {
    // If already logged in, redirect
    if (getCurrentUserId()) { navigate("/", { replace: true }); return; }
    if (isAdminLoggedIn()) { navigate("/admin", { replace: true }); return; }
    if (refCode) setTab("register");
    getAppSettings().then(s => setWaNumber(s.whatsapp_number || "+255765947141"));
  }, [refCode, navigate]);

  const handleHelp = () => {
    const num = waNumber.replace(/[^0-9]/g, "");
    window.open(`https://wa.me/${num}`, "_blank");
  };

  const handleLogin = async () => {
    if (!phone || !password) { toast.error("Jaza sehemu zote."); return; }
    setLoading(true);
    const result = await loginUser(phone, password);
    setLoading(false);
    if (result === "admin") {
      navigate("/admin", { replace: true });
    } else if (typeof result === "string") {
      toast.error(result);
    } else {
      setCurrentUserId((result as User).id);
      navigate("/", { replace: true });
    }
  };

  const handleRegister = async () => {
    if (!name || !phone || !password) { toast.error("Jaza sehemu zote."); return; }
    if (phone.length < 10) { toast.error("Weka namba sahihi ya simu."); return; }
    if (password.length < 4) { toast.error("Password lazima iwe na angalau herufi 4."); return; }
    setLoading(true);
    const result = await registerUser(name, phone, password);
    if (typeof result === "string") {
      setLoading(false);
      toast.error(result);
      return;
    }
    if (refCode) {
      const referrer = await getUserByAccountId(refCode.toUpperCase());
      if (referrer && referrer.id !== result.id) {
        const stats = await getReferralStats(referrer.id);
        await recordReferral(referrer.id, result.id, stats.cycle);
      }
    }
    setLoading(false);
    setCurrentUserId(result.id);
    toast.success("Umesajiliwa kikamilifu!");
    navigate("/", { replace: true });
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
      style={{ backgroundImage: `url(${bgImg})`, backgroundSize: "cover", backgroundPosition: "center" }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white tracking-widest drop-shadow-lg"
            style={{ textShadow: "0 0 30px rgba(100,150,255,0.8)" }}>
            WEKEZA PESA TZ
          </h1>
          <p className="text-blue-300 text-sm mt-1 font-medium">Wekeza • Pata Faida • Jibu Maisha</p>
        </div>

        {refCode && (
          <div className="glass-card p-3 mb-4 flex items-center gap-2 border border-yellow-500/30">
            <span className="text-lg">🎁</span>
            <p className="text-yellow-400 text-xs font-bold">Umealikwa! Jisajili upate zawadi za kipekee.</p>
          </div>
        )}

        <div className="glass-card p-6">
          <div className="flex rounded-xl overflow-hidden mb-6 bg-black/20">
            <button onClick={() => setTab("login")}
              className={`flex-1 py-3 font-bold text-sm ${tab === "login" ? "bg-blue-600 text-white" : "text-blue-300"}`}>
              INGIA
            </button>
            <button onClick={() => setTab("register")}
              className={`flex-1 py-3 font-bold text-sm ${tab === "register" ? "bg-blue-600 text-white" : "text-blue-300"}`}>
              JISAJILI
            </button>
          </div>

          {tab === "register" && (
            <div className="mb-4">
              <label className="text-blue-200 text-xs font-semibold mb-1 block">JINA LAKO KAMILI</label>
              <input className="inp" placeholder="Mfano: John Mwenda" value={name} onChange={e => setName(e.target.value)} />
            </div>
          )}

          <div className="mb-4">
            <label className="text-blue-200 text-xs font-semibold mb-1 block">NAMBA YA SIMU</label>
            <input className="inp" placeholder="+255700000000" value={phone} onChange={e => setPhone(e.target.value)} type="tel" />
          </div>

          <div className="mb-6">
            <label className="text-blue-200 text-xs font-semibold mb-1 block">PASSWORD</label>
            <input className="inp" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} type="password" />
          </div>

          <button
            className="btn-primary w-full py-4 text-base font-bold mb-3"
            onClick={tab === "login" ? handleLogin : handleRegister}
            disabled={loading}
          >
            {loading ? "Subiri..." : tab === "login" ? "INGIA" : "JISAJILI SASA"}
          </button>

          <button
            onClick={handleHelp}
            className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border border-green-500/40 text-green-400"
            style={{ background: "rgba(0,128,0,0.12)" }}
          >
            <MessageCircle size={18} className="text-green-400" />
            MSAADA WA WHATSAPP
          </button>

          <p className="text-center text-blue-300/60 text-xs mt-4">
            {tab === "login" ? "Bado huna akaunti? " : "Una akaunti? "}
            <button onClick={() => setTab(tab === "login" ? "register" : "login")} className="text-blue-400 font-bold underline">
              {tab === "login" ? "Jisajili" : "Ingia"}
            </button>
          </p>
        </div>

        <p className="text-center text-blue-300/40 text-xs mt-6">
          © 2026 WEKEZA PESA TZ. Haki zote zimehifadhiwa.
        </p>
      </div>
    </div>
  );
}
