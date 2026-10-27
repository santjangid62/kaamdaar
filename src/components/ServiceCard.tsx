import Link from "next/link";
import type { Service } from "../lib/types";
import { Clock, IndianRupee } from "lucide-react";
import { SERVICE_ICONS, serviceTone } from "../lib/service-icons";
import { LayoutGrid } from "lucide-react";

export default function ServiceCard({ service }: { service: Service }) {
  // static lookup (not a call) so the icon component identity stays stable
  const Icon = SERVICE_ICONS[service.id] ?? LayoutGrid;

  return (
    <Link
      href={`/services/${service.id}`}
      className="group card flex flex-col p-5 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/60"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${serviceTone(service.category)} text-white shadow-md shadow-black/10 transition duration-300 group-hover:-translate-y-0.5 group-hover:scale-105`}
        >
          <Icon className="h-6 w-6" strokeWidth={2} />
        </span>
        {service.popular && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
            Popular
          </span>
        )}
      </div>

      <span className="mt-4 inline-flex w-fit rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
        {service.category}
      </span>

      <h3 className="mt-3 text-base font-bold text-slate-900 group-hover:text-blue-700">
        {service.name}
      </h3>
      <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">{service.tagline}</p>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
        <span className="flex items-center gap-1 font-bold text-slate-900">
          <IndianRupee className="h-3.5 w-3.5" />
          {service.price}
          <span className="font-normal text-slate-500">/{service.unit.replace("per ", "")}</span>
        </span>
        <span className="flex items-center gap-1 text-slate-500">
          <Clock className="h-3.5 w-3.5" />
          {service.duration}
        </span>
      </div>
    </Link>
  );
}