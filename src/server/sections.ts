/**
 * Admin section builder — turns a sidebar slug into { title, description,
 * columns, rows, kpis, fields } using ONLY real database rows.
 *
 * - Plain sections read their collection directly.
 * - Derived sections (invoices, payments, commission, insights…) are
 *   projections of bookings / wallets — they return an honest empty list
 *   when no real data exists. No placeholder statistics are ever produced.
 * - `fields` describe the add/edit form for editable sections.
 */
import { all, ready } from "./db";
import { commissionRate } from "./settings";
import type { ServiceRow } from "./catalog";
import { ICON_NAMES } from "../lib/service-icons";
import type { Booking, Provider, User } from "../lib/types";
import type { Column, Field, SectionDef } from "../lib/admin/types";

export type { Field, SectionDef };


const DAY = 24 * 60 * 60 * 1000;
const LIVE = new Set(["dispatched", "accepted", "enroute", "arrived", "in_progress", "pending_confirm"]);
const inr = (n: number): string => "₹" + Math.round(n).toLocaleString("en-IN");
const dateFmt = (ts: number): string =>
  new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
/** Short human booking reference shown in admin tables (raw ids stay in rows). */
export const bookingCode = (id: string): string =>
  "BKG-" + id.replace(/[^a-zA-Z0-9]/g, "").slice(-5).toUpperCase();

function fullName(u: User & { firstName?: string; lastName?: string }): string {
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
}

/* ── shared projections ─────────────────────────────────────────── */

async function usersAsCustomers(details: boolean) {
  const [users, bookings] = await Promise.all([all<User & { createdAt: number; status?: string }>("users"), all<Booking>("bookings")]);
  return users
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((u) => {
      const mine = bookings.filter((b) => b.userId === u.id);
      const base = {
        id: u.id,
        name: fullName(u) || "(profile pending)",
        phone: u.phone,
        area: "—",
        bookings: mine.length,
        spend: inr(mine.filter((b) => b.status === "completed").reduce((s, b) => s + b.amount, 0)),
        joined: dateFmt(u.createdAt),
        statusLabel: u.status === "blocked" ? "Blocked" : "Active",
        // raw values for the edit form (columns above drive what is displayed)
        status: u.status === "blocked" ? "blocked" : "active",
        firstName: u.firstName ?? "",
        lastName: u.lastName ?? "",
        email: u.email ?? "",
        _userId: u.id,
      };
      return details ? { ...base, email: u.email || "—", referral: u.referralCode ?? "—" } : base;
    });
}

function bookingRows(bookings: Booking[], users: User[]) {
  const nameOf = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u ? fullName(u) || u.phone : id || "—";
  };
  const tone = (s: string) =>
    s === "completed" ? "green" : s === "cancelled" ? "red" : LIVE.has(s) ? "sky" : s === "accepted" ? "blue" : "grey";
  return bookings
    .slice()
    .sort((a, b) => (b.dispatchedAt ?? b.createdAt) - (a.dispatchedAt ?? a.createdAt))
    .map((b) => ({
      id: b.id,
      code: bookingCode(b.id), // short human code, e.g. BKG-XT3QL
      customer: nameOf(b.userId),
      provider: b.providerName || "—",
      service: b.serviceName,
      location: [b.address?.label, b.address?.city].filter(Boolean).join(", ") || "—",
      amount: inr(b.amount),
      status: b.status === "dispatched" ? "Searching" : b.status === "pending_confirm" ? "Awaiting OTP" : b.status[0].toUpperCase() + b.status.slice(1),
      tone: tone(b.status),
      time: dateFmt(b.dispatchedAt ?? b.createdAt),
      _bookingId: b.id,
    }));
}

/* ── section registry ───────────────────────────────────────────── */

