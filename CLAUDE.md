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

## Delivery Assignment (Phase 5) notes

- **`delivery_partners` did not already exist** — the user's brief for this
  phase said to "confirm/extend" it as if earlier scaffolding had created
  it; grepping the schema showed it was only ever referenced in a comment.
  Built fresh this phase, mirroring `vendors`' shape (`kyc_status`,
  `is_online`, `current_lat`/`current_lng`, `vehicle_type`).
- **`order_status` gained `delivery_assigned`, `picked_up`,
  `out_for_delivery`, `delivered`** — placed *after* `handed_over` in the
  enum, not interleaved with `ready`/`handed_over`. Delivery assignment is
  triggered by the vendor's own `handed_over` action rather than at
  `ready`, so Phase 4's already-tested vendor forward-only transition
  sequence needed zero changes. `delivery_assigned` itself isn't in the
  TRD's literal state diagram — added so "partner accepted the assignment"
  has a real loggable status distinct from "assignment pending".
- **Matching is nearest-online-partner via plain Haversine** over
  `delivery_partners.current_lat/lng` (`DeliveryService.findNearestOnlinePartner`)
  — same no-Maps-API rule as vendor allocation. Location updates are
  foreground-only, periodic (~75s while online in the partner app), never
  background/continuous.
- **Reassignment reuses `JobQueueService` from `AllocationModule`** rather
  than a second in-memory timer implementation — `AllocationModule` now
  exports it alongside `AllocationService` specifically for this. Same
  timeout → auto-reassign → exhausted-retries → `failed` pattern as Phase
  4's vendor allocation, same silent-reassignment-on-reject/timeout rule
  (no customer-visible history entry until a terminal accept/fail).
  `DELIVERY_SLA_SECONDS` / `MAX_DELIVERY_ASSIGNMENT_ATTEMPTS` env vars,
  defaulting to 120s / 3, mirroring `ALLOCATION_SLA_SECONDS` /
  `MAX_ALLOCATION_ATTEMPTS`.
- **Delivery OTP is stored in plain text** (`grocery_orders`/`food_orders
  .delivery_otp`) — deliberately, unlike the Phase 1 login OTP. It's a
  real, repeatedly customer-facing doorstep code for the life of the
  delivery, not a one-time credential; the customer's own order screen has
  to keep re-displaying it. Visibility is role-gated: `OrderService`'s
  `getGroceryOrder`/`getFoodOrder` run every response through a
  `withOtpVisibility` helper that nulls the field for any requester whose
  role isn't `customer` (vendor, delivery partner mid-flow, admin all see
  `null`).
- **Bug found and fixed this phase**: `listAllOrdersForAdmin` (the
  `GET /admin/orders` list endpoint, built in Phase 4 before `delivery_otp`
  existed) spread the raw order row unfiltered, so once the column was
  added it silently leaked every order's OTP to any admin list request —
  `withOtpVisibility` only ever covered the single-order detail endpoints.
  Fixed by stripping `deliveryOtp` in the list mapper too.
- **Vendor Order History was permanently empty until this phase** — Phase
  4's vendor "active" queries only ever selected
  `vendor_accepted/preparing/ready/handed_over`, and there was no endpoint
  for terminal orders at all, so `laoji-vendor`'s `OrderHistoryScreen`
  (which filters for `delivered`/`cancelled`/`rejected`) had nothing to
  read even once `delivered` became reachable. Added
  `GET /vendor/orders/{grocery,food}/history` (terminal statuses only,
  last 100) and folded them into `laoji-vendor`'s `ordersService.list()`.
- **Auth throttler bug found and fixed this phase**: `otp/request`,
  `otp/verify` and `admin/login` all used `@Throttle({ default: {...} })`
  with three *different* limits (3, 10, 10 per 60s) — but
  `@nestjs/throttler` keys its in-memory storage by throttler *name* + IP,
  not by route, so all three routes were silently sharing one counter
  bucket. `otp/request`'s tight 3/60s limit tripped from hits against the
  other two routes entirely, which surfaced as `otp/request` going
  permanently 429 mid-session with no way to recover short of a clean
  60s+ window with *zero* requests to any of the three (rejected requests
  still increment the counter, so retrying on 429 only made it worse).
  Fixed by giving each route its own named throttler (`otpRequest`,
  `otpVerify`, `adminLogin`) registered in `ThrottlerModule.forRoot`
  alongside the existing global `default`.
- **`listPartnersBasic` (admin) now resolves phone**, same
  phone-stands-in-for-name pattern as customers/vendors — the admin
  Delivery Partners page has nothing else to identify a partner by.
