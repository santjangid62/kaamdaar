import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Check, Clock, IndianRupee, MapPin, ShieldCheck, X } from "lucide-react";
import { SERVICES, getService } from "../../../lib/seed";
import ServiceCard from "../../../components/ServiceCard";

export function generateStaticParams() {
  return SERVICES.map((s) => ({ slug: s.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) return { title: "Service not found" };
  return { title: service.name, description: service.tagline };
}

// The App Shell must stay URL-independent for instant navigation: the
// params-dependent content renders inside a Suspense boundary with a
// static placeholder as its fallback.
export default function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<ServiceDetailSkeleton />}>
      <ServiceDetailView params={params} />
    </Suspense>
  );
}

function ServiceDetailSkeleton() {
  return (
    <div className="section-shell py-10" aria-hidden>
      <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
      <div className="mt-6 h-8 w-72 animate-pulse rounded bg-slate-100" />
      <div className="mt-4 h-4 w-52 animate-pulse rounded bg-slate-100" />
      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}

async function ServiceDetailView({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) notFound();

  const related = SERVICES.filter(
    (s) => s.id !== service.id && (s.category === service.category || s.popular),
  ).slice(0, 3);

  return (
    <div className="section-shell py-10">
      <nav className="mb-6 flex items-center gap-2 text-sm text-slate-400">
        <Link href="/services" className="hover:text-blue-600">
          Services
        </Link>
        <span>/</span>
        <span className="text-slate-600">{service.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
            {service.category}
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            {service.name}
          </h1>
          <p className="mt-2 text-lg text-slate-500">{service.tagline}</p>
          <p className="mt-5 leading-7 text-slate-600">{service.description}</p>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <div className="card p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-green-700">
                <Check className="h-4 w-4" /> What&apos;s included
              </h2>
              <ul className="mt-3 space-y-2">
                {service.includes.map((i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-red-600">
                <X className="h-4 w-4" /> Not included
              </h2>
              <ul className="mt-3 space-y-2">
                {service.excludes.map((i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-600">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="card mt-6 p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
              How booking works
            </h2>
            <ol className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                "Pick this service and your location",
                "Choose a verified Pro near you",
                "Confirm slot, verify OTP, done",
              ].map((step, i) => (
                <li key={step} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                  <span className="mb-1 block font-bold text-blue-600">Step {i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* rate card */}
        <aside className="lg:col-span-1">
          <div className="card sticky top-24 p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Rate card
            </h2>
            <div className="mt-3 flex items-end gap-2">
              <span className="flex items-center text-4xl font-extrabold text-slate-900">
                <IndianRupee className="h-6 w-6" />
                {service.price}
              </span>
              <span className="pb-1.5 text-sm text-slate-500">/{service.unit.replace("per ", "")}</span>
            </div>

            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-slate-500">
                  <Clock className="h-4 w-4" /> Duration
                </dt>
                <dd className="font-semibold text-slate-800">{service.duration}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-slate-500">
                  <IndianRupee className="h-4 w-4" /> Billing
                </dt>
                <dd className="font-semibold text-slate-800">{service.unit}</dd>
              </div>
            </dl>

            {service.slots && (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Choose duration
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {service.slots.map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <Link
              href={`/services/${service.id}/providers`}
              className="btn-accent mt-6 w-full"
            >
              <MapPin className="h-4 w-4" /> Show providers near me
            </Link>

            <ul className="mt-5 space-y-2 text-xs text-slate-500">
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-600" /> Trained &amp; verified Pros
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-600" /> Providers within 2–3 km of you
              </li>
            </ul>

            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              Final price is shown at checkout and can vary with location and
              service complexity.
            </p>
          </div>
        </aside>
      </div>

      <section className="mt-14">
        <h2 className="text-xl font-bold text-slate-900">You may also need</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      </section>
    </div>
  );
}
