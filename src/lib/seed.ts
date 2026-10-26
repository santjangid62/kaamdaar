import type { Provider, Service } from "./types";
import { CITY_CLUSTERS } from "./geo";

/**
 * Backend catalogue. In production these rows live in Firestore
 * (`services`, `providers`) and are managed from the Admin dashboard.
 * This file is the seed the admin panel starts from.
 */
export const SERVICES: Service[] = [
  {
    id: "hourly-bookings",
    name: "Hourly Bookings",
    category: "Flexible Help",
    tagline: "A trained Pro for whatever is pending at home",
    description:
      "Combine chores in a single visit — cleaning, laundry, kitchen prep or tidying up. Pick a duration and the Pro handles the list you give them.",
    includes: ["Choice of 30 min to 3 hours", "Multiple chores in one visit", "Supplies carried by Pro"],
    excludes: ["Cooking full meals", "Painting and carpentry", "Pet grooming"],
    duration: "30 min – 3 hrs",
    price: 149,
    unit: "per hour",
    popular: true,
    slots: ["30 minutes", "1 hour", "1.5 hours", "2 hours", "3 hours"],
  },
  {
    id: "kitchen-cleaning",
    name: "Kitchen Cleaning",
    category: "Cleaning",
    tagline: "Counters, sink, hob and tiles, degreased properly",
    description:
      "A surface-level deep clean of the kitchen: platform, sink, hob exterior, chimney filter face, backsplash tiles and floor.",
    includes: ["Platform and sink", "Hob and chimney exterior", "Tiles and floor", "Cabinet fronts"],
    excludes: ["Inside oven / dishwasher", "Grease from inside chimney motor", "Shifting heavy appliances"],
    duration: "60–90 min",
    price: 349,
    unit: "per task",
    popular: true,
  },
  {
    id: "kitchen-prep",
    name: "Kitchen Prep",
    category: "Kitchen",
    tagline: "Vegetables washed, peeled and chopped",
    description:
      "Pro washes, peels and chops your vegetables and prepares ingredients so cooking is quick when you get home.",
    includes: ["Washing and peeling", "Chopping as instructed", "Ingredient storage in containers"],
    excludes: ["Cooking the meal", "Grinding masalas", "Cleaning up after cooking"],
    duration: "45–60 min",
    price: 199,
    unit: "per task",
    popular: true,
  },
  {
    id: "utensils",
    name: "Utensils",
    category: "Kitchen",
    tagline: "Every vessel washed, dried and stacked",
    description: "Wash, rinse, dry and stack utensils from the sink or after a meal.",
    includes: ["Wash and rinse", "Drying and stacking", "Sink cleaned after"],
    excludes: ["Cleaning burnt utensils with chemicals", "Dishwasher loading", "Organising the whole kitchen"],
    duration: "30–45 min",
    price: 149,
    unit: "per task",
  },
  {
    id: "bathroom-cleaning",
    name: "Bathroom Cleaning",
    category: "Cleaning",
    tagline: "Toilet, basin, tiles and floor sanitised",
    description:
      "Complete bathroom clean — toilet seat and basin sanitised, fixtures wiped, visible tiles and floor mopped.",
    includes: ["Toilet and seat sanitised", "Basin and fixtures", "Visible tiles and floor"],
    excludes: ["Heavy mould or hard-water stain removal", "Grout scrubbing", "Plumbing repairs"],
    duration: "45–60 min",
    price: 249,
    unit: "per task",
    popular: true,
  },
  {
    id: "sweeping-mopping",
    name: "Sweeping & Mopping",
    category: "Cleaning",
    tagline: "All floors swept and mopped",
    description: "Dry sweep followed by damp mop across rooms, hall and kitchen floor.",
    includes: ["All rooms swept", "Damp mopping", "Skirting wiped"],
    excludes: ["Shifting furniture", "Carpet shampooing", "Scrubbing stubborn stains"],
    duration: "40–70 min",
    price: 219,
    unit: "per task",
    popular: true,
  },
  {
    id: "dusting-wiping",
    name: "Dusting & Wiping",
    category: "Cleaning",
    tagline: "Every reachable surface, dust free",
    description: "Dry dusting of furniture, shelves, switchboards, frames and ledges.",
    includes: ["Furniture and shelves", "Frames and ledges", "Switchboards and fans (reachable)"],
    excludes: ["Ceiling and high-reach areas needing ladders", "Curtain removal", "Wall washing"],
    duration: "40–60 min",
    price: 219,
    unit: "per task",
  },
  {
    id: "window-cleaning",
    name: "Window Cleaning",
    category: "Cleaning",
    tagline: "Glass and grilles done inside out",
    description: "Interior glass, grilles and sills cleaned; exterior only where safely reachable.",
    includes: ["Interior glass panes", "Grilles and sills", "Frames wiped"],
    excludes: ["High-rise exterior glass", "Rope-access cleaning", "Removing curtains"],
    duration: "45–75 min",
    price: 299,
    unit: "per task",
  },
  {
    id: "balcony-cleaning",
    name: "Balcony Cleaning",
    category: "Cleaning",
    tagline: "Floor, railing and corners cleared",
    description: "Sweep, mop and scrub the balcony floor, wipe railing and clear cobwebs.",
    includes: ["Floor scrubbing", "Railing wiping", "Corner cobweb removal"],
    excludes: ["Drainage repair", "Painting touch-ups", "Plant shifting"],
    duration: "30–45 min",
    price: 199,
    unit: "per task",
  },
  {
    id: "fan-cleaning",
    name: "Fan Cleaning",
    category: "Cleaning",
    tagline: "Fans dusted and wiped blades",
    description: "Ceiling and table fans wiped blade by blade with a dry cloth.",
    includes: ["Ceiling fans", "Table and pedestal fans", "Visible wiring covers"],
    excludes: ["Fan servicing or motor repair", "High ceilings needing tall ladders", "Exhaust fans with dismantling"],
    duration: "20–40 min",
    price: 129,
    unit: "per task",
  },
  {
    id: "laundry",
    name: "Laundry",
    category: "Laundry",
    tagline: "Washed, dried and folded",
    description: "Coloureds and whites sorted, machine washed as per fabric and hung to dry.",
    includes: ["Sorting and washing", "Hanging to dry", "Folded clothes returned on next visit"],
    excludes: ["Dry cleaning", "Stain treatment with harsh chemicals", "Ironing"],
    duration: "45–60 min",
    price: 249,
    unit: "per visit",
    popular: true,
  },
  {
    id: "ironing-folding",
    name: "Ironing & Folding",
    category: "Laundry",
    tagline: "Crease-free clothes, stacked by category",
    description: "Ironing of everyday clothes and folding into neat stacks.",
    includes: ["Shirts, trousers, kurtas", "Dresses and tops", "Stacking and counting"],
    excludes: ["Delicate silks and lehengas", "Saree pleating", "Alterations"],
    duration: "45–90 min",
    price: 199,
    unit: "per visit",
  },
  {
    id: "wardrobe-cleaning",
    name: "Complete Wardrobe Cleaning",
    category: "Laundry",
    tagline: "Shelves, drawers and everything inside",
    description: "Emptying, wiping and re-organising wardrobes shelf by shelf.",
    includes: ["Shelves and drawers wiped", "Re-organising by category", "Dusting inside and out"],
    excludes: ["Throwing away belongings", "Carpentry fixes", "Storage boxes"],
    duration: "60–120 min",
    price: 449,
    unit: "per task",
  },
  {
    id: "fridge-cleaning",
    name: "Fridge Cleaning",
    category: "Appliances",
    tagline: "Inside-out clean, shelves scrubbed",
    description: "Everything taken out, shelves and trays washed, interiors wiped and items restacked.",
    includes: ["Shelves and trays", "Interior walls and gasket", "Exterior and handle"],
    excludes: ["Gas or cooling repair", "Defrosting frozen ice panels", "Discarding food"],
    duration: "45–60 min",
    price: 299,
    unit: "per task",
    popular: true,
  },
  {
    id: "kitchen-cabinet-cleaning",
    name: "Kitchen Cabinet Cleaning",
    category: "Appliances",
    tagline: "Inside and outside of every cabinet",
    description: "Cabinet fronts degreased and interiors wiped with items neatly placed back.",
    includes: ["Fronts and handles", "Interior shelves", "Countertop return"],
    excludes: ["Termite or wood treatment", "Replacing liners", "Dismantling cabinetry"],
    duration: "60–90 min",
    price: 349,
    unit: "per task",
  },
  {
    id: "car-surface-cleaning",
    name: "Car Surface Cleaning",
    category: "Special",
    tagline: "Dusting and wiping, inside and out",
    description: "Exterior dust-off and wipe-down plus interior vacuuming of seats and mats.",
    includes: ["Exterior wipe-down", "Interior vacuum", "Dashboard and door trims"],
    excludes: ["Teflon / wax coating", "Seat shampooing", "Engine bay cleaning"],
    duration: "45–60 min",
    price: 399,
    unit: "per task",
  },
  {
    id: "pre-party-express-clean",
    name: "Pre-Party Express Clean",
    category: "Special",
    tagline: "Home guest-ready in a hurry",
    description:
      "Express clean before guests arrive — living areas, bathroom, floor and quick kitchen tidy in one visit.",
    includes: ["Living and dining area", "Guest bathroom", "Floor and surface dusting", "Kitchen quick tidy"],
    excludes: ["Deep cleaning of every room", "Laundry", "Decor setup"],
    duration: "90–120 min",
    price: 649,
    unit: "per task",
  },
  {
    id: "after-party-express-clean",
    name: "After-Party Express Clean",
    category: "Special",
    tagline: "Everything cleared by morning",
    description: "Dishes, floors, trash and surfaces restored after a party.",
    includes: ["Utensils washed", "Floor mopping", "Trash cleared", "Surface wiping"],
    excludes: ["Deep kitchen degreasing", "Carpet stain removal", "Furniture shifting"],
    duration: "90–120 min",
    price: 649,
    unit: "per task",
  },
  {
    id: "packing-unpacking",
    name: "Packing or Unpacking",
    category: "Flexible Help",
    tagline: "Move-in and move-out made easy",
    description: "Systematic packing of household items into labelled cartons, or unpacking and arranging at the new home.",
    includes: ["Labelled cartons", "Fragile wrapping", "Unpacking and arranging"],
    excludes: ["Transportation", "Disassembling furniture", "Storage rental"],
    duration: "2–4 hrs",
    price: 499,
    unit: "per hour",
  },
  {
    id: "plant-care",
    name: "Plant Care",
    category: "Special",
    tagline: "Watering, wiping and pruning",
    description: "Watering, leaf wiping, light pruning and terrace plant tidying while you are away.",
    includes: ["Watering schedule", "Leaf cleaning", "Light pruning"],
    excludes: ["Re-potting soil replacement", "Pest control chemicals", "Buying new plants"],
    duration: "30–45 min",
    price: 179,
    unit: "per task",
  },
];

