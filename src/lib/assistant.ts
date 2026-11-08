/**
 * Local assistant engine — handles the high-value intents without any AI
 * backend so voice/chat works out of the box (search, book, track, rates,
 * help, login). Anything it cannot answer is escalated to /api/assistant
 * (AI) by the widget, which falls back to suggestions if no key is set.
 */
import { SERVICES as DEFAULT_SERVICES } from "./seed";
import type { Service } from "./types";

/**
 * Catalogue the assistant reasons over. Defaults to the seed, and is swapped
 * for the live database catalogue by the API route (server) or AppProvider
 * (browser) — so new/edited services from the Admin panel are picked up.
 */
let SERVICES: Service[] = DEFAULT_SERVICES;

export function setCatalog(services: Service[]) {
  if (services.length > 0) SERVICES = services;
}
import { SERVICE_HI, SERVICE_DETAIL_HI, type Lang } from "./strings";

export type AssistantAction =
  | { type: "search"; q: string }
  | { type: "service"; id: string }
  | { type: "track" }
  | { type: "page"; href: string }
  | { type: "login" };

export interface AssistantReply {
  text: string;
  suggestions?: string[];
  action?: AssistantAction;
}

export interface AssistantContext {
  lang: Lang;
  loggedIn: boolean;
  name?: string;
}

