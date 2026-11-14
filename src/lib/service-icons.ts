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
  Baby,
  Camera,
  FileText,
  Flower2,
  Gem,
  GraduationCap,
  Music2,
  Scissors,
  Tv,
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
  "hair-styling": Scissors,
  "beauty-services": Sparkles,
  "baby-care": Baby,
  "child-care": Baby,
  "tutoring": GraduationCap,
  "document-services": FileText,
  "tv-repair": Tv,
  "cctv-installation": Camera,
  "puja-services": Flower2,
  "jewellery-repair": Gem,
  "music-classes": Music2,
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
  scissors: Scissors,
  baby: Baby,
  camera: Camera,
  tv: Tv,
  file: FileText,
  flower: Flower2,
  gem: Gem,
  graduation: GraduationCap,
  music: Music2,
  chefhat: ChefHat,
  droplets: Droplets,
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

/** Pick a stable Lucide icon key from the service name/category for imported catalogue rows. */
export function categoryIconKey(name: string, category = ""): string {
  const value = `${category} ${name}`.toLowerCase();
  if (/hair|salon|beaut|makeup|spa|mehndi|bridal|groom/.test(value)) return "scissors";
  if (/cook|chef|kitchen|food|utensil|tiffin/.test(value)) return "chefhat";
  if (/water|ro |purifier|filter|plumb|bathroom|tap/.test(value)) return "droplets";
  if (/electric|wiring|fan|ac |air condition|appliance/.test(value)) return "plug";
  if (/tv|television|led|electronics|refrigerator|fridge/.test(value)) return "tv";
  if (/car|vehicle|bike|auto|rickshaw|mechanic/.test(value)) return "car";
  if (/clean|sweep|mop|dust|pest|sanit/.test(value)) return "broom";
  if (/laundry|iron|cloth|wash|dry clean/.test(value)) return "shirt";
  if (/paint|painter|wall/.test(value)) return "paint";
  if (/carpent|furniture|wood|welder|weld|fabricat/.test(value)) return "hammer";
  if (/baby|nanny|child|caregiver/.test(value)) return "baby";
  if (/tutor|teacher|education|coach|class|training/.test(value)) return "graduation";
  if (/csc|online form|document|form filling|cyber|computer/.test(value)) return "file";
  if (/puja|ritual|priest|flower|decoration/.test(value)) return "flower";
  if (/cctv|camera|security|surveillance|lock/.test(value)) return "camera";
  if (/jewel|goldsmith|gold|silver|ornament/.test(value)) return "gem";
  if (/dance|music|sing|dj|instrument/.test(value)) return "music";
  if (/plant|garden|lawn|gardener/.test(value)) return "sprout";
  if (/pack|move|shift|delivery/.test(value)) return "package";
  if (/kitchen/.test(category.toLowerCase())) return "chefhat";
  if (/laundry/.test(category.toLowerCase())) return "shirt";
  if (/clean/.test(category.toLowerCase())) return "broom";
  return "wrench";
}
