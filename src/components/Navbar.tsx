"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Menu, Search, User as UserIcon, X, LogOut } from "lucide-react";
import { useApp } from "./AppProvider";
import LocationButton from "./LocationButton";
import { SERVICES } from "../lib/seed";

export default function Navbar() {
  const router = useRouter();
  const { user, ready, logout } = useApp();
  const [q, setQ] = useState("");
  const [openSuggest, setOpenSuggest] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return SERVICES.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.category.toLowerCase().includes(term) ||
        s.tagline.toLowerCase().includes(term),
    ).slice(0, 6);
  }, [q]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpenSuggest(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    setOpenSuggest(false);
    router.push(`/services?q=${encodeURIComponent(term)}`);
  }

  const links = [
    { href: "/services", label: "Services" },
    { href: "/#how-it-works", label: "How it works" },
    { href: "/cities", label: "Cities" },
    { href: "/help", label: "Help" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image
            src="/kaamdaar-icon.png"
            alt="Kaamdaar"
            width={36}
            height={36}
            className="h-9 w-9 rounded-xl"
            priority
          />
          <span className="text-lg font-extrabold tracking-tight">
            <span className="text-navy">Kaam</span>
            <span className="text-flame-600">daar</span>
          </span>
        </Link>

        {/* location pill */}
        <LocationButton />

        {/* search */}
        <div ref={boxRef} className="relative flex-1">
          <form onSubmit={submitSearch}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOpenSuggest(true);
              }}
              onFocus={() => setOpenSuggest(true)}
              placeholder="Search services — cleaning, laundry…"
              className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </form>
          {openSuggest && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/services/${s.id}`}
                    onClick={() => setOpenSuggest(false)}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-800">{s.name}</span>
                    <span className="text-slate-500">
                      from ₹{s.price}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <nav className="hidden items-center gap-5 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-slate-600 transition hover:text-blue-600"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {ready && user ? (
          <div className="flex items-center gap-2">
            <Link
              href="/profile"
              className="hidden items-center gap-2 rounded-full border border-slate-200 py-1.5 pl-1.5 pr-3.5 text-sm font-semibold text-slate-800 transition hover:border-blue-300 hover:bg-blue-50 sm:flex"
            >
              {user.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.photo}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {(user.firstName || user.phone).slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="max-w-[7rem] truncate">
                {user.firstName ? user.firstName : user.phone.slice(-4)}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => {
                logout();
                router.push("/");
              }}
              className="hidden rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-red-600 xl:grid"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Login
          </Link>
        )}

        <button
          type="button"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menu"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* mobile location row */}
      <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-2 md:hidden">
        <LocationButton variant="inline" className="min-w-0 flex-1 md:hidden" />
        {ready && user && (
          <button
            type="button"
            onClick={() => {
              logout();
              router.push("/");
            }}
            className="flex items-center gap-1 text-xs font-semibold text-red-600"
          >
            <LogOut className="h-3.5 w-3.5" /> Logout
          </button>
        )}
      </div>

      {menuOpen && (
        <div className="border-t border-slate-100 bg-white px-4 py-3 lg:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {l.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <UserIcon className="h-4 w-4" /> My Profile
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setMenuOpen(false);
                    router.push("/");
                  }}
                  className="flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" /> Logout
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg bg-blue-600 px-2 py-2.5 text-center text-sm font-semibold text-white"
              >
                Login / Register
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}