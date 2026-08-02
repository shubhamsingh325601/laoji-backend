# Laoji Backend — CLAUDE.md

This is the NestJS backend for Laoji, a hyperlocal marketplace (grocery + food
delivery). Before working here, read (in the parent workspace):

- `../docs/Laoji_PRD.md` — product requirements, business rules, MVP vs Phase 2 scope
- `../docs/Laoji_TRD.md` — full technical spec: schema, module boundaries, payment
  abstraction, queue pattern, per-app requirements
- `../docs/Laoji_Implementation_Plan.md` — the exact phase-by-phase build order

Follow the implementation plan phase by phase, in order. Don't skip ahead. Each phase
has a "Done when" gate — treat it as a real gate, not a suggestion.

## Non-negotiable rules

These come straight from the TRD. Do not drift from them without flagging it first,
even if a "simpler" alternative seems tempting mid-build.

1. **Orders are two tables** — `grocery_orders` and `food_orders` — never one shared
   `orders` table. They share `order_status_history` (dual-nullable-FK pattern) for
   tracking, but the order tables themselves stay split (TRD §3.5).
2. **All payment logic goes through the `PaymentProvider` interface**
   (`initiate` / `verify` / `refund`). `UpiDeepLinkProvider` is the only implementation
   for now. Never call UPI logic directly from Order/Checkout code (TRD §4).
3. **Background jobs run on an in-process, in-memory queue.** No Redis. Single backend
   instance only — this is deliberate, not a placeholder (TRD §8). Keep job-creation
   code behind a small `JobQueue` interface so a future Redis/BullMQ swap doesn't touch
   business logic.
4. **No live map, no background/continuous location tracking, no Google Maps
   Directions/Distance-Matrix calls.** Nearest-vendor and nearest-delivery-partner
   matching is plain Haversine distance over stored `lat`/`lng` (TRD §9.3). Google Maps
   is Geocoding-only (address → lat/lng at entry time).
5. **Every vendor or delivery-partner manual status change** (Accepted, Preparing,
   Ready, Handed Over, Picked Up, Out for Delivery, Delivered) must go through a real
   API call that writes to `order_status_history` with `actor_role` and `changed_by`,
   before the client's own UI shows it as confirmed. No client-local-only status
   changes, ever (TRD §9.4) — this is what makes Admin's "track everything" requirement
   actually true.
6. **Stack:** NestJS + TypeScript, PostgreSQL, Drizzle ORM, Cloudinary (signed uploads
   only — never expose the API secret client-side), Firebase Cloud Messaging (push),
   Resend (email), phone+OTP auth for Customer/Vendor/Delivery, JWT access + refresh
   tokens. Admin auth is email+password (an assumption from the implementation plan,
   not explicit in the PRD/TRD — already flagged).
7. **Small single-city MVP scope.** If a change starts building something from the
   PRD's Phase 2 list (§5), stop and flag it rather than building it anyway.

## Architecture

Modular monolith (TRD §0) — one NestJS app, domain modules under `src/modules/`, each
owning its own tables and talking to others only through service interfaces, never by
reaching into another module's repository directly.

```
src/
  modules/
    auth/ catalog/ order/ allocation/ payment/providers/ delivery/
    notification/templates/{push,email}/ user/ health/
  common/    (guards, interceptors, decorators, filters, error envelope)
  config/    (env schema/validation, Drizzle db module)
drizzle/
  schema.ts
  migrations/
```

- API is versioned and prefixed: `/api/v1/...`.
- Standard error envelope: `{ "error": { "code", "message", "details" } }`.
- Auth: `Authorization: Bearer <jwt>` on every route except `/auth/*`; refresh-token
  rotation on use.

## Local dev

```
docker compose up -d          # Postgres on host port 5433 (see note below)
npm run start:dev             # boots Nest, GET /api/v1/health should return 200
npm run db:generate           # generate a Drizzle migration from drizzle/schema.ts
npm run db:migrate            # apply migrations
```

**Port note:** this machine already runs a native Postgres service on 5432, so the
Docker Postgres container is mapped to host port **5433** instead (see
`docker-compose.yml` and `.env.example`). Don't "fix" this back to 5432 — it's
intentional, not a mistake.

Copy `.env.example` to `.env` and fill in real values before working on a phase that
needs them (Cloudinary, Firebase, Resend keys are stubbed/blank until Phase 2+).

## Auth (Phase 1) notes

- **OTP delivery is a dev-mode stub** — no SMS provider is wired up yet. `POST
  /auth/otp/request` returns `{ devOtp }` in the response body whenever
  `NODE_ENV !== 'production'`, and never in production. Swap in a real SMS
  provider (MSG91/Twilio/etc.) behind `AuthService.requestOtp` when one is
  chosen — this was an explicit assumption flagged before building, not a
  spec requirement.
- **Admin has no signup endpoint** (by design — admin is the most privileged
  role, TRD §11). Bootstrap or reset an admin account with
  `npm run seed:admin -- <email> <password>`.
