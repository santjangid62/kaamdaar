/**
 * One-off demo seeder (run: node .seed-demo.js) — fills the JSON store with
 * realistic data so the whole workflow can be tested: providers near the
 * user's location, bookings across every status, wallets, reviews,
 * complaints, payouts, campaigns, banners and FAQs.
 */
const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), ".data", "db.json");
const db = JSON.parse(fs.readFileSync(FILE, "utf8"));

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const center = { lat: 26.974, lng: 75.7603 }; // Vidyadhar Nagar, Jaipur
const uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/* ── providers near the user (within ~2.5 km) ─────────────────── */
const PROVIDERS = [
  { name: "Rakesh Kumar", phone: "+919887001122", off: [0.004, 0.005], services: ["kitchen-cleaning", "bathroom-cleaning", "sweeping-mopping", "hourly-bookings"], rating: 4.8, jobs: 342, exp: 6, rate: 180, wallet: 1200 },
  { name: "Amit Sharma", phone: "+919887002233", off: [-0.006, 0.008], services: ["laundry", "ironing-folding", "wardrobe-cleaning"], rating: 4.7, jobs: 298, exp: 5, rate: 160, wallet: 950 },
  { name: "Sunil Yadav", phone: "+919887003344", off: [0.011, -0.005], services: ["kitchen-prep", "utensils", "fridge-cleaning", "kitchen-cabinet-cleaning"], rating: 4.6, jobs: 276, exp: 4, rate: 170, wallet: 830 },
  { name: "Manoj Meena", phone: "+919887004455", off: [-0.009, -0.012], services: ["dusting-wiping", "window-cleaning", "balcony-cleaning", "fan-cleaning"], rating: 4.6, jobs: 253, exp: 7, rate: 165, wallet: 1500 },
  { name: "Deepak Singh", phone: "+919887005566", off: [0.015, 0.013], services: ["car-surface-cleaning", "packing-unpacking", "plant-care", "hourly-bookings"], rating: 4.5, jobs: 241, exp: 3, rate: 155, wallet: 640 },
  { name: "Pooja Devi", phone: "+919887006677", off: [-0.016, 0.007], services: ["kitchen-cleaning", "utensils", "kitchen-prep", "laundry"], rating: 4.9, jobs: 410, exp: 8, rate: 190, wallet: 2100 },
  { name: "Anil Kumar", phone: "+919887007788", off: [0.008, -0.015], services: ["pre-party-express-clean", "after-party-express-clean", "sweeping-mopping"], rating: 4.4, jobs: 180, exp: 2, rate: 150, wallet: 520 },
  { name: "Sarita Patel", phone: "+919887008899", off: [-0.013, 0.016], services: ["bathroom-cleaning", "dusting-wiping", "hourly-bookings", "plant-care"], rating: 4.7, jobs: 220, exp: 5, rate: 175, wallet: 1000 },
];

