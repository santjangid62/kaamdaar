import { NextResponse } from "next/server";
import { catalogueForPrompt, setCatalog } from "../../../lib/assistant";
import { getServices } from "../../../server/catalog";

/**
 * AI answers for the Kaamdaar Assistant.
 *
 * The key lives only on the server (OPENAI_API_KEY in .env / project secrets)
 * and is never sent to the browser. Without a key the route reports
 * `reply: null` and the widget keeps using its offline intent engine, so the
 * assistant still works for search / book / track / rates / help.
 */

const MODEL = "gpt-4o-mini";

interface Body {
  message?: string;
  lang?: "en" | "hi";
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export async function POST(req: Request): Promise<NextResponse> {
  // assistant reasons over the live database catalogue, not the seed
  try {
    setCatalog(await getServices());
  } catch {
    /* keep the default catalogue */
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const message = body.message?.slice(0, 1000) ?? "";
  const normalized = message.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const hasHindiScript = /[\u0900-\u097F]/.test(message);
  const romanHindi = /\b(kya|kaise|mujhe|mere|meri|karna|karvani|chahiye|abhi|kal|aaj|hai|hain|batao|book|kar do)\b/i.test(normalized);
  const lang = hasHindiScript || romanHindi || body.lang === "hi" ? "hi" : "en";
  if (!message) return NextResponse.json({ error: "empty message" }, { status: 400 });
  const asksName = /\b(who are you|your name|what is your name|what should i call you)\b/.test(normalized) ||
    /(आपका नाम|तुम्हारा नाम|कौन हो|कौन हैं|अपना नाम|आप कौन)/.test(normalized) ||
    /\b(aapka naam|tumhara naam|naam kya|aap kaun)\b/.test(normalized);
  const asksCreator = /\b(who made you|who created you|who built you|who developed you|who is your developer|who trained you|your creator|which company made you)\b/.test(normalized) ||
    /(किसने बनाया|किसने बनाया है|किसने डेवलप|किसने विकसित|आपको किसने डेवलप|आपके डेवलपर|किसने ट्रेन|किसने प्रशिक्षित|आपके निर्माता|किसकी टीम ने)/.test(normalized) ||
    /\b(kisne banaya|kisne develop|kisne developed|kisne train|kisne trained|aapko kisne|kaun banaya)\b/.test(normalized);
  if (asksName) {
    return NextResponse.json({ reply: lang === "hi"
      ? "मेरा नाम Kaamdaar Bot है। मैं Kaamdaar का आपका डिजिटल सहायक हूँ।"
      : "My name is Kaamdaar Bot. I'm your digital assistant for Kaamdaar.", ai: false, intent: "identity" });
  }
  if (asksCreator) {
    return NextResponse.json({ reply: lang === "hi"
      ? "मुझे Unique IT Solutions - A Unit of Unique Computers, The Best One की Team ने बनाया और प्रशिक्षित किया है।"
      : "I was created and trained by the team at Unique IT Solutions - A Unit of Unique Computers, The Best One.", ai: false, intent: "creator" });
  }

  const isKaamdaarTopic = /\b(kaamdaar|service|services|clean|cleaning|kitchen|bathroom|car wash|vehicle|plumb|electric|air condition|pest|salon|repair|book|booking|reserve|schedule|appointment|provider|professional|address|location|jaipur|slot|available|availability|price|rate|cost|payment|pay|refund|cancel|cancellation|track|status|order|account|profile|login|otp|wallet)\b/i.test(normalized) || /(सेवा|बुक|बुकिंग|सफाई|किचन|रसोई|बाथरूम|गाड़ी|कार|प्लंबर|बिजली|इलेक्ट्रिशियन|एसी|मरम्मत|पता|लोकेशन|जयपुर|रेट|कीमत|भुगतान|पेमेंट|प्रोवाइडर|ट्रैक|स्टेटस|रद्द|लॉगिन)/.test(message);
  if (!isKaamdaarTopic) {
    return NextResponse.json({ reply: lang === "hi"
      ? "मुझे खेद है, इस प्रश्न के लिए मैं आपकी सहायता नहीं कर सकता।"
      : "Sorry, I can't help with that question.", ai: false, intent: "out_of_scope" });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ reply: lang === "hi" ? "मैं Kaamdaar की सेवाओं, बुकिंग, उपलब्ध समय, पते और भुगतान से जुड़ी सहायता कर सकता हूँ। कृपया बताएं आपको कौन-सी सेवा चाहिए?" : "I can help with Kaamdaar services, bookings, available slots, addresses and payments. Which service do you need?", ai: false });

  const system =
    `You are Kaamdaar Bot, the official customer assistant for Kaamdaar, a Jaipur home-services booking platform. ` +
    `Your identity: your name is Kaamdaar Bot. If asked who created/trained you, say: "Mujhe Unique IT Solutions - A Unit of Unique Computers, The Best One ki Team ne banaya or trained kiya hai" (translate naturally to the user's language). ` +
    `Answer in ${lang === "hi" ? "simple Hindi (Devanagari)" : "simple English"}; mirror the user's language if clear. ` +
    `You may ONLY help with Kaamdaar topics: services, catalogue, published prices, booking, addresses, schedules, provider dispatch, booking status, payments, account, and customer support. ` +
    `If asked anything unrelated, politely refuse. Hindi refusal: "मुझे खेद है, इस प्रश्न के लिए मैं आपकी सहायता नहीं कर सकता।" English refusal: "Sorry, I can't help with that question." ` +
    `Never claim a booking has been placed unless the booking API confirms it. Never invent providers, availability, prices, policies, or booking status. Ask one clear question at a time when booking details are missing. Do not collect OTPs, passwords, or payment credentials. Final booking requires explicit customer confirmation. Use this live service catalogue:\n` +
    catalogueForPrompt();

  const messages = [
    { role: "system", content: system },
    ...(body.history ?? []).slice(-6),
    { role: "user", content: message },
  ];

  try {
    const res = await fetch("https://freebuff.com/api/v1/paid/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model: MODEL, messages, max_tokens: 220 }),
    });
    if (!res.ok) {
      return NextResponse.json({ reply: null, ai: false, error: `upstream ${res.status}` });
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = data.choices?.[0]?.message?.content?.trim() ?? null;
    return NextResponse.json({ reply, ai: true });
  } catch {
    return NextResponse.json({ reply: null, ai: false, error: "network" });
  }
}