- **CORS is enabled only for `laoji-admin`** (the one browser-based client —
  the three React Native apps aren't subject to CORS). Configured via
  `CORS_ORIGIN` in `.env`, default `http://localhost:8080` (Vite's default
  dev port for that app).
- Refresh tokens rotate on every use and detect reuse (a rotated-out token
  being replayed revokes every session for that user) — see
  `AuthService.refresh`.

## File storage (Phase 2) notes

- `kyc_documents` table isn't named in the TRD (Section 3 only has a rolled-up
  `kyc_status` on `vendors`/`delivery_partners`) — added because a real
  review screen needs to see individual uploaded documents. Keyed to `users`
  directly since the `vendors`/`delivery_partners` profile tables don't
  exist yet.
- Upload flow is strictly: `POST /uploads/signature` (backend signs, never
  touches the file) → client uploads directly to Cloudinary → client calls
  `POST /uploads/kyc-documents` to record the `secure_url`/`public_id`. The
  backend never proxies file bytes.
- `laoji-admin`'s KYC review page (`/kyc-review`) and its auth calls are the
  only parts of that app hitting the real backend — everything else still
  reads from its mock transport until later phases wire it up. See
  `src/api/realClient.ts` in that repo.

## Catalog (Phase 3) notes

- **`vendors` (TRD §3.4) didn't exist yet and had to be created here** —
  `vendor_products`/`restaurants` can't have real FKs without it. A vendor
  profile (`POST /vendors/me`) is created right after OTP verify in the
  Vendor app, capturing `pickup_lat`/`pickup_lng` from the device (falls back
  to a Kolhapur coordinate if location permission is denied) — there was no
  dedicated location-entry screen in the original onboarding flow.
- **`products.mrp` and `menu_items.is_veg` were added beyond the TRD's literal
  column list** — both the vendor and admin frontend shells had already
  modeled an MRP field independently, and `is_veg` is standard for Indian
  food delivery. See the schema comment in `drizzle/schema.ts` above the
  `vendors` table for the full reasoning.
- **Menu item variants now persist for real** (`menu_item_variants`, added
  right after Phase 3 closed, once the gap above was flagged) — same shape
  as `menu_item_addons` plus `is_default`, storing a `price_delta` off the
  item's base price rather than an absolute price.
- **Radius filtering is plain Haversine in `CatalogService`** (TRD §9.3) —
  loads all vendor rows and filters in JS, no PostGIS. Fine at single-city
  MVP scale; revisit only if the vendor count grows enough to matter.
- Customer "browse" endpoints (`GET /catalog/products`, `/catalog/restaurants`)
  never expose which vendor fulfils a product — they return an aggregated
  view (cheapest in-radius price, `inStock` if any in-radius vendor has
  stock), consistent with the "customer never sees vendor identity" rule
  (PRD §4.1).

## Orders & Allocation (Phase 4) notes

- **Allocation waterfall implements the dominant path only**: single vendor
  covering the whole cart → pickup radius → lowest combined cost → fastest
  (closest) tiebreak. The TRD's "minimum vendor combination" step (splitting
  one cart across multiple vendors when no single vendor covers it) is NOT
  implemented — real bin-packing, not attempted. No single-vendor match
  means checkout fails immediately with a clear error, per PRD §9's "cart
  can only be placed if a valid vendor-combination exists" rule.
- **`order_status` only reaches Phase 4's vendor manual-control scope**:
  `placed → vendor_accepted → preparing → ready → handed_over`, plus
  `failed`/`cancelled`. The TRD's full lifecycle continues through
  `picked_up`/`out_for_delivery`/`delivered` — Phase 5 (Delivery Assignment)
  adds those to the enum then, not guessed at now.
- **SLA window (120s) and max reallocation attempts (3) are assumptions** —
  the PRD explicitly left both as open questions. Both overridable via
  `ALLOCATION_SLA_SECONDS` / `MAX_ALLOCATION_ATTEMPTS` env vars.
- **Reallocation timers are plain in-process `setTimeout`** behind a small
  `JobQueueService` (TRD §8's "custom EventEmitter + setTimeout" option) —
  lost on restart, same documented trade-off as the rest of the in-memory
  queue. `allocation_attempts` (Postgres) stays the source of truth for
  what's pending; no reconciliation sweep to resume interrupted timers after
  a restart is built yet (flagged, not silently skipped).
- **`addresses` had no endpoints until now** — Phase 1 built the table only;
  checkout needed a real `deliveryAddressId` to exist, so a minimal
  `AddressController` (create/list/update/delete, own-address-only) was
  added as a hard prerequisite.
- **No customer "name" field exists anywhere** — accounts are phone+OTP
  only, no profile/name capture in any phase so far. Order responses use
  the customer's phone as a stand-in `customer.name`. Real name capture
  isn't in any phase's scope yet.
- **Three minimal admin listing endpoints** (`GET /admin/vendors`,
  `/admin/restaurants`, `/admin/menu-items`) were added — id+name only, just
  enough for the Admin Orders list/detail to resolve vendor/item names.
  Full vendor/restaurant management screens are still unbuilt.
- Food orders have **no allocation or SLA-timeout concept** — the customer
  picks the restaurant directly at cart time, so a reject just fails the
  order outright rather than triggering reallocation.
