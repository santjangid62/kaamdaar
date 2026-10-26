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
    <div className="section-shell py-12">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-lg leading-7 text-slate-600">{intro}</p>
        {updated && <p className="mt-2 text-xs text-slate-400">Last updated: {updated}</p>}
      </div>

      <div className="mt-10 max-w-3xl space-y-8">
        {blocks.map((b, i) => (
          <section key={b.heading} className="card p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 text-xs font-bold text-blue-600">
                {i + 1}
              </span>
              <h2 className="text-lg font-bold text-slate-900">{b.heading}</h2>
            </div>
            {b.paragraphs?.map((p) => (
              <p key={p} className="mt-3 text-sm leading-6 text-slate-600">
                {p}
              </p>
            ))}
            {b.bullets && (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
                {b.bullets.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}