import Link from "next/link";
import { BadgeCheck, CalendarClock, IndianRupee, Users } from "lucide-react";
import InfoPage, { infoMetadata } from "../../components/InfoPage";

export const metadata = infoMetadata(
  "For Providers",
  "Join Kaamdaar as a verified service professional and grow your business.",
);

const PERKS = [
  {
    icon: Users,
    title: "Get more customers",
    body: "Work lands on your dashboard from customers within 2–3 km of your location.",
  },
  {
    icon: CalendarClock,
    title: "Flexible working hours",
    body: "Accept instant, scheduled or recurring jobs that fit your daily routine.",
  },
  {
    icon: IndianRupee,
    title: "Secure payments",
    body: "No cash handling — payouts are settled to your account after each job.",
  },
  {
    icon: BadgeCheck,
    title: "Build your reputation",
    body: "Ratings and reviews from customers raise your ranking in the area.",
  },
];

export default function ForProvidersPage() {
  return (
    <div>
      <section className="bg-navy py-14 text-white">
        <div className="section-shell">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-blue-100">
            <BadgeCheck className="h-3.5 w-3.5 text-flame-400" /> Partner
            program
          </span>
          <h1 className="mt-4 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
            Grow your business with <span className="text-flame">Kaamdaar</span>
          </h1>
          <p className="mt-3 max-w-xl text-blue-200">
            Bring your skills to thousands of homes that need them. Register as
            a Kaamdaar Pro and start receiving jobs near you.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/help" className="btn-accent px-6 py-3 text-base">
              Register Now
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full border border-white/30 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10"
            >
              Provider Login
            </Link>
          </div>
        </div>
      </section>

      <section className="section-shell py-14">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PERKS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="card p-6">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-flame-50 text-flame-600">
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="mt-4 font-bold text-slate-900">{p.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {p.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <InfoPage
        title="How to join"
        intro="Three steps and you are live on the platform."
        blocks={[
          {
            heading: "1. Register",
            paragraphs: [
              "Share your name, phone number, the services you offer and the area you cover. Our team verifies every application.",
            ],
          },
          {
            heading: "2. Get verified",
            paragraphs: [
              "We check your ID, address and experience, then run a short training on quality standards, safety and customer etiquette.",
            ],
          },
          {
            heading: "3. Start earning",
            paragraphs: [
              "Jobs near you appear in your provider app. Accept what fits your schedule, complete the job and get paid securely.",
            ],
            bullets: [
              "Payouts settled after every completed job",
              "Ratings and reviews build your profile",
              "Support team available 7:00 AM – 10:00 PM",
            ],
          },
        ]}
      />

      <div className="section-shell -mt-4 pb-12">
        <Link href="/help" className="btn-accent">
          Talk to our partner team
        </Link>
      </div>
    </div>
  );
}