- **`GET /delivery/orders/:type/:id`** (`DeliveryService.getOrderDetailForPartner`)
  is a new enriched-detail endpoint — the plain `incoming`/`active` list
  endpoints return raw `delivery_assignments`/order rows with no vendor
  name, customer contact, or item count, which `laoji-delivery`'s
  assignment/active-delivery screens need. Built purely for that UI need,
  not called for anywhere in the TRD.
- **`laoji-user`'s 5-stage tracker rail wasn't extended to 6 stages** —
  `delivery_assigned`/`picked_up`/`out_for_delivery` all collapse onto the
  existing "Out for Delivery" stage; only `delivered` is a genuinely new
  terminal stage, per the "don't restyle" rule.

## Payments (Phase 6) notes

- **`payments` table added** (`drizzle/schema.ts`), same dual-nullable-FK
  pattern as `order_status_history`/`delivery_assignments` (exactly one of
  `grocery_order_id`/`food_order_id` set, DB CHECK constraint). Columns:
  `provider`, `status`, `amount`, `upi_deep_link`, `provider_ref`,
  `reconciled_by`/`reconciled_at`. `grocery_orders`/`food_orders
  .payment_status` (a plain varchar since Phase 1) stays as a denormalized
  read-model column, kept in sync by `PaymentService` on every status
  change — cheap for existing consumers that already read it as a string
  (vendor app's `PAYMENT_MAP`, admin's `PaymentBadge`) without touching
  them; `payments` is the real source of truth.
