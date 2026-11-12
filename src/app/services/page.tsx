import type { Metadata } from "next";
import ServicesExplorer from "../../components/ServicesExplorer";
import { getServices, getServiceCategories } from "../../server/catalog";

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
  const [services, categories] = await Promise.all([
    getServices(),
    getServiceCategories(),
  ]);
  const category = cat === "All" || categories.includes(cat) ? cat : "All";

  return (
    <>
      <section className="relative isolate overflow-hidden bg-navy py-16 text-white sm:py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(59,130,246,.28),transparent_32%),radial-gradient(circle_at_85%_80%,rgba(255,122,0,.22),transparent_30%)]" />
        <div className="section-shell relative text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[.18em] text-orange-200">✦ HOME SERVICES</span>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">Explore Our Services</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-blue-100 sm:text-lg">Find the right help for your home, compare services and transparent starting prices, and book with confidence.</p>
        </div>
      </section>
      <div className="section-shell py-10">
      <ServicesExplorer
        initialQuery={q}
        initialCategory={category}
        services={services}
      />
      </div>
    </>
  );
}
