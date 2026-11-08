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
    <div className="section-shell py-10">
      <ServicesExplorer
        initialQuery={q}
        initialCategory={category}
        services={services}
      />
    </div>
  );
}
