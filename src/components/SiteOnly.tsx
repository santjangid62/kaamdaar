"use client";

/**
 * Renders its children only on the customer website. Admin routes
 * (/admin…) get their own chrome (AdminShell), so the navbar, footer and
 * floating assistant must disappear there.
 */
import { usePathname } from "next/navigation";

export default function SiteOnly({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return <>{children}</>;
}
