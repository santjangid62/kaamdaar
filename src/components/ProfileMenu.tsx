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
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useApp } from "./AppProvider";

const ITEMS = [
  { href: "/help", label: "Help & Support", icon: LifeBuoy },
  { href: "/refer", label: "Refer & Earn", icon: Gift },
  { href: "/terms", label: "Terms of Services", icon: FileText },
  { href: "/about", label: "About us", icon: Info },
  { href: "/privacy", label: "Privacy Policy", icon: ShieldCheck },
  { href: "/delete-account", label: "Request account deletion", icon: Trash2 },
];

export default function ProfileMenu() {
  const router = useRouter();
  const { user, logout, ready } = useApp();

  if (!ready || !user) return null;

  return (
    <section className="card overflow-hidden">
      <ul>
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const danger = item.label.includes("deletion");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 border-b border-slate-100 px-6 py-3.5 text-sm font-medium transition hover:bg-slate-50 ${
                  danger ? "text-red-600" : "text-slate-700"
                }`}
              >
                <Icon className={`h-4 w-4 ${danger ? "text-red-500" : "text-slate-400"}`} />
                {item.label}
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
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </li>
      </ul>
      <p className="flex items-center gap-2 bg-slate-50 px-6 py-3 text-xs text-slate-400">
        <BookOpenText className="h-3.5 w-3.5" />
        You stay signed in until you tap Logout.
      </p>
    </section>
  );
}