"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

/**
 * Big hero search bar — plain query field plus the orange Search CTA.
 * Location is shown in the navbar, so it does not repeat here.
 */
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
      className="flex w-full max-w-xl items-center gap-2 rounded-full bg-white p-2 shadow-2xl shadow-black/30"
    >
      <Search className="ml-3 h-4 w-4 shrink-0 text-slate-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="What service do you need?"
        aria-label="Search a service"
        className="min-w-0 flex-1 bg-transparent py-2 pr-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
      />
      <button
        type="submit"
        className="btn-accent shrink-0 px-6 py-2.5 text-sm sm:rounded-full"
      >
        <Search className="h-4 w-4" /> Search
      </button>
    </form>
  );
}