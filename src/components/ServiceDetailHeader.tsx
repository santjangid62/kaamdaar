"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import type { Service } from "../lib/types";
import { useCatLabel, useLang, useServiceLabels } from "../lib/i18n";
import { FALLBACK_ICON, ICONS, SERVICE_ICONS, serviceTone } from "../lib/service-icons";

/** Breadcrumb + category pill + H1 + tagline, translated. */
export default function ServiceDetailHeader({ service }: { service: Service }) {
  const { s } = useLang();
  const labels = useServiceLabels();
  const cat = useCatLabel();
  const { name, tagline } = labels(service);

  return (
    <div className="lg:col-span-2">
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-slate-400">
        <Link href="/" className="hover:text-blue-600">
          {s.detail.home}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/services" className="hover:text-blue-600">
          {s.detail.servicesCrumb}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-slate-600">{name}</span>
      </nav>

      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
        {cat(service.category)}
      </span>
      <div className="mt-4 flex items-center gap-4">
        {service.image ? (
          <Image
            src={service.image}
            alt={name}
            width={72}
            height={72}
            unoptimized
            className="h-18 w-18 rounded-2xl object-cover shadow-md shadow-black/10"
          />
        ) : (
          <span
            className={`grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br ${serviceTone(service.category)} text-white shadow-md shadow-black/10`}
          >
            {(() => {
              const Icon =
                (service.icon ? ICONS[service.icon] : undefined) ??
                SERVICE_ICONS[service.id] ??
                FALLBACK_ICON;
              return <Icon className="h-8 w-8" strokeWidth={2} />;
            })()}
          </span>
        )}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            {name}
          </h1>
          <p className="mt-2 text-lg text-slate-500">{tagline}</p>
        </div>
      </div>
    </div>
  );
}
