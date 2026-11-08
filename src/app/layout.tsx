import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { AppProvider } from "../components/AppProvider";
import { LangProvider } from "../lib/i18n";
import ConsentNotice from "../components/ConsentNotice";
import LocationNotice from "../components/LocationNotice";
import Assistant from "../components/Assistant";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SiteOnly from "../components/SiteOnly";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Kaamdaar — Har Kaam Turant | Trusted house help in minutes",
    template: "%s | Kaamdaar",
  },
  description:
    "Kaamdaar — book trained house help in minutes. Cleaning, laundry, kitchen prep, hourly help and more. Instant, scheduled and recurring bookings.",
  keywords: ["Kaamdaar", "Har Kaam Turant", "house help", "cleaning services", "home services India"],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-offwhite text-slate-900">
        <AppProvider>
          <LangProvider>
            <LocationNotice />
            <Suspense fallback={<Navbar />}>
              <SiteOnly>
                <Navbar />
              </SiteOnly>
            </Suspense>
            <main className="flex-1">{children}</main>
            <Suspense fallback={<Footer />}>
              <SiteOnly>
                <Footer />
                <ConsentNotice />
                <Assistant />
              </SiteOnly>
            </Suspense>
          </LangProvider>
        </AppProvider>
        {/* Firebase Phone Auth reCAPTCHA mount point */}
        <div id="kaamdaar-recaptcha" />
      </body>
    </html>
  );
}
