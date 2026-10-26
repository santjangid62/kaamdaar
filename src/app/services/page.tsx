import type { Metadata } from "next";
import ServiceCard from "../../components/ServiceCard";
import ServiceFilterBar from "../../components/ServiceFilterBar";
import { SERVICES, SERVICE_CATEGORIES } from "../../lib/seed";

export const metadata: Metadata = {
  title: "All services",
  description: "Browse every house-help service with transparent starting rates.",
};

// reads searchParams → rendered at request time
export const instant = false;

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string }>;
}) {
  const { q = "", cat = "All" } = await searchParams;
  const term = q.trim().toLowerCase();
  const category = SERVICE_CATEGORIES.includes(cat) ? cat : "All";

  const results = SERVICES.filter((s) => {
    const matchTerm =
      !term ||
      s.name.toLowerCase().includes(term) ||
      s.category.toLowerCase().includes(term) ||
      s.tagline.toLowerCase().includes(term) ||
      s.description.toLowerCase().includes(term);
    const matchCat = category === "All" || s.category === category;
    return matchTerm && matchCat;
  });

  return (
    <div className="section-shell py-10">
      <div className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          All services
        </h1>
        <p className="mt-2 text-slate-500">
          Transparent starting rates. Final price is confirmed before you book.
        </p>
      </div>

      <ServiceFilterBar
        initialQuery={q}
        initialCategory={category}
        categories={SERVICE_CATEGORIES}
        total={results.length}
      />

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((s) => (
          <ServiceCard key={s.id} service={s} />
        ))}
      </div>

      {results.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <p className="font-semibold text-slate-700">No service matched “{q}”.</p>
          <p className="mt-1 text-sm text-slate-500">
            Try “cleaning”, “laundry”, “kitchen” or “hourly”.
          </p>
        </div>
      )}
    </div>
  );
}