export function getService(id: string): Service | undefined {
  return SERVICES.find((s) => s.id === id);
}

export const SERVICE_CATEGORIES = Array.from(new Set(SERVICES.map((s) => s.category)));

/** Fixed offsets (~0.4–2.5 km) used to spread a city's providers around its centre. */
const OFFSETS: Array<[number, number]> = [
  [0.004, 0.005],
  [-0.006, 0.009],
  [0.012, -0.004],
  [-0.01, -0.011],
  [0.018, 0.014],
  [-0.017, 0.006],
  [0.008, 0.021],
  [-0.003, -0.019],
  [0.022, -0.012],
  [-0.021, 0.017],
  [0.015, 0.024],
  [-0.024, -0.008],
];

const FIRST_NAMES = [
  "Ravi", "Sunita", "Amit", "Pooja", "Suresh", "Kavita", "Manoj", "Deepa",
  "Anil", "Farida", "Vikram", "Anita", "Rajesh", "Meena", "Tarun", "Sarita",
  "Imran", "Rekha", "Sanjay", "Geeta", "Nitin", "Shabnam", "Rahul", "Latha",
];

const LAST_NAMES = [
  "Kumar", "Sharma", "Singh", "Yadav", "Patel", "Verma", "Rao", "Nair",
  "Das", "Gupta", "Khan", "Mehta", "Joshi", "Pillai", "Reddy", "Chauhan",
];

