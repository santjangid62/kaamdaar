"use client";

/**
 * Global Kaamdaar Assistant — floating chat + voice widget available on
 * every page (guests and logged-in users).
 *
 * - Voice input via Web Speech API, replies spoken back for voice queries.
 * - Offline intent engine answers search / book / track / rates / help in
 *   Hindi & English; anything else escalates to /api/assistant (AI) and
 *   falls back to suggestions when no key is configured.
 * - After login it auto-opens once and walks the user through the flow.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpenText,
  Bot,
  Loader2,
  LogIn,
  MapPin,
  Mic,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useApp } from "./AppProvider";
import { fill, useLang } from "../lib/i18n";
import {
  fallbackReply,
  localAnswer,
  type AssistantAction,
  type AssistantReply,
} from "../lib/assistant";
import { SERVICE_HI } from "../lib/strings";
import { nearbyAreaNames } from "../lib/areas";

interface Msg extends AssistantReply {
  role: "user" | "bot";
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult:
    | ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void)
    | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type SRCtor = new () => SpeechRecognitionLike;

function getSR(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function speakOut(text: string, lang: "en" | "hi") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text.replace(/\n+/g, ". "));
  u.lang = lang === "hi" ? "hi-IN" : "en-IN";
  u.rate = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

const ACTION_LABEL: Record<AssistantAction["type"], { en: string; hi: string }> = {
  search: { en: "View results", hi: "परिणाम देखें" },
  service: { en: "See Pros & book", hi: "प्रो देखें और बुक करें" },
  track: { en: "Open dashboard", hi: "डैशबोर्ड खोलें" },
  page: { en: "Open", hi: "खोलें" },
  login: { en: "Login", hi: "लॉगिन" },
};

export default function Assistant() {
  const router = useRouter();
  const { user, ready, location, services, providers } = useApp();
  const { lang, s } = useLang();

  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const viaVoiceRef = useRef(false);
  const guidedRef = useRef(false);

  const ctx = {
    lang,
    loggedIn: Boolean(user),
    name: user?.firstName || undefined,
  };

  const push = useCallback((m: Msg) => setMsgs((prev) => [...prev, m]), []);

  const answer = useCallback(
    async (text: string, viaVoice: boolean) => {
      viaVoiceRef.current = viaVoice;
      push({ role: "user", text });

      const known = {
        areas: location ? nearbyAreaNames(location, 10, providers) : undefined,
      };
      const local = localAnswer(text, ctx, known);
      if (local) {
        push({ role: "bot", ...local });
        if (viaVoice) speakOut(local.text, lang);
        return;
      }

      setBusy(true);
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            lang,
            history: msgs
              .filter((m) => m.role === "user" || m.role === "bot")
              .slice(-6)
              .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })),
          }),
        });
        const data = (await res.json()) as { reply?: string | null };
        const reply = data.reply
          ? { text: data.reply }
          : fallbackReply(lang);
        push({ role: "bot", ...reply });
        if (viaVoice && data.reply) speakOut(data.reply, lang);
      } catch {
        const fb = fallbackReply(lang);
        push({ role: "bot", ...fb });
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ctx/msgs captured intentionally
    [lang, location, msgs, push, services, providers],
  );

  /** Quick chips: built-in replies for the most common asks. */
  function quick(kind: string) {
    if (kind === "search") {
      push({
        role: "bot",
        text:
          lang === "hi"
            ? "सभी सेवाएं श्रेणी और रेट के साथ खोल रहा हूँ।"
            : "Opening all services with categories and rates.",
        action: { type: "page", href: "/services" },
      });
      return;
    }
    if (kind === "rates") {
      const top = services.filter((x) => x.popular).slice(0, 3);
      if (top.length === 0) {
        push({
          role: "bot",
          text: lang === "hi" ? "रेट पेज खोल रहा हूँ।" : "Opening the rates page.",
          action: { type: "page", href: "/services" },
        });
        return;
      }
      const named = top.map((x) => {
        const name = lang === "hi" && SERVICE_HI[x.id] ? SERVICE_HI[x.id].name : x.name;
        return `${name} ₹${x.price}`;
      });
      push({
        role: "bot",
        text:
          (lang === "hi" ? "शुरुआती रेट: " : "Starting rates: ") + named.join(" · "),
        action: { type: "page", href: "/services" },
      });
      return;
    }
    const queries: Record<string, string> = {
      track: "track my booking",
      how: "how to book",
      help: "help",
      login: "login",
    };
    const local = localAnswer(queries[kind] ?? kind, ctx);
    const reply = local ?? fallbackReply(lang);
    push({ role: "bot", ...reply });
  }

  function startListening() {
    const SR = getSR();
    if (!SR) {
      push({ role: "bot", text: s.assistant.notSupported });
      return;
    }
    recRef.current?.stop();
    const rec = new SR();
    rec.lang = lang === "hi" ? "hi-IN" : "en-IN";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript?.trim() ?? "";
      if (transcript) void answer(transcript, true);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  function stopListening() {
    recRef.current?.stop();
    setListening(false);
  }

  // open via navbar mic / home CTAs
  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<{ listen?: boolean }>).detail ?? {};
      setOpen(true);
      if (detail.listen) setTimeout(startListening, 350);
    }
    window.addEventListener("kaamdaar:assistant", onOpen);
    return () => window.removeEventListener("kaamdaar:assistant", onOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startListening follows lang/user via re-registration
  }, [lang, user]);

  // first open → greet
  useEffect(() => {
    if (!open || msgs.length > 0 || busy) return;
    const text = user
      ? fill(s.assistant.userGreeting, { name: user.firstName || user.phone.slice(-4) })
      : s.assistant.guestGreeting;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot greeting when the panel first opens
    push({ role: "bot", text });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- greet once per open
  }, [open]);

  // after login: auto-open once and guide the user
  useEffect(() => {
    if (!ready || !user || guidedRef.current) return;
    guidedRef.current = true;
    const key = `kaamdaar.guide.${user.id}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot guide prompt after login
    setOpen(true);
    setMsgs((prev) =>
      prev.length > 0
        ? prev
        : [
            {
              role: "bot",
              text: fill(s.assistant.userGreeting, {
                name: user.firstName || user.phone.slice(-4),
              }),
            },
            {
              role: "bot",
              text: `${s.assistant.guideTitle}\n${s.assistant.guide
                .map((g, i) => `${i + 1}. ${g}`)
                .join("\n")}`,
            },
          ],
    );
  }, [ready, user, s]);

  // keep messages scrolled to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy, open]);

  function runAction(action: AssistantAction) {
    if (action.type === "search") {
      router.push(`/services${action.q ? `?q=${encodeURIComponent(action.q)}` : ""}`);
    } else if (action.type === "service") {
      router.push(`/services/${action.id}/providers`);
    } else if (action.type === "track") {
      router.push(user ? "/dashboard" : "/login?next=/dashboard");
    } else if (action.type === "login") {
      router.push("/login");
    } else {
      router.push(action.href);
    }
    setOpen(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void answer(text, false);
  }

  const quickChips = user ? s.assistant.quick : s.assistant.quickGuest;
  const quickKinds = user ? ["search", "track", "how", "help"] : ["search", "rates", "help", "login"];

  return (
    <>
      {/* floating trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={s.assistant.openLabel}
        aria-label={s.assistant.openLabel}
        className={`fixed bottom-5 right-5 z-[70] grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-flame to-flame-600 text-navy shadow-xl shadow-black/30 transition hover:scale-105 active:scale-95 ${
          open ? "hidden" : "block"
        }`}
      >
        {listening ? <Mic className="h-6 w-6 animate-pulse" /> : <Bot className="h-6 w-6" />}
      </button>

      {/* panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-[70] flex w-[min(92vw,24rem)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-black/30">
          {/* header */}
          <div className="flex items-center gap-3 bg-navy px-4 py-3.5 text-white">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-flame text-navy">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{s.assistant.title}</p>
              <p className="truncate text-[11px] text-blue-200">{s.assistant.tagline}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1.5 text-blue-200 transition hover:bg-white/10 hover:text-white"
              aria-label={s.assistant.close}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* messages */}
          <div ref={scrollRef} className="flex max-h-[55vh] min-h-[16rem] flex-1 flex-col gap-3 overflow-y-auto bg-offwhite p-4">
            {msgs.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
                    m.role === "user"
                      ? "rounded-br-md bg-blue-600 text-white"
                      : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {m.text}
                </div>
                {m.action && (
                  <button
                    type="button"
                    onClick={() => runAction(m.action!)}
                    className="mt-1.5 flex items-center gap-1.5 rounded-full bg-flame px-3.5 py-1.5 text-xs font-bold text-navy transition hover:bg-flame-400"
                  >
                    {m.action.type === "service" ? (
                      <BookOpenText className="h-3.5 w-3.5" />
                    ) : m.action.type === "track" ? (
                      <MapPin className="h-3.5 w-3.5" />
                    ) : m.action.type === "login" ? (
                      <LogIn className="h-3.5 w-3.5" />
                    ) : null}
                    {ACTION_LABEL[m.action.type][lang]}
                  </button>
                )}
                {m.suggestions && m.suggestions.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {m.suggestions.map((sg) => (
                      <button
                        key={sg}
                        type="button"
                        onClick={() => void answer(sg, false)}
                        className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                      >
                        {sg}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> {s.assistant.thinking}
              </div>
            )}
          </div>

          {/* quick chips */}
          <div className="flex flex-wrap gap-1.5 border-t border-slate-100 bg-white px-3 pt-2.5">
            {quickChips.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => quick(quickKinds[i])}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-flame-400 hover:text-flame-600"
              >
                {label}
              </button>
            ))}
          </div>

          {/* input */}
          <form onSubmit={submit} className="flex items-center gap-2 bg-white p-3">
            <button
              type="button"
              onClick={() => (listening ? stopListening() : startListening())}
              title={s.assistant.tapToSpeak}
              aria-label={s.assistant.tapToSpeak}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${
                listening
                  ? "animate-pulse bg-red-500 text-white"
                  : "bg-flame-100 text-flame-600 hover:bg-flame hover:text-navy"
              }`}
            >
              <Mic className="h-5 w-5" />
            </button>
            <input
              value={listening ? s.assistant.listening : input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setListening(false)}
              placeholder={listening ? s.assistant.listening : s.assistant.placeholder}
              disabled={listening}
              className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label={s.assistant.send}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