db.providers = db.providers || {};
for (const p of PROVIDERS) {
  const id = `pro_${p.name.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  db.providers[id] = {
    id,
    name: p.name,
    phone: p.phone,
    services: p.services,
    lat: Number((center.lat + p.off[0]).toFixed(6)),
    lng: Number((center.lng + p.off[1]).toFixed(6)),
    city: "Jaipur",
    rating: p.rating,
    jobs: p.jobs,
    experience: p.exp,
    verified: true,
    policeVerified: true,
    hourlyRate: p.rate,
    reviewCount: Math.round(p.jobs / 6),
    status: "Online",
    kycStatus: "Verified",
    area: "Jaipur",
    reviews: [
      { author: "Priya S.", rating: 5, text: "On time and did a thorough job. Very satisfied." },
      { author: "Amit G.", rating: 4, text: "Good work, polite and careful with things at home." },
    ],
    createdAt: NOW - 90 * DAY,
    updatedAt: NOW - DAY,
  };
  db.wallets = db.wallets || {};
  db.wallets[id] = { providerId: id, balance: p.wallet, updatedAt: NOW - DAY };
}

// repair the pre-existing provider row (it had lat/lng 0 and a category name)
const old = Object.values(db.providers).find((p) => p.name === "SK Jangid");
if (old) {
  Object.assign(old, {
    lat: center.lat + 0.007,
    lng: center.lng - 0.004,
    city: "Jaipur",
    area: "Jaipur",
    services: ["ser_mvsvwtnq7hva76", "hourly-bookings"],
    status: "Online",
    kycStatus: "Verified",
    verified: true,
    policeVerified: true,
    rating: 4.9,
    jobs: 96,
    experience: 12,
    reviewCount: 18,
    reviews: [{ author: "Neha C.", rating: 5, text: "Excellent teacher, very patient with beginners." }],
  });
  db.wallets = db.wallets || {};
  db.wallets[old.id] = { providerId: old.id, balance: 1800, updatedAt: NOW - DAY };
}

/* ── bookings ─────────────────────────────────────────────────── */
const A = {
  id: "addr_seed_home",
  userId: "+919876543210",
  label: "Home",
  line1: "C-42, Vidyadhar Nagar",
  line2: "Near Jaipur National University",
  city: "Jaipur",
  pincode: "302039",
  lat: center.lat,
  lng: center.lng,
  isDefault: true,
  createdAt: NOW - 5 * DAY,
  updatedAt: NOW - 5 * DAY,
};
db.addresses = db.addresses || {};
db.addresses[A.id] = A;

const prov = (i) => Object.values(db.providers)[i];
const pickAddr = (userId, line, pin) => ({
  id: uid("addr"),
  userId,
  label: "Home",
  line1: line,
  city: "Jaipur",
  pincode: pin,
  lat: center.lat,
  lng: center.lng,
  isDefault: false,
  createdAt: NOW - 10 * DAY,
  updatedAt: NOW - 10 * DAY,
});

function booking(o) {
  const p = o.provider;
  const providerPoint = { lat: p.lat + 0.002, lng: p.lng - 0.003 };
  return {
    id: o.id,
    userId: o.userId,
    phone: o.userId,
    serviceId: o.serviceId,
    serviceName: o.serviceName,
    providerId: p.id,
    providerName: p.name,
    address: o.address,
    mode: o.mode ?? "instant",
    date: o.date,
    slot: o.slot ?? "12:00 PM",
    amount: o.amount,
    status: o.status,
    createdAt: o.createdAt,
    commission: Math.round(o.amount * 0.1),
    updatedAt: o.updatedAt ?? o.createdAt,
    notifiedIds: [],
    dispatchedAt: o.createdAt,
    originPoint: { lat: o.address.lat, lng: o.address.lng },
    providerPoint,
    etaMinutes: 12,
    providerProfile: {
      id: p.id,
      name: p.name,
      rating: p.rating,
      jobs: p.jobs,
      experience: p.experience,
      verified: p.verified,
      policeVerified: p.policeVerified,
      hourlyRate: p.hourlyRate,
      reviewCount: p.reviewCount,
      reviews: p.reviews,
      distanceKm: 1.4,
    },
    ...(o.extra ?? {}),
  };
}

db.bookings = db.bookings || {};
const U1 = "+919876543210"; // logged-in test user
const U2 = "+919829588572";

const seedBookings = [
  // current — Pro on the way
  booking({
    id: "bkg-demo-enroute", userId: U1, provider: prov(0), serviceId: "kitchen-cleaning",
    serviceName: "Kitchen Cleaning", address: A, amount: 349, status: "enroute",
    date: new Date().toISOString().slice(0, 10), createdAt: NOW - 12 * 60 * 1000,
    extra: { acceptedAt: NOW - 9 * 60 * 1000, enrouteAt: NOW - 6 * 60 * 1000, startOtp: "482913", etaMinutes: 9 },
  }),
  // current — waiting for a provider to accept
  booking({
    id: "bkg-demo-searching", userId: U1, provider: prov(5), serviceId: "laundry",
    serviceName: "Laundry", address: A, amount: 249, status: "dispatched",
    date: new Date().toISOString().slice(0, 10), createdAt: NOW - 3 * 60 * 1000,
    extra: { providerId: "", providerName: "", providerProfile: undefined },
  }),
  // upcoming — scheduled for tomorrow
  booking({
    id: "bkg-demo-scheduled", userId: U1, provider: prov(3), serviceId: "bathroom-cleaning",
    serviceName: "Bathroom Cleaning", address: A, amount: 249, status: "scheduled",
    mode: "scheduled", date: new Date(NOW + DAY).toISOString().slice(0, 10), slot: "04:00 PM",
    createdAt: NOW - 2 * DAY, extra: { acceptedAt: NOW - 2 * DAY },
  }),
  // previous — completed & paid via UPI
  booking({
    id: "bkg-demo-done-1", userId: U1, provider: prov(1), serviceId: "laundry",
    serviceName: "Laundry", address: A, amount: 349, status: "completed",
    date: new Date(NOW - 4 * DAY).toISOString().slice(0, 10), createdAt: NOW - 4 * DAY,
    extra: {
      acceptedAt: NOW - 4 * DAY, enrouteAt: NOW - 4 * DAY + 600000,
      arrivedAt: NOW - 4 * DAY + 1500000, startedAt: NOW - 4 * DAY + 1560000,
      completedAt: NOW - 4 * DAY + 3300000, paidAt: NOW - 4 * DAY + 3360000,
      startOtp: "119922", completeOtp: "556677", paymentMethod: "upi",
    },
  }),
  // previous — completed & paid in cash
  booking({
    id: "bkg-demo-done-2", userId: U1, provider: prov(4), serviceId: "sweeping-mopping",
    serviceName: "Sweeping & Mopping", address: A, amount: 219, status: "completed",
    date: new Date(NOW - 11 * DAY).toISOString().slice(0, 10), createdAt: NOW - 11 * DAY,
    extra: {
      acceptedAt: NOW - 11 * DAY, completedAt: NOW - 11 * DAY + 4000000,
      paidAt: NOW - 11 * DAY + 4100000, completeOtp: "998877",
      paymentMethod: "cash",
    },
  }),
  // previous — cancelled
  booking({
    id: "bkg-demo-cancelled", userId: U1, provider: prov(6), serviceId: "fan-cleaning",
    serviceName: "Fan Cleaning", address: pickAddr(U1, "Sector 10, Vidyadhar Nagar", "302016"),
    amount: 129, status: "cancelled", date: new Date(NOW - 7 * DAY).toISOString().slice(0, 10),
    createdAt: NOW - 7 * DAY, extra: { cancelledAt: NOW - 7 * DAY + 900000 },
  }),
  // second user — one live, one previous
  booking({
    id: "bkg-demo-u2-live", userId: U2, provider: prov(2), serviceId: "kitchen-prep",
    serviceName: "Kitchen Prep",
    address: pickAddr(U2, "174B, Murlipura Scheme, Jaipur", "302039"),
    amount: 199, status: "arrived", date: new Date().toISOString().slice(0, 10),
    createdAt: NOW - 25 * 60 * 1000,
    extra: { acceptedAt: NOW - 20 * 60 * 1000, enrouteAt: NOW - 18 * 60 * 1000, arrivedAt: NOW - 2 * 60 * 1000, startOtp: "665544", etaMinutes: 3 },
  }),
  booking({
    id: "bkg-demo-u2-done", userId: U2, provider: prov(7), serviceId: "hourly-bookings",
    serviceName: "Hourly Bookings",
    address: pickAddr(U2, "174B, Murlipura Scheme, Jaipur", "302039"),
    amount: 299, status: "completed", date: new Date(NOW - 9 * DAY).toISOString().slice(0, 10),
    createdAt: NOW - 9 * DAY,
    extra: { completedAt: NOW - 9 * DAY + 3600000, paidAt: NOW - 9 * DAY + 3660000, paymentMethod: "cash", completeOtp: "334455" },
  }),
];
for (const b of seedBookings) db.bookings[b.id] = b;

/* ── wallet transactions ──────────────────────────────────────── */
db.walletTxns = db.walletTxns || {};
const txns = [
  { providerId: prov(0).id, kind: "commission", amount: -35, balanceAfter: 1165, note: "Kitchen Cleaning", at: NOW - 4 * DAY },
  { providerId: prov(0).id, kind: "recharge", amount: 1000, balanceAfter: 1200, note: "Wallet recharge", at: NOW - 6 * DAY },
  { providerId: prov(1).id, kind: "commission", amount: -35, balanceAfter: 915, note: "Laundry", at: NOW - 4 * DAY },
  { providerId: prov(5).id, kind: "commission", amount: -41, balanceAfter: 2059, note: "Kitchen Cleaning", at: NOW - 6 * DAY },
  { providerId: prov(3).id, kind: "recharge", amount: 500, balanceAfter: 1500, note: "Wallet recharge", at: NOW - 8 * DAY },
];
txns.forEach((t) => {
  const id = uid("tx");
  db.walletTxns[id] = {
    id, providerId: t.providerId, kind: t.kind, amount: t.amount,
    balanceAfter: t.balanceAfter, note: t.note, createdAt: t.at, updatedAt: t.at,
  };
});

/* ── reviews ──────────────────────────────────────────────────── */
db.reviews = db.reviews || {};
[
  { author: "Priya Sharma", service: "Kitchen Cleaning", rating: 5, text: "Very professional service. Arrived on time and did a great job.", at: NOW - 2 * DAY },
  { author: "Rajesh Kumar", service: "Plumbing", rating: 4.5, text: "Quick response and good quality work.", at: NOW - 5 * DAY },
  { author: "Neha Verma", service: "Home Cleaning", rating: 5, text: "Wonderful cleaning — the kitchen looks brand new.", at: NOW - 8 * DAY },
  { author: "Sanjay Patel", service: "Electrical", rating: 4.5, text: "Fixed the issue quickly. Good service.", at: NOW - 12 * DAY },
  { author: "Anita Singh", service: "Laundry", rating: 4, text: "Good experience, clothes were ironed and packed neatly.", at: NOW - 15 * DAY },
].forEach((r) => {
  const id = uid("rev");
  db.reviews[id] = { id, ...r, createdAt: r.at, updatedAt: r.at };
});

/* ── complaints ───────────────────────────────────────────────── */
db.complaints = db.complaints || {};
[
  { customer: "Amit Verma", provider: "Anil Kumar", issue: "Provider arrived 40 minutes late without calling.", booking: "bkg-demo-cancelled", status: "Open" },
  { customer: "Sneha Gupta", provider: "Deepak Singh", issue: "Requested a re-clean — one window was missed.", booking: "bkg-demo-done-2", status: "Escalated" },
].forEach((c, i) => {
  const id = `TCK-${1001 + i}`;
  db.complaints[id] = { id, ...c, createdAt: NOW - (i + 1) * 2 * DAY, updatedAt: NOW - (i + 1) * 2 * DAY };
});

/* ── payouts ──────────────────────────────────────────────────── */
db.payouts = db.payouts || {};
[
  { provider: "Rakesh Kumar", jobs: 42, amount: 8500, mode: "UPI", status: "Paid", date: "28 Oct 2026" },
  { provider: "Pooja Devi", jobs: 55, amount: 11200, mode: "Bank", status: "Processing", date: "29 Oct 2026" },
  { provider: "Sunil Yadav", jobs: 31, amount: 6400, mode: "UPI", status: "Paid", date: "25 Oct 2026" },
].forEach((p, i) => {
  const id = uid("pay");
  db.payouts[id] = { id, ...p, createdAt: NOW - (i + 1) * DAY, updatedAt: NOW - (i + 1) * DAY };
});

/* ── campaigns / banners / faqs ───────────────────────────────── */
db.campaigns = db.campaigns || {};
[
  { title: "Monsoon deep-clean offer — 20% off", audience: "All users", channel: "Push", status: "Sent", sentAt: "27 Oct 2026, 10:00 AM" },
  { title: "New: Hourly Bookings in your area", audience: "Jaipur users", channel: "SMS", status: "Sent", sentAt: "26 Oct 2026, 06:30 PM" },
  { title: "Refer a friend, earn ₹100", audience: "All users", channel: "In-app", status: "Draft", sentAt: "" },
].forEach((c, i) => {
  const id = uid("cmp");
  db.campaigns[id] = { id, ...c, createdAt: NOW - i * DAY, updatedAt: NOW - i * DAY };
});

db.banners = db.banners || {};
[
  { title: "Festive Cleanathon", placement: "Home hero", status: "Active", clicks: 1284 },
  { title: "First booking flat ₹100 off", placement: "Services top", status: "Scheduled", clicks: 0 },
].forEach((b, i) => {
  const id = uid("ban");
  db.banners[id] = { id, ...b, createdAt: NOW - i * DAY, updatedAt: NOW - i * DAY };
});

db.faqs = db.faqs || {};
[
  { q: "Payment kaise karein?", answer: "Service complete hone ke baad aap cash ya UPI se seedha provider ko de sakte hain. Online pre-payment ki zarurat nahi hai.", category: "Payment", status: "Published", votes: 42 },
  { q: "Provider kitne time me pahunchta hai?", answer: "Aam taur par aapke area ke 2–3 km ke provider 15–30 minute me pahunch jaate hain. Accept hone ke baad live tracking aur ETA dikhta hai.", category: "Booking", status: "Published", votes: 31 },
  { q: "Booking cancel kar sakte hain?", answer: "Haan — work start hone se pehle kisi bhi waqt cancel kar sakte hain, koi charge nahi lagta.", category: "Booking", status: "Published", votes: 18 },
  { q: "Provider verified hai kaise?", answer: "Har provider ki KYC aur police verification hoti hai; profile par verified badge dikhta hai.", category: "Safety", status: "Published", votes: 27 },
  { q: "OTP kis kaam ka hai?", answer: "Kaam shuru karne se pehle provider aapka start OTP maangta hai, aur complete hone par aapko completion OTP milta hai — isi se confirm hota hai ki kaam sach me hua.", category: "Booking", status: "Published", votes: 15 },
  { q: "Refer & Earn kaise kaam karta hai?", answer: "Apna referral code dosto ke saath share karein — unki pehli booking ke baad aapke wallet me cashback aayega.", category: "Offers", status: "Draft", votes: 9 },
].forEach((f, i) => {
  const id = uid("faq");
  db.faqs[id] = { id, ...f, createdAt: NOW - i * DAY, updatedAt: NOW - i * DAY };
});

fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
console.log(
  "seeded →",
  "providers:", Object.keys(db.providers).length,
  "| bookings:", Object.keys(db.bookings).length,
  "| wallets:", Object.keys(db.wallets || {}).length,
  "| reviews:", Object.keys(db.reviews).length,
  "| complaints:", Object.keys(db.complaints).length,
  "| payouts:", Object.keys(db.payouts).length,
  "| campaigns:", Object.keys(db.campaigns).length,
  "| banners:", Object.keys(db.banners).length,
  "| faqs:", Object.keys(db.faqs).length,
);
