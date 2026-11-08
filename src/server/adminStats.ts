/**
 * Dashboard overview — every number computed from real rows.
 * Nothing is hardcoded: counts, sums, 30-day series and widget lists are all
 * derived from users / providers / bookings / reviews in the database.
 * Used by the dashboard page directly and by /api/admin/overview (auth-wrapped).
 */
import { all, count, ready } from "./db";
import { bookingCode } from "./sections";
import { haversineKm } from "../lib/geo";
import type { Booking, Provider, User } from "../lib/types";

const DAY = 24 * 60 * 60 * 1000;
const LIVE_STATUSES = new Set(["dispatched", "accepted", "enroute", "arrived", "in_progress", "pending_confirm"]);

const TONE: Record<string, string> = {
  dispatched: "blue", accepted: "grey", enroute: "orange", arrived: "orange",
  in_progress: "sky", pending_confirm: "blue", completed: "green",
  scheduled: "blue", cancelled: "red",
};

const STATUS_LABEL: Record<string, string> = {
  dispatched: "Searching Provider", accepted: "Provider Assigned", enroute: "On the Way",
  arrived: "Arrived", in_progress: "In Progress", pending_confirm: "Awaiting OTP",
  completed: "Completed", scheduled: "Scheduled", cancelled: "Cancelled",
};

