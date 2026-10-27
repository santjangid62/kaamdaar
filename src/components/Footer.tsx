import Link from "next/link";
import Image from "next/image";
import { AtSign, Camera, MessageCircle, Send } from "lucide-react";
import Year from "./Year";

export default function Footer() {
  const cols = [
    {
      title: "Quick Links",
      links: [
        { href: "/", label: "Home" },
        { href: "/services", label: "Services" },
        { href: "/about", label: "About Us" },
        { href: "/cities", label: "Service Areas" },
        { href: "/refer", label: "Refer & Earn" },
      ],
    },
    {
      title: "Customer Support",
      links: [
        { href: "/help", label: "Help Center" },
        { href: "/help", label: "FAQs" },
        { href: "/profile", label: "Track Booking" },
        { href: "/delete-account", label: "Request account deletion" },
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
              alt="Kaamdaar"
              width={180}
              height={62}
              className="h-auto w-44"
            />
          </Link>
          <p className="mt-3 text-lg font-extrabold text-flame">
            Har Kaam Turant
          </p>
          <p className="mt-3 max-w-xs text-sm leading-6 text-blue-200">
            Trusted house help in minutes. Book a trained Kaamdaar Pro for
            cleaning, laundry, kitchen work and more.
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

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-blue-300 sm:flex-row sm:px-6">
          <p>
            © <Year /> Kaamdaar. All rights reserved.
          </p>
          <p className="flex gap-4">
            <Link href="/privacy" className="transition hover:text-flame">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition hover:text-flame">
              Terms & Conditions
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}