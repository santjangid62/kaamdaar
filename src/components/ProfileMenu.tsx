"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CreditCard,
  FileText,
  Gift,
  Info,
  LifeBuoy,
  LogOut,
  MapPin,
  MessageSquareWarning,
  Settings,
  ShieldCheck,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import { useApp } from "./AppProvider";

const ACCOUNT = [
  { href: "#profile", label: "My Profile", icon: UserRound },
  { href: "#bookings", label: "My Bookings", icon: FileText },
  { href: "#addresses", label: "Saved Addresses", icon: MapPin },
];

const SUPPORT = [
  { href: "/help", label: "Help & Support", icon: LifeBuoy },
  { href: "/refer", label: "Refer & Earn", icon: Gift },
  { href: "/terms", label: "Terms of Services", icon: FileText },
  { href: "/about", label: "About us", icon: Info },
  { href: "/privacy", label: "Privacy Policy", icon: ShieldCheck },
  { href: "/delete-account", label: "Request account deletion", icon: Trash2 },
];

/** Placeholder entries the backend will power later (wallet, reviews…). */
const SOON = [
  { label: "Payments & Wallet", icon: CreditCard },
  { label: "My Reviews", icon: Star },
  { label: "Notifications", icon: Bell },
  { label: "Complaints", icon: MessageSquareWarning },
  { label: "Settings", icon: Settings },
];

export default function ProfileMenu() {
  const router = useRouter();
  const { user, logout, ready } = useApp();

  if (!ready || !user) return null;

  return (
    <aside className="card h-fit overflow-hidden lg:sticky lg:top-24">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-600 text-sm font-bold text-white">
          {(user.firstName || user.phone).slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">
            {user.firstName ? `${user.firstName} ${user.lastName}`.trim() : "My account"}
          </p>
          <p className="truncate text-xs text-slate-500">+91 {user.phone.replace("+91", "")}</p>
        </div>
      </div>

      <nav className="p-2">
        <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
          Account
        </p>
        <ul>
          {ACCOUNT.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                >
                  <Icon className="h-4 w-4 text-slate-400" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="px-3 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wide text-slate-400">
          More
        </p>
        <ul>
          {SUPPORT.map((item) => {
            const Icon = item.icon;
            const danger = item.label.includes("deletion");
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-slate-50 ${
                    danger ? "text-red-600" : "text-slate-700"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${danger ? "text-red-500" : "text-slate-400"}`} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="px-3 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wide text-slate-400">
          Coming soon
        </p>
        <ul>
          {SOON.map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={item.label}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400"
                title="Coming with the Kaamdaar apps"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => {
            logout();
            router.push("/");
          }}
          className="mt-2 flex w-full items-center gap-3 rounded-lg border-t border-slate-100 px-3 py-3.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </nav>
    </aside>
  );
}