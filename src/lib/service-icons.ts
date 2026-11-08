import {
  AppWindow,
  Archive,
  Boxes,
  Broom,
  Car,
  ChefHat,
  Clock,
  Droplets,
  Fan,
  Feather,
  Fence,
  Hammer,
  Package,
  PartyPopper,
  Plug,
  Refrigerator,
  Shirt,
  Sparkles,
  SprayCan,
  Sprout,
  Wrench,
  PaintRoller,
  AirVent,
  Utensils,
  Wind,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";

/** Attractive per-service icon used on the services page cards. */
export const SERVICE_ICONS: Record<string, LucideIcon> = {
  "hourly-bookings": Clock,
  "kitchen-cleaning": SprayCan,
  "kitchen-prep": ChefHat,
  utensils: Utensils,
  "bathroom-cleaning": Droplets,
  "sweeping-mopping": Sparkles,
  "dusting-wiping": Feather,
  "window-cleaning": AppWindow,
  "balcony-cleaning": Fence,
  "fan-cleaning": Fan,
  laundry: Shirt,
  "ironing-folding": Wind,
  "wardrobe-cleaning": Archive,
  "fridge-cleaning": Refrigerator,
  "kitchen-cabinet-cleaning": Boxes,
  "car-surface-cleaning": Car,
  "pre-party-express-clean": PartyPopper,
  "after-party-express-clean": Broom,
  "packing-unpacking": Package,
  "plant-care": Sprout,
};

/**
 * Icon picker for the Admin panel — every service can name its own icon here
 * (the "Icon" dropdown in Services). Keys are stored on the service row and
 * resolved on the customer site through `resolveIcon`.
 */
export const ICONS: Record<string, LucideIcon> = {
  ...SERVICE_ICONS,
  clock: Clock,
  hammer: Hammer,
  wrench: Wrench,
  plug: Plug,
  paint: PaintRoller,
  airvent: AirVent,
  car: Car,
  package: Package,
  sprout: Sprout,
  feather: Feather,
  party: PartyPopper,
  broom: Broom,
  grid: AppWindow,
  star: Sparkles,
};

/** Values shown in the Admin “Icon” dropdown. */
export const ICON_NAMES = Object.keys(ICONS).sort();

/**
 * Icon lookup rule used at every call site:
 *   (service.icon ? ICONS[service.icon] : undefined) ?? SERVICE_ICONS[service.id] ?? LayoutGrid
 * Kept as plain object reads (no factory call) so react-hooks/static-components
 * sees stable component identities during render.
 */
export const FALLBACK_ICON = LayoutGrid;

/** Brand-palette gradient for the icon tile, chosen by category. */
export function serviceTone(category: string): string {
  switch (category) {
    case "Kitchen":
      return "from-flame to-flame-600";
    case "Cleaning":
      return "from-blue-500 to-blue-700";
    case "Laundry":
      return "from-blue-400 to-blue-600";
    case "Appliances":
      return "from-blue-600 to-navy-700";
    case "Special":
      return "from-navy-700 to-navy-800";
    default:
      // Flexible Help and anything new
      return "from-flame-400 to-flame-600";
  }
}