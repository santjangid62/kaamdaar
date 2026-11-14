"use client";

/**
 * Admin Dashboard shell — dark sidebar (all nav sections from the mockup)
 * + white top bar (search, location, date range, notifications, profile).
 * Responsive: sidebar collapses into a slide-over below `lg`.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import AdminNotificationsBell from "./AdminNotificationsBell";
import {
  Calendar,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { NAV } from "../../lib/admin/sections";
import LocationButton from "../LocationButton";
import { useApp } from "../AppProvider";
import { icon } from "./registry";

function SidebarBody({ activeSlug, onNavigate }: { activeSlug: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-5">
      {NAV.map((group, gi) => (
        <div key={group.section ?? `g${gi}`} className="mb-1.5">
          {group.section && (
            <p className="px-3 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400/70">
              {group.section}
            </p>
          )}
          {group.items.map((item) => {
            const href = item.slug ? `/admin/${item.slug}` : "/admin";
            const active = activeSlug === item.slug;
            const Icon = icon(item.icon);
            return (
              <Link
                key={item.slug || "dashboard"}
                href={href}
                onClick={onNavigate}
                className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all duration-200 ${
                  active
                    ? "bg-gradient-to-r from-flame to-orange-500 text-white shadow-[0_10px_24px_-10px_rgba(255,122,0,0.75)] ring-1 ring-white/15"
                    : "text-slate-300/85 hover:translate-x-0.5 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Sidebar({ activeSlug }: { activeSlug: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/10 bg-[#0b1f3a] shadow-[12px_0_40px_-28px_rgba(2,12,27,0.65)] lg:flex">
      <SidebarBody activeSlug={activeSlug} />
    </aside>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { settings } = useApp();
  const siteName = settings.site_name?.trim() || "Kaamdaar";

  // derive the active nav slug from the URL so the shell needs no props
  const activeSlug = useMemo(() => {
    if (!pathname || pathname === "/admin") return "";
    const seg = pathname.split("/").filter(Boolean).pop() ?? "";
    return seg === "admin" ? "" : seg;
  }, [pathname]);

  const title = useMemo(() => {
    for (const g of NAV) for (const it of g.items) if (it.slug === activeSlug) return it.label;
    return "Dashboard";
  }, [activeSlug]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-navy">
      <Sidebar activeSlug={activeSlug} />

      {/* mobile slide-over */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-navy">
            <div className="flex items-center justify-between px-4 py-4">
              <span className="text-sm font-bold text-white">{siteName} Admin</span>
              <button type="button" onClick={() => setMobileOpen(false)} className="text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarBody activeSlug={activeSlug} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        {/* ── Top bar ─────────────────────────────────────────── */}
        <header className="sticky top-0 z-20 flex h-[4.5rem] items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 shadow-[0_6px_24px_-20px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:px-6">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href="/admin" className="flex shrink-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kaamdaar-icon.png" alt={siteName} className="h-9 w-9 rounded-lg" />
            <span className="hidden leading-tight sm:block">
              <span className="block text-[15px] font-extrabold text-blue-600">{siteName}</span>
              <span className="block text-[10px] font-semibold text-slate-400">— Har Kaam Turant —</span>
            </span>
          </Link>

          <label className="mx-auto hidden max-w-xl flex-1 items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 transition focus-within:border-blue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50 md:flex">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="search"
              autoComplete="off"
              aria-label="Search admin"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              placeholder="Search bookings, customers, providers, services..."
            />
          </label>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <LocationButton variant="inline" className="hidden xl:flex" />
            <button
              type="button"
              className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 lg:flex"
            >
              <Calendar className="h-3.5 w-3.5 text-blue-600" /> 01 Oct 2026 – 31 Oct 2026
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            <AdminNotificationsBell />

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-slate-100"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  AK
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-[13px] font-bold text-navy">Admin</span>
                  <span className="block text-[10px] text-slate-400">Super Admin</span>
                </span>
                <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    <Link
                      href="/super-admin"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                      onClick={() => setMenuOpen(false)}
                    >
                      <ShieldCheck className="h-4 w-4" /> Super Admin Centre
                    </Link>
                    <Link
                      href="/"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                      onClick={() => setMenuOpen(false)}
                    >
                      <Search className="h-4 w-4" /> Customer website
                    </Link>
                    <button
                      type="button"
                      onClick={() => void logout()}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" /> Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="px-4 py-7 sm:px-6 lg:px-8 lg:py-8" data-page={title}>
          {children}
        </main>
      </div>
    </div>
  );
}