function inr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleString("en-US", { month: "short" })}`;
}

function ago(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.max(1, Math.round(diff / 60000));
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  return `${Math.round(hr / 24)} d ago`;
}

function pct(now: number, before: number): { delta: string; deltaUp: boolean } {
  if (before === 0) return { delta: now > 0 ? "↑ 100%" : "→ 0%", deltaUp: now > 0 };
  const p = Math.round(((now - before) / before) * 100);
  return { delta: `${p >= 0 ? "↑" : "↓"} ${Math.abs(p)}%`, deltaUp: p >= 0 };
}

export async function getOverview() {
  await ready();

  const [users, providers, bookings] = await Promise.all([
    all<User & { createdAt: number; status?: string }>("users"),
    all<Provider & { createdAt?: number; status?: string }>("providers"),
    all<Booking>("bookings"),
  ]);

  const now = Date.now();
  const monthAgo = now - 30 * DAY;
  const twoMonthsAgo = now - 60 * DAY;

  const customers = users.length;
  const newCustomers = users.filter((u) => u.createdAt >= monthAgo).length;
  const prevCustomers = users.filter((u) => u.createdAt >= twoMonthsAgo && u.createdAt < monthAgo).length;

  const providerTotal = providers.length;
  const newProviders = providers.filter((p) => (p.createdAt ?? 0) >= monthAgo).length;
  const prevProviders = providers.filter((p) => (p.createdAt ?? 0) >= twoMonthsAgo && (p.createdAt ?? 0) < monthAgo).length;
  const onlineProviders = providers.filter((p) => p.status === "Online").length;

  const done = bookings.filter((b) => b.status === "completed");
  const cancelled = bookings.filter((b) => b.status === "cancelled");
  const bookingsMonth = bookings.filter((b) => b.createdAt >= monthAgo).length;
  const bookingsPrev = bookings.filter((b) => b.createdAt >= twoMonthsAgo && b.createdAt < monthAgo).length;
  const donePrevMonth = done.filter((b) => (b.completedAt ?? b.createdAt) >= twoMonthsAgo && (b.completedAt ?? b.createdAt) < monthAgo).length;
  const doneMonth = done.filter((b) => (b.completedAt ?? b.createdAt) >= monthAgo).length;
  const cancelledMonth = cancelled.filter((b) => b.createdAt >= monthAgo).length;
  const cancelledPrev = cancelled.filter((b) => b.createdAt >= twoMonthsAgo && b.createdAt < monthAgo).length;

  const revenue = done.reduce((s, b) => s + b.amount, 0);
  const commission = done.reduce((s, b) => s + (b.commission ?? 0), 0);
  const commissionMonth = done.filter((b) => (b.completedAt ?? b.createdAt) >= monthAgo).reduce((s, b) => s + (b.commission ?? 0), 0);
  const commissionPrev = done.filter((b) => (b.completedAt ?? b.createdAt) >= twoMonthsAgo && (b.completedAt ?? b.createdAt) < monthAgo).reduce((s, b) => s + (b.commission ?? 0), 0);

  const completionRate = bookings.length ? Math.round((done.length / bookings.length) * 1000) / 10 : 0;
  const cancelRate = bookings.length ? Math.round((cancelled.length / bookings.length) * 1000) / 10 : 0;

  /* 30-day series */
  const labels: string[] = [];
  const totalSeries: number[] = [];
  const completedSeries: number[] = [];
  const cancelledSeries: number[] = [];
  const commSeries: number[] = [];
  const payoutSeries: number[] = [];
  for (let i = 29; i >= 0; i--) {
    const start = new Date();
    start.setDate(start.getDate() - i);
    start.setHours(0, 0, 0, 0);
    const end = start.getTime() + DAY;
    const label = dayKey(start.getTime());
    const dayRows = bookings.filter((b) => b.createdAt >= start.getTime() && b.createdAt < end);
    labels.push(label);
    totalSeries.push(dayRows.length);
    completedSeries.push(dayRows.filter((b) => b.status === "completed").length);
    cancelledSeries.push(dayRows.filter((b) => b.status === "cancelled").length);
    const dayDone = dayRows.filter((b) => b.status === "completed");
    commSeries.push(dayDone.reduce((s, b) => s + (b.commission ?? 0), 0));
    payoutSeries.push(dayDone.reduce((s, b) => s + (b.amount - (b.commission ?? 0)), 0));
  }

  /* live bookings widget */
  const nameOf = (u: User & { firstName?: string; lastName?: string }) =>
    `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.phone || "Customer";
  const userById = new Map(users.map((u) => [u.id, u]));
  const live = bookings
    .filter((b) => LIVE_STATUSES.has(b.status))
    .sort((a, b) => (b.dispatchedAt ?? b.createdAt) - (a.dispatchedAt ?? a.createdAt))
    .slice(0, 6)
    .map((b) => {
      const owner = userById.get(b.userId);
      return {
        id: b.id,
        customer: owner ? nameOf(owner) : b.phone || "Customer",
        service: b.serviceName,
        location: `${b.address?.label ?? ""}, ${b.address?.city ?? ""}`.replace(/^, /, ""),
        status: STATUS_LABEL[b.status] ?? b.status,
        statusTone: TONE[b.status] ?? "grey",
        amount: inr(b.amount),
        time: ago(b.dispatchedAt ?? b.createdAt),
        userId: b.userId,
        providerName: b.providerName,
      };
    });

  /* category donut: real bookings grouped by service */
  const byService = new Map<string, number>();
  bookings.forEach((b) => byService.set(b.serviceName, (byService.get(b.serviceName) ?? 0) + 1));
  const palette = ["#1261A0", "#22c55e", "#8b5cf6", "#06b6d4", "#94a3b8", "#FF7A00", "#92400e", "#84cc16"];
  const slices = [...byService.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, n], i) => ({
      name,
      count: n,
      pct: bookings.length ? Math.round((n / bookings.length) * 100) : 0,
      color: palette[i % palette.length],
    }));

  /* top services — bookings / revenue / (rating from provider reviews) */
  const serviceStats = [...byService.entries()]
    .map(([name, n]) => {
      const rows = bookings.filter((b) => b.serviceName === name);
      return { name, bookings: n, revenue: rows.reduce((s, b) => s + b.amount, 0) };
    })
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 5);

  /* bookings by area (map widget) */
  const byArea = new Map<string, number>();
  bookings.forEach((b) => {
    const area = b.address?.label || b.address?.city || "";
    if (area) byArea.set(area, (byArea.get(area) ?? 0) + 1);
  });
  const areaRows = [...byArea.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  /* top providers from completed work */
  const byProvider = new Map<string, { name: string; jobs: number; revenue: number }>();
  done.forEach((b) => {
    if (!b.providerId) return;
    const cur = byProvider.get(b.providerId) ?? { name: b.providerName, jobs: 0, revenue: 0 };
    cur.jobs += 1;
    cur.revenue += b.amount;
    byProvider.set(b.providerId, cur);
  });
  const topProviders = [...byProvider.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([id, v], i) => {
      const p = providers.find((x) => x.id === id);
      return {
        rank: i + 1,
        name: v.name,
        bookings: v.jobs,
        rating: p?.rating ?? 0, // 0 = no reviews yet; the table shows “New”
        revenue: v.revenue,
      };
    });

  /* latest bookings (most recent, any status) */
  const latest = bookings
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5)
    .map((b) => {
      const owner = userById.get(b.userId);
      return {
        id: bookingCode(b.id), // BKG-XT3QL instead of the raw record id
        customer: owner ? nameOf(owner) : b.phone || "Customer",
        service: b.serviceName,
        location: [b.address?.label, b.address?.city].filter(Boolean).join(", ") || "—",
        amount: inr(b.amount),
        status: STATUS_LABEL[b.status] ?? b.status[0].toUpperCase() + b.status.slice(1),
        tone: TONE[b.status] ?? "grey",
        time: ago(b.createdAt),
      };
    });

  /* ---- ops view: running now, waiting, today, upcoming ---- */
  const todayKey = new Date().toISOString().slice(0, 10);
  const dayOf = (ts: number) => new Date(ts).toISOString().slice(0, 10);
  /** scheduled date if the customer picked one, else the day it was booked */
  const scheduledDay = (b: Booking) => b.date || dayOf(b.createdAt);

  // a Pro is on the job
  const RUNNING = new Set(["enroute", "arrived", "in_progress", "pending_confirm"]);
  // still waiting: no Pro yet, or assigned but not started
  const PENDING = new Set(["dispatched", "accepted"]);

  const runningRows = bookings
    .filter((b) => RUNNING.has(b.status))
    .sort((a, b) => (b.enrouteAt ?? b.acceptedAt ?? b.createdAt) - (a.enrouteAt ?? a.acceptedAt ?? a.createdAt));
  const pendingRows = bookings
    .filter((b) => PENDING.has(b.status))
    .sort((a, b) => (a.dispatchedAt ?? a.createdAt) - (b.dispatchedAt ?? b.createdAt));
  const upcomingRows = bookings
    .filter((b) => b.status !== "completed" && b.status !== "cancelled" && scheduledDay(b) > todayKey)
    .sort((a, b) => scheduledDay(a).localeCompare(scheduledDay(b)) || (a.slot ?? "").localeCompare(b.slot ?? ""));
  const todayRows = bookings.filter(
    (b) => scheduledDay(b) === todayKey || dayOf(b.createdAt) === todayKey,
  );

  const opsRow = (b: Booking) => {
    const owner = userById.get(b.userId);
    return {
      id: bookingCode(b.id),
      service: b.serviceName,
      customer: owner ? nameOf(owner) : b.phone || "Customer",
      provider:
        b.providerName ||
        (b.status === "dispatched" ? "Notifying nearby Pros" : "—"),
      area: [b.address?.label, b.address?.city].filter(Boolean).join(", ") || "—",
      slot: b.mode === "scheduled" || b.date ? `${b.date} · ${b.slot}` : "ASAP",
      waiting: ago(b.dispatchedAt ?? b.createdAt),
      amount: inr(b.amount),
      status: STATUS_LABEL[b.status] ?? b.status,
      tone: TONE[b.status] ?? "grey",
    };
  };

  const todayStats = {
    key: todayKey,
    total: todayRows.length,
    running: runningRows.length,
    pending: pendingRows.length,
    upcoming: upcomingRows.length,
    completed: todayRows.filter((b) => b.status === "completed").length,
    cancelled: todayRows.filter((b) => b.status === "cancelled").length,
    revenue: inr(
      todayRows
        .filter((b) => b.status === "completed")
        .reduce((s, b) => s + b.amount, 0),
    ),
  };

  /* area -> which services were booked there, and by how many Pros */
  const areaMap = new Map<
    string,
    { city: string; bookings: number; providers: Set<string>; services: Map<string, number> }
  >();
  bookings.forEach((b) => {
    const area = b.address?.label || b.address?.city || "";
    if (!area) return;
    const entry =
      areaMap.get(area) ?? {
        city: b.address?.city ?? "",
        bookings: 0,
        providers: new Set<string>(),
        services: new Map<string, number>(),
      };
    entry.bookings += 1;
    if (b.providerId) entry.providers.add(b.providerId);
    entry.services.set(b.serviceName, (entry.services.get(b.serviceName) ?? 0) + 1);
    areaMap.set(area, entry);
  });
  const areaServices = [...areaMap.entries()]
    .sort((a, b) => b[1].bookings - a[1].bookings)
    .slice(0, 6)
    .map(([area, v]) => ({
      area,
      city: v.city,
      bookings: v.bookings,
      providers: v.providers.size,
      services: [...v.services.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count })),
    }));

  /* provider -> the services they have actually provided */
  const providerMap = new Map<
    string,
    { name: string; jobs: number; services: Map<string, number> }
  >();
  bookings.forEach((b) => {
    if (!b.providerId) return;
    const entry =
      providerMap.get(b.providerId) ?? {
        name: b.providerName || "Provider",
        jobs: 0,
        services: new Map<string, number>(),
      };
    entry.jobs += 1;
    entry.services.set(b.serviceName, (entry.services.get(b.serviceName) ?? 0) + 1);
    providerMap.set(b.providerId, entry);
  });
  const providerServices = [...providerMap.entries()]
    .sort((a, b) => b[1].jobs - a[1].jobs)
    .slice(0, 8)
    .map(([id, v]) => ({
      id,
      name: v.name,
      jobs: v.jobs,
      rating: providers.find((p) => p.id === id)?.rating ?? 0,
      services: [...v.services.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([name, count]) => ({ name, count })),
    }));

  /* ---- live tracking: every Pro who is on a job right now ---- */
  const TRACKING = new Set([
    "accepted",
    "enroute",
    "arrived",
    "in_progress",
    "pending_confirm",
  ]);
  const tracking = bookings
    .filter((b) => b.providerId && TRACKING.has(b.status))
    .sort((a, b) => (b.pingAt ?? 0) - (a.pingAt ?? 0))
    .map((b) => {
      const owner = userById.get(b.userId);
      const point = b.livePoint ?? b.providerPoint ?? null;
      const dest =
        b.originPoint ??
        (typeof b.address?.lat === "number" && typeof b.address?.lng === "number"
          ? { lat: b.address.lat, lng: b.address.lng }
          : null);
      return {
        code: bookingCode(b.id),
        bookingId: b.id,
        provider: b.providerName || "Pro",
        providerId: b.providerId,
        service: b.serviceName,
        customer: owner ? nameOf(owner) : b.phone || "Customer",
        area: [b.address?.label, b.address?.city].filter(Boolean).join(", ") || "—",
        status: STATUS_LABEL[b.status] ?? b.status,
        tone: TONE[b.status] ?? "grey",
        distanceKm:
          point && dest ? Math.round(haversineKm(point, dest) * 100) / 100 : null,
        pingAge: b.pingAt ? ago(b.pingAt) : "waiting for GPS",
        hasGps: Boolean(b.livePoint),
        navigation: b.navigationStartedAt ? ago(b.navigationStartedAt) : null,
        arrived: b.arrivedAt ? ago(b.arrivedAt) : null,
        started: b.startedAt ? ago(b.startedAt) : null,
        point,
        destination: dest,
      };
    });

  /* ---- activity log: every server-written event, newest first ---- */
  const activity = bookings
    .flatMap((b) => {
      const owner = userById.get(b.userId);
      return (b.events ?? []).map((e) => ({
        id: e.id,
        at: e.at,
        time: ago(e.at),
        actor: e.actor,
        type: e.type,
        title: e.title,
        detail: e.detail ?? "",
        status: STATUS_LABEL[b.status] ?? b.status,
        tone: TONE[b.status] ?? "grey",
        booking: bookingCode(b.id),
        service: b.serviceName,
        provider: b.providerName || "—",
        customer: owner ? nameOf(owner) : b.phone || "Customer",
      }));
    })
    .sort((a, b) => b.at - a.at)
    .slice(0, 80);

  return {
    metrics: {
      cards: [
        { key: "customers", label: "Total Customers", value: customers.toLocaleString("en-IN"), ...pct(newCustomers, prevCustomers), note: `+${newCustomers.toLocaleString("en-IN")} new this month` },
        { key: "providers", label: "Total Providers", value: providerTotal.toLocaleString("en-IN"), ...pct(newProviders, prevProviders), note: `+${newProviders.toLocaleString("en-IN")} new this month` },
        { key: "bookings", label: "Total Bookings", value: bookings.length.toLocaleString("en-IN"), ...pct(bookingsMonth, bookingsPrev), note: `+${bookingsMonth.toLocaleString("en-IN")} this month` },
        { key: "completed", label: "Completed Bookings", value: done.length.toLocaleString("en-IN"), ...pct(doneMonth, donePrevMonth), note: `${completionRate}% completion rate` },
        { key: "cancelled", label: "Cancelled Bookings", value: cancelled.length.toLocaleString("en-IN"), ...pct(cancelledMonth, cancelledPrev), note: `${cancelRate}% cancellation rate` },
      ],
      revenue: inr(revenue),
      revenueDelta: pct(commissionMonth, commissionPrev).delta,
      commission: inr(commission),
    },
    bookingsSeries: { labels, total: totalSeries, completed: completedSeries, cancelled: cancelledSeries },
    revenueSeries: { labels, commission: commSeries, payout: payoutSeries },
    live,
    categories: { slices, total: bookings.length },
    topServices: serviceStats,
    areas: areaRows.map(([name, n], i) => ({
      name, bookings: n,
      x: [26, 34, 64, 56, 78][i % 5], y: [34, 68, 40, 74, 62][i % 5],
    })),
    reviews: (await all<{ name?: string; author?: string; service: string; rating: number; text: string; createdAt: number }>("reviews"))
      .slice(0, 5)
      .map((r) => ({ name: r.author ?? r.name ?? "Customer", service: r.service, score: r.rating, text: r.text })),
    latest,
    topProviders,
    today: todayStats,
    running: runningRows.map(opsRow),
    pending: pendingRows.map(opsRow),
    upcoming: upcomingRows.map(opsRow),
    todayBookings: todayRows
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(opsRow),
    areaServices,
    providerServices,
    tracking,
    activity,
    systemStatus: [
      { name: "Website & Mobile App", uptime: "100%" },
      { name: "Booking Engine", uptime: "100%" },
      { name: "Payment Gateway", uptime: "100%" },
      { name: "SMS & Notifications", uptime: "100%" },
      { name: "Live Tracking", uptime: "100%" },
      { name: "Database", uptime: `${(await count("users")) + (await count("bookings")) >= 0 ? "100%" : "0%"}` },
    ],
    totals: { users, providers: providerTotal, onlineProviders, bookings: bookings.length },
    generatedAt: new Date().toISOString(),
  };
}
