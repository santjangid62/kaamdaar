import { NextResponse } from "next/server";

type Body = {
  section?: string;
  field?: string;
  fieldKey?: string;
  serviceName?: string;
  category?: string;
  context?: string;
  language?: string;
  format?: "text" | "list";
};

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "AI is not configured. Please add OPENAI_API_KEY in Vercel project settings." }, { status: 503 });
  let body: Body;
  try { body = await req.json() as Body; }
  catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }

  const subject = [body.serviceName, body.category].filter(Boolean).join(" / ") || body.section || "home service";
  const format = body.format === "list"
    ? "Return 5 to 7 concise, customer-friendly bullet points, one per line, without bullet symbols."
    : "Return polished, concise customer-facing copy in 2 to 4 sentences. Do not add a heading.";
  const prompt = [
    "You write accurate content for Kaamdaar, an Indian home-services marketplace.",
    "Create only the requested field content. Never invent guarantees, certifications, prices, service coverage, or safety claims.",
    `Section: ${body.section || "Services"}`,
    `Subject: ${subject}`,
    `Field: ${body.field || body.fieldKey || "Description"}`,
    `Existing context: ${body.context || "Not provided"}`,
    `Language: ${body.language || "Simple English"}`,
    format,
    "Make the content useful and clear for Indian customers."
  ].join("\n");

  try {
    const upstream = await fetch("https://freebuff.com/api/v1/paid/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: "You are a professional marketplace content writer." }, { role: "user", content: prompt }], max_tokens: 350 }),
    });
    if (!upstream.ok) return NextResponse.json({ error: `AI provider returned ${upstream.status}` }, { status: 502 });
    const data = await upstream.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return NextResponse.json({ error: "AI returned empty content." }, { status: 502 });
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ error: "Could not connect to the AI provider." }, { status: 502 });
  }
}
