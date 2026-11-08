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

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json({ reply: null, ai: false });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const message = body.message?.slice(0, 1000) ?? "";
  const lang = body.lang === "hi" ? "hi" : "en";
  if (!message) return NextResponse.json({ error: "empty message" }, { status: 400 });

  const system =
    `You are Kaamdaar Assistant, a friendly support+sales helper for Kaamdaar, an Indian home-services marketplace (house cleaning, laundry, kitchen help, hourly help). ` +
    `Answer in ${lang === "hi" ? "simple Hindi (Devanagari)" : "simple English"} in at most 3 short sentences. ` +
    `Help the user search services, understand rates, start bookings and track bookings. Never invent prices — use this catalogue:\n` +
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
