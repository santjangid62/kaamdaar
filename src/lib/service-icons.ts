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
  Package,
  PartyPopper,
  Refrigerator,
  Shirt,
  Sparkles,
  SprayCan,
  Sprout,
  Utensils,
  Wind,
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