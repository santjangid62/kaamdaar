"use client";

/** Top Services widget — tabs switch over REAL booking aggregates. */
import { useState } from "react";
import { TopServices, ViewAll, WidgetCard } from "./widgets";

export type TopServiceRow = { name: string; bookings: number; revenue: number; rating: number };

const inr = (n: number): string => "₹" + n.toLocaleString("en-IN");

export default function TopServicesCard({ rows }: { rows: TopServiceRow[] }) {
  const [by, setBy] = useState<"bookings" | "revenue" | "rating">("bookings");

  const sorted = [...rows].sort((a, b) =>
    by === "bookings" ? b.bookings - a.bookings : by === "revenue" ? b.revenue - a.revenue : b.rating - a.rating,
  );
  const ranked = sorted.map((r, i) => ({
    rank: i + 1,
    name: r.name,
    metric:
      by === "bookings"
        ? r.bookings.toLocaleString("en-IN")
        : by === "revenue"
          ? inr(r.revenue)
          : r.rating > 0 ? `⭐ ${r.rating.toFixed(1)}` : "—",
    growth: "",
  }));

  return (
    <WidgetCard title="Top Services" right={<ViewAll />}>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          No bookings yet — top services appear once customers start booking.
        </p>
      ) : (
        <TopServices rows={ranked} by={by} onBy={setBy} />
      )}
    </WidgetCard>
  );
}