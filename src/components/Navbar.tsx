"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Languages,
  LogIn,
  LogOut,
  Menu,
  Mic,
  Search,
  User as UserIcon,
  X,
} from "lucide-react";
import { useApp } from "./AppProvider";
import { useLang } from "../lib/i18n";
import { openVoiceAssistant } from "../lib/assistant";
import LocationButton from "./LocationButton";

function LanguageSwitcher() {
  const { lang, setLang, s } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:border-blue-300 hover:text-blue-600"
        title={s.nav.language}
        aria-expanded={open}
      >
        <Languages className="h-4 w-4" />
        {lang === "en" ? "EN" : "हि"}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {(["en", "hi"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setLang(l);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-3.5 py-2.5 text-sm transition hover:bg-slate-50 ${
                lang === l ? "font-bold text-blue-700" : "font-medium text-slate-700"
              }`}
            >
              {l === "en" ? "English" : "हिंदी"}
              {lang === l && <span className="h-1.5 w-1.5 rounded-full bg-flame" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const router = useRouter();
  const { user, ready, logout, services, settings } = useApp();
  const { s } = useLang();
  const [q, setQ] = useState("");
  const [openSuggest, setOpenSuggest] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return services.filter(
      (x) =>
        x.name.toLowerCase().includes(term) ||
        x.category.toLowerCase().includes(term) ||
        x.tagline.toLowerCase().includes(term),
    ).slice(0, 6);
  }, [q, services]);

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
    { href: "/", label: s.nav.home },
    { href: "/services", label: s.nav.services },
    { href: "/#how-it-works", label: s.nav.howItWorks },
    { href: "/about", label: s.nav.about },
    { href: "/help", label: s.nav.help },
  ];
  const siteName = settings.site_name?.trim() || "Kaamdaar";

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image
            src="/kaamdaar-icon.png"
            alt={siteName}
            width={36}
            height={36}
            className="h-9 w-9 rounded-xl"
            priority
          />
          <span className="text-lg font-extrabold tracking-tight text-navy">{siteName}</span>
        </Link>

        {/* location pill */}
        <LocationButton />

        <nav className="hidden flex-1 items-center justify-center gap-7 lg:flex">
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

        {/* voice search */}
        <button
          type="button"
          onClick={() => openVoiceAssistant(true)}
          title={s.nav.voice}
          aria-label={s.nav.voice}
          className="ml-auto hidden rounded-full border border-slate-200 p-2 text-slate-600 transition hover:border-flame-400 hover:bg-flame-50 hover:text-flame-600 sm:grid"
        >
          <Mic className="h-4 w-4" />
        </button>

        <div className="hidden sm:block">
          <LanguageSwitcher />
        </div>

        {ready && user ? (
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
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
              <span className="max-w-28 truncate">
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
              title={s.nav.logout}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          // icon-only CTA: the label lives in aria-label/title so screen readers
          // and tooltips keep it, while the bar stays clean at every width
          <Link
            href="/login"
            aria-label={s.nav.login}
            title={s.nav.login}
            className="relative hidden h-10 w-10 shrink-0 place-items-center rounded-full bg-linear-to-br from-flame to-amber-500 text-navy shadow-[0_6px_16px_-6px_rgba(255,122,0,0.7)] ring-2 ring-white/70 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_9px_20px_-6px_rgba(255,122,0,0.85)] focus-visible:outline-none focus-visible:ring-flame-300 sm:grid"
          >
            <LogIn
              className="h-5 w-5 transition-transform duration-200 group-hover:-translate-x-0.5"
              strokeWidth={2.5}
            />
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
        <button
          type="button"
          onClick={() => openVoiceAssistant(true)}
          className="flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600"
        >
          <Mic className="h-3.5 w-3.5" /> {s.nav.voice}
        </button>
        <LanguageSwitcher />
        {ready && user && (
          <button
            type="button"
            onClick={() => {
              logout();
              router.push("/");
            }}
            className="flex items-center gap-1 text-xs font-semibold text-red-600"
          >
            <LogOut className="h-3.5 w-3.5" /> {s.nav.logout}
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
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <UserIcon className="h-4 w-4" /> {s.nav.myProfile}
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
                  <LogOut className="h-4 w-4" /> {s.nav.logout}
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg bg-linear-to-br from-flame to-amber-500 px-2 py-2.5 text-center text-sm font-bold text-navy shadow-[0_6px_16px_-6px_rgba(255,122,0,0.7)]"
              >
                {s.nav.login}
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
