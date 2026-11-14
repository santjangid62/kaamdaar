export type PriceUnit = "per task" | "per hour" | "per visit";

export interface Service {
  id: string; // slug
  name: string;
  category: string;
  categoryId?: string;
  subcategoryId?: string;
  nameHi?: string;
  categoryHi?: string;
  tagline: string;
  description: string;
  includes: string[];
  excludes: string[];
  duration: string;
  price: number; // starting price in ₹
  unit: PriceUnit;
  popular?: boolean;
  slots?: string[]; // selectable durations for hourly services
  icon?: string; // icon key chosen in the Admin panel (see lib/service-icons)
  image?: string; // optional cover image URL added in the Admin panel
  /** Set by /api/catalog when a Pro serving this service covers the customer's area. */
  availableInArea?: boolean;
}

export interface ProviderReview {
  author: string;
  rating: number;
  text: string;
}

export interface Provider {
  id: string;
  name: string;
  /** Mobile the Pro signs in with in the Provider app (+91…). */
  phone?: string;
  services: string[]; // service slugs
  lat: number;
  lng: number;
  city: string;
  rating: number;
  jobs: number;
  experience: number;
  verified: boolean;
  policeVerified?: boolean;
  hourlyRate?: number; // ₹/hr shown to the user after accept
  reviewCount?: number;
  reviews?: ProviderReview[];
  synthetic?: boolean; // dev-mode filler, never persisted
}

/** Snapshot of the accepted Pro shown to the user during tracking. */
export interface ProviderProfile {
  id: string;
  name: string;
  rating: number;
  jobs: number;
  experience: number;
  verified: boolean;
  policeVerified: boolean;
  hourlyRate: number;
  reviewCount: number;
  reviews: ProviderReview[];
  distanceKm: number;
}

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface GeoResult extends GeoPoint {
  label: string; // "Sector 56, Gurugram"
  city: string;
  pincode?: string;
}

export interface Address {
  id: string;
  label: string; // Home / Office / ...
  line1: string;
  line2?: string;
  city: string;
  pincode: string;
  lat?: number;
  lng?: number;
  isDefault?: boolean;
}

export interface User {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  email?: string;
  photo?: string; // data URL
  referralCode: string;
  createdAt: number;
  /** account state managed from the Admin dashboard */
  status?: "active" | "blocked" | "deleted";
  role?: "customer" | "provider" | "admin";
  updatedAt?: number;
  /** Signup channel recorded by the server: web or mobile_app. */
  registrationPlatform?: "web" | "mobile_app";
}

export type BookingMode = "instant" | "scheduled" | "recurring";

export type PaymentMethod = "cash" | "upi";

/**
 * Lifecycle of the dispatch flow:
 *   dispatched      → request pushed to every nearby Pro, waiting for an accept
 *   accepted        → a Pro accepted and the user confirmed them
 *   scheduled       → accepted for a future date/time (no live tracking yet)
 *   enroute         → Pro is on the way to the user's live location
 *   arrived         → Pro reached, waiting for the start OTP
 *   in_progress     → work started with the start OTP
 *   pending_confirm → Pro marked "Work Completed", waiting for the user's OTP
 *   completed       → user verified the completion OTP (payment follows)
 *   cancelled       → dropped at any point before work start
 */
export type BookingStatus =
  | "dispatched"
  | "accepted"
  | "scheduled"
  | "enroute"
  | "arrived"
  | "in_progress"
  | "pending_confirm"
  | "completed"
  | "cancelled";

export interface Booking {
  id: string;
  userId: string;
  phone: string;
  serviceId: string;
  serviceName: string;
  providerId: string;
  providerName: string;
  address: Address;
  mode: BookingMode;
  date: string; // yyyy-mm-dd
  slot: string; // human readable time slot
  duration?: string;
  amount: number;
  /** Immutable price/time snapshot of the parent service and selected add-ons. */
  selectedSubServiceIds?: string[];
  serviceItems?: Array<{ id: string; name: string; price: number; durationMinutes: number }>;
  durationMinutes?: number;
  status: BookingStatus;
  createdAt: number;

  /* ---- dispatch flow ---- */
  /** Nearby Pros currently notified; cleared for everyone else on first accept. */
  notifiedIds?: string[];
  /** Radius this request was offered in — 3 km first, 5 km after widening. */
  dispatchRadiusKm?: number;
  dispatchedAt?: number;
  /** Hard expiry for the provider's 40-second dispatch offer. */
  offerExpiresAt?: number;
  acceptedAt?: number;
  /** when the user confirmed the Pro — the ETA animation runs from here */
  enrouteAt?: number;
  arrivedAt?: number;
  startedAt?: number;
  completedAt?: number;
  paidAt?: number;
  paymentMethod?: PaymentMethod;
  /** Transient provider PATCH flag; the API consumes it and does not persist it. */
  paymentReported?: boolean;
  paymentStatus?: "unpaid" | "reported" | "verified" | "disputed";
  paymentReportedAt?: number;
  paymentReportedBy?: string;
  paymentReference?: string;
  paymentVerifiedAt?: number;
  paymentVerifiedBy?: string;
  cancelledAt?: number;
  cancelledBy?: "customer" | "provider" | "admin" | "system";
  cancellationReason?: string;
  /** 10% company commission deducted from the Pro's wallet on payment. */
  commission?: number;
  /** Estimated minutes to reach the user, shown while enroute. */
  etaMinutes?: number;
  /** Accepted Pro's snapshot (rating, verifications, hourly rate, reviews). */
  providerProfile?: ProviderProfile;
  /** 6-digit OTP the Pro must enter to start the work (user only sees it). */
  startOtp?: string;
  /** 6-digit OTP sent to the user after the Pro marks the work completed. */
  completeOtp?: string;
  /** Where the service happens — current location or a saved address. */
  originPoint?: GeoPoint;
  /** Pro's position when it accepted — the map animation starts here. */
  providerPoint?: GeoPoint;
  /**
   * Live GPS position the Pro app reports while travelling to the job. The
   * customer's tracking screen and the admin panel both read this, so every
   * surface shows the same last-known point instead of animating a fake one.
   */
  livePoint?: GeoPoint;
  /** Timestamp of the last live ping (ms). */
  pingAt?: number;
  /** How many position updates this job has received. */
  pingCount?: number;
  /** Set when the Pro taps "Start navigation" in the Provider app. */
  navigationStartedAt?: number;
  /** Append-only audit trail for this job, rendered in the Admin activity log. */
  events?: BookingEvent[];
}

/** Who caused a booking event — used for the coloured actor chip in the log. */
export type BookingActor = "customer" | "provider" | "admin" | "system";

/**
 * One line of the booking timeline. Written server-side on every transition so
 * the Admin log cannot be edited by a client, and so the customer screen can
 * show what actually happened instead of guessing from the current status.
 */
export interface BookingEvent {
  id: string;
  at: number;
  actor: BookingActor;
  /** machine key: created | accepted | declined | enroute | navigation | ping | arrived | started | pending_confirm | completed | cancelled | paid */
  type: string;
  title: string;
  detail?: string;
  status?: BookingStatus;
  lat?: number;
  lng?: number;
}

/** Buckets shown in My Bookings. */
export type BookingTab = "current" | "upcoming" | "previous";