- **`PaymentProvider` interface** (`src/modules/payment/payment.types.ts`)
  — `initiate`/`verify`/`refund`, exactly the shape CLAUDE.md's non-
  negotiable rule #2 names. Three implementations:
  - `UpiDeepLinkProvider` — the only real one. Builds a plain
    `upi://pay?pa=...&pn=...&am=...&tr=<orderId>&cu=INR` link
    (`UPI_VPA`/`UPI_PAYEE_NAME` env vars). `verify()`/`refund()` both
    throw — honestly unimplementable with no PSP webhook, which is the
    entire reason the manual-reconciliation screen exists.
  - `CodProvider` — cash on delivery, shaped like a provider so it goes
    through the same `PaymentService` path rather than being
    special-cased in Order/Checkout code. `initiate()` returns
    `pending_cod` immediately; nothing to verify.
  - `RazorpayProvider` — deliberately stubbed, every method throws "not
    implemented". Exists to prove the interface and the config-driven
    selection are real and swappable, not to be a second working gateway
    (that's a future phase).
  - **`PAYMENT_PROVIDER` env var** (`upi_deeplink` | `razorpay`, already
    staged in Step 0's config before this phase) selects which provider
    backs the customer-facing `method: 'online'` choice —
    `PaymentService.onlineProvider()`. `method: 'cod'` always uses
    `CodProvider` regardless of this setting.
- **No PSP webhook exists, so there are exactly two ways a payment ever
  reaches `paid`**: the customer's own "I've paid" self-confirmation
  (`POST /payments/:type/:orderId/confirm` — the real happy path, since
  nothing else can ever confirm a UPI deep-link payment automatically at
  MVP), or an admin manually reconciling it
  (`POST /admin/payments/:id/reconcile`) after checking their own bank/UPI
  statement — the fallback for whenever the customer never taps confirm
  (closes the app, disputes it, etc). `GET /admin/payments/pending` lists
  every payment still sitting in `pending`, enriched with order code,
  customer phone and the deep link itself.
- **Order creation now actually gates on payment** — `acceptGroceryOrder`/
  `acceptFoodOrder` call a new `requirePaymentSatisfied` check before
  proceeding; a vendor cannot accept an order whose payment is still
  `pending`/`failed`. `paid`, `pending_cod`, and `collected` are all
  satisfied (COD is always immediately fine — it resolves at delivery, not
  at order time). This only gates the *accept* step, not order creation
  itself — checkout still creates the order first exactly as Phase 4 left
  it, then routes to payment.
- **COD's `pending_cod` → `collected` flip happens inside Delivery, not
  Payment** — `DeliveryService.verifyDelivery` (Phase 5's OTP-verify
  endpoint) calls `PaymentService.markCodCollected` right after marking
  the order `delivered`; a no-op for online-paid orders. `DeliveryModule`
  now imports `PaymentModule` for this one cross-module call.
- **Refund gap closed (post-Phase-6 housekeeping)**: `payment_status`
  gained `refund_pending`/`refunded`. `PaymentService
  .markRefundPendingIfPaid(type, orderId)` is a no-op unless the order's
  current payment is `paid` (COD is always skipped — nothing was collected
  if the order fails before delivery); when it does fire, it flips the
  payment straight to `refund_pending`, same as everywhere else `paid` is
  the one status nothing here can auto-verify past. Hooked into the three
  places an order actually transitions to `failed` (grep confirmed these
  are the only call sites — no `cancelled` transition is wired anywhere
  yet):
  - `AllocationService.markFailed` — allocation exhausted after the
    customer already paid while vendors were still rejecting/timing out.
  - `DeliveryService.markDeliveryFailed` — delivery-partner matching
    exhausted post-handed_over (payment gate already required paid/COD by
    then, so a UPI order failing here genuinely took money with nothing
    delivered).
  - `OrderService.rejectFoodOrder` — the payment gate only blocks
    *accept*, not reject, so a vendor can reject an order the customer
    already paid for before ever accepting it.
  - `AllocationModule` now imports `PaymentModule` for this (no cycle —
    `PaymentModule` depends on nothing).
  - Still no refund on the customer-initiated-cancel path because no such
    endpoint exists at all yet (not this housekeeping's scope to add one).
  - Admin gained a parallel **refunds queue**
    (`GET /admin/payments/refunds`, `POST /admin/payments/:id/mark-refunded`)
    — same "track a manual, offline money movement" shape as the existing
    pending-payment reconciliation queue, not automated (still no gateway
    to push money through). `laoji-admin`'s `/payments` page now has two
    sections, "Awaiting confirmation" and "Refunds owed", sharing one
    `PaymentCard` component. Verified end-to-end: paid food order → vendor
    rejects pre-accept → payment auto-flips to `refund_pending` → shows in
    the admin refunds queue with order code/amount/customer phone → admin
    marks refunded → flips to `refunded` → correctly drops off the queue.
- **`laoji-user`'s `app/payment.tsx`** (previously a fully client-local UI
  shell per its own Phase-4-era comment) now calls the real
  initiate/confirm/get endpoints, added a "Cash on Delivery" option
  alongside UPI, and polls `GET /payments/:type/:orderId` every 4s while
  waiting so it advances automatically the moment an admin resolves an
  ambiguous payment — not just on the customer's own "I've paid" tap.
- **`laoji-admin` gained a new `/payments` route** (`PaymentReconciliationPage`)
  — lists pending payments with Mark Paid/Mark Failed actions. Not in the
  original nav/route set; added fresh this phase, same pattern as Phase
  5's `/delivery-partners` page.

## Notifications (Phase 7) notes

- **`device_tokens`/`notification_log` added exactly per TRD Section 3.7**
  — `device_tokens` keyed by (`user_id`, `platform`) unique index, one
  current token per device type per user (a fresh login replaces the old
  token rather than accumulating stale ones); `notification_log` is the
  append-only dispatch record (channel/template/payload/status/sentAt)
  regardless of whether the send was real or a dev-mode stub.
- **`NotificationService` uses its own `JobQueueService` instance**, not
  `AllocationModule`'s — `AllocationService` also needs to call
  `NotificationService` (the allocation-failed admin alert), so
  `NotificationModule` importing `AllocationModule` would create a cycle.
  `JobQueueService` has no dependencies of its own, so a second instance
  costs nothing; both still reuse the exact same class/mechanism per the
  "reuse the pattern" instruction, just not the same singleton.
  `notifyPush`/`notifyEmail` enqueue with `delayMs=0` — enough to get off
  the calling transaction's call stack (TRD Section 6: order-state writes
  must not block on a 3rd-party push API), no retry/backoff on failure
  (`JobQueueService` doesn't have one; a failed send is just logged
  `status='failed'`, matching MVP scope).
- **`FcmPushProvider`/`ResendEmailProvider` are real SDK integrations**
  (`firebase-admin`, `resend`) that degrade to a dev-mode stub — log the
  payload, report success — when their env vars are blank, exactly like
  every other unconfigured integration in this app (Cloudinary/Maps/OTP
  delivery). No real Firebase project or Resend key exists in this
  environment, so **every notification in this phase's verification is a
  logged stub, not an actually-delivered push/email** — proof means a
  correctly-rendered template + an async dispatch + a `notification_log`
  row with `status='sent'`, not a notification landing on a screen.
- **Two prerequisite features had to be built fresh, not just wired**:
  - **KYC review** (`uploads.service.ts` `reviewKycDocument` +
    `PATCH /uploads/kyc-documents/:id/review`, admin-only) — no
    approve/reject action existed anywhere before this phase; the admin
    KYC page (Phase 2) only ever listed documents. Reviewing a document
    rolls up to the user's single `vendors`/`delivery_partners.kyc_status`
    field (any rejected doc → profile rejected; all verified → profile
    verified; otherwise pending), and fires the `kyc_approved`/
    `kyc_rejected` email off that rolled-up status.
  - **`PATCH /users/me/email`** (`AuthService.updateEmail`) — phone+OTP
    accounts (customer/vendor/delivery_partner) had no way to add an email
    at all; email notifications need somewhere real to send to for these
    roles, not just admin's email+password login.
- **Matrix's "Order cancelled" row is mapped onto the three real
  order->`failed` transitions** (allocation exhausted, delivery-matching
  exhausted, vendor rejects a food order pre-accept) — no dedicated
  customer-cancel endpoint exists anywhere in the codebase, flagged rather
  than built as part of a Notifications phase. The partner-alert cell
  ("if assigned") never fires from `markDeliveryFailed` specifically,
  since by the time that path runs, no partner has ever formally accepted
  (every prior offer either rejected, timed out, or none existed).
- **One template was written but deliberately not wired here**:
  `settlement_summary_email` (Phase 8 dependency — no real settlement
  computation existed yet to put numbers in it). Exists purely so the
  Notification Matrix is fully covered in code, ready to wire once Phase 8
  lands. `product_suggestion_approved/rejected` was the other — now wired
  for real in Phase 9 (`CatalogService.approveProductSuggestion` /
  `rejectProductSuggestion`).
- **Frontend**: all three RN apps (`laoji-user`/`laoji-vendor`/
  `laoji-delivery`) register a real device token on auth (foreground
  permission request → `getDevicePushTokenAsync()` → `POST
  /notifications/device-token`), wrapped to no-op silently on failure —
  none of the three has `google-services.json`/`GoogleService-Info.plist`
  configured, so the native token call always throws in this environment;
  this degrades exactly like the backend's unconfigured-provider stubs.
  `laoji-user` also wires a real foreground notification listener as the
  pattern proof (logs only — no in-app notification center exists to
  route into yet). `laoji-admin` has no push at all (web app, and the only
  matrix row targeting Admin — allocation-failed — goes out as email to
  every admin user instead) but gained two new real screens:
  `/notifications` (the full dispatch log, doubles as this phase's
  primary proof surface) and real approve/reject buttons on the existing
  `/kyc-review` page.

## Order cancellation (housekeeping before Phase 8)

- **Real "cancel order" endpoint added**: `POST /admin/orders/:type/:id/cancel`
  (`OrderService.cancelOrder`) — admin-only, sets the order's *already-existing*
  `cancelled` enum value (it was in `order_status` since Phase 4/5 but no
  code ever set it — every real terminal path used `failed` instead).
  Customer self-service cancel is **not** built — there's no defined
  eligibility rule for when a customer should still be allowed to cancel
  (before vendor-accept? before handed-over?), and inventing one wasn't
  part of what was asked; flagged rather than guessed at.
- **Reuses the exact Phase 6 refund hook**: `cancelOrder` calls
  `PaymentService.markRefundPendingIfPaid`, same as every other real
  `failed`/`cancelled` transition — an already-`paid` UPI order being
  cancelled owes a refund exactly like a rejected one does.
- **New defensive guard in `DeliveryService.reassign`**: admin can now
  cancel an order while a delivery-assignment SLA timer is still pending
  in-memory; without a guard, a stale timeout firing after cancellation
  would re-offer the order to another partner or overwrite `cancelled`
  back to `failed`. Mirrors `AllocationService.reallocate`'s existing
  `order.status !== 'placed' → return` check (that one already handled
  this correctly — its own comment even said "already moved on (e.g.
  cancelled)" — `reassign` just never got the equivalent check).
- **Interpretation flag**: the instruction was to wire `order_cancelled`
  "instead of the failed-transition proxy." Read literally that could mean
  removing the notification from the three `failed` call sites (allocation
  exhausted, delivery exhausted, vendor rejects) now that a real
  `cancelled` endpoint exists. Chose **not** to remove those — they're
  real terminal failures the customer still needs to hear about, and
  silently dropping that notification would be a real regression, not a
  cleanup. Net effect: `order_cancelled` now fires from *both* the three
  `failed` paths (system-caused) *and* the new real cancel endpoint
  (admin-caused) — same customer-facing template, different trigger.
  Flagging this interpretation explicitly rather than guessing silently.
- **`laoji-admin`'s Order Detail "Manual overrides" card** (previously a
  disabled placeholder noting Phases 5–6 weren't built) now has a real
  "Cancel order" button, hidden once the order is already terminal
  (`delivered`/`cancelled`/`allocation_failed`). Delivery-partner
  reassignment still isn't built — the card's copy says so.

## Revenue Config & Settlements (Phase 8) notes

- **`revenue_config` rows are immutable — a "change" is always a new row**,
  never an UPDATE. That's simultaneously the enforcement mechanism for
  "never retroactive" (resolution always picks the winning row as of a
  given order's *creation* time, and an already-placed order never
  re-resolves) and the full change-history audit trail, with no separate
  history table needed — `GET /admin/revenue-config` sorted by
  `effective_from` desc *is* the history. No PATCH/DELETE endpoints exist
  on purpose.
- **`commission_pct` added to `grocery_orders`/`food_orders`** alongside
  the pre-existing `platform_commission` (the computed amount) — Phase 8
  snapshots the *rate* explicitly too, not just its derived amount, so an
  order's own row can answer "what rate produced this" without a join.
  Both are resolved once, at order-creation time, in
  `OrderService.createGroceryOrder`/`createFoodOrder`, replacing the old
  hardcoded `FLAT_DELIVERY_FEE`/`COMMISSION_RATE` constants — those
  constants are gone now, not just unused.
- **Resolution priority: vendor-scoped rule (most specific) > category-
  scoped > global**, and within the winning scope, the rule with the
  latest `effective_from <= asOf` wins (`RevenueConfigService.resolve`).
  Falls back to the pre-Phase-8 defaults (10% commission, ₹30 delivery
  fee, no COD cap) when an admin hasn't configured anything yet, so
  checkout keeps working with zero rules on record.
- **Category-scope only applies to grocery orders, and only via a
  simplification**: a cart can span multiple product categories within
  one vendor, so there's no single "the" category to resolve against —
  resolution uses the *first line item's* product category. Flagged, not
  silently treated as universally correct. Food orders skip category-scope
  entirely: menu items use `menu_categories` (a restaurant's own menu
  sections), a completely different table from the product catalog's
  `categories` that revenue_config's category scope actually refers to —
  applying it there wouldn't be semantically meaningful. Food orders
  resolve vendor-scope, falling back to global.
- **`cod_threshold` is a real gate**, wired into `PaymentService.initiate`
  — a COD `method` request is rejected with 400 if the order total exceeds
  the resolved vendor's cap (null cap = no limit). Resolved via the same
  `RevenueConfigService.resolve` used at order creation, so it can only
  ever get *more* restrictive going forward for existing pending orders in
  the same way commission does — never retroactively looser or tighter for
  an order whose payment method was already chosen.
- **`SettlementService` does its own local `vendorIdForUser`/
  `partnerIdForUser` lookups** rather than importing `CatalogService`/
  `DeliveryService` — both `CatalogModule` and `DeliveryModule` already
  need `RevenueModule` (for config resolution / settlement generation),
  so `RevenueModule` importing either back would be circular. Two small
  direct queries cost less than restructuring module boundaries.
- **Settlement generation reuses the exact `verifyDelivery` hook** Phase
  5/6/7 already fire from (COD auto-collect, notification dispatch) —
  vendor keeps `subtotal - platform_commission`, the delivery partner
  keeps the whole `delivery_fee` (same "deliveryFee as earnings" precedent
  Phase 5's frontend used before real settlements existed), platform
  keeps `platform_commission`. Every field is copied straight from the
  order's own already-snapshotted numbers, not re-resolved.
- **`settlement_summary` email (written, unwired in Phase 7) is now wired
  per-settlement, not as a true weekly digest** — no cron/aggregation job
  exists to batch multiple orders into one real weekly summary yet, so the
  "period" is honestly labelled as the single order it covers rather than
  faking a week that isn't being computed. Sent to the vendor only (the
  template's commission/net shape doesn't translate meaningfully to a
  delivery partner's 100%-of-delivery-fee payout).
- **Vendor/delivery earnings screens now read real `settlements` rows** —
  there's no separate "paid out" batching step implemented, so every
  settlement is immediately final the moment it's created; `laoji-vendor`'s
  "Pending settlement" hero stat therefore always reads ₹0 (honest, not a
  bug), and the fake "Weekly payout to bank... Next: 03 Aug" card was
  removed from `laoji-delivery`'s earnings screen — that was a hardcoded
  false claim about a process that doesn't exist, not a design element,
  so removing it is within the "wire to real data" ask, not a restyle.
- **Verified end-to-end** (two E2E scripts, since the first one's tail end
  collided with the 120s allocation SLA on its own earlier unaccepted test
  orders — a test-script artifact, not a product bug, fixed by accepting
  orders immediately in the follow-up run): the critical demo — order A
  placed under a 10% vendor rule, rule changed to 20%, order B placed,
  order A re-fetched and its `commissionPct`/`platformCommission`/
  `deliveryFee`/`total` all provably unchanged — plus COD correctly
  rejected above a lowered cap, and a full delivery generating a real
  settlement visible to vendor, delivery partner, and admin with correct
  payout math and the correct order-creation-time commission rate
  snapshotted onto it.

## Admin Dashboard & Reports (Phase 10) notes

- **Pure read/aggregate layer, no new tables** — exactly per TRD §9.4. A new
  `DashboardModule` (`src/modules/dashboard/`) owns `GET /dashboard/stats`,
  `GET /dashboard/attention`, `GET /reports/series`,
  `GET /reports/vendor-performance`, `GET /reports/cancellations` — all
  admin-only, all pure queries over tables Phases 1–9 already built and
  populate. Same "fetch rows, compute in JS" style as `CatalogService`'s
  Haversine filtering (MVP scale, no SQL aggregate functions needed yet).
- **Stuck-order detection reuses TRD §9.4's own worked example as the
  threshold table** (`STUCK_SLA_MINUTES` in `dashboard.service.ts`):
  `placed`: 5m, `vendor_accepted`: 20m (the TRD's literal example),
  `preparing`: 30m, `ready`: 15m, `handed_over`/`delivery_assigned`/
  `picked_up`/`out_for_delivery`: 45m (one shared bucket, mirroring how the
  admin UI's own status rail already collapses those four onto a single
  "picked up" stage). Distinct from `ALLOCATION_SLA_SECONDS`/
  `DELIVERY_SLA_SECONDS` (Phase 4/5, 120s) — those cover the *automated*
  vendor/delivery-partner matching windows; this covers the *manual*
  vendor-progression stages the TRD explicitly says those don't reach. It's
  a plain query over `order_status_history` (latest row per open order vs.
  now), not a new monitoring system.
- **`AttentionItem.kind` drops the mock UI's `expiring_kyc`** — the real
  `kyc_documents` table has no expiry-date column (Phase 2 never modeled
  document expiry), so there's nothing real to compute that signal from.
  Only `stuck_order` and `failed_allocation` are implemented; flagged
  rather than faked. `laoji-admin`'s copy referencing "expiring documents"
  was trimmed to match (a factual correction, not a restyle).
- **`failed_allocation` items only cover grocery, not food** — grocery's
  `status='failed'` is genuinely a fulfillment gap (allocation exhausted or
  delivery-partner matching exhausted, both logged with `actor_role:
  'system'`); food's `status='failed'` is a direct vendor rejection
  (`actor_role: 'vendor'`), which is a different signal (surfaced instead
  in `getCancellations()`'s `vendor` bucket, not as a live ops alert).
- **Cancellation-cause taxonomy is derived straight from
  `order_status_history.actor_role`**, not a new column: `status='failed'
  actor_role='vendor'` → `vendor` (food pre-accept reject);
  `status='failed' actor_role='system'` → `no_fulfillment` (allocation or
  delivery-matching exhausted, Phase 4/5); `status='cancelled'
  actor_role='admin'` → `customer` — **flagged assumption**: no
  customer-self-service-cancel endpoint exists anywhere yet (see the
  housekeeping section above), so every real `cancelled` row today is
  admin-initiated, and in practice that's an admin acting on a customer's
  request. If a real customer-cancel endpoint is ever added, it should get
  its own `actor_role` branch here rather than continuing to share the
  `admin` bucket.
- **"Revenue" (reports/series) is narrower than "GMV" (dashboard/stats) on
  purpose**: GMV counts every order placed today regardless of outcome
  (same population as the orders-today count); revenue sums
  `platform_commission` (Phase 8's snapshotted rate/amount) only for
  orders that actually reached `delivered` — money that was never
  actually earned on a failed/cancelled order isn't counted as revenue.
  Both are bucketed by the order's own `created_at` date, not a later
  delivery timestamp (a small simplification, flagged rather than silently
  assumed).
- **Vendor performance's acceptance rate uses two different real signals**
  depending on order type, both already captured by earlier phases:
  grocery uses `allocation_attempts.outcome` (captures every vendor
  offered the order, including ones who rejected/timed out before another
  vendor accepted — more precise than `order_status_history` alone, which
  only ever sees the vendor who eventually accepted); food has no
  allocation waterfall, so it uses `order_status_history` directly
  (`vendor_accepted` reached = accepted, `status='failed'` with
  `actor_role='vendor'` = rejected). Avg prep time is
  `ready.changed_at - vendor_accepted.changed_at` per order, averaged per
  vendor, straight from `order_status_history`'s own timestamps — no new
  tracking, per TRD §9.4's third bullet.
- **Verified end-to-end** against the real dev database (not just that the
  query compiles): placed a real grocery order, paid COD, had the vendor
  accept it (writes a real `order_status_history` row), then backdated
  that row's `changed_at` in Postgres to 25 minutes ago (simulating the
  20-minute `vendor_accepted` SLA actually elapsing, since waiting 20 real
  minutes isn't practical for a verification run) — `GET
  /dashboard/attention` correctly surfaced it: `"stuck at vendor accepted
  ... no movement for 25 min (SLA 20 min)"`, severity `warning`. Also
  confirmed `/dashboard/stats`, `/reports/series`,
  `/reports/vendor-performance`, and `/reports/cancellations` all return
  real, non-zero numbers computed from the accumulated residual test data
  left behind by Phases 4–9's own E2E verification runs (dozens of real
  vendors/orders/allocation attempts already in the dev DB) — not just the
  one order created for this phase's own test.
- **`laoji-admin`'s `DashboardPage`/`ReportsPage`** (previously reading
  from the mock transport via `@/api/services`) now call a new
  `src/api/dashboardAdmin.ts` (same `realRequest`-via-`realClient.ts`
  pattern as `productSuggestionsAdmin.ts`/`ordersAdmin.ts`). Dashboard's
  "Latest orders" widget, which previously used the mock `ordersQuery`,
  now reuses the same real `listAdminOrders` + `adaptOrderSummary`
  pipeline `OrdersPage` already wires up (Phase 4), so there's exactly one
  real orders data path in the app, not two.

## Hardening & Launch Readiness (Phase 11) notes

This phase was run as a checklist against the already-built system, not a
build sprint — most items below are either "confirmed OK," a small real fix,
or an explicit flag for a decision only the product owner can make. Nothing
here was guessed at silently.

**Security — fixed:**
- **Rate limiting had a real gap**: the global `ThrottlerModule` default
  (100 req/min/IP, `app.module.ts`) covered every route, but three
  abuse-prone write endpoints — order creation (`POST orders/grocery`,
  `POST orders/food`), payment initiation (`POST payments/:type/:orderId
  /initiate`), and product-suggestion submission (`POST
  vendor/product-suggestions`) — had no tighter per-route limit, unlike
  `otp/request`/`otp/verify`/`admin/login` from Phase 1. Added three more
  named throttlers (`orderCreate` 10/min, `paymentInitiate` 10/min,
  `productSuggestion` 5/min), same pattern as the existing auth ones
  (named separately per the Phase 5 shared-bucket bug, not reused).
- **Postgres was running the app as its own owner role** — `laoji`
  (`docker-compose.yml`'s `POSTGRES_USER`) owns `laoji_dev` outright, full
  DDL/DROP included, and the running app connected as that same role.
  Added `scripts/init-db/01-create-app-role.sql` (mounted into
  `docker-entrypoint-initdb.d`, and applied by hand to the existing local
  dev volume via `docker exec ... psql < ...`) creating `laoji_app`: DML
  only (SELECT/INSERT/UPDATE/DELETE) via `ALTER DEFAULT PRIVILEGES`
  covering future migrations too, explicit `REVOKE CREATE` on both schema
  and database. `.env`/`.env.example` now split `DATABASE_URL` (runtime,
  `laoji_app`) from `MIGRATIONS_DATABASE_URL` (schema owner, `laoji` —
  used only by `drizzle.config.ts` and `scripts/seed-admin.ts`).
  **Verified end-to-end**: booted the app on the restricted role, `GET
  /health` reported `db: connected`, `POST /auth/otp/request` (a real
  INSERT into `auth_tokens`) succeeded, `npm run db:migrate` still applies
  cleanly against the owner role, and `laoji_app` was directly confirmed
  to get `permission denied for schema public` on `CREATE TABLE` and
  `must be owner of table users` on `DROP TABLE` — the restriction is
  real, not just configured and untested.

**Security — confirmed OK, no change:**
- **CORS**: `main.ts`'s `enableCors` reads `CORS_ORIGIN` into an explicit
  origin array (defaulting to `laoji-admin`'s dev port), never `*`,
  `credentials: true` scoped to that list — not wider than Phase 1 left
  it.
- **HTTPS**: no HSTS/redirect middleware exists in `main.ts`, and none was
  added — deliberately deferred to whichever hosting/reverse-proxy layer
  gets chosen (see below), consistent with TRD Section 1 leaving hosting
  open. Once hosting is picked, add `helmet()` + `trust proxy` then (the
  latter also matters for `ThrottlerGuard`'s IP-keying behind a proxy).

**Compliance — real gaps, flagged rather than guessed at:**
- **GST-compliant invoicing does not exist.** The only receipt-shaped
  artifact anywhere is `notification/templates/email/order-receipt.ts` —
  a plain HTML email with item rows and a total. No invoice number
  sequence, no GSTIN (buyer or seller), no tax breakdown (CGST/SGST/IGST
  — pricing is currently treated as flat/tax-inclusive with no tax field
  at all), no HSN/SAC codes, no buyer legal name/address (orders still
  only have a phone number standing in for customer identity, per Phase
  4's note), no seller registered address. No PDF generation library is
  even installed. This was flagged as MVP-critical and not deferrable in
  the PRD (Section 12) — **this needs a real scoping decision from the
  product owner** (what GST registration status Laoji itself has, which
  categories/city trigger which tax treatment, whether line-item tax needs
  to be itemized per product or platform-level) before any code gets
  written here; guessing at Indian tax-compliance details would create
  real legal exposure, not just a UX gap.
- **No ToS/Privacy Policy exists anywhere.** The only mention across all 5
  repos is a static, non-interactive caption in `laoji-user/app
  /onboarding.tsx` ("By continuing you agree to our Terms & Privacy
  Policy") — plain text, not a link, routes nowhere. No actual document,
  screen, or static page exists in any of the 4 apps or the backend.
  Flagged as an outstanding item rather than drafted here — this is legal
  copy, not something to author without review.
- **Location-tracking copy audited, no mismatch found.** Only
  `laoji-delivery` calls any location API, and only the documented
  periodic ~75s foreground-only pattern (`Location
  .requestForegroundPermissionsAsync` + `setInterval`) — no custom
  permission-rationale strings exist anywhere near it (bare OS dialog), so
  there's no copy to misrepresent. `laoji-user`/`laoji-vendor`'s only
  location-adjacent code is one-time address/pickup-point capture, not
  tracking. Confirmed clean, nothing to fix.

**Hosting — deliberately not chosen here, see decision list below.**

**Release readiness — cross-checked PRD Section 5's MVP table against the
real code, not just against which implementation-plan phase was marked
closed. Two real gaps found, plus one partial:**
- **Ratings (Food) — not built.** `restaurants.ratingAvg` exists in the
  schema but is a hardcoded `.default(0)` with no write path anywhere;
  `DeliveryService` even has a code comment noting "no ratings system." No
  rating-submission endpoint, no rate/review UI in `laoji-user`. This is
  listed as MVP scope in PRD Section 5's Food row, not Phase 2 — a genuine
  gap, not a documentation oversight.
- **Business Hours (Vendor) — not built server-side.** The backend only
  has a manual boolean `vendors.isOpen`/`restaurants.isOpen` toggle, no
  weekly-schedule columns at all. `laoji-vendor`'s `BusinessHoursScreen`
  (weekly open/close editor) is a fully client-local Zustand mock
  (`vendorStore.ts`'s `setSchedule`) with no API call to persist or read
  it — real-looking UI over nothing real.
- **Customer Support (contact/help) — partial.** `laoji-user`'s Profile
  screen "Help & support" row is a static hardcoded alert referencing a
  placeholder `contact@onspace.ai` email, not a real screen or
  backend-backed flow. PRD Section 5 scopes this as "basic
  (contact/help)," so a real static contact screen with Laoji's own
  details would clear the bar — what exists today doesn't.
- Every other MVP-table row (Grocery allocation/reallocation/Product
  Suggestions, single-restaurant cart + menu management, the rest of
  Customer/Vendor/Delivery/Admin app screens, UPI+COD payments,
  order-status notifications) was confirmed genuinely built and wired end
  to end, not just phase-closed on paper.
