"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

interface Props {
  initialQuery: string;
  initialCategory: string;
  categories: string[];
  total: number;
}

/** Remounts (and so resets local state) whenever the URL query changes. */
export default function ServiceFilterBar(props: Props) {
  const key = `${props.initialQuery}|${props.initialCategory}`;
  return <FilterControls key={key} {...props} />;
}

function FilterControls({ initialQuery, initialCategory, categories, total }: Props) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);

  function go(nextQuery: string, nextCat: string) {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextCat !== "All") params.set("cat", nextCat);
    const qs = params.toString();
    router.push(`/services${qs ? `?${qs}` : ""}`);
  }

  const tabs = ["All", ...categories];

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(q, initialCategory);
        }}
        className="relative max-w-xl"
      >
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a service by name…"
          className="field pl-10"
        />
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((cat) => {
          const active = cat === initialCategory;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => go(initialQuery, cat)}
              className={
                active
                  ? "rounded-full bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white"
                  : "rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 transition hover:border-blue-300 hover:text-blue-700"
              }
            >
              {cat}
            </button>
          );
        })}
        <span className="ml-auto text-sm text-slate-400">{total} services</span>
      </div>
    </div>
  );
}