export async function buildSection(slug: string): Promise<SectionDef | null> {
  await ready();
  const [users, bookings, providers, wallets, serviceRows] = await Promise.all([
    all<User & { createdAt: number; status?: string }>("users"),
    all<Booking>("bookings"),
    all<Provider & { createdAt?: number; kycStatus?: string; walletBalance?: number; phone?: string; status?: string }>("providers"),
    all<{ providerId: string; balance: number }>("wallets"),
    all<{ id: string; name: string }>("services"),
  ]);
  /** live wallet balance (the wallets collection is the source of truth) */
  const walletOf = (id: string): number =>
    wallets.find((w) => w.providerId === id)?.balance ?? 0;
  /** service ids → display names for the table */
  const serviceName = (id: string): string =>
    serviceRows.find((s) => s.id === id)?.name ?? id;

  const bookingCols: Column[] = [
    { key: "code", label: "Booking" },
    { key: "customer", label: "Customer" },
    { key: "service", label: "Service" },
    { key: "location", label: "Location" },
    { key: "amount", label: "Amount", align: "right" },
    { key: "status", label: "Status" },
    { key: "time", label: "Time" },
  ];

  const done = bookings.filter((b) => b.status === "completed");
  const cancelled = bookings.filter((b) => b.status === "cancelled");
  const live = bookings.filter((b) => LIVE.has(b.status));
  const monthAgo = Date.now() - 30 * DAY;

  switch (slug) {
    /* BOOKINGS ---------------------------------------------------- */
    case "all-bookings":
      return {
        title: "All Bookings",
        description: "Every real booking — live, scheduled, completed and cancelled.",
        columns: bookingCols,
        rows: bookingRows(bookings, users),
        collection: "bookings",
        readOnly: true,
        kpis: [
          { label: "Total", value: String(bookings.length) },
          { label: "Live now", value: String(live.length) },
          { label: "Completed", value: String(done.length) },
        ],
      };
    case "live-bookings":
      return {
        title: "Live Bookings",
        description: "In-flight dispatches — searching, assigned, on the way, in progress.",
        columns: bookingCols,
        rows: bookingRows(live, users),
        readOnly: true,
        kpis: [
          { label: "Live now", value: String(live.length) },
          { label: "Searching", value: String(bookings.filter((b) => b.status === "dispatched").length) },
          { label: "In progress", value: String(bookings.filter((b) => b.status === "in_progress").length) },
        ],
      };
    case "cancelled-bookings":
      return {
        title: "Cancelled Bookings",
        description: "Bookings cancelled before or during service.",
        columns: bookingCols,
        rows: bookingRows(cancelled, users),
        readOnly: true,
        kpis: [
          { label: "Cancelled", value: String(cancelled.length) },
          { label: "Rate", value: bookings.length ? `${Math.round((cancelled.length / bookings.length) * 1000) / 10}%` : "—" },
        ],
      };

    /* CUSTOMERS --------------------------------------------------- */
    case "customers":
      return {
        title: "Customers",
        description: "Everyone who completed phone-OTP signup — real registrations only.",
        columns: [
          { key: "name", label: "Name" },
          { key: "phone", label: "Phone" },
          { key: "bookings", label: "Bookings", align: "right" },
          { key: "spend", label: "Total spend", align: "right" },
          { key: "joined", label: "Joined" },
          { key: "statusLabel", label: "Status" },
        ],
        rows: await usersAsCustomers(false),
        collection: "users",
        fields: [
          { key: "firstName", label: "First name", help: "Customer ka pehla naam — profile page par yahi dikhta hai. Phone OTP ke baad khud bhara ja sakta hai." },
          { key: "lastName", label: "Last name", help: "Apna naam. Optional hai — khaali chhoda ja sakta hai." },
          { key: "email", label: "Email", help: "Optional. Receipts / offers ke liye. Format: name@example.com" },
          { key: "status", label: "Status", type: "select", options: ["active", "blocked"], help: "active = account chalu, booking kar sakta hai. blocked = login/book band (refund ya violation case me)." },
        ],
        kpis: [
          { label: "Total customers", value: String(users.length) },
          { label: "New (30d)", value: String(users.filter((u) => u.createdAt >= monthAgo).length) },
          { label: "Active", value: String(users.filter((u) => u.status !== "blocked").length) },
        ],
      };
    case "customer-details":
      return {
        title: "Customer Details",
        description: "Full profiles — contact, referral code and engagement.",
        columns: [
          { key: "name", label: "Name" },
          { key: "phone", label: "Phone" },
          { key: "email", label: "Email" },
          { key: "referral", label: "Referral" },
          { key: "bookings", label: "Bookings", align: "right" },
          { key: "spend", label: "Spend", align: "right" },
          { key: "statusLabel", label: "Status" },
        ],
        rows: await usersAsCustomers(true),
        collection: "users",
        readOnly: true,
      };
    case "customer-complaints": {
      const rows = await all<{ id: string; customer: string; provider: string; issue: string; booking: string; status: string; createdAt: number }>("complaints");
      return {
        title: "Customer Complaints",
        description: "Support tickets raised by customers.",
        columns: [
          { key: "id", label: "Ticket" },
          { key: "customer", label: "Customer" },
          { key: "provider", label: "Provider" },
          { key: "issue", label: "Issue" },
          { key: "booking", label: "Booking" },
          { key: "status", label: "Status" },
        ],
        rows: rows.map((c) => ({ ...c, time: dateFmt(c.createdAt) })),
        collection: "complaints",
        fields: [
          { key: "customer", label: "Customer", help: "Shikayat karne wale customer ka naam ya phone (+91…)." },
          { key: "provider", label: "Provider", help: "Jis provider ke khilaf shikayat hai uska naam. Na pata ho to “—" },
          { key: "issue", label: "Issue", type: "textarea", help: "Customer ne kya bataya — jaise “service time par nahi aayi”. Support yahi dekhta hai." },
          { key: "booking", label: "Booking id", help: "Related booking ka id, jaise BKG-10245. Table ke Bookings section me mil jayega." },
          { key: "status", label: "Status", type: "select", options: ["Open", "Escalated", "Resolved"], help: "Open = abhi handle nahi hua. Escalated = senior ko bheja. Resolved = kaam ho gaya." },
        ],
        kpis: [
          { label: "Open", value: String(rows.filter((c) => c.status === "Open").length) },
          { label: "Total", value: String(rows.length) },
        ],
      };
    }

    /* PROVIDERS --------------------------------------------------- */
    case "service-providers":
    case "provider-details": {
      const detail = slug === "provider-details";
      const rows = providers.map((p) => {
        const base = {
          id: p.id,
          name: p.name,
          phone: String(p.phone ?? "—"),
          service: (p.services ?? []).map(serviceName).join(", ") || "—",
          area: p.city || "—",
          rating: Number(p.rating ?? 0).toFixed(1),
          jobs: p.jobs ?? 0,
          wallet: inr(walletOf(p.id)),
          status: p.status ?? "Offline",
          kyc: p.kycStatus ?? "Pending",
          // raw values for the edit form (display columns pick their own keys)
          city: p.city || "",
          services: (p.services ?? []).join(", "),
          lat: Number(p.lat ?? 0),
          lng: Number(p.lng ?? 0),
          hourlyRate: Number(p.hourlyRate ?? 0),
          experience: Number(p.experience ?? 0),
          kycStatus: p.kycStatus ?? "Pending",
          policeVerified: p.policeVerified ? "true" : "false",
          verified: p.verified ? "true" : "false",
        };
        return detail
          ? { ...base, police: p.policeVerified ? "Verified" : "No", hourly: inr(p.hourlyRate ?? 0) }
          : base;
      });
      return {
        title: detail ? "Provider Details" : "Service Providers",
        description: detail
          ? "Deep profile: police verification, experience, rates and workload."
          : "Providers onboarded by the company — nobody self-registers.",
        columns: detail
          ? [
              { key: "name", label: "Provider" },
              { key: "phone", label: "Phone" },
              { key: "service", label: "Services" },
              { key: "police", label: "Police" },
              { key: "experience", label: "Exp. (yrs)" },
              { key: "rating", label: "Rating", align: "right" },
              { key: "hourly", label: "Hourly", align: "right" },
              { key: "kyc", label: "KYC" },
            ]
          : [
              { key: "name", label: "Provider" },
              { key: "service", label: "Services" },
              { key: "area", label: "Area" },
              { key: "rating", label: "Rating", align: "right" },
              { key: "jobs", label: "Jobs", align: "right" },
              { key: "wallet", label: "Wallet", align: "right" },
              { key: "kyc", label: "KYC" },
              { key: "status", label: "Status" },
            ],
        rows,
        collection: "providers",
        fields: [
          { key: "name", label: "Provider name", required: true, help: "Provider ka poora naam — user ko accept ke baad yahi dikhta hai. Koi provider khud register nahi karta, sirf aap yahan se add karte hain." },
          { key: "phone", label: "Phone (+91…)", required: true, help: "10 digit Indian number, jaise +919876543210 — OTP aur notifications yahin jate hain." },
          { key: "services", label: "Kaunsi service dega", help: "Service ke slug id (jaise kitchen-cleaning), multiple ho to comma se alag: kitchen-cleaning, utensils. Ye IDs Services section ki table me milti hain." },
          { key: "city", label: "Area / city", help: "Provider kahan ka hai — jaise “Malviya Nagar, Jaipur”. Map par isi ke aas-paas wo dikhta hai." },
          { key: "lat", label: "Latitude", type: "number", help: "Map ki exact location (decimal, jaise 26.8467). Google Maps par location right-click karke mil jata hai." },
          { key: "lng", label: "Longitude", type: "number", help: "Map ki exact location (decimal, jaise 75.7836). 2–3 km radius ka hisaab isi se hota hai." },
          { key: "hourlyRate", label: "Hourly rate ₹", type: "number", help: "Ye rate user ko accept ke baad dikhta hai. Sirf number daalein." },
          { key: "experience", label: "Experience (yrs)", type: "number", help: "Saal ka anubhav — profile card par “X yrs” likha aata hai." },
          { key: "kycStatus", label: "KYC", type: "select", options: ["Pending", "Verified", "Rejected"], help: "Documents check karne ke baad: Verified = kaam shuru kar sakta hai; Pending = ruk jata hai; Rejected = naya document mangwana hai." },
          { key: "policeVerified", label: "Police verified", type: "toggle", help: "On sirf tab jab police verification certificate check ho chuka ho — user ko badge dikhta hai (galti se on mat karna)." },
          { key: "verified", label: "Platform verified", type: "toggle", help: "On = Kaamdaar ka blue verified badge user ko dikhega." },
          { key: "status", label: "Status", type: "select", options: ["Online", "Offline"], help: "Online = abhi booking accept kar sakta hai. Offline = usko dispatch notification nahi jayega." },
        ],
        kpis: [
          { label: "Total providers", value: String(providers.length) },
          { label: "Online now", value: String(providers.filter((p) => p.status === "Online").length) },
          { label: "KYC pending", value: String(providers.filter((p) => (p.kycStatus ?? "Pending") === "Pending").length) },
        ],
      };
    }
    case "kyc-queue": {
      const rows = providers
        .filter((p) => (p.kycStatus ?? "Pending") !== "Verified")
        .map((p) => ({
          id: p.id,
          name: p.name,
          phone: String(p.phone ?? "—"),
          service: (p.services ?? []).map(serviceName).join(", ") || "—",
          kyc: p.kycStatus ?? "Pending",
          submitted: dateFmt(p.createdAt ?? Date.now()),
          // raw values for the KYC edit form
          kycStatus: p.kycStatus ?? "Pending",
          verified: p.verified ? "true" : "false",
        }));
      return {
        title: "KYC Queue",
        description: "Providers awaiting document verification before going live.",
        columns: [
          { key: "name", label: "Provider" },
          { key: "phone", label: "Phone" },
          { key: "service", label: "Services" },
          { key: "kyc", label: "Status" },
          { key: "submitted", label: "Added" },
        ],
        rows,
        collection: "providers",
        fields: [
          { key: "kycStatus", label: "KYC decision", type: "select", options: ["Pending", "Verified", "Rejected"], help: "Documents dekh kar final decision: Verified hi karne par provider live ho jata hai. Ye queue sirf unnon ki hai jinka abhi verify nahi hua." },
          { key: "verified", label: "Platform verified", type: "toggle", help: "KYC ke saath platform badge bhi dena ho to on karein." },
        ],
        kpis: [
          { label: "Pending", value: String(rows.filter((r) => r.kyc === "Pending").length) },
          { label: "Rejected", value: String(rows.filter((r) => r.kyc === "Rejected").length) },
        ],
      };
    }
    case "provider-payouts": {
      const rows = await all<{ id: string; provider: string; jobs: number; amount: number; mode: string; status: string; date: string; createdAt: number }>("payouts");
      return {
        title: "Provider Payouts",
        description: "Withdrawal requests after the commission deduction.",
        columns: [
          { key: "provider", label: "Provider" },
          { key: "jobs", label: "Jobs", align: "right" },
          { key: "amountLabel", label: "Amount", align: "right" },
          { key: "mode", label: "Mode" },
          { key: "status", label: "Status" },
          { key: "date", label: "Date" },
        ],
        rows: rows.map((r) => ({ ...r, amountLabel: inr(r.amount) })),
        collection: "payouts",
        fields: [
          { key: "provider", label: "Provider", help: "Jisko payout ja raha hai — provider ka naam (Service Providers section se)." },
          { key: "jobs", label: "Jobs settled", type: "number", help: "Is payout me kitne completed services cover ho rahi hain. Sirf number." },
          { key: "amount", label: "Amount ₹", type: "number", help: "Sirf number daalein, jaise 2500 (₹ apne aap lag jayega). Ye wallet se kaat ke provider ko jata hai." },
          { key: "mode", label: "Mode", type: "select", options: ["UPI", "Bank"], help: "Paise kaise bheje gaye — UPI transfer ya bank NEFT." },
          { key: "status", label: "Status", type: "select", options: ["Processing", "Paid"], help: "Processing = order placed, abhi paisa nahi gaya. Paid = transfer ho chuka hai." },
          { key: "date", label: "Date", help: "Payout ki tarikh, jaise 30 Oct 2026." },
        ],
        kpis: [
          { label: "Total payouts", value: String(rows.length) },
          { label: "Processing", value: String(rows.filter((r) => r.status === "Processing").length) },
        ],
      };
    }
    case "reviews": {
      const rows = await all<{ id: string; author: string; service: string; rating: number; text: string; createdAt: number }>("reviews");
      const avg = rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : 0;
      return {
        title: "Reviews",
        description: "Ratings customers left after completed bookings.",
        columns: [
          { key: "author", label: "Customer" },
          { key: "service", label: "Service" },
          { key: "ratingLabel", label: "Rating", align: "right" },
          { key: "text", label: "Review" },
        ],
        rows: rows.map((r) => ({ ...r, ratingLabel: `${Number(r.rating).toFixed(1)} ⭐` })),
        collection: "reviews",
        fields: [
          { key: "author", label: "Customer", help: "Review dene wale customer ka naam — site par yahi dikhta hai." },
          { key: "service", label: "Service", help: "Kaunsi service par review diya — jaise “Kitchen Cleaning”." },
          { key: "rating", label: "Rating (1–5)", type: "number", required: true, help: "1 se 5 ka number, jaise 4 ya 5. Site par stars me badal kar dikhta hai." },
          { key: "text", label: "Review", type: "textarea", full: true, help: "Customer ka feedback text — detail page par “Recent Reviews” me dikhta hai." },
        ],
        kpis: [
          { label: "Avg rating", value: rows.length ? `${avg.toFixed(1)} ⭐` : "—" },
          { label: "Reviews", value: String(rows.length) },
        ],
      };
    }

    /* SERVICES ---------------------------------------------------- */
    case "categories": {
      const rows = await all<{ id: string; name: string; active: boolean; order: number }>("categories");
      return {
        title: "Categories",
        description: "Top-level categories on the customer site.",
        columns: [
          { key: "name", label: "Category" },
          { key: "order", label: "Order", align: "right" },
          { key: "status", label: "Status" },
        ],
        rows: rows.map((c) => ({
          ...c,
          active: c.active ? "true" : "false", // raw for the edit toggle
          status: c.active ? "Active" : "Hidden", // displayed
        })),
        collection: "categories",
        fields: [
          { key: "name", label: "Category name", required: true, help: "Customer ko dikhne wali category — jaise “Cleaning”, “Kitchen”. Service add karte time yahi is dropdown me aayegi." },
          { key: "order", label: "Order (display order)", type: "number", help: "Site par kis order me dikhani hai — 1 = sabse pehle (top). Nayi category ke liye sabse bada number + 1 daal dein (jaise maujuda 3 hain to 4). Number chhota = upar, bada = neeche." },
          { key: "active", label: "Visible", type: "toggle", help: "On = category site par dikh rahi hai. Off = category aur uski saari services customer ko nahi dikhengi." },
        ],
      };
    }
    case "services":
    case "sub-services": {
      const allServices = await all<ServiceRow>("services");
      const catRows = await all<{ name: string; active: boolean }>("categories");
      // Category dropdown = admin categories ∪ categories already in use
      const categoryOptions = [
        ...new Set([
          ...catRows.map((c) => c.name),
          ...allServices.map((s) => s.category),
        ].filter(Boolean)),
      ]
        .sort()
        .map((name) => ({ value: name, label: name }));
      // Parent dropdown = main services only (a sub-service can't nest)
      const parentOptions = allServices
        .filter((s) => !s.parent)
        .map((s) => ({ value: s.id, label: `${s.name} (${s.id})` }));

      const rows = (slug === "sub-services" ? allServices.filter((s) => s.parent) : allServices.filter((s) => !s.parent)).map((s) => ({
        id: s.id,
        name: s.name,
        category: s.parent || s.category,
        price: Number(s.price ?? 0), // raw for the edit form
        priceLabel: inr(s.price ?? 0), // displayed
        duration: s.duration ?? "—",
        tagline: s.tagline ?? "",
        description: s.description ?? "",
        unit: s.unit ?? "per task",
        parent: s.parent ?? "",
        includes: (s.includes ?? []).join("\n"), // raw list for the form
        excludes: (s.excludes ?? []).join("\n"),
        slots: (s.slots ?? []).join("\n"),
        icon: s.icon ?? "",
        image: s.image ?? "",
        popular: s.popular ? "true" : "false",
        order: Number(s.order ?? 0),
        providers: providers.filter((p) => (p.services ?? []).includes(s.id)).length,
        status: s.active === false ? "Hidden" : "Active",
        active: s.active === false ? "false" : "true", // raw for the edit toggle
      }));
      return {
        title: slug === "sub-services" ? "Sub Services" : "Services",
        description:
          slug === "sub-services"
            ? "Granular tasks booked under a parent service."
            : "The live catalogue customers search and book — changes show on the website immediately.",
        columns: [
          { key: "name", label: "Service" },
          { key: "category", label: slug === "sub-services" ? "Parent" : "Category" },
          { key: "priceLabel", label: "From", align: "right" },
          { key: "duration", label: "Duration" },
          { key: "providers", label: "Providers", align: "right" },
          { key: "status", label: "Status" },
        ],
        rows,
        collection: "services",
        fields: [
          { key: "name", label: "Service name", required: true, help: "Customer ko jo dikhana hai — jaise “Kitchen Cleaning”. URL slug (link) naam se hi ban jayega." },
          { key: "category", label: "Category", type: "select", options: categoryOptions, required: true, help: "Sirf wahi categories dropdown me aati hain jo aapne Categories section me add ki hain. Nayi category chahiye to pehle Categories → Add karein, phir yahan refresh karke choose karein." },
          { key: "tagline", label: "Tagline", help: "Ek chhoti selling line — card par naam ke neeche dikhti hai. Optional." },
          { key: "description", label: "Description", type: "textarea", full: true, help: "Service detail page par puri jankari. Kya hota hai is service me, kaise karte hain." },
          { key: "includes", label: "Kya shamil hai (Includes)", type: "list", help: "Ek point per line. Booking box aur detail page par green ticks me dikhta hai. Jaise: “Platform and sink” / “Hob and chimney exterior”." },
          { key: "excludes", label: "Kya shamil nahi (Excludes)", type: "list", help: "Ek point per line. Customer ko pehle se bata dein ki service me kya nahi aata (red crosses me dikhta hai)." },
          { key: "price", label: "Starting price ₹", type: "number", required: true, help: "Sirf number, jaise 349 — site par “₹349 se shuru” dikh jayega. Commission (10%) ye nahi hai — ye customer ko lagta hai." },
          { key: "unit", label: "Price kis par", type: "select", options: ["per task", "per hour", "per visit"], default: "per task", help: "per task = ek poora kaam; per hour = ghante ke; per visit = har visit par. Rate ke saath wahi likhta hai." },
          { key: "duration", label: "Duration", help: "Kitna time lagta hai — jaise “60–90 min”. Card par clock icon ke saath dikhta hai." },
          { key: "slots", label: "Duration slots (hourly service ke liye)", type: "list", help: "Optional. Hourly service par customer jo options chun sake — ek per line, jaise “30 minutes”, “1 hour”, “2 hours”. Detail page par chips ban jate hain." },
          { key: "icon", label: "Icon", type: "select", options: ICON_NAMES, help: "Service card ka icon (image na di ho to yahi dikhta hai). Image di to image hi upar rahegi." },
          { key: "image", label: "Image URL (optional)", help: "Poori image link https:// se — card aur detail page par wahi image dikhegi. Na di to colored icon tile dikhega." },
          { key: "parent", label: "Parent service (sirf Sub Service ke liye)", type: "select", options: parentOptions, help: "Agar ye Sub Service hai to apni main service choose karein (dropdown me sabhi services hain). Main service banane par khaali chhodein." },
          { key: "order", label: "Order (display order)", type: "number", help: "Site par kis order me dikhani hai — 1 sabse upar/pehle. Naye service ke liye sabse bada number + 1 daal dein (jaise pehle 20 hain to 21)." },
          { key: "popular", label: "Popular (home page par)", type: "toggle", help: "On = ye service home page ke “Popular Services” grid me top par aayegi." },
          { key: "active", label: "Live on site", type: "toggle", help: "On = service site par dikh rahi hai aur book ho rahi hai. Off = turat chhap jayegi (delete ki zarurat nahi)." },
        ],
        kpis: [
          { label: "Services", value: String(allServices.filter((s) => !s.parent).length) },
          { label: "Sub services", value: String(allServices.filter((s) => s.parent).length) },
          { label: "Live", value: String(allServices.filter((s) => s.active !== false).length) },
        ],
      };
    }
    case "pricing-commission": {
      const rate = await commissionRate();
      const rows = await all<{ id: string; name: string; price: number; active?: boolean }>("services");
      return {
        title: "Pricing & Commission",
        description: `Base prices and the fixed ${rate}% company commission.`,
        columns: [
          { key: "name", label: "Service" },
          { key: "base", label: "Base price", align: "right" },
          { key: "commission", label: "Commission", align: "right" },
          { key: "providerShare", label: "Provider gets", align: "right" },
          { key: "minWallet", label: "Min wallet", align: "right" },
        ],
        rows: rows.map((s) => ({
          id: s.id,
          name: s.name,
          price: Number(s.price ?? 0), // raw for the edit form
          base: inr(s.price ?? 0),
          commission: `${rate}% = ${inr(((s.price ?? 0) * rate) / 100)}`,
          providerShare: inr((s.price ?? 0) * (1 - rate / 100)),
          minWallet: inr(500),
        })),
        collection: "services",
        noAdd: true,
        noDelete: true,
        fields: [
          { key: "name", label: "Service name", readonly: true, help: "Naam yahan se nahi badalta — Services section me badlein." },
          { key: "price", label: "Base price ₹", type: "number", required: true, help: `Customer ko lagna wala rate (sirf number, jaise 349). Site par turat update ho jayega. Commission (${rate}%) apne aap is par lagta hai — provider ko uske baad milta hai.` },
        ],
        kpis: [
          { label: "Services priced", value: String(rows.length) },
          { label: "Commission rate", value: `${rate}%` },
        ],
      };
    }

    /* FINANCE ----------------------------------------------------- */
    case "invoices": {
      const rows = done.map((b) => ({
        id: bookingCode(b.id),
        customer: (() => { const u = users.find((x) => x.id === b.userId); return u ? fullName(u) || u.phone : b.userId; })(),
        service: b.serviceName,
        amount: inr(b.amount),
        commission: inr(b.commission ?? 0),
        status: b.paymentMethod ? "Paid" : "Pending",
        date: dateFmt(b.completedAt ?? b.createdAt),
      }));
      return {
        title: "Invoices",
        description: "Generated from completed bookings — amount and commission split.",
        columns: [
          { key: "id", label: "Booking" },
          { key: "customer", label: "Customer" },
          { key: "service", label: "Service" },
          { key: "amount", label: "Amount", align: "right" },
          { key: "commission", label: "Commission", align: "right" },
          { key: "status", label: "Status" },
          { key: "date", label: "Date" },
        ],
        rows,
        readOnly: true,
        kpis: [
          { label: "Invoices", value: String(rows.length) },
          { label: "Revenue", value: inr(done.reduce((s, b) => s + b.amount, 0)) },
        ],
      };
    }
    case "payments": {
      const paid = bookings.filter((b) => b.paymentMethod);
      const rows = paid.map((b) => ({
        id: bookingCode(b.id),
        customer: (() => { const u = users.find((x) => x.id === b.userId); return u ? fullName(u) || u.phone : b.userId; })(),
        mode: b.paymentMethod === "upi" ? "UPI" : "Cash",
        amount: inr(b.amount),
        status: "Captured",
        date: dateFmt(b.paidAt ?? b.completedAt ?? b.createdAt),
      }));
      return {
        title: "Payments",
        description: "Cash and UPI collections recorded against bookings.",
        columns: [
          { key: "id", label: "Booking" },
          { key: "customer", label: "Customer" },
          { key: "mode", label: "Mode" },
          { key: "amount", label: "Amount", align: "right" },
          { key: "status", label: "Status" },
          { key: "date", label: "Date" },
        ],
        rows,
        readOnly: true,
        kpis: [
          { label: "Collected", value: inr(paid.reduce((s, b) => s + b.amount, 0)) },
          { label: "UPI share", value: paid.length ? `${Math.round((paid.filter((b) => b.paymentMethod === "upi").length / paid.length) * 100)}%` : "—" },
        ],
      };
    }
    case "wallet-transactions": {
      const txns = await all<{ id: string; provider: string; providerId: string; kind: string; amount: number; balanceAfter: number; note: string; createdAt: number }>("walletTxns");
      return {
        title: "Wallet Transactions",
        description: "Every commission debit and recharge on provider wallets.",
        columns: [
          { key: "provider", label: "Provider" },
          { key: "kind", label: "Type" },
          { key: "note", label: "Note" },
          { key: "amount", label: "Amount", align: "right" },
          { key: "balanceAfter", label: "Wallet after", align: "right" },
          { key: "date", label: "Date" },
        ],
        rows: txns
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((t) => ({
            ...t,
            provider: t.provider || providers.find((p) => p.id === t.providerId)?.name || "Removed provider",
            kind: t.kind === "commission" ? "10% commission" : "Recharge",
            amount: (t.amount < 0 ? "−" : "+") + inr(Math.abs(t.amount)),
            balanceAfter: inr(t.balanceAfter),
            date: dateFmt(t.createdAt),
          })),
        readOnly: true,
        kpis: [
          { label: "Ledger rows", value: String(txns.length) },
          { label: "Commission collected", value: inr(txns.filter((t) => t.kind === "commission").reduce((s, t) => s + Math.abs(t.amount), 0)) },
        ],
      };
    }
    case "commission-revenue": {
      const months = new Map<string, { bookings: number; gmv: number; commission: number }>();
      done.forEach((b) => {
        const key = new Date(b.completedAt ?? b.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
        const cur = months.get(key) ?? { bookings: 0, gmv: 0, commission: 0 };
        cur.bookings += 1;
        cur.gmv += b.amount;
        cur.commission += b.commission ?? 0;
        months.set(key, cur);
      });
      const rate = await commissionRate();
      return {
        title: "Commission & Revenue",
        description: `Company earnings — fixed ${rate}% of every completed service.`,
        columns: [
          { key: "month", label: "Month" },
          { key: "bookings", label: "Completed", align: "right" },
          { key: "gmv", label: "GMV", align: "right" },
          { key: "commission", label: "Commission", align: "right" },
          { key: "rate", label: "Rate", align: "right" },
        ],
        rows: [...months.entries()].map(([month, v]) => ({
          id: month,
          month,
          bookings: v.bookings,
          gmv: inr(v.gmv),
          commission: inr(v.commission),
          rate: `${rate}%`,
        })),
        readOnly: true,
        kpis: [
          { label: "Lifetime commission", value: inr(done.reduce((s, b) => s + (b.commission ?? 0), 0)) },
          { label: "Lifetime GMV", value: inr(done.reduce((s, b) => s + b.amount, 0)) },
        ],
      };
    }

    /* CMS & CONTENT ----------------------------------------------- */
    case "banners": {
      const rows = await all<{ id: string; title: string; placement: string; status: string; clicks: number; updatedAt: number }>("banners");
      return {
        title: "Banners",
        description: "Promotional banners across the customer app.",
        columns: [
          { key: "title", label: "Banner" },
          { key: "placement", label: "Placement" },
          { key: "status", label: "Status" },
          { key: "clicks", label: "Clicks", align: "right" },
          { key: "updated", label: "Updated" },
        ],
        rows: rows.map((b) => ({ ...b, updated: b.updatedAt ? dateFmt(b.updatedAt) : "—" })),
        collection: "banners",
        fields: [
          { key: "title", label: "Banner title", required: true, help: "Promo ka naam — sirf andar (admin) ke liye, jaise “Diwali Cleanathon”." },
          { key: "placement", label: "Placement", help: "Banner kahan dikhega — jaise “Home hero”, “Services top”. Ek jagah ka naam daalein." },
          { key: "status", label: "Status", type: "select", options: ["Active", "Scheduled", "Paused"], help: "Active = abhi chal raha. Scheduled = date aane par chalega. Paused = band." },
          { key: "clicks", label: "Clicks", type: "number", help: "Kitni baar click hua — normally khud update hota hai, manual chhod dein." },
        ],
      };
    }
    case "faqs": {
      const rows = await all<{ id: string; q: string; category: string; status: string; votes: number }>("faqs");
      return {
        title: "FAQs",
        description: "Help-centre questions shown to customers.",
        columns: [
          { key: "q", label: "Question" },
          { key: "category", label: "Category" },
          { key: "votes", label: "Helpful", align: "right" },
          { key: "status", label: "Status" },
        ],
        rows,
        collection: "faqs",
        fields: [
          { key: "q", label: "Question", required: true, help: "Customer ka sawal — jaise “Payment kaise karein?” Help page par yahi upar dikhta hai." },
          { key: "answer", label: "Answer", type: "textarea", full: true, required: true, help: "Sawal ka jawaab — simple bhasha me, 2–3 line. Customer isi ko padhta hai." },
          { key: "category", label: "Category", help: "Sawal kis section ka hai — jaise “Booking”, “Payment”, “Cancellation”. Help page par isi ke group me aata hai." },
          { key: "status", label: "Status", type: "select", options: ["Published", "Draft"], help: "Published = site par dikh raha. Draft = save kar rakha hai, abhi nahi dikh raha." },
          { key: "votes", label: "Helpful votes", type: "number", help: "Customer ne kitni baar “helpful” dabaya — sirf anka, manually badalne ki zarurat nahi." },
        ],
      };
    }

    /* NOTIFICATIONS & PAGES --------------------------------------- */
    case "notifications": {
      const rows = await all<{ id: string; title: string; audience: string; channel: string; status: string; sentAt: string; createdAt: number }>("campaigns");
      return {
        title: "Notifications",
        description: "Push, SMS and email campaigns sent to users.",
        columns: [
          { key: "title", label: "Notification" },
          { key: "audience", label: "Audience" },
          { key: "channel", label: "Channel" },
          { key: "status", label: "Status" },
          { key: "sent", label: "Sent" },
        ],
        rows: rows.map((n) => ({ ...n, sent: n.sentAt || "—" })),
        collection: "campaigns",
        fields: [
          { key: "title", label: "Notification title", required: true, help: "Push/SMS ka headline — chhota rakhein, jaise “Monsoon offer: 20% off”." },
          { key: "audience", label: "Audience", help: "Kisko bhejna hai — jaise “All users”, “Jaipur users”, “Providers”." },
          { key: "channel", label: "Channel", type: "select", options: ["Push", "SMS", "Email", "In-app"], help: "Kis raste bhejna hai: Push = mobile notification, SMS = text message, Email = mail, In-app = app/website ke andar." },
          { key: "status", label: "Status", type: "select", options: ["Sent", "Draft"], help: "Draft = abhi bhejna nahi hai (sirf taiyar kiya). Sent = bhej diya gaya." },
          { key: "sentAt", label: "Sent at", help: "Bhejne ka time, jaise “30 Oct 2026, 10:24 AM”. Scheduled ho to khaali chhodein." },
        ],
      };
    }
    case "pages": {
      const rows = await all<{ id: string; title: string; slug: string; status: string; updatedAt: number }>("pages");
      return {
        title: "Pages",
        description: "Static pages served by the website.",
        columns: [
          { key: "title", label: "Page" },
          { key: "slug", label: "Slug" },
          { key: "status", label: "Status" },
          { key: "updated", label: "Updated" },
        ],
        rows: rows.map((p) => ({ ...p, updated: p.updatedAt ? dateFmt(p.updatedAt) : "—" })),
        collection: "pages",
        fields: [
          { key: "title", label: "Page title", required: true, help: "Page ka naam — browser tab par aur page ke top par yahi dikhta hai." },
          { key: "slug", label: "Slug (URL path)", required: true, help: "Page ka link — / se shuru, jaise /about ya /offers. Yahi link banega website par." },
          { key: "status", label: "Status", type: "select", options: ["Published", "Draft"], help: "Published = page link par khul raha. Draft = abhi nahi khulega." },
        ],
      };
    }

    /* REPORTS & ANALYTICS ----------------------------------------- */
    case "reports": {
      const rows = [
        { id: "bookings30", report: "Bookings — last 30 days", rows: bookings.filter((b) => b.createdAt >= monthAgo).length, format: "CSV", lastRun: "live" },
        { id: "completed", report: "Completed services", rows: done.length, format: "PDF", lastRun: "live" },
        { id: "commission", report: "Commission reconciliation", rows: done.length, format: "XLSX", lastRun: "live" },
        { id: "kyc", report: "KYC compliance", rows: providers.filter((p) => (p.kycStatus ?? "Pending") !== "Verified").length, format: "PDF", lastRun: "live" },
      ];
      return {
        title: "Reports",
        description: "Exports computed from live data — row counts update as bookings happen.",
        columns: [
          { key: "report", label: "Report" },
          { key: "rows", label: "Rows", align: "right" },
          { key: "format", label: "Format" },
          { key: "lastRun", label: "Last run" },
        ],
        rows,
        readOnly: true,
      };
    }
    case "insights": {
      const rows: Array<Record<string, string | number>> = [];
      if (bookings.length > 0) {
        const byArea = new Map<string, number>();
        bookings.forEach((b) => {
          const a = [b.address?.label, b.address?.city].filter(Boolean).join(", ");
          if (a) byArea.set(a, (byArea.get(a) ?? 0) + 1);
        });
        const topArea = [...byArea.entries()].sort((a, b) => b[1] - a[1])[0];
        const bySvc = new Map<string, number>();
        bookings.forEach((b) => bySvc.set(b.serviceName, (bySvc.get(b.serviceName) ?? 0) + 1));
        const topSvc = [...bySvc.entries()].sort((a, b) => b[1] - a[1])[0];
        if (topArea) rows.push({ id: "area", insight: `Highest demand: ${topArea[0]}`, area: topArea[0], confidence: "High", action: "Prioritise supply" });
        if (topSvc) rows.push({ id: "service", insight: `Most booked service: ${topSvc[0]} (${topSvc[1]})`, area: "All", confidence: "High", action: "Scale provider onboarding" });
        rows.push({ id: "cancel", insight: `Cancellation rate: ${Math.round((cancelled.length / bookings.length) * 1000) / 10}%`, area: "All", confidence: "Medium", action: cancelled.length ? "Review cancellation reasons" : "Maintain" });
        rows.push({ id: "providers", insight: `${providers.length} providers serving ${bookings.length} bookings`, area: "All", confidence: "High", action: providers.length * 20 < bookings.length ? "Onboard more providers" : "Balanced" });
      }
      return {
        title: "Insights",
        description: "Observations computed from your real bookings — they appear as data comes in.",
        columns: [
          { key: "insight", label: "Insight" },
          { key: "area", label: "Area" },
          { key: "confidence", label: "Confidence" },
          { key: "action", label: "Suggested action" },
        ],
        rows,
        readOnly: true,
      };
    }

    /* SETTINGS ----------------------------------------------------- */
    case "admin-users": {
      const rows = await all<{ id: string; name: string; email: string; role: string; status: string; lastSeen: string }>("adminUsers");
      return {
        title: "Admin Users",
        description: "Back-office accounts with role-based access.",
        columns: [
          { key: "name", label: "Name" },
          { key: "email", label: "Email" },
          { key: "role", label: "Role" },
          { key: "status", label: "Status" },
        ],
        rows,
        collection: "adminUsers",
        fields: [
          { key: "name", label: "Full name", required: true, help: "Andar login karne wale bandhe ka naam — topbar me wahi dikhta hai." },
          { key: "email", label: "Email (login id)", required: true, help: "Login ke liye email — jaise ops@kaamdaar.com. Isi se dashboard me enter karte hain." },
          { key: "role", label: "Role", type: "select", options: ["Super Admin", "Operations", "Finance", "Support"], help: "Super Admin = sab kuch. Operations = bookings/providers. Finance = payouts/invoices. Support = complaints/FAQs. Role ke hisaab se access milta hai." },
          { key: "status", label: "Status", type: "select", options: ["Active", "Suspended"], help: "Active = login kar sakta hai. Suspended = login band (bina delete kiye)." },
        ],
      };
    }
    case "roles-permissions": {
      const rows = (await all<{ id: string; role: string; users: number; permissions: string; scope: string }>("settings"))
        .filter((s) => s.id.startsWith("role_"))
        .map((s) => ({ id: s.id, role: (s as unknown as { value?: string }).value ?? s.id, users: s.users ?? 0, permissions: s.permissions ?? "—", scope: s.scope ?? "—" }));
      return {
        title: "Roles & Permissions",
        description: "RBAC definitions stored as settings (role_* rows).",
        columns: [
          { key: "role", label: "Role" },
          { key: "users", label: "Users", align: "right" },
          { key: "permissions", label: "Permissions" },
          { key: "scope", label: "Scope" },
        ],
        rows,
        readOnly: true,
      };
    }
    case "system-settings": {
      const rows = await all<{ id: string; key: string; value: string; scope: string }>("settings");
      return {
        title: "System Settings",
        description: "Billing, branding, theme colors and homepage copy. Changes appear across the customer site and admin after refresh.",
        columns: [
          { key: "key", label: "Setting" },
          { key: "value", label: "Value" },
          { key: "scope", label: "Scope" },
        ],
        rows,
        collection: "settings",
        fields: [
          { key: "key", label: "Setting", readonly: true, help: "Setting ka naam — yahan se nahi badalta." },
          { key: "value", label: "Value", required: true, help: "Nayi value — save karte hi poori site par lagu. Jaise “Company commission” = 10 (percent), “Minimum provider wallet” = 500 (₹)." },
          { key: "scope", label: "Scope", readonly: true, help: "Ye value kis cheez par asar karti hai (Billing / Discovery / Auth…)." },
        ],
      };
    }

    default:
      return null;
  }
}
