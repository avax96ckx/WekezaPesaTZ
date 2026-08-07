import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCurrentUserId, getUserById, createWithdrawal,
  createTransfer, submitTransfer, formatTZS, verifyUserPassword, getAppSettings,
} from "@/lib/storage";
import { User } from "@/types";
import { ArrowLeft, ArrowUpFromLine, Send, Search, CheckCircle, Lock, X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import bgImg from "@/assets/bg-gradient.jpg";

const NETWORKS = ["MPESA", "TIGOPESA", "AIRTEL MONEY", "HALOPESA"];

type Mode = "choose" | "withdraw" | "transfer_search" | "transfer_confirm";

interface PinModalProps {
  onConfirm: (pin: string) => void;
  onCancel: () => void;
  loading: boolean;
  title: string;
}

function PinModal({ onConfirm, onCancel, loading, title }: PinModalProps) {
  const [pin, setPin] = useState("");
  const [show, setShow] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center">
      <div className="w-full max-w-sm glass-card rounded-t-3xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#1e6fff,#5500cc)" }}>
            <Lock size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white font-black text-sm">THIBITISHA NA PASSWORD</p>
            <p className="text-blue-300/60 text-xs">{title}</p>
          </div>
          <button onClick={onCancel} className="p-1">
            <X size={20} className="text-blue-300/60" />
          </button>
        </div>

        <p className="text-blue-200/70 text-xs mb-3">Weka password yako ili kuthibitisha muamala huu:</p>

        <div className="relative mb-5">
          <input
            type={show ? "text" : "password"}
            className="inp pr-12 text-lg tracking-widest"
            placeholder="••••••••"
            value={pin}
            onChange={e => setPin(e.target.value)}
            autoFocus
          />
          <button onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300/60">
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-3 rounded-2xl font-bold text-sm bg-blue-900/50 text-blue-300">
            Ghairi
          </button>
          <button
            onClick={() => pin.trim() && onConfirm(pin)}
            disabled={loading || !pin.trim()}
            className="flex-1 py-3 rounded-2xl font-black text-sm text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#1e6fff,#5500cc)" }}>
            {loading ? "Inathibitisha..." : "THIBITISHA"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Withdraw() {
  const navigate = useNavigate();
  const uid = getCurrentUserId();
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<Mode>("withdraw");
  const [blocked, setBlocked] = useState(false);
  const [waNum, setWaNum] = useState("+255765947141");

  // Withdraw form
  const [recipientName, setRecipientName] = useState("");
  const [network, setNetwork] = useState("");
  const [wAmount, setWAmount] = useState("");

  // Transfer form
  const [receiverAccountId, setReceiverAccountId] = useState("");
  const [tAmount, setTAmount] = useState("");
  const [foundReceiver, setFoundReceiver] = useState<User | null>(null);
  const [searching, setSearching] = useState(false);

  // PIN modal
  const [showPin, setShowPin] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<"withdraw" | "transfer" | null>(null);

  useEffect(() => {
    if (!uid) { navigate("/auth"); return; }
    getUserById(uid).then(async u => {
      if (!u) { navigate("/auth"); return; }
      if (u.is_blocked) {
        const { getAppSettings } = await import("@/lib/storage");
        const s = await getAppSettings();
        setWaNum(s.whatsapp_number || "+255765947141");
        setBlocked(true); return;
      }
      setUser(u);
      if (u.vip_member) setMode("choose");
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

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ backgroundImage: `url(${bgImg})`, backgroundSize: "cover" }}>
      <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // --- Validation before PIN ---
  const validateWithdraw = (): boolean => {
    const num = parseInt(wAmount) || 0;
    if (!recipientName.trim()) { toast.error("Weka jina la mpokeaji."); return false; }
    if (!network) { toast.error("Chagua mtandao."); return false; }
    if (num < 2000) { toast.error("Kiwango cha chini cha kutoa ni TZS 2,000."); return false; }
    return true;
  };

  const handleWithdrawClick = () => {
    if (!validateWithdraw()) return;
    setPendingAction("withdraw");
    setShowPin(true);
  };

  const handleTransferConfirmClick = () => {
    setPendingAction("transfer");
    setShowPin(true);
  };

  const handlePinConfirm = async (pin: string) => {
    if (!user) return;
    setPinLoading(true);
    const valid = await verifyUserPassword(user.id, pin);
    if (!valid) {
      toast.error("Password si sahihi. Jaribu tena.");
      setPinLoading(false);
      return;
    }
    setPinLoading(false);
    setShowPin(false);

    if (pendingAction === "withdraw") {
      const num = parseInt(wAmount) || 0;
      const result = await createWithdrawal(user.id, user.name, user.phone, recipientName, network, num);
      if (typeof result === "string") {
        toast.error(result);
      } else {
        toast.success("Ombi la kutoa pesa limetumwa. Subiri uthibitisho wa admin.");
        navigate("/");
      }
    } else if (pendingAction === "transfer" && foundReceiver) {
      const num = parseInt(tAmount) || 0;
      if (num < 1000) { toast.error("Kiwango cha chini ni TZS 1,000."); return; }
      const result = await submitTransfer(user.id, user.name, foundReceiver.id, foundReceiver.name, foundReceiver.phone, num);
      if (typeof result === "string") {
        toast.error(result);
      } else {
        toast.success("Ombi la kutuma pesa limetumwa! Admin atakagua hivi karibuni.");
        navigate("/");
      }
    }
    setPendingAction(null);
  };

  const handleSearchReceiver = async () => {
    if (!receiverAccountId.trim()) { toast.error("Weka Account ID."); return; }
    setSearching(true);
    const result = await createTransfer(user.id, user.name, receiverAccountId.trim().toUpperCase(), parseInt(tAmount) || 0);
    setSearching(false);
    if (typeof result === "string") {
      toast.error(result);
    } else {
      setFoundReceiver(result.receiver);
      setMode("transfer_confirm");
    }
  };

  return (
    <div className="min-h-screen pb-8"
      style={{ backgroundImage: `url(${bgImg})`, backgroundSize: "cover", backgroundPosition: "center" }}>

      {/* PIN Modal */}
      {showPin && (
        <PinModal
          title={pendingAction === "withdraw"
            ? `Kutoa TZS ${parseInt(wAmount).toLocaleString()}`
            : `Kutuma TZS ${parseInt(tAmount).toLocaleString()} kwa ${foundReceiver?.name}`}
          loading={pinLoading}
          onConfirm={handlePinConfirm}
          onCancel={() => { setShowPin(false); setPendingAction(null); }}
        />
      )}

      <div className="px-4 pt-6">
        <button onClick={() => user.vip_member && mode !== "choose" ? setMode("choose") : navigate("/")}
          className="flex items-center gap-2 text-blue-300 mb-6">
          <ArrowLeft size={20} /> <span className="font-semibold">Rudi</span>
        </button>

        {/* VIP Choose Mode */}
        {mode === "choose" && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-red-600/80 flex items-center justify-center">
                <ArrowUpFromLine size={20} className="text-white" />
              </div>
              <h2 className="text-xl font-black text-white tracking-widest">CHAGUA CHAGUO</h2>
            </div>
            <div className="space-y-3">
              <button onClick={() => setMode("withdraw")}
                className="w-full glass-card p-5 flex items-center gap-4 text-left">
                <div className="w-12 h-12 rounded-2xl bg-red-600/80 flex items-center justify-center flex-shrink-0">
                  <ArrowUpFromLine size={22} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-black text-base">TOA PESA</p>
                  <p className="text-blue-300/60 text-sm">Toa pesa kwenye namba yako ya simu</p>
                </div>
              </button>
              <button onClick={() => setMode("transfer_search")}
                className="w-full glass-card p-5 flex items-center gap-4 text-left">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,#FFB300,#FF8F00)" }}>
                  <Send size={22} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-black text-base">TUMA PESA</p>
                  <p className="text-blue-300/60 text-sm">Tuma pesa kwenye akaunti nyingine</p>
                </div>
              </button>
            </div>
          </>
        )}

        {/* Withdraw Form */}
        {mode === "withdraw" && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-red-600/80 flex items-center justify-center">
                <ArrowUpFromLine size={20} className="text-white" />
              </div>
              <h2 className="text-xl font-black text-white tracking-widest">TOA PESA</h2>
            </div>
            <div className="glass-card p-4 mb-4">
              <p className="text-blue-200/70 text-xs font-semibold mb-1">SALIO LINALOWEZA KUTOLEWA</p>
              <p className="text-2xl font-black text-white">{formatTZS(user.balance)}</p>
              <p className="text-blue-300/50 text-xs mt-1">Kiwango cha chini: TZS 2,000</p>
            </div>
            <div className="glass-card p-5 space-y-4">
              <div>
                <label className="text-blue-200 text-xs font-semibold mb-1 block">NAMBA YA SIMU YA KUPOKEA</label>
                <input className="inp" value={user.phone} disabled style={{ opacity: 0.7 }} />
                <p className="text-blue-300/40 text-xs mt-1">Inajaza otomatiki kutoka akaunti yako</p>
              </div>
              <div>
                <label className="text-blue-200 text-xs font-semibold mb-1 block">JINA LITAKALOKUJA</label>
                <input className="inp" placeholder="Jina kama linavyoonekana kwenye M-Pesa/Tigo..."
                  value={recipientName} onChange={e => setRecipientName(e.target.value)} />
                <p className="text-yellow-400/70 text-xs mt-1">⚠️ Weka jina sahihi ili kuthibitisha muamala</p>
              </div>
              <div>
                <label className="text-blue-200 text-xs font-semibold mb-1 block">MTANDAO WA SIMU</label>
                <select className="inp" value={network} onChange={e => setNetwork(e.target.value)}>
                  <option value="">-- Chagua Mtandao --</option>
                  {NETWORKS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="text-blue-200 text-xs font-semibold mb-1 block">WEKA KIASI UNACHOTAKA KUTOA</label>
                <input className="inp text-xl font-bold" placeholder="weka kiasi hapa......" type="number"
                  value={wAmount} onChange={e => setWAmount(e.target.value)} />
              </div>
              <button className="btn-primary w-full py-4 font-bold text-base flex items-center justify-center gap-2"
                onClick={handleWithdrawClick}>
                <Lock size={16} />
                TUMA OMBI (THIBITISHA NA PIN)
              </button>
            </div>
          </>
        )}

        {/* Transfer Search */}
        {mode === "transfer_search" && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#FFB300,#FF8F00)" }}>
                <Send size={20} className="text-white" />
              </div>
              <h2 className="text-xl font-black text-white tracking-widest">TUMA PESA</h2>
            </div>
            <div className="glass-card p-4 mb-4">
              <p className="text-blue-200/70 text-xs font-semibold mb-1">SALIO LAKO</p>
              <p className="text-2xl font-black text-white">{formatTZS(user.balance)}</p>
            </div>
            <div className="glass-card p-5 space-y-4">
              <div>
                <label className="text-blue-200 text-xs font-semibold mb-1 block">ACCOUNT ID YA MPOKEAJI</label>
                <input className="inp font-bold text-lg tracking-widest uppercase"
                  placeholder="Mfano: WPT123456"
                  value={receiverAccountId} onChange={e => setReceiverAccountId(e.target.value.toUpperCase())} />
              </div>
              <div>
                <label className="text-blue-200 text-xs font-semibold mb-1 block">WEKA KIASI UNACHOTAKA KUTOA</label>
                <input className="inp text-xl font-bold" placeholder="weka kiasi hapa......" type="number"
                  value={tAmount} onChange={e => setTAmount(e.target.value)} />
              </div>
              <button onClick={handleSearchReceiver} disabled={searching}
                className="btn-primary w-full py-4 font-bold flex items-center justify-center gap-2">
                {searching ? "Inatafuta..." : <><Search size={18} />TAFUTA AKAUNTI</>}
              </button>
            </div>
          </>
        )}

        {/* Transfer Confirm */}
        {mode === "transfer_confirm" && foundReceiver && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#FFB300,#FF8F00)" }}>
                <CheckCircle size={20} className="text-white" />
              </div>
              <h2 className="text-xl font-black text-white tracking-widest">THIBITISHA KUTUMA</h2>
            </div>
            <div className="glass-card p-5 space-y-4">
              <div className="glass-card-dark p-4 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-700 flex items-center justify-center text-xl font-bold text-white">
                    {foundReceiver.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-black text-base">{foundReceiver.name}</p>
                    <p className="text-blue-300/60 text-sm">{foundReceiver.phone}</p>
                    <p className="text-blue-300/40 text-xs">{foundReceiver.account_id}</p>
                  </div>
                </div>
              </div>
              <div className="glass-card-dark p-4 rounded-2xl space-y-2">
                <div className="flex justify-between">
                  <span className="text-blue-300/60 text-sm">Kiasi:</span>
                  <span className="text-white font-black text-lg">{formatTZS(parseInt(tAmount) || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-300/60 text-sm">Kutoka:</span>
                  <span className="text-white font-semibold text-sm">{user.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-300/60 text-sm">Kwenda:</span>
                  <span className="text-white font-semibold text-sm">{foundReceiver.name}</span>
                </div>
              </div>
              <p className="text-yellow-400/80 text-xs bg-yellow-900/20 rounded-xl p-3">
                ⚠️ Utaombwa uweke password yako kuthibitisha muamala huu.
              </p>
              <div className="flex gap-3">
                <button onClick={() => { setMode("transfer_search"); setFoundReceiver(null); }}
                  className="flex-1 py-4 rounded-2xl font-bold text-sm bg-blue-900/50 text-blue-300">
                  Rudi
                </button>
                <button onClick={handleTransferConfirmClick}
                  className="flex-1 py-4 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg,#FFB300,#FF8F00)" }}>
                  <Lock size={15} />
                  THIBITISHA
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
