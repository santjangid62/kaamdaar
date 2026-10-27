import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { SERVICES, getService } from "../../../lib/seed";
import ServiceCard from "../../../components/ServiceCard";
import ServiceTabs from "../../../components/ServiceTabs";
import BookingBox from "../../../components/BookingBox";

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
      {/* breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-slate-400">
        <Link href="/services" className="hover:text-blue-600">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/services" className="hover:text-blue-600">
          Services
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-slate-600">{service.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* left: header + tabs */}
        <div className="lg:col-span-2">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
            {service.category}
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            {service.name}
          </h1>
          <p className="mt-2 text-lg text-slate-500">{service.tagline}</p>

          <div className="mt-6">
            <ServiceTabs service={service} />
          </div>
        </div>

        {/* right: booking rail */}
        <aside className="lg:col-span-1">
          <BookingBox service={service} />
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