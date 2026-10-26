import Link from "next/link";
import Image from "next/image";
import Year from "./Year";
import { SERVICES } from "../lib/seed";

export default function Footer() {
  const cols = [
    {
      title: "Company",
      links: [
        { href: "/about", label: "About us" },
        { href: "/cities", label: "Cities we serve" },
        { href: "/refer", label: "Refer & Earn" },
        { href: "/help", label: "Help & Support" },
      ],
    },
    {
      title: "Legal",
      links: [
        { href: "/terms", label: "Terms of Service" },
        { href: "/privacy", label: "Privacy Policy" },
        { href: "/delete-account", label: "Request account deletion" },
      ],
    },
    {
      title: "Popular services",
      links: SERVICES.filter((s) => s.popular)
        .slice(0, 5)
        .map((s) => ({ href: `/services/${s.id}`, label: s.name })),
    },
  ];

  return (
    <footer className="mt-16 border-t border-navy-700 bg-navy text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4 sm:px-6">
        <div>
          <Image
            src="/kaamdaar-logo-white.png"
            alt="Kaamdaar — Har Kaam Turant"
            width={168}
            height={53}
            className="h-14 w-auto"
          />
          <p className="mt-3 max-w-xs text-sm leading-6 text-blue-200">
            <span className="font-semibold text-flame-400">Har Kaam Turant.</span> Book
            a trained Kaamdaar Pro for cleaning, laundry, kitchen work and more.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h4 className="text-sm font-semibold text-white">{c.title}</h4>
            <ul className="mt-3 space-y-2">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-blue-200 transition hover:text-flame-400"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-navy-700 py-5 text-center text-xs text-blue-300">
        © <Year /> Kaamdaar. All rights reserved.
      </div>
    </footer>
  );
}