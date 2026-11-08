"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpenText,
  FileText,
  Gift,
  Info,
  LogOut,
  LifeBuoy,
  MapPin,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { useApp } from "./AppProvider";
import { useLang } from "../lib/i18n";

/** Indices refer to s.profile.menu so both languages stay aligned. */
const ITEMS = [
  { href: "/profile", key: 0, icon: UserRound },
  { href: "/profile#bookings", key: 1, icon: BookOpenText },
  { href: "/profile#addresses", key: 2, icon: MapPin },
  { href: "/help", key: 3, icon: LifeBuoy },
  { href: "/refer", key: 4, icon: Gift },
  { href: "/terms", key: 5, icon: FileText },
  { href: "/about", key: 6, icon: Info },
  { href: "/privacy", key: 7, icon: ShieldCheck },
  { href: "/delete-account", key: 8, icon: Trash2 },
];

export default function ProfileMenu() {
  const router = useRouter();
  const { user, logout, ready } = useApp();
  const { s } = useLang();

  if (!ready || !user) return null;

  return (
    <section className="card overflow-hidden">
      <ul>
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const label = s.profile.menu[item.key];
          const danger = item.key === 8;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 border-b border-slate-100 px-6 py-3.5 text-sm font-medium transition hover:bg-slate-50 ${
                  danger ? "text-red-600" : "text-slate-700"
                }`}
              >
                <Icon className={`h-4 w-4 ${danger ? "text-red-500" : "text-slate-400"}`} />
                {label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => {
              logout();
              router.push("/");
            }}
            className="flex w-full items-center gap-3 px-6 py-3.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" /> {s.profile.menu[9]}
          </button>
        </li>
      </ul>
      <p className="flex items-center gap-2 bg-slate-50 px-6 py-3 text-xs text-slate-400">
        <BookOpenText className="h-3.5 w-3.5" />
        {s.profile.signedInNote}
      </p>
    </section>
  );
}
