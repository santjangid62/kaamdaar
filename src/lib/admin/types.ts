/** Shared admin panel types — client-safe (no server imports). */
import type { Collection } from "../../server/db";

export interface Column {
  key: string;
  label: string;
  align?: "right";
}

export type FieldOption = string | { value: string; label: string };

export interface Field {
  key: string;
  label: string;
  type?: "text" | "number" | "select" | "textarea" | "toggle" | "list";
  options?: FieldOption[];
  readonly?: boolean;
  /** hint shown under the input — tells the admin what to enter */
  help?: string;
  /** blocks saving while the value is empty */
  required?: boolean;
  /** value pre-filled when adding a new row */
  default?: string;
  /** render across the full modal width */
  full?: boolean;
}

export interface SectionDef {
  title: string;
  description: string;
  columns: Column[];
  rows: Array<Record<string, string | number>>;
  kpis?: Array<{ label: string; value: string }>;
  /** collection that Add/Edit/Delete write to (absent = derived / read-only) */
  collection?: Collection;
  fields?: Field[];
  readOnly?: boolean;
  /** hide the Add button (editable rows only — e.g. Pricing edits prices) */
  noAdd?: boolean;
  /** hide the delete action (derived rows whose delete would be wrong) */
  noDelete?: boolean;
}

/* dashboard widget row shapes */
export type Row = Record<string, string | number>;

export interface Metric {
  key: string;
  label: string;
  value: string;
  delta: string;
  deltaUp: boolean;
  note: string;
}

export interface LiveRow {
  id: string;
  customer: string;
  service: string;
  location: string;
  status: string;
  statusTone: string;
  amount?: string;
  time: string;
}

export interface CategorySlice {
  name: string;
  pct: number;
  count: number;
  color: string;
}

export interface AreaRow {
  name: string;
  bookings: number;
  x: number;
  y: number;
}

export interface ReviewRow {
  name: string;
  service: string;
  score: number;
  text: string;
}

export interface ProviderRow {
  rank: number;
  name: string;
  bookings: number;
  rating: number;
  revenue: number;
}

/** Today's ops numbers — counts are "right now", revenue is today only. */
export interface TodayStats {
  key: string;
  total: number;
  running: number;
  pending: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  revenue: string;
}

/** Which services are being booked in an area, and how many Pros worked it. */
export interface AreaServiceRow {
  area: string;
  city: string;
  bookings: number;
  providers: number;
  services: Array<{ name: string; count: number }>;
}

/** Which services a Pro has actually delivered. */
export interface ProviderServiceRow {
  id: string;
  name: string;
  jobs: number;
  rating: number;
  services: Array<{ name: string; count: number }>;
}

/** A Pro who is on the road to (or on) a job right now. */
export interface TrackingRow {
  /** short human code, e.g. BKG-XT3QL */
  code: string;
  bookingId: string;
  provider: string;
  providerId: string;
  service: string;
  customer: string;
  area: string;
  status: string;
  tone: string;
  /** straight-line km from the last ping to the customer */
  distanceKm: number | null;
  /** "12 s ago" once the Pro app reports a position */
  pingAge: string;
  hasGps: boolean;
  navigation: string | null;
  arrived: string | null;
  started: string | null;
  point: { lat: number; lng: number } | null;
  destination: { lat: number; lng: number } | null;
}

/** One line of the audit trail shown in the Admin activity log. */
export interface ActivityRow {
  id: string;
  at: number;
  time: string;
  actor: "customer" | "provider" | "admin" | "system";
  type: string;
  title: string;
  detail: string;
  status: string;
  tone: string;
  booking: string;
  service: string;
  provider: string;
  customer: string;
}

export interface Overview {
  metrics: { cards: Metric[]; revenue: string; revenueDelta: string; commission: string };
  bookingsSeries: { labels: string[]; total: number[]; completed: number[]; cancelled: number[] };
  revenueSeries: { labels: string[]; commission: number[]; payout: number[] };
  live: LiveRow[];
  categories: { slices: CategorySlice[]; total: number };
  topServices: Array<{ name: string; bookings: number; revenue: number }>;
  areas: AreaRow[];
  reviews: ReviewRow[];
  topProviders: ProviderRow[];
  latest: Array<Record<string, string | number>>;
  systemStatus: Array<{ name: string; uptime: string }>;
  /** ops view: right now, today, waiting, upcoming */
  today: TodayStats;
  running: Array<Record<string, string | number>>;
  pending: Array<Record<string, string | number>>;
  upcoming: Array<Record<string, string | number>>;
  todayBookings: Array<Record<string, string | number>>;
  areaServices: AreaServiceRow[];
  providerServices: ProviderServiceRow[];
  /** live Pro positions for the map + tracking table */
  tracking: TrackingRow[];
  /** newest-first audit trail across every booking */
  activity: ActivityRow[];
}