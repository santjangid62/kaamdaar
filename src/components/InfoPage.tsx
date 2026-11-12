import type { Metadata } from "next";

export interface InfoBlock {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export function infoMetadata(title: string, description: string): Metadata {
  return { title, description };
}

export default function InfoPage({
  title,
  intro,
  blocks,
  updated,
}: {
  title: string;
  intro: string;
  blocks: InfoBlock[];
  updated?: string;
}) {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="relative isolate overflow-hidden bg-navy py-16 text-white sm:py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(59,130,246,.28),transparent_32%),radial-gradient(circle_at_85%_80%,rgba(255,122,0,.22),transparent_30%)]" />
        <div className="section-shell relative text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[.18em] text-orange-200">✦ KAAMDAAR</span>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">{title}</h1>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-blue-100 sm:text-lg">{intro}</p>
          {updated && <p className="mt-3 text-xs text-blue-200/70">Last updated: {updated}</p>}
        </div>
      </section>
      <section className="section-shell -mt-8 relative z-10 grid gap-5 pb-20">
        {blocks.map((b, i) => (
          <article key={b.heading} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_55px_-35px_rgba(15,35,65,.35)] transition hover:-translate-y-1 hover:shadow-xl sm:p-8">
            <div className="flex items-center gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-base font-black text-white shadow-lg">{String(i + 1).padStart(2, "0")}</span>
              <h2 className="text-xl font-extrabold text-slate-900">{b.heading}</h2>
            </div>
            {b.paragraphs?.map((p) => (
              <p key={p} className="mt-4 text-sm leading-7 text-slate-600">{p}</p>
            ))}
            {b.bullets && (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {b.bullets.map((l) => (
                  <li key={l} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">✓</span>
                    {l}
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </section>
    </main>
  );}