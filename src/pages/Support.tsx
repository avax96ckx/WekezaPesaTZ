import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUserId, getAppSettings } from "@/lib/storage";
import { AppSettings } from "@/types";
import { ArrowLeft, Send, ImageIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { FunctionsHttpError } from "@supabase/supabase-js";
import bgImg from "@/assets/bg-gradient.jpg";

interface Message {
  role: "user" | "assistant";
  content: string;
  time: string;
  links?: ActionLink[];
}

interface ActionLink {
  label: string;
  path?: string;
  url?: string;
}

function parseMessageContent(raw: string): { text: string; links: ActionLink[] } {
  const links: ActionLink[] = [];
  const text = raw
    .replace(/\[NAV:([^:]+):([^\]]+)\]/g, (_: string, path: string, label: string) => {
      links.push({ label, path });
      return "";
    })
    .replace(/\[URL:([^:]+):([^\]]+)\]/g, (_: string, url: string, label: string) => {
      links.push({ label, url });
      return "";
    })
    .trim();
  return { text, links };
}

const QUICK_QUESTIONS = [
  "Jinsi ya kuweka pesa?",
  "Ninaweza kutoa pesa lini?",
  "VIP inanisaidia vipi?",
  "Jinsi ya kupata zawadi ya marafiki?",
  "Nataka kupakua app",
];

