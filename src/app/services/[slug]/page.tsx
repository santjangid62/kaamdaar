import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import ServiceTabs from "../../../components/ServiceTabs";
import BookingBox from "../../../components/BookingBox";
import ServiceDetailHeader from "../../../components/ServiceDetailHeader";
import RelatedServices from "../../../components/RelatedServices";
import { getServiceById, getServices } from "../../../server/catalog";

// The catalogue comes from the database (Admin panel), so pages render per
// request; the static shell must not freeze a snapshot of it.
export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = await getServiceById(slug);
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
  const service = await getServiceById(slug);
  if (!service || service.active === false) notFound();

  const all = await getServices();
  const related = all
    .filter(
      (s) => s.id !== service.id && (s.category === service.category || s.popular),
    )
    .slice(0, 3);

  return (
    <div className="section-shell py-10">
      <div className="grid gap-8 lg:grid-cols-3">
        {/* left: header + tabs */}
        <div className="lg:col-span-2">
          <ServiceDetailHeader service={service} />

          <div className="mt-6">
            <ServiceTabs service={service} />
          </div>
        </div>

        {/* right: booking rail */}
        <aside className="lg:col-span-1">
          <BookingBox service={service} />
        </aside>
      </div>

      <RelatedServices services={related} />
    </div>
  );
}
