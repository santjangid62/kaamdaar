/**
 * Admin login lives outside the guarded (panel) group but still needs the
 * request path at render time (SiteOnly hides the customer chrome), so it is
 * a blocking route rather than a prerendered one.
 */
import type { Metadata } from "next";

export const instant = false;

export const metadata: Metadata = {
  title: "Kaamdaar Admin Login",
  robots: { index: false, follow: false },
};

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
