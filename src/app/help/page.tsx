import Link from "next/link";
import {
  BadgeCheck,
  CreditCard,
  LifeBuoy,
  MessageSquareWarning,
  Search,
  UserRound,
  Wallet,
  Wrench,
  XCircle,
} from "lucide-react";
import { infoMetadata } from "../../components/InfoPage";

export const metadata = infoMetadata(
  "Help & Support",
  "Find answers, track complaints or raise a request with the support team.",
);

const CATEGORIES = [
  { icon: Wallet, title: "Billing & Payments", body: "Refunds, invoices and payment issues" },
  { icon: Wrench, title: "Service Quality", body: "Raise a concern about a completed job" },
  { icon: UserRound, title: "Account Issues", body: "Login, OTP, profile and addresses" },
  { icon: XCircle, title: "Cancellations & Refunds", body: "Cancel rules and refund status" },
  { icon: CreditCard, title: "Bookings & Rescheduling", body: "Change date, slot or service" },
  { icon: BadgeCheck, title: "Other Help", body: "Anything else we can assist with" },
];

const ARTICLES = [
  {
    q: "How to book a service?",
    a: "Pick a service from the Services page, choose a verified Pro near you, select a date and time slot, then confirm with your saved address. Login is phone-OTP only and you stay signed in until you log out.",
  },
  {
    q: "How to make payment?",
    a: "Pay after the service is completed — via UPI, card or cash. No advance payment is needed to book, and the final amount is always confirmed with you before the work starts.",
  },
  {
    q: "How to reschedule a booking?",
    a: "Open My bookings in your profile, pick the upcoming booking and choose a new date or slot. Rescheduling is free up to 2 hours before the scheduled time.",
  },
  {
    q: "How to cancel a booking?",
    a: "Open My bookings, select the booking and tap cancel. The applicable cancellation window and any fee are shown before you confirm the cancellation.",
  },
  {
    q: "How to raise a complaint?",
    a: "Write to support@kaamdaar.in with your booking ID and registered mobile number, or use Raise a Complaint below. Average first response is under 10 minutes on chat.",
  },
  {
    q: "OTP is not arriving — what do I do?",
    a: "Wait 30 seconds and tap Resend OTP, then check SMS/WhatsApp. If it still does not arrive, confirm the number is correct and your network is reachable; support can verify your number manually.",
  },
];

export default function HelpPage() {
  return (
    <div>
      {/* hero */}
      <section className="bg-navy py-14 text-white">
        <div className="section-shell text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-blue-100">
            <LifeBuoy className="h-3.5 w-3.5 text-flame-400" /> Support
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            How can we help you?
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-blue-200">
            Find answers, track complaints or talk to our support team — we
            reply within minutes, 7:00 AM to 10:00 PM.
          </p>
          <div className="relative mx-auto mt-6 max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Search for help articles…"
              aria-label="Search help articles"
              className="w-full rounded-full border-0 bg-white py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none ring-2 ring-transparent transition placeholder:text-slate-400 focus:ring-flame"
            />
          </div>
        </div>
      </section>

      {/* categories */}
      <section className="section-shell -mt-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.title}
                className="card flex items-start gap-4 p-5 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-flame-50 text-flame-600">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-bold text-slate-900">{c.title}</h2>
                  <p className="mt-0.5 text-sm text-slate-500">{c.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* popular articles */}
      <section className="section-shell grid gap-8 py-12 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="text-xl font-extrabold text-slate-900">
            Popular Articles
          </h2>
          <div className="mt-4 space-y-3">
            {ARTICLES.map((art) => (
              <details key={art.q} className="card p-5">
                <summary className="cursor-pointer font-bold text-slate-900">
                  {art.q}
                </summary>
                <p className="mt-2 text-sm leading-6 text-slate-600">{art.a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* still need help */}
        <aside>
          <div className="card sticky top-24 overflow-hidden">
            <div className="bg-navy p-6 text-white">
              <h2 className="text-lg font-extrabold">Still need help?</h2>
              <p className="mt-1 text-sm text-blue-200">
                Our support team is here for you — average reply under 10
                minutes.
              </p>
            </div>
            <div className="space-y-3 p-6">
              <a
                href="mailto:support@kaamdaar.in?subject=Kaamdaar%20support%20request"
                className="btn-accent w-full"
              >
                <MessageSquareWarning className="h-4 w-4" /> Chat with us
              </a>
              <a
                href="mailto:support@kaamdaar.in?subject=Complaint%20-%20Kaamdaar"
                className="btn-ghost w-full text-red-600"
              >
                Raise a Complaint
              </a>
              <p className="pt-2 text-center text-xs text-slate-400">
                support@kaamdaar.in · 7:00 AM – 10:00 PM
              </p>
              <Link
                href="/profile"
                className="block text-center text-sm font-semibold text-blue-600 hover:underline"
              >
                Open my bookings →
              </Link>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}