export type PriceUnit = "per task" | "per hour" | "per visit";

export interface Service {
  id: string; // slug
  name: string;
  category: string;
  tagline: string;
  description: string;
  includes: string[];
  excludes: string[];
  duration: string;
  price: number; // starting price in ₹
  unit: PriceUnit;
  popular?: boolean;
  slots?: string[]; // selectable durations for hourly services
}

export interface Provider {
  id: string;
  name: string;
  services: string[]; // service slugs
  lat: number;
  lng: number;
  city: string;
  rating: number;
  jobs: number;
  experience: number;
  verified: boolean;
  synthetic?: boolean; // dev-mode filler, never persisted
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeoResult extends GeoPoint {
  label: string; // "Sector 56, Gurugram"
  city: string;
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
}

export type BookingMode = "instant" | "scheduled" | "recurring";

export type BookingStatus = "accepted" | "scheduled" | "in_progress" | "completed" | "cancelled";

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
  status: BookingStatus;
  createdAt: number;
}

/** Buckets shown in My Bookings. */
export type BookingTab = "current" | "upcoming" | "previous";