/** Open the floating assistant (optionally straight into listening mode). */
export function openVoiceAssistant(listen = true) {
  window.dispatchEvent(
    new CustomEvent("kaamdaar:assistant", { detail: { listen } }),
  );
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

/** Best-matching service for a free-text query, or null. */
export function matchService(query: string): (typeof SERVICES)[number] | null {
  const q = norm(query);
  if (!q) return null;

  // 1. direct id / name / Hindi name match
  let best: (typeof SERVICES)[number] | null = null;
  let bestScore = 0;
  for (const s of SERVICES) {
    const hi = SERVICE_HI[s.id];
    const names = [s.name, s.category, hi?.name ?? ""].map(norm);
    for (const name of names) {
      if (!name) continue;
      if (q === name) return s;
      if (q.includes(name) && name.length > bestScore) {
        best = s;
        bestScore = name.length;
      } else if (name.includes(q) && q.length >= 4 && q.length > bestScore) {
        best = s;
        bestScore = q.length;
      }
    }
  }
  if (best) return best;

  // 2. loose word overlap (handles "kitchen ki safai", "AC jaise extras")
  const words = norm(query).split(" ").filter((w) => w.length >= 3);
  for (const s of SERVICES) {
    const hi = SERVICE_HI[s.id];
    const hay = norm(`${s.name} ${s.category} ${s.tagline} ${hi?.name ?? ""}`);
    const hits = words.filter((w) => hay.includes(w)).length;
    if (hits > 0 && hits >= bestScore) {
      best = s;
      bestScore = hits;
    }
  }
  return best;
}

/** Category match for queries like "cleaning dikhao" / "safai wali services". */
function matchCategory(query: string): string | null {
  const q = norm(query);
  const cats = Array.from(new Set(SERVICES.map((s) => s.category)));
  for (const c of cats) {
    if (q.includes(norm(c))) return c;
  }
  const hints: Array<[string[], string]> = [
    [["safai", "saaf", "cleaning", "clean"], "Cleaning"],
    [["rasoi", "kitchen", "bartan", "kitchen"], "Kitchen"],
    [["kapde", "laundry", "dhulai", "istri", "iron"], "Laundry"],
    [["appliance", "fridge", "fan", "washing"], "Appliances"],
    [["party", "special", "packing", "plant"], "Special"],
    [["hourly", "ghante", "flexible"], "Flexible Help"],
  ];
  for (const [keys, cat] of hints) {
    if (keys.some((k) => q.includes(k))) return cat;
  }
  return null;
}

const GUIDE = [
  "1. Search a service — type or speak its name",
  "2. Pick a Pro near you, choose date & time",
  "3. Confirm the booking, pay after the service",
  "4. Track it live from your dashboard",
];

/**
 * Try to answer locally. Returns null when the query needs the AI backend.
 */
export function localAnswer(
  query: string,
  ctx: AssistantContext,
  known?: { areas?: string[] },
): AssistantReply | null {
  const q = norm(query);
  if (!q) return null;
  const hi = ctx.lang === "hi";
  const service = matchService(q);
  const wantsBook = /(book|buk|lagwa|karwa|kervana|booking|बुक|लगव|करवा)/i.test(query);
  const wantsTrack = /(track|status|kahan|kab pahunch|meri booking|my booking|ट्रैक|स्टेटस|मेरी बुकिंग|कहाँ)/i.test(query);
  const wantsPrice = /(rate|price|kitne|cost|दाम|कीमत|कितने|रेट|भाव)/i.test(query);
  const wantsHelp = /(help|madad|support|complain|shikayat|मदद|सहायता|शिकायत|सपोर्ट)/i.test(query);
  const wantsLogin = /(login|log in|signin|sign in|laut|लॉगिन|लॉग इन|साइन)/i.test(query);
  const wantsHow = /(kaise|how|कैसे|तरीका)/i.test(query);
  const wantsAreas = /(area|ilake|nearby area|इलाके|क्षेत्र|एरिया)/i.test(query);
  const greeting = /^(hi|hello|hey|namaste|namaskar|नमस्ते|हैलो|हाय)\b/.test(q);

  if (greeting) {
    return {
      text: ctx.loggedIn && ctx.name
        ? hi
          ? `नमस्ते ${ctx.name}! सेवा खोजनी हो, बुक करनी हो या ट्रैक करना हो — बताइए।`
          : `Hi ${ctx.name}! Want to search a service, book one, or track a booking?`
        : hi
          ? "नमस्ते! मैं कामदार असिस्टेंट हूँ — सेवा, रेट, बुकिंग या ट्रैकिंग पूछिए।"
          : "Hi! I'm the Kaamdaar Assistant — ask me about services, rates, booking or tracking.",
      suggestions: hi
        ? ["किचन सफाई बुक करें", "रेट कितने हैं?", "बुकिंग कैसे करें?"]
        : ["Book kitchen cleaning", "What are the rates?", "How do I book?"],
    };
  }

  if (wantsTrack) {
    if (!ctx.loggedIn) {
      return {
        text: hi
          ? "बुकिंग ट्रैक करने के लिए लॉगिन करना होगा — आपका फ़ोन नंबर OTP से वेरिफाई होगा।"
          : "You need to log in (phone + OTP) to track your bookings.",
        action: { type: "login" },
        suggestions: hi ? ["सेवा खोजें", "रेट देखें"] : ["Search services", "View rates"],
      };
    }
    return {
      text: hi
        ? "आपकी बुकिंग डैशबोर्ड के “मेरी बुकिंग” सेक्शन में है — वहाँ चालू, आगामी और पिछली तीनों दिखती हैं। खोलूँ?"
        : "Your bookings are in the dashboard under “My bookings” — current, upcoming and previous. Open it?",
      action: { type: "track" },
    };
  }

  if (wantsHelp) {
    return {
      text: hi
        ? "हेल्प एंड सपोर्ट पेज पर बिलिंग, रिफंड, बुकिंग और शिकायत के विकल्प मिल जाएँगे। खोलूँ?"
        : "The Help & Support page covers billing, refunds, bookings and complaints. Open it?",
      action: { type: "page", href: "/help" },
    };
  }

  if (wantsLogin && !ctx.loggedIn) {
    return {
      text: hi
        ? "लॉगिन सिर्फ फ़ोन नंबर से होता है — OTP डालते ही लॉगिन।"
        : "Login only needs your phone number — enter the OTP and you're in.",
      action: { type: "login" },
    };
  }

  if (wantsAreas && known?.areas?.length) {
    return {
      text: hi
        ? `आपके 10 किमी के अंदर ये इलाके कवर हो रहे हैं: ${known.areas.slice(0, 6).join(", ")}. पूरी सूची होम पेज पर है।`
        : `Areas covered within 10 km of you: ${known.areas.slice(0, 6).join(", ")}. The full list is on the home page.`,
      action: { type: "page", href: "/#areas" },
    };
  }

  if (service && (wantsBook || wantsPrice || !wantsHow)) {
    const name = ctx.lang === "hi" && SERVICE_HI[service.id] ? SERVICE_HI[service.id].name : service.name;
    const dur =
      hi && SERVICE_DETAIL_HI[service.id]
        ? SERVICE_DETAIL_HI[service.id].duration
        : service.duration;
    const unitWord = (service.unit ?? "per task").replace("per ", "");
    const unitHi =
      ({ task: "काम", hour: "घंटा", visit: "विज़िट" } as Record<string, string>)[unitWord] ??
      unitWord;
    if (wantsPrice) {
      return {
        text: hi
          ? `${name} की शुरुआत ₹${service.price} प्रति ${unitHi} से होती है (${dur}).`
          : `${name} starts at ₹${service.price} per ${unitWord} (${service.duration}).`,
        action: { type: "service", id: service.id },
        suggestions: hi ? ["पास के प्रो दिखाएं", "बुकिंग कैसे करें?"] : ["Show nearby Pros", "How to book?"],
      };
    }
    if (wantsBook) {
      return {
        text: hi
          ? `${name} के लिए पास के वेरिफाइड प्रो दिखा रहा हूँ — तारीख और समय चुनकर बुक कर लीजिए।`
          : `Showing verified Pros near you for ${name} — pick a date and time to book.`,
        action: { type: "service", id: service.id },
      };
    }
    return {
      text: hi
        ? `${name} मिल गया — शुरुआत ₹${service.price} से, अवधि ${dur}. पास के प्रो देखें?`
        : `Found ${name} — from ₹${service.price}, takes ${service.duration}. See nearby Pros?`,
      action: { type: "service", id: service.id },
    };
  }

  const cat = matchCategory(query);
  if (cat) {
    return {
      text: hi
        ? `${cat} की सेवाएं खोल रहा हूँ — रेट और विवरण साथ दिखेगा।`
        : `Opening ${cat} services with rates and details.`,
      action: { type: "search", q: cat },
    };
  }

  if (wantsHow) {
    return {
      text: hi
        ? `बुकिंग आसान है:\n${[
            "1. सेवा खोजें — नाम लिखें या बोलें",
            "2. पास का प्रो चुनें, तारीख व समय तय करें",
            "3. बुकिंग कन्फर्म करें, सेवा के बाद भुगतान करें",
            "4. डैशबोर्ड से लाइव ट्रैक करें",
          ].join("\n")}`
        : `Booking is simple:\n${GUIDE.join("\n")}`,
      suggestions: hi ? ["सेवा खोजें", "अभी लॉगिन करें"] : ["Search services", "Login now"],
    };
  }

  return null; // escalate to AI
}

/** Generic fallback when neither local engine nor AI could answer. */
export function fallbackReply(lang: Lang): AssistantReply {
  return {
    text:
      lang === "hi"
        ? "इसे समझ नहीं पाया। आप सेवा का नाम बोल सकते हैं (जैसे “किचन सफाई”), या नीचे से चुन लीजिए।"
        : "I couldn't get that. Say a service name (like “kitchen cleaning”) or pick one below.",
    suggestions:
      lang === "hi"
        ? ["किचन सफाई बुक करें", "रेट कितने हैं?", "मेरी बुकिंग ट्रैक करें", "बुकिंग कैसे करें?"]
        : ["Book kitchen cleaning", "What are the rates?", "Track my booking", "How do I book?"],
  };
}

/** Summary of the catalogue handed to the AI as system context. */
export function catalogueForPrompt(): string {
  return SERVICES.slice(0, 40)
    .map((s) => `${s.name} (${s.category}) — from ₹${s.price}/${s.unit}, ${s.duration}`)
    .join("\n");
}
