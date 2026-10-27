import type { Metadata } from "next";
import ServicesExplorer from "../../components/ServicesExplorer";
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
  const category = SERVICE_CATEGORIES.includes(cat) ? cat : "All";

  return (
    <div className="section-shell py-10">
      <div className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Search results
        </h1>
        <p className="mt-2 text-slate-500">
          Transparent starting rates. Final price is confirmed before you book.
        </p>
      </div>

      <ServicesExplorer
        initialQuery={q}
        initialCategory={category}
        services={SERVICES}
      />
    </div>
  );
}