export default function Support() {
  const navigate = useNavigate();
  const uid = getCurrentUserId();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showQuickQs, setShowQuickQs] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const adminName = settings?.admin_name || "CEO - WEKEZA PESA TZ";
  const adminPhoto = settings?.admin_photo || "";

  useEffect(() => {
    getAppSettings().then(s => {
      setSettings(s);
      const now = new Date().toLocaleTimeString("sw-TZ", { hour: "2-digit", minute: "2-digit" });
      setMessages([{
        role: "assistant",
        content: `Habari! Ninafurahi kukusaidia na maswali yoyote kuhusu akaunti yako, uwekezaji, au huduma zetu. Uliza swali lolote!`,
        time: now,
        links: [],
      }]);
    });
  }, []);

  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, [messages, loading]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setShowQuickQs(false);

    const now = new Date().toLocaleTimeString("sw-TZ", { hour: "2-digit", minute: "2-digit" });
    const userMsg: Message = { role: "user", content: text.trim(), time: now, links: [] };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = [...messages, userMsg].slice(-12).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke("support-chat", {
        body: { messages: history, userId: uid },
      });

      const replyTime = new Date().toLocaleTimeString("sw-TZ", { hour: "2-digit", minute: "2-digit" });

      if (error) {
        if (error instanceof FunctionsHttpError) {
          try { const t = await error.context?.text(); console.error("Support chat error:", t); } catch {}
        }
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "Samahani, kuna tatizo kidogo. Jaribu tena au wasiliana nasi kupitia WhatsApp.",
          time: replyTime,
          links: [],
        }]);
      } else {
        const raw: string = data?.reply || "Samahani, jaribu tena.";
        const parsed = parseMessageContent(raw);
        setMessages(prev => [...prev, {
          role: "assistant",
          content: parsed.text,
          time: replyTime,
          links: parsed.links,
        }]);
      }
    } catch (err) {
      console.error("Send error:", err);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Samahani, tatizo la mtandao. Jaribu tena.",
        time: new Date().toLocaleTimeString("sw-TZ", { hour: "2-digit", minute: "2-digit" }),
        links: [],
      }]);
    }

    setLoading(false);
  }, [loading, messages, uid]);

  const handleSend = useCallback(() => {
    sendMessage(input);
  }, [input, sendMessage]);

  const handleWhatsApp = () => {
    const num = (settings?.whatsapp_number || "+255765947141").replace(/[^0-9]/g, "");
    window.open(`https://wa.me/${num}`, "_blank");
  };

  const handleLinkClick = (link: ActionLink) => {
    if (link.path) navigate(link.path);
    else if (link.url) window.open(link.url, "_blank");
  };

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{
        backgroundImage: `url(${bgImg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* ── HEADER ── */}
      <div
        className="relative flex-shrink-0 flex items-center gap-2 px-3 pt-5 pb-3"
        style={{ background: "rgba(10,16,40,0.92)" }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "#1e2a4a" }}
        >
          <ArrowLeft size={20} className="text-white" />
        </button>

        <div
          className="flex items-center gap-2.5 flex-1 px-3 py-2 rounded-full"
          style={{ background: "#1a2344" }}
        >
          <div className="relative flex-shrink-0">
            {adminPhoto ? (
              <img src={adminPhoto} alt={adminName} className="w-9 h-9 rounded-full object-cover"
                style={{ border: "2px solid #4caf50" }} />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-base"
                style={{ background: "linear-gradient(135deg,#1e6fff,#5500cc)", border: "2px solid #4caf50" }}>
                {adminName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
              style={{ background: "#4caf50", borderColor: "#0a1028" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-white font-black text-sm truncate">{adminName}</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                <circle cx="12" cy="12" r="10" fill="#1e6fff" />
                <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-xs font-semibold" style={{ color: "#4caf50" }}>● Mtandaoni sasa hivi</p>
          </div>
        </div>

        <button onClick={handleWhatsApp}
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "#25d366" }}>
          <svg width="26" height="26" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M24 4C12.954 4 4 12.954 4 24C4 27.614 4.974 31.002 6.674 33.924L4.1 43.8L14.22 41.274C17.044 42.794 20.42 43.7 24 43.7C35.046 43.7 44 34.746 44 23.7C44 12.654 35.046 4 24 4Z" fill="white"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M24 7C14.611 7 7 14.611 7 24C7 27.38 7.954 30.54 9.61 33.22L7.3 41.7L16 39.44C18.6 40.94 21.7 41.8 25 41.8C34.389 41.8 42 34.189 42 24.8C42 15.411 34.389 7.8 25 7.8L24 7ZM18.5 15.5C18.1 14.7 17.5 14.7 17.1 14.7C16.7 14.7 16.3 14.7 15.9 14.7C15.5 14.7 14.8 14.9 14.3 15.4C13.8 15.9 12.5 17.2 12.5 19.8C12.5 22.4 14.3 24.9 14.6 25.3C14.9 25.7 18.4 31.4 23.9 33.6C28.4 35.4 29.4 35.1 30.4 35C31.4 34.9 33.7 33.7 34.2 32.4C34.7 31.1 34.7 30 34.5 29.7C34.3 29.5 34 29.4 33.5 29.1C33 28.9 30.4 27.6 30 27.4C29.5 27.3 29.2 27.2 28.9 27.7C28.5 28.2 27.5 29.4 27.2 29.7C26.9 30 26.6 30.1 26.1 29.8C25.6 29.6 24.1 29.1 22.2 27.4C20.8 26.1 19.8 24.5 19.5 24C19.2 23.5 19.5 23.2 19.7 22.9C20 22.6 20.2 22.4 20.5 22.1C20.7 21.8 20.8 21.6 21 21.3C21.1 21 21 20.7 20.9 20.5C20.7 20.2 19.8 17.6 19.3 16.5L18.5 15.5Z" fill="#25d366"/>
          </svg>
        </button>
      </div>

      {/* ── MESSAGES AREA ── */}
      <div
        className="flex-1 overflow-y-auto px-3 py-4 space-y-3"
        style={{ background: "rgba(8,14,35,0.72)" }}
        onClick={() => inputRef.current?.focus()}
      >
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-end gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            <div className="flex-shrink-0 mb-4">
              {msg.role === "assistant" ? (
                adminPhoto ? (
                  <img src={adminPhoto} alt={adminName} className="w-8 h-8 rounded-full object-cover"
                    style={{ border: "1.5px solid #4caf50" }} />
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-sm"
                    style={{ background: "linear-gradient(135deg,#1e6fff,#5500cc)", border: "1.5px solid #4caf50" }}>
                    {adminName.charAt(0).toUpperCase()}
                  </div>
                )
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black"
                  style={{ background: "#5500cc" }}>U</div>
              )}
            </div>

            <div className={`max-w-[78%] flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div
                className="px-4 py-2.5 text-sm leading-relaxed"
                style={msg.role === "assistant" ? {
                  background: "#111827", color: "#f0f0f0",
                  borderRadius: "4px 18px 18px 18px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                } : {
                  background: "linear-gradient(135deg,#1e6fff,#5500cc)", color: "white",
                  borderRadius: "18px 4px 18px 18px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                }}
              >
                {msg.content}
              </div>

              {/* Action link shortcuts — labels only, no URLs shown */}
              {msg.links && msg.links.length > 0 && (
                <div className={`flex flex-wrap gap-1.5 mt-0.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.links.map((link, li) => (
                    <button
                      key={li}
                      onClick={() => handleLinkClick(link)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                      style={{ background: "linear-gradient(135deg,#00c853,#388e3c)" }}
                    >
                      {link.label} →
                    </button>
                  ))}
                </div>
              )}

              <span className="text-[9px] px-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                {msg.time}
              </span>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-end gap-2">
            <div className="flex-shrink-0">
              {adminPhoto ? (
                <img src={adminPhoto} alt="" className="w-8 h-8 rounded-full object-cover" style={{ border: "1.5px solid #4caf50" }} />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-sm"
                  style={{ background: "linear-gradient(135deg,#1e6fff,#5500cc)" }}>
                  {adminName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="px-4 py-3 rounded-2xl flex items-center gap-1.5" style={{ background: "#111827" }}>
              <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "#888", animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "#888", animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "#888", animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick questions — auto-send on click, hide after any message sent */}
      {showQuickQs && messages.length <= 1 && !loading && (
        <div className="flex-shrink-0 px-3 pb-2" style={{ background: "rgba(8,14,35,0.72)" }}>
          <p className="text-white/40 text-[10px] font-semibold mb-1.5 mt-1.5">MASWALI YA HARAKA:</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => sendMessage(q)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.8)",
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── INPUT BAR ── */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-3 py-3"
        style={{ background: "rgba(10,16,40,0.92)" }}
      >
        <button
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "#1a2344" }}
        >
          <ImageIcon size={20} style={{ color: "rgba(255,255,255,0.5)" }} />
        </button>

        <input
          ref={inputRef}
          className="flex-1 text-sm outline-none px-4 py-3"
          style={{ background: "#1a2344", color: "white", borderRadius: "24px", border: "none" }}
          placeholder="Andika ujumbe wako..."
          value={input}
          onChange={e => { setInput(e.target.value); if (e.target.value) setShowQuickQs(false); }}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          disabled={loading}
        />

        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: input.trim() && !loading ? "#1e6fff" : "#1a2344",
            opacity: loading ? 0.5 : 1,
          }}
        >
          <Send size={18} className="text-white" />
        </button>
      </div>
    </div>
  );
}
