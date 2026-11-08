/**
 * Sidebar navigation registry for the Admin Dashboard — client-safe (no
 * server imports): AdminShell renders this, and the server section builder
 * ([src/server/sections.ts](src/server/sections.ts)) reuses the Column type.
 * Actual per-section data now comes from the database at request time.
 */

export type { Column, SectionDef, Field } from "./types";

export interface NavItem {
  slug: string;
  label: string;
  icon: string;
}

export interface NavGroup {
  section?: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  { items: [{ slug: "", label: "Dashboard", icon: "LayoutDashboard" }] },
  {
    section: "Bookings",
    items: [
      { slug: "all-bookings", label: "All Bookings", icon: "List" },
      { slug: "live-bookings", label: "Live Bookings", icon: "Monitor" },
      { slug: "cancelled-bookings", label: "Cancelled Bookings", icon: "CircleX" },
      { slug: "activity-log", label: "Activity Log", icon: "FileText" },
    ],
  },
  {
    section: "Customers",
    items: [
      { slug: "customers", label: "Customers", icon: "User" },
      { slug: "customer-details", label: "Customer Details", icon: "Contact" },
      { slug: "customer-complaints", label: "Customer Complaints", icon: "Headset" },
    ],
  },
  {
    section: "Providers",
    items: [
      { slug: "service-providers", label: "Service Providers", icon: "Wrench" },
      { slug: "provider-details", label: "Provider Details", icon: "IdCard" },
      { slug: "kyc-queue", label: "KYC Queue", icon: "ClipboardCheck" },
      { slug: "provider-payouts", label: "Provider Payouts", icon: "Banknote" },
      { slug: "reviews", label: "Reviews", icon: "Star" },
    ],
  },
  {
    section: "Services",
    items: [
      { slug: "categories", label: "Categories", icon: "Grid3X3" },
      { slug: "services", label: "Services", icon: "Wrench" },
      { slug: "sub-services", label: "Sub Services", icon: "ListTree" },
      { slug: "pricing-commission", label: "Pricing & Commission", icon: "Tag" },
    ],
  },
  {
    section: "Finance",
    items: [
      { slug: "invoices", label: "Invoices", icon: "FileText" },
      { slug: "payments", label: "Payments", icon: "CreditCard" },
      { slug: "wallet-transactions", label: "Wallet Transactions", icon: "Wallet" },
      { slug: "commission-revenue", label: "Commission & Revenue", icon: "ChartPie" },
    ],
  },
  {
    section: "CMS & Content",
    items: [
      { slug: "banners", label: "Banners", icon: "ImageIcon" },
      { slug: "faqs", label: "FAQs", icon: "CircleHelp" },
    ],
  },
  {
    items: [
      { slug: "notifications", label: "Notifications", icon: "Bell" },
      { slug: "pages", label: "Pages", icon: "FileText" },
    ],
  },
  {
    section: "Reports & Analytics",
    items: [
      { slug: "reports", label: "Reports", icon: "ChartBar" },
      { slug: "insights", label: "Insights", icon: "Lightbulb" },
    ],
  },
  {
    section: "Settings",
    items: [
      { slug: "admin-users", label: "Admin Users", icon: "Users" },
      { slug: "roles-permissions", label: "Roles & Permissions", icon: "Shield" },
      { slug: "system-settings", label: "System Settings", icon: "Settings" },
    ],
  },
];

export function navLabelFor(slug: string): string {
  for (const g of NAV) for (const it of g.items) if (it.slug === slug) return it.label;
  return "Dashboard";
}