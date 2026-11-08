"use client";

import type { Service } from "../lib/types";
import { useLang } from "../lib/i18n";
import ServiceCard from "./ServiceCard";

/** "You may also need" grid — client so the heading can be translated. */
export default function RelatedServices({ services }: { services: Service[] }) {
  const { s } = useLang();

  return (
    <section className="mt-14">
      <h2 className="text-xl font-bold text-slate-900">{s.detail.alsoYou}</h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((x) => (
          <ServiceCard key={x.id} service={x} />
        ))}
      </div>
    </section>
  );
}
