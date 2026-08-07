import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUserId, getUserById, createDeposit, uploadScreenshot, getAppSettings, formatTZS, AppNotification } from "@/lib/storage";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _AppNotification = AppNotification;
import { User, AppSettings } from "@/types";
import { ArrowLeft, PlusCircle, Camera, ImageIcon, Copy, Loader2, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import bgImg from "@/assets/bg-gradient.jpg";

export default function Deposit() {
  const navigate = useNavigate();
  const uid = getCurrentUserId();
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [amount, setAmount] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!uid) { navigate("/auth"); return; }
    Promise.all([getUserById(uid), getAppSettings()]).then(([u, s]) => {
      if (!u) { navigate("/auth"); return; }
      if (u.is_blocked) { setBlocked(true); setSettings(s); return; }
      setUser(u);
      setSettings(s);
    });
  }, [uid, navigate]);

  if (blocked) {
    const num = (settings?.whatsapp_number || "+255765947141").replace(/[^0-9]/g, "");
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

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Picha ni kubwa sana. Chagua picha ndogo zaidi (chini ya 5MB)."); return; }
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setScreenshotPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setShowSourcePicker(false);
  };

  const handleSubmit = async () => {
    if (!user) return;
    const num = parseInt(amount) || 0;
    if (num < 1) { toast.error("Weka kiasi cha pesa."); return; }
    if (!screenshotFile) { toast.error("Pakia picha ya muamala (screenshot)."); return; }

    setSubmitting(true);
    setUploading(true);
    toast.loading("Inapakia picha ya muamala...");
    const screenshotUrl = await uploadScreenshot(screenshotFile, user.id);
    setUploading(false);
    toast.dismiss();

    if (!screenshotUrl) {
      toast.error("Imeshindwa kupakia picha. Jaribu tena.");
      setSubmitting(false);
      return;
    }

    await createDeposit(user.id, user.name, num, screenshotUrl);
    setSubmitting(false);
    toast.success("Ombi limetumwa! Admin atakagua na kuthibitisha hivi karibuni.");
    // Browser push notification
    if ("Notification" in window) {
      if (Notification.permission === "default") await Notification.requestPermission();
      if (Notification.permission === "granted") {
        try {
          new Notification("📥 Amana Imetumwa!", {
            body: `Amana ya TZS ${num.toLocaleString()} imepokelewa. Subiri uthibitisho wa admin.`,
            icon: "/favicon.ico",
          });
        } catch {}
      }
    }
    // Play notification sound
    try {
      const soundUrl = settings?.notification_sound;
      if (soundUrl && soundUrl.trim() !== "") {
        const audio = new Audio(soundUrl);
        audio.volume = 1.0;
        audio.play().catch(() => {});
      }
    } catch {}
    navigate("/");
  };

  const copyPhone = () => {
    if (!settings) return;
    navigator.clipboard.writeText(settings.payment_phone);
    toast.success("Namba imenakiliwa!");
  };

  if (!user || !settings) return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ backgroundImage: `url(${bgImg})`, backgroundSize: "cover" }}>
      <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen pb-8"
      style={{ backgroundImage: `url(${bgImg})`, backgroundSize: "cover", backgroundPosition: "center" }}>

      {/* Source Picker Modal */}
      {showSourcePicker && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center">
          <div className="w-full max-w-sm glass-card rounded-t-3xl p-6">
            <div className="flex items-center justify-between mb-5">
              <p className="text-white font-black text-base">CHAGUA CHANZO CHA PICHA</p>
              <button onClick={() => setShowSourcePicker(false)}>
                <X size={20} className="text-blue-300/60" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => galleryRef.current?.click()}
                className="flex flex-col items-center gap-3 py-6 rounded-2xl border-2 border-blue-500/30 bg-blue-900/20">
                <ImageIcon size={32} className="text-blue-400" />
                <span className="text-white font-bold text-sm">Chagua Picha</span>
                <span className="text-blue-300/50 text-xs">Kutoka Gallery</span>
              </button>
              <button
                onClick={() => cameraRef.current?.click()}
                className="flex flex-col items-center gap-3 py-6 rounded-2xl border-2 border-green-500/30 bg-green-900/20">
                <Camera size={32} className="text-green-400" />
                <span className="text-white font-bold text-sm">Piga Picha</span>
                <span className="text-blue-300/50 text-xs">Kwa Camera</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden inputs */}
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />

      <div className="px-4 pt-6">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-blue-300 mb-6">
          <ArrowLeft size={20} /> <span className="font-semibold">Rudi</span>
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-green-600/80 flex items-center justify-center">
            <PlusCircle size={20} className="text-white" />
          </div>
          <h2 className="text-xl font-black text-white tracking-widest">WEKA PESA</h2>
        </div>

        {/* Payment Info - prominent card */}
        <div className="glass-card p-4 mb-4" style={{ border: "1px solid rgba(0,200,83,0.3)" }}>
          <p className="text-green-400 font-black text-xs tracking-widest mb-3">📲 TUMA PESA KWENYE NAMBA HII</p>
          
          <div className="glass-card-dark p-4 rounded-2xl mb-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-white font-black text-2xl tracking-widest">{settings.payment_phone}</p>
                <p className="text-blue-300/70 text-sm font-semibold mt-0.5">{settings.payment_name}</p>
              </div>
              <button onClick={copyPhone}
                className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-blue-600/40">
                <Copy size={18} className="text-blue-300" />
                <span className="text-blue-300 text-[10px] font-bold">NAKILI</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 rounded-full text-xs font-black"
                style={{ background: "rgba(0,200,83,0.2)", color: "#00C853", border: "1px solid rgba(0,200,83,0.4)" }}>
                {settings.payment_network}
              </div>
              <span className="text-blue-300/40 text-xs">Malipo yakubaliwa</span>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-blue-200/70">
              <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center font-bold text-[10px] text-white flex-shrink-0">1</span>
              <span>Tuma pesa kwenye namba hapo juu</span>
            </div>
            <div className="flex items-center gap-2 text-blue-200/70">
              <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center font-bold text-[10px] text-white flex-shrink-0">2</span>
              <span>Pakia picha ya risiti ya malipo hapa chini</span>
            </div>
            <div className="flex items-center gap-2 text-blue-200/70">
              <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center font-bold text-[10px] text-white flex-shrink-0">3</span>
              <span>Tuma ombi - admin atakagua na kuthibitisha</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="glass-card p-5 space-y-4">
          {/* Amount */}
          <div>
            <label className="text-blue-200 text-xs font-semibold mb-1 block">WEKA KIASI ULICHOTUMA</label>
            <input className="inp text-xl font-bold" placeholder="weka kiasi hapa......"
              type="number" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>

          {/* Quick amounts */}
          <div className="grid grid-cols-3 gap-2">
            {[5000, 10000, 20000, 50000, 100000, 200000].map(v => (
              <button key={v} onClick={() => setAmount(String(v))}
                className={`py-2 rounded-xl text-xs font-bold border transition-colors ${amount === String(v)
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "text-blue-300 border-blue-500/30 bg-blue-900/30"}`}>
                {formatTZS(v)}
              </button>
            ))}
          </div>

          {/* Screenshot Upload */}
          <div>
            <label className="text-blue-200 text-xs font-semibold mb-2 block">PAKIA PICHA YA MUAMALA</label>
            
            <button onClick={() => setShowSourcePicker(true)}
              className="w-full py-8 border-2 border-dashed border-blue-500/40 rounded-2xl flex flex-col items-center gap-3">
              {uploading
                ? <Loader2 size={32} className="text-blue-400 animate-spin" />
                : screenshotFile
                  ? <CheckCircle2 size={32} className="text-green-400" />
                  : (
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-12 h-12 rounded-xl bg-blue-800/50 flex items-center justify-center">
                          <ImageIcon size={22} className="text-blue-400" />
                        </div>
                        <span className="text-blue-300/70 text-[10px]">Gallery</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-12 h-12 rounded-xl bg-green-800/30 flex items-center justify-center">
                          <Camera size={22} className="text-green-400" />
                        </div>
                        <span className="text-green-400/70 text-[10px]">Camera</span>
                      </div>
                    </div>
                  )}
              {screenshotFile
                ? <span className="text-green-400 font-semibold text-sm">✓ Picha imechaguliwa</span>
                : <span className="text-blue-300 font-semibold text-sm">Bonyeza kuchagua picha</span>}
              {!screenshotFile && <span className="text-blue-300/40 text-xs">Kutoka gallery au piga kwa camera</span>}
            </button>

            {screenshotPreview && !uploading && (
              <div className="mt-3 relative">
                <img src={screenshotPreview} alt="Screenshot preview"
                  className="rounded-xl w-full max-h-52 object-contain border border-blue-500/20" />
                <button onClick={() => { setScreenshotFile(null); setScreenshotPreview(""); }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-600 flex items-center justify-center">
                  <X size={14} className="text-white" />
                </button>
              </div>
            )}
          </div>

          <p className="text-blue-300/50 text-xs bg-blue-900/30 rounded-xl p-3">
            ℹ️ Baada ya kutuma ombi, admin atakagua screenshot yako na kuthibitisha. Pesa itaingia kwenye akaunti yako hivi karibuni.
          </p>

          <button className="btn-primary w-full py-4 font-bold text-base flex items-center justify-center gap-2"
            onClick={handleSubmit} disabled={submitting || uploading}>
            {submitting
              ? <><Loader2 size={18} className="animate-spin" />Inatumwa...</>
              : "TUMA OMBI LA WEKA PESA"}
          </button>
        </div>
      </div>
    </div>
  );
}
