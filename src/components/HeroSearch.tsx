"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import LocationButton from "./LocationButton";

/** Big hero search bar — location on the left, query, orange Search CTA. */
export default function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(`/services${term ? `?q=${encodeURIComponent(term)}` : ""}`);
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-full max-w-2xl flex-col gap-2 rounded-3xl bg-white p-2.5 shadow-2xl shadow-black/20 sm:flex-row sm:items-center sm:rounded-full"
    >
      <div className="flex items-center px-2 sm:px-1">
        <LocationButton variant="inline" className="min-w-0" />
      </div>
      <div className="hidden h-6 w-px bg-slate-200 sm:block" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="What service do you need?"
        aria-label="Search a service"
        className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
      />
      <button
        type="submit"
        className="btn-accent shrink-0 px-6 py-3 text-base sm:rounded-full"
      >
        <Search className="h-4 w-4" /> Search
      </button>
    </form>
  );
}