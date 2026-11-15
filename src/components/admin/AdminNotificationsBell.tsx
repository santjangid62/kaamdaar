"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, UserRoundPlus, CreditCard, ChevronRight } from "lucide-react";

type Notice = {
  id: string; type: string; title: string; userId: string; userName: string; phone: string;
  platform: string; bookingId?: string; message?: string; readAt?: number | null; createdAt: number;
};

function timeAgo(value: number) {
  if (!value) return "Just now";
  const minutes = Math.max(0, Math.floor((Date.now() - value) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default function AdminNotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);

  async function refresh() {
    try {
      const res = await fetch("/api/admin/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json() as { notifications: Notice[]; unreadCount: number };
      setItems(data.notifications);
      setUnread(data.unreadCount);
    } catch { /* keep last known state while offline */ }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 20000);
    return () => window.clearInterval(timer);
  }, []);

  async function markRead() {
    if (!unread) return;
    try {
      await fetch("/api/admin/notifications", { method: "PATCH" });
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? Date.now() })));
      setUnread(0);
    } catch { /* next refresh reconciles state */ }
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => { const next = !open; setOpen(next); if (next) void markRead(); }}
        className="relative rounded-xl border border-slate-200/80 p-2.5 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-navy"
        aria-label={"Notifications" + (unread ? ", " + unread + " unread" : "")} aria-expanded={open}>
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && <>
        <button type="button" aria-label="Close notifications" className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
        <section className="absolute right-0 z-40 mt-3 w-[min(calc(100vw-2rem),24rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_-24px_rgba(15,23,42,.35)]">
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
            <div><h3 className="text-sm font-extrabold text-navy">Notifications</h3><p className="mt-0.5 text-[11px] text-slate-400">{unread} unread alerts</p></div>
            <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-bold text-orange-600">Live updates</span>
          </header>
          <div className="max-h-[min(65vh,26rem)] overflow-y-auto">
            {items.length ? items.slice(0, 8).map((item) => (
              <Link key={item.id} href={item.type === "booking_payment_report" ? "/admin/payment-confirmations" : "/admin/customers"} onClick={() => setOpen(false)} className="flex gap-3 border-b border-slate-50 px-4 py-3.5 transition hover:bg-slate-50">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600">{item.type === "booking_payment_report" ? <CreditCard className="h-4 w-4" /> : <UserRoundPlus className="h-4 w-4" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2"><span className="text-xs font-bold text-navy">{item.title}</span><span className="shrink-0 text-[10px] text-slate-400">{timeAgo(item.createdAt)}</span></span>
                  <span className="mt-1 block text-[11px] leading-5 text-slate-500">{item.type === "booking_payment_report" ? (item.message ?? item.userName) : `${item.userName} · ${item.phone}`}</span>
                  <span className="mt-1 block text-[10px] font-semibold text-blue-600">{item.type === "booking_payment_report" ? "Open payment verification" : `${item.platform} · View customers`}</span>
                </span>
              </Link>
            )) : <div className="px-5 py-10 text-center"><Bell className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-2 text-xs font-semibold text-slate-500">You&apos;re all caught up</p><p className="mt-1 text-[11px] text-slate-400">New registrations will appear here.</p></div>}
          </div>
          <Link href="/admin/notifications" onClick={() => setOpen(false)} className="flex items-center justify-between bg-slate-50 px-4 py-3 text-xs font-bold text-blue-700 hover:bg-blue-50">View all notifications <ChevronRight className="h-4 w-4" /></Link>
        </section>
      </>}
    </div>
  );
}
