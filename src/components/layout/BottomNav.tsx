import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getAppSettings, getApkLastSeen, setApkLastSeen } from "@/lib/storage";
import { Home, HelpCircle, Download, Settings } from "lucide-react";

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [apkUrl, setApkUrl] = useState("");
  const [hasNewApk, setHasNewApk] = useState(false);

  const loadSettings = useCallback(async () => {
    const s = await getAppSettings();
    setApkUrl(s.apk_url || "");
    if (s.apk_url && s.apk_updated_at) {
      const lastSeen = getApkLastSeen();
      const apkTime = new Date(s.apk_updated_at).getTime();
      const seenTime = new Date(lastSeen).getTime();
      setHasNewApk(apkTime > seenTime);
    } else {
      setHasNewApk(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleDownload = () => {
    if (apkUrl) {
      window.open(apkUrl, "_blank");
      setApkLastSeen();
      setHasNewApk(false);
    } else {
      import("sonner").then(({ toast }) => toast.info("APK bado haipatikani. Wasiliana na msaada."));
    }
  };

  const isHome = location.pathname === "/";
  const isSettings = location.pathname === "/settings";
  const isSupport = location.pathname === "/support";

  return (
    <div className="bottom-nav fixed bottom-0 left-0 right-0 flex items-center justify-around px-6 py-3 z-50">
      <NavItem icon={<Home size={22} />} label="Home" active={isHome} onClick={() => navigate("/")} />
      <NavItem
        icon={<HelpCircle size={22} />}
        label="Msaada"
        active={isSupport}
        onClick={() => navigate("/support")}
      />
      <NavItem
        icon={
          <div className="relative">
            <Download size={22} />
            {hasNewApk && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black text-white"
                style={{ background: "#F44336" }}>1</span>
            )}
          </div>
        }
        label="Download App"
        onClick={handleDownload}
      />
      <NavItem icon={<Settings size={22} />} label="Settings" active={isSettings} onClick={() => navigate("/settings")} />
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 min-w-[52px]">
      <span className={active ? "text-blue-400" : "text-blue-300/60"}>{icon}</span>
      <span className={`text-[10px] font-semibold ${active ? "text-blue-400" : "text-blue-300/50"}`}>{label}</span>
    </button>
  );
}
