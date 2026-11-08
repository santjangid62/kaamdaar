/**
 * First-boot seed: loads the real service catalogue and platform config into
 * the database. It never invents statistics — customers, bookings, reviews,
 * revenue and wallets all start empty and fill up from real usage, which is
 * what the Admin dashboard then reports.
 *
 * Registered via registerSeeder(), runs once (flag `seeded` in the store).
 */
import { SERVICES, SERVICE_CATEGORIES } from "../lib/seed";
import { registerSeeder } from "./db";

registerSeeder((store) => {
  /* service catalogue — the same rows the admin panel manages from now on */
  if (!store.services || Object.keys(store.services).length === 0) {
    store.services = Object.fromEntries(
      SERVICES.map((s) => [
        s.id,
        { ...s, parent: "", active: true, order: SERVICES.indexOf(s) },
      ]),
    );
  }
  if (!store.categories || Object.keys(store.categories).length === 0) {
    const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    store.categories = Object.fromEntries(
      SERVICE_CATEGORIES.map((name, i) => [
        slug(name),
        { id: slug(name), name, active: true, order: i },
      ]),
    );
  }

  /* platform settings — live values the app and admin both read */
  if (!store.settings || Object.keys(store.settings).length === 0) {
    store.settings = {
      commission_rate: { id: "commission_rate", key: "Company commission", value: "10", scope: "Billing", updatedAt: 0 },
      min_wallet: { id: "min_wallet", key: "Minimum provider wallet", value: "500", scope: "Billing", updatedAt: 0 },
      provider_radius_km: { id: "provider_radius_km", key: "Provider match radius", value: "3", scope: "Discovery", updatedAt: 0 },
      area_radius_km: { id: "area_radius_km", key: "Areas-we-serve radius", value: "10", scope: "Discovery", updatedAt: 0 },
      payment_modes: { id: "payment_modes", key: "Payment modes", value: "Cash, UPI", scope: "Checkout", updatedAt: 0 },
      languages: { id: "languages", key: "Languages", value: "English, हिन्दी", scope: "i18n", updatedAt: 0 },
      location_scope: { id: "location_scope", key: "Location support", value: "India only (+91, Indian PINs)", scope: "Validation", updatedAt: 0 },
      login_method: { id: "login_method", key: "Login method", value: "Phone OTP (Firebase)", scope: "Auth", updatedAt: 0 },
    };
  }

  const siteSettings = [
    ["site_name", "Site name", "Kaamdaar", "Branding"],
    ["site_tagline", "Site tagline", "Har Kaam Turant", "Branding"],
    ["site_description", "Site description", "Trusted home services, booked in minutes.", "Branding"],
    ["brand_navy", "Brand navy", "#0B1F3A", "Branding"],
    ["brand_blue", "Brand blue", "#1261A0", "Branding"],
    ["brand_orange", "Brand orange", "#FF7A00", "Branding"],
    ["brand_background", "Page background", "#F7F9FC", "Branding"],
    ["home_hero_title_en", "Home hero title (English)", "Har Ghar Ka Har Kaam Turant", "Homepage"],
    ["home_hero_subtitle_en", "Home hero subtitle (English)", "Verified professionals for all your home and business needs. Book easily, track live, pay safely.", "Homepage"],
    ["home_hero_title_hi", "Home hero title (Hindi)", "हर घर का हर काम तुरंत", "Homepage"],
    ["home_hero_subtitle_hi", "Home hero subtitle (Hindi)", "आपके घर और ऑफिस के हर काम के लिए वेरिफाइड प्रोफेशनल। आसानी से बुक करें, लाइव ट्रैक करें, सुरक्षित भुगतान करें।", "Homepage"],
  ] as const;
  const settings = (store.settings ??= {});
  for (const [id, key, value, scope] of siteSettings) {
    if (!settings[id]) settings[id] = { id, key, value, scope, updatedAt: 0 };
  }

  /* CMS pages — real routes served by this website */
  if (!store.pages || Object.keys(store.pages).length === 0) {
    const pages = [
      ["about", "About Us", "/about"],
      ["terms", "Terms of Service", "/terms"],
      ["privacy", "Privacy Policy", "/privacy"],
      ["help", "Help & Support", "/help"],
      ["refer", "Refer & Earn", "/refer"],
      ["delete-account", "Account Deletion", "/delete-account"],
    ] as const;
    store.pages = Object.fromEntries(
      pages.map(([id, title, slug]) => [
        id,
        { id, title, slug, status: "Published", updatedAt: 0 },
      ]),
    );
  }

  /* the one real back-office account (credentials come from env at login) */
  if (!store.adminUsers || Object.keys(store.adminUsers).length === 0) {
    store.adminUsers = {
      superadmin: {
        id: "superadmin",
        name: "Super Admin",
        email: process.env.ADMIN_EMAIL ?? "admin@kaamdaar.com",
        role: "Super Admin",
        status: "Active",
        lastSeen: "",
        updatedAt: 0,
      },
    };
  }

  return store;
});