function buildProviders(): Provider[] {
  const list: Provider[] = [];
  CITY_CLUSTERS.forEach((city, ci) => {
    for (let i = 0; i < OFFSETS.length; i++) {
      const [dLat, dLng] = OFFSETS[i];
      const name = `${FIRST_NAMES[(ci * OFFSETS.length + i) % FIRST_NAMES.length]} ${
        LAST_NAMES[(ci * 5 + i * 3) % LAST_NAMES.length]
      }`;
      // rotate a 7-slug window through the catalogue so every service is covered
      const start = (ci * 3 + i * 7) % SERVICES.length;
      const services = Array.from({ length: 7 }, (_, k) => SERVICES[(start + k) % SERVICES.length].id);
      list.push({
        id: `pr-${ci + 1}-${i + 1}`,
        name,
        services: Array.from(new Set(services)),
        lat: city.lat + dLat,
        lng: city.lng + dLng,
        city: city.name,
        rating: Number((4.2 + ((i * 7 + ci) % 8) / 10).toFixed(1)),
        jobs: 120 + ((i * 137 + ci * 41) % 1800),
        experience: 1 + ((i + ci) % 8),
        verified: true,
      });
    }
  });
  return list;
}

export const PROVIDERS: Provider[] = buildProviders();

export const CITIES = CITY_CLUSTERS.map((c) => c.name);