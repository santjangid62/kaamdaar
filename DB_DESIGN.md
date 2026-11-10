# Kaamdaar — Database Design

Every record the product writes lives in one database with 18 collections.
The frontend never touches storage directly: the browser calls `/api/*`,
API routes run the repository functions in [`src/server/db.ts`](src/server/db.ts),
and the Admin dashboard reads and writes through the same routes.

```
Browser (customer site / admin panel)
        │  fetch /api/…
        ▼
Next.js API routes (src/app/api/**)      ← validation, auth, business rules
        │  all() get() insert() patch() remove()
        ▼
Repository (src/server/db.ts)            ← single swap-point for Firestore / D1
        │
        ▼
.data/db.json  (file store, git-ignored; one JSON object per collection)
```

**Storage engine today:** a serialized JSON file (`.data/db.json`) so the whole
product runs with zero external services. The repository API is deliberately
tiny — moving to Firestore or Cloudflare D1 means reimplementing six functions
(`all / get / insert / patch / upsert / remove`) in `src/server/db.ts`;
no API route, store client or admin page changes.

---

## Collections

### `users` — anyone who completes phone-OTP login
| field | type | notes |
|---|---|---|
| id | string | the phone number, e.g. `+919876543210` (login key) |
| registrationPlatform | `web \| mobile_app` | first successful registration source |
| phone | string | same as id, kept explicit |
| firstName, lastName | string | filled on the profile page (validated: letters only) |
| email | string? | optional, format-checked when present |
| photo | string? | data URL of the profile picture |
| referralCode | string | generated at signup (`KDM` + phone tail) |
| role | `"customer" \| "provider" \| "admin"` | default customer |
| status | `"active" \| "blocked" \| "deleted"` | admin can block/delete |
| deletedAt | number? | soft delete timestamp |
| createdAt, updatedAt | number | set by the repository |

### `addresses` — many per user
`id, userId, label (Home/Office/…), line1, line2?, city, pincode (6-digit
real Indian PIN), lat?, lng?, isDefault?, createdAt, updatedAt`

### `bookings` — the dispatch/OTP/commission lifecycle
Full field list lives on the `Booking` type
([`src/lib/types.ts`](src/lib/types.ts)). Server-owned fields:

| field | notes |
|---|---|
| id | `bk_…` assigned by the server |
| userId, phone | owner of the booking |
| serviceId, serviceName, providerId, providerName | catalogue + accepted Pro |
| address | snapshot of the service address (incl. lat/lng) |
| mode, date, slot, duration, amount | booking facts |
| status | `dispatched → accepted → enroute → arrived → in_progress → pending_confirm → completed / cancelled` (+ `scheduled`) |
| startOtp, completeOtp | 6-digit OTPs (user-only visibility) |
| commission | **server-computed 10%** of `amount` — deducted from the provider wallet on completion |
| paymentMethod | `cash \| upi` (collected by the provider) |
| notifiedIds | Pros currently notified; cleared for everyone else on first accept |
| originPoint, providerPoint, etaMinutes, providerProfile | live tracking snapshot |
| timestamps | `createdAt, dispatchedAt, acceptedAt, enrouteAt, arrivedAt, startedAt, completedAt, paidAt, updatedAt` |

### `providers` — **only the company adds these** (no self-registration)
`id, name, phone, services[] (slugs), lat, lng, city, area, rating, jobs,
experience, hourlyRate, verified, policeVerified, kycStatus
(Pending/Verified/Rejected), status (Online/Offline), walletBalance,
commissionRate (10), reviewCount, createdAt, updatedAt`

### `services` — catalogue shown on the customer site
`id (=slug), name, category, tagline, description, includes[], excludes[],
duration, price, unit, popular?, slots?, parent? (sub-service), active, order`
Seeded once from the real catalogue ([`src/lib/seed.ts`](src/lib/seed.ts));
after that **the Admin panel owns it** — add, edit, price, publish, unpublish.

### `categories` — `id, name, active, order`

### `reviews` — `id, bookingId?, userId, providerId, author, service, rating (1-5), text, createdAt`

### `complaints` — `id, bookingId?, customerId, providerId, customer, provider,
issue, status (Open/Escalated/Resolved), createdAt, updatedAt`

### `banners` — `id, title, placement, status (Active/Scheduled/Paused), clicks, updatedAt`

### `faqs` — `id, q, category, answer?, status (Published/Draft), votes, updatedAt`

### `pages` — CMS metadata for real routes: `id, title, slug, status, updatedAt`

### `campaigns` — `id, title, audience, channel (Push/SMS/Email/In-app), status (Sent/Draft), sentAt, createdAt`

### `notifications` — operational in-app alerts for admins, including customer registration events:
`id, type, title, message, userId, userName, phone, platform (web/mobile_app), readAt?, createdAt`

### `payouts` — `id, providerId, provider, jobs, amount, mode, status (Processing/Paid), date`

### `wallets` — one per provider
`providerId, balance, updatedAt`. Rules enforced by the API:
**10% commission auto-debit per completed service**, **minimum balance ₹500**.

### `walletTxns` — append-only ledger
`id, providerId, provider, service, serviceCharge, commission, balanceAfter,
kind (commission/recharge), note, createdAt`

### `adminUsers` — back-office accounts
`id, name, email, role (Super Admin/Operations/Finance/Support), status,
lastSeen, updatedAt`. Login itself verifies against env
(`ADMIN_EMAIL` / `ADMIN_PASSWORD`) with an HMAC-signed httpOnly session cookie.

### `settings` — `id = key slug, key, value, scope, updatedAt`
Seeded with the live platform config: commission 10%, min wallet ₹500,
provider radius 3 km, areas radius 10 km, payment modes, languages, etc.

---

## Derived (never stored) numbers

The dashboard's analytics are **aggregates of real rows**, so they can never
drift from the data:

- customers / providers / bookings / completed / cancelled → `count()`
- revenue, commission → `sum(amount)` / `sum(commission)` over bookings
- 30-day charts → bookings grouped by `createdAt` day
- top services / providers, category donut → grouped sums
- live bookings → `status ∈ {dispatched, accepted, enroute, arrived, in_progress, pending_confirm}`
- invoices / payments / wallet transactions → project bookings & ledger rows

Anything without real rows renders an honest **empty state**, not placeholder
numbers.

## Integrity rules

1. Registration is phone-OTP only; `id = phone`, so re-login finds the same row.
2. Profile fields validated server-side and client-side (Indian mobile, real
   PIN codes, letter-only names, optional-but-valid email).
3. A booking's `commission` is recalculated by the API from settings — the
   client cannot set it.
4. First Pro to accept receives the user's details; `notifiedIds` is cleared
   for everyone else in the same write.
5. Wallet debits only happen through `POST /api/wallets/:id` with the
   booking-derived commission amount.
6. Admin mutations require the signed session cookie (401 otherwise).