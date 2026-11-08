import Link from "next/link";
import Image from "next/image";
import type { Service } from "../lib/types";
import { Clock, IndianRupee } from "lucide-react";
import { useCatLabel, useLang, useServiceLabels } from "../lib/i18n";
import { FALLBACK_ICON, ICONS, SERVICE_ICONS, serviceTone } from "../lib/service-icons";

export default function ServiceCard({ service }: { service: Service }) {
  // static object lookup — admin icon, then id default, then generic tile
  const Icon =
    (service.icon ? ICONS[service.icon] : undefined) ??
    SERVICE_ICONS[service.id] ??
    FALLBACK_ICON;
  const { s } = useLang();
  const labels = useServiceLabels();
  const cat = useCatLabel();
  const { name, tagline, duration } = labels(service);
  const unitKey = (service.unit ?? "per task").replace(
    "per ",
    "",
  ) as keyof typeof s.services.units;
  const unitLabel = s.services.units[unitKey] ?? unitKey;

  return (
    <Link
      href={`/services/${service.id}`}
      className="group card flex flex-col p-5 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/60"
    >
      <div className="flex items-start justify-between gap-3">
        {service.image ? (
          <Image
            src={service.image}
            alt={name}
            width={48}
            height={48}
            unoptimized
            className="h-12 w-12 rounded-2xl object-cover shadow-md shadow-black/10 transition duration-300 group-hover:-translate-y-0.5 group-hover:scale-105"
          />
        ) : (
          <span
            className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${serviceTone(service.category)} text-white shadow-md shadow-black/10 transition duration-300 group-hover:-translate-y-0.5 group-hover:scale-105`}
          >
            <Icon className="h-6 w-6" strokeWidth={2} />
          </span>
        )}
        {service.popular && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
            {s.services.popularBadge}
          </span>
        )}
      </div>

      <span className="mt-4 inline-flex w-fit rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
        {cat(service.category)}
      </span>

      <h3 className="mt-3 text-base font-bold text-slate-900 group-hover:text-blue-700">
        {name}
      </h3>
      <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">{tagline}</p>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
        <span className="flex items-center gap-1 font-bold text-slate-900">
          <IndianRupee className="h-3.5 w-3.5" />
          {service.price}
          <span className="font-normal text-slate-500">/{unitLabel}</span>
        </span>
        <span className="flex items-center gap-1 text-slate-500">
          <Clock className="h-3.5 w-3.5" />
          {duration}
        </span>
      </div>
    </Link>
  );
}
