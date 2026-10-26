import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { CITIES, SERVICES } from "../../lib/seed";

export const metadata: Metadata = {
  title: "Cities we serve",
  description: "Kaamdaar home-services coverage across Indian cities.",
};

export default function CitiesPage() {
  return (
    <div className="section-shell py-12">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Cities we serve
        </h1>
        <p className="mt-3 text-slate-600">
          Trained Kaamdaar Pros are available across {CITIES.length} cities.
          Availability at any address depends on providers within 2–3 km of you.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CITIES.map((city) => (
          <div key={city} className="card p-5">
            <span className="flex items-center gap-2 font-bold text-slate-900">
              <MapPin className="h-4 w-4 text-blue-600" /> {city}
            </span>
            <p className="mt-1 text-sm text-slate-500">All {SERVICES.length} services available</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-2xl bg-blue-50 p-6">
        <h2 className="font-bold text-slate-900">Not in your city yet?</h2>
        <p className="mt-1 text-sm text-slate-600">
          Tell us where you are through Help & Support and we will notify you
          when Kaamdaar launches near you.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/help" className="btn-primary">
            Request your city
          </Link>
          <Link href="/services" className="btn-ghost">
            Browse services
          </Link>
        </div>
      </div>
    </div>
  );
}