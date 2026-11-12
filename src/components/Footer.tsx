"use client";

import Link from "next/link";
import Image from "next/image";
import { AtSign, Camera, MessageCircle, Send, Heart } from "lucide-react";
import Year from "./Year";
import { useApp } from "./AppProvider";
import { useLang } from "../lib/i18n";

export default function Footer() {
  const { s } = useLang();
  const { settings } = useApp();
  const siteName = settings.site_name?.trim() || "Kaamdaar";
  const tagline = settings.site_tagline?.trim() || s.footer.tagline;
  const description = settings.site_description?.trim() || s.footer.desc;

  const cols = [
    {
      title: s.footer.quickLinks,
      links: [
        { href: "/", label: s.footer.links.home },
        { href: "/services", label: s.footer.links.services },
        { href: "/about", label: s.footer.links.about },
        { href: "/#areas", label: s.footer.links.serviceAreas },
        { href: "/refer", label: s.footer.links.refer },
      ],
    },
    {
      title: s.footer.support,
      links: [
        { href: "/help", label: s.footer.links.helpCenter },
        { href: "/help", label: s.footer.links.faqs },
        { href: "/dashboard", label: s.footer.links.track },
        { href: "/delete-account", label: s.footer.links.deletion },
      ],
    },
  ];

  const socials = [
    { Icon: MessageCircle, label: "WhatsApp" },
    { Icon: Camera, label: "Instagram" },
    { Icon: AtSign, label: "X" },
    { Icon: Send, label: "Telegram" },
  ];

  return (
    <footer className="mt-16 bg-navy text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Link href="/" className="inline-block">
            <Image
              src="/kaamdaar-logo-white.png"
              alt={siteName}
              width={180}
              height={62}
              className="h-auto w-44"
            />
          </Link>
          <p className="mt-3 text-lg font-extrabold text-flame">
            {tagline}
          </p>
          <p className="mt-3 max-w-xs text-sm leading-6 text-blue-200">
            {description}
          </p>
          <div className="mt-5 flex gap-3">
            {socials.map(({ Icon, label }) => (
              <span
                key={label}
                title={label}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-blue-100 transition hover:bg-flame hover:text-navy"
              >
                <Icon className="h-4 w-4" />
              </span>
            ))}
          </div>
        </div>

        {cols.map((c) => (
          <div key={c.title}>
            <h4 className="text-sm font-bold uppercase tracking-wide text-white">
              {c.title}
            </h4>
            <ul className="mt-4 space-y-2.5">
              {c.links.map((l) => (
                <li key={`${c.title}-${l.label}`}>
                  <Link
                    href={l.href}
                    className="text-sm text-blue-200 transition hover:text-flame"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/15">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-4 px-4 py-6 text-center text-xs text-blue-200 sm:px-6 md:grid-cols-[1fr_auto_1fr] md:text-left">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 md:justify-start">
            <p className="text-blue-200/75">
              © <Year /> Unique IT Solutions. {s.footer.rights}
            </p>
            <span className="flex gap-3 text-blue-200/60">
              <Link href="/privacy" className="transition hover:text-flame">
                {s.footer.links.privacy}
              </Link>
              <Link href="/terms" className="transition hover:text-flame">
                {s.footer.links.terms}
              </Link>
            </span>
          </div>

          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-medium text-blue-100/90">
            <span>Made with Love &amp; Care by</span>
            <span className="font-extrabold text-white">
              Unique IT Solutions - A Unit of Unique Computers, The Best One
            </span>
            <Heart className="h-3.5 w-3.5 fill-flame text-flame" aria-label="love" />
          </p>

     </div>
      </div>
    </footer>
  );
}
