"use client";

import { useEffect, useState } from "react";
import { editMyReview, listMyReviews, submitMyReview, type BookingReview } from "../lib/store";

export default function BookingReviewPanel({ bookingId, serviceName }: { bookingId: string; serviceName: string }) {
  const [review, setReview] = useState<BookingReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [providerRating, setProviderRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listMyReviews().then((rows) => {
      if (!active) return;
      const found = rows.find((row) => row.bookingId === bookingId) ?? null;
      setReview(found);
      if (found) {
        setProviderRating(Number(found.providerRating ?? found.rating ?? 0));
        setServiceRating(Number(found.serviceRating ?? 0));
        setText(found.text ?? "");
        setEditing(Number(found.editCount ?? 0) < 1);
      } else {
        setEditing(true);
      }
    }).catch((e) => { if (active) setError(e instanceof Error ? e.message : "Could not load your review."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bookingId]);

  async function save() {
    if (!providerRating || !serviceRating || busy) return;
    setBusy(true); setError(null);
    try {
      const payload = { bookingId, providerRating, serviceRating, text: text.trim() };
      const saved = review ? await editMyReview(payload) : await submitMyReview(payload);
      setReview(saved); setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review could not be saved.");
    } finally { setBusy(false); }
  }

  const stars = (value: number, onChange: (value: number) => void, label: string) => (
    <div className="mt-1 flex items-center gap-1" role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!editing} onClick={() => onChange(n)}
          aria-label="Star rating" className={n <= value ? "text-2xl leading-none text-amber-500 disabled:cursor-default" : "text-2xl leading-none text-slate-300 disabled:cursor-default"}>
          ★
        </button>
      ))}
    </div>
  );

  if (loading) return <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Loading review…</div>;
  if (review && !editing) return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-800">Your review for {serviceName}</p>
        {Number(review.editCount ?? 0) < 1 ? <button type="button" onClick={() => setEditing(true)} className="text-xs font-bold text-blue-700 hover:underline">Edit once</button> : <span className="text-xs font-semibold text-slate-500">Edit used · Locked</span>}
      </div>
      <p className="mt-2 text-xs text-slate-600">Professional: {review.providerRating ?? review.rating ?? 0}/5 · Service: {review.serviceRating ?? 0}/5</p>
      {review.text && <p className="mt-2 text-sm text-slate-700">{review.text}</p>}
    </div>
  );

  return (
    <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
      <p className="text-sm font-bold text-slate-900">{review ? "Edit your review" : "Rate your experience"}</p>
      <p className="mt-1 text-xs text-slate-600">{review ? "You have one edit remaining. Saving will permanently lock this review." : "Rate the professional and the service you received."}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div><p className="text-xs font-semibold text-slate-700">Professional rating</p>{stars(providerRating, setProviderRating, "Professional rating")}</div>
        <div><p className="text-xs font-semibold text-slate-700">Service rating</p>{stars(serviceRating, setServiceRating, "Service rating")}</div>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={3} disabled={!editing}
        placeholder="Share your experience (optional)" className="mt-3 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none focus:border-blue-400 disabled:bg-slate-100" />
      {error && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
      <div className="mt-3 flex items-center gap-3">
        <button type="button" disabled={!providerRating || !serviceRating || busy} onClick={() => void save()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Saving…" : review ? "Save one-time edit" : "Submit review"}</button>
        {review && <button type="button" disabled={busy} onClick={() => setEditing(false)} className="text-xs font-semibold text-slate-600 hover:underline">Cancel</button>}
      </div>
    </div>
  );
}
