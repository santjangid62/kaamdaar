"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search, X } from "lucide-react";
import ServiceCard from "./ServiceCard";
import { useApp } from "./AppProvider";
import type { Service } from "../lib/types";

interface Props {
  initialQuery: string;
  initialCategory: string;
  services: Service[];
}

type Sort = "relevance" | "price-asc" | "price-desc" | "name";

const SORTS: Array<{ id: Sort; label: string }> = [
  { id: "relevance", label: "Recommended" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "name", label: "Name: A to Z" },
];

/** Remounts whenever the URL query changes. */
export default function ServicesExplorer(props: Props) {
  const key = `${props.initialQuery}|${props.initialCategory}`;
  return <Explorer key={key} {...props} />;
}

function Explorer({ initialQuery, initialCategory, services }: Props) {
  const router = useRouter();
  const { location } = useApp();
  const [q, setQ] = useState(initialQuery);
  const [cat, setCat] = useState(initialCategory);
  const [maxPrice, setMaxPrice] = useState(() =>
    Math.max(...services.map((s) => s.price), 100),
  );
  const [sort, setSort] = useState<Sort>("relevance");

  const priceCeiling = useMemo(
    () => Math.max(...services.map((s) => s.price), 100),
    [services],
  );

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    services.forEach((s) => counts.set(s.category, (counts.get(s.category) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [services]);

  function go(nextQ: string, nextCat: string) {
    const params = new URLSearchParams();
    if (nextQ.trim()) params.set("q", nextQ.trim());
    if (nextCat !== "All") params.set("cat", nextCat);
    const qs = params.toString();
    router.push(`/services${qs ? `?${qs}` : ""}`);
  }

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = services.filter((s) => {
      const matchTerm =
        !term ||
        s.name.toLowerCase().includes(term) ||
        s.category.toLowerCase().includes(term) ||
        s.tagline.toLowerCase().includes(term) ||
        s.description.toLowerCase().includes(term);
      const matchCat = cat === "All" || s.category === cat;
      return matchTerm && matchCat && s.price <= maxPrice;
    });
    const sorted = [...list];
    if (sort === "price-asc") sorted.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") sorted.sort((a, b) => b.price - a.price);
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [services, q, cat, maxPrice, sort]);

  const place = location?.label?.split(",")[0] ?? "your area";
  const activeFilters = (cat !== "All" ? 1 : 0) + (maxPrice < priceCeiling ? 1 : 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[264px_1fr]">
      {/* ── filters sidebar ─────────────────────────────── */}
      <aside className="card h-fit p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
            Filters
          </h2>
          {activeFilters > 0 && (
            <button
              type="button"
              onClick={() => {
                setCat("All");
                setMaxPrice(priceCeiling);
              }}
              className="flex items-center gap-1 text-xs font-semibold text-flame-600 hover:underline"
            >
              <X className="h-3.5 w-3.5" /> Clear All
            </button>
          )}
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-bold text-slate-900">Category</legend>
          <ul className="mt-3 space-y-2">
            {categories.map(([c, count]) => (
              <li key={c}>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={cat === c}
                    onChange={() => go(q, cat === c ? "All" : c)}
                    className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                  />
                  <span className="flex-1">{c}</span>
                  <span className="text-xs text-slate-400">({count})</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <div className="mt-6">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-slate-900">Price range</span>
            <span className="font-semibold text-flame-600">₹{maxPrice}</span>
          </div>
          <input
            type="range"
            min={50}
            max={priceCeiling}
            step={10}
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="mt-3 w-full accent-blue-600"
            aria-label="Maximum price"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-400">
            <span>₹50</span>
            <span>₹{priceCeiling}</span>
          </div>
        </div>
      </aside>

      {/* ── results ─────────────────────────────────────── */}
      <div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            go(q, cat);
          }}
          className="relative mb-5 max-w-xl"
        >
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a service by name…"
            className="field pl-10"
          />
        </form>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            <span className="font-extrabold text-slate-900">
              {results.length}
            </span>{" "}
            {q ? `results for “${q}”` : "professional services"}
            <span className="flex items-center gap-1 text-slate-400">
              {" "}
              in{" "}
              <MapPin className="h-3.5 w-3.5 text-flame-600" /> {place}
            </span>
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-500">
            Sort by
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {results.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <p className="font-semibold text-slate-700">
              No service matched {q ? `“${q}”` : "these filters"}.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Try “cleaning”, “laundry”, “kitchen” or “hourly” — or clear the
              filters.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}