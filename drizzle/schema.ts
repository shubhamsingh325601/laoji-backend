// Drizzle schema — grows phase by phase per docs/Laoji_Implementation_Plan.md.
// Phase 1 (Auth & Identity): users, auth_tokens, addresses (TRD Section 3.1),
// plus otp_codes — an implementation detail not named in the TRD, needed to
// back the phone+OTP flow (see laoji-backend/CLAUDE.md OTP-delivery note).
// Phase 2 (File Storage): kyc_documents — also not named in the TRD (Section
// 3 lists `vendors.kyc_status` / `delivery_partners.kyc_status` as a single
// rolled-up field, with no table for the underlying documents). A real KYC
// review screen needs to see individual uploaded documents, so this table
// exists to hold them, keyed directly to `users` since the `vendors` /
// `delivery_partners` profile tables themselves aren't built yet (out of
// scope for a file-storage phase).

import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'customer',
  'vendor',
  'delivery_partner',
  'admin',
]);

export const userStatusEnum = pgEnum('user_status', ['active', 'suspended']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    phone: varchar('phone', { length: 20 }),
    email: varchar('email', { length: 255 }),
    // Admin only. Never set for customer/vendor/delivery_partner (they use OTP).
    passwordHash: text('password_hash'),
    role: userRoleEnum('role').notNull(),
    status: userStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Same phone number may hold separate accounts under different roles
    // (e.g. a person who is both a customer and a delivery partner), but not
    // two accounts in the same role.
    uniqueIndex('users_phone_role_idx').on(table.phone, table.role),
    uniqueIndex('users_email_idx').on(table.email),
  ],
);

export const authTokens = pgTable('auth_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  refreshTokenHash: text('refresh_token_hash').notNull(),
  deviceId: varchar('device_id', { length: 255 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const addresses = pgTable('addresses', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 100 }),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  formattedAddress: text('formatted_address').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
});

export const otpCodes = pgTable('otp_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  phone: varchar('phone', { length: 20 }).notNull(),
  purpose: varchar('purpose', { length: 30 }).notNull().default('login'),
  codeHash: text('code_hash').notNull(),
  attemptCount: integer('attempt_count').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const kycDocumentStatusEnum = pgEnum('kyc_document_status', [
  'pending',
  'verified',
  'rejected',
]);

export const kycDocuments = pgTable('kyc_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // Snapshot of users.role at upload time — lets Admin filter/group without
  // a join, and stays correct even if role semantics evolve later.
  role: userRoleEnum('role').notNull(),
  docType: varchar('doc_type', { length: 50 }).notNull(),
  secureUrl: text('secure_url').notNull(),
  publicId: varchar('public_id', { length: 255 }).notNull(),
  status: kycDocumentStatusEnum('status').notNull().default('pending'),
  rejectionReason: text('rejection_reason'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
});

// Phase 3 (Catalog). Two additions beyond the TRD's literal Section 3.2–3.4
// text, both flagged here rather than silently decided:
//
// 1. `vendors` (TRD Section 3.4) isn't built by any earlier phase, but
//    `vendor_products`/`restaurants` can't have real FKs without it — created
//    now as a necessary prerequisite. `pickup_lat`/`pickup_lng` are captured
//    from the vendor's device at registration (TRD Section 9.2's "set at
//    registration and editable manually"), radius_km defaults to 5.
// 2. `products.mrp` isn't in the TRD's column list, but both the vendor and
//    admin frontend shells already modeled an MRP field independently on
//    their mock Product types, and the PRD's business rule ("vendor cannot
//    set price below an Admin-configured floor," Section 9) implies exactly
//    this kind of catalog-level reference price. Added as products.mrp.
// `menu_items.is_veg` is a similar small addition — standard for Indian food
// delivery, expected by the customer/vendor UIs, absent from the TRD text.
//
// `menu_item_variants` was deferred at first (Phase 3's done-when only
// covered grocery) then added right after, once the gap was flagged: the
// vendor app's menu editor already had a Variants UI with nowhere to
// persist to. Same shape as menu_item_addons, plus is_default. See its
// table definition below, near menu_item_addons.

export const vendorTypeEnum = pgEnum('vendor_type', ['grocery', 'restaurant', 'both']);

export const vendors = pgTable('vendors', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  businessName: varchar('business_name', { length: 200 }).notNull(),
  ownerName: varchar('owner_name', { length: 200 }).notNull(),
  type: vendorTypeEnum('type').notNull(),
  shopAddress: text('shop_address'),
  gstNumber: varchar('gst_number', { length: 50 }),
  aadhaarNumber: varchar('aadhaar_number', { length: 20 }),
  bankAccount: varchar('bank_account', { length: 50 }),
  bankIfsc: varchar('bank_ifsc', { length: 20 }),
  upiId: varchar('upi_id', { length: 100 }),
  // Reuses kyc_document_status's value set (pending|verified|rejected) — same
  // meaning, no need for a second identical enum type.
  kycStatus: kycDocumentStatusEnum('kyc_status').notNull().default('pending'),
  pickupLat: doublePrecision('pickup_lat').notNull(),
  pickupLng: doublePrecision('pickup_lng').notNull(),
  radiusKm: doublePrecision('radius_km').notNull().default(5),
  // Manual master switch — vendor can force-close any time (holiday, out of
  // stock, etc.) regardless of what the weekly schedule below says.
  isOpen: boolean('is_open').notNull().default(true),
  // Post-Phase-11 MVP-completion pass: real weekly business-hours schedule,
  // closing the gap the Phase 11 report flagged (laoji-vendor's
  // BusinessHoursScreen was a fully client-local Zustand mock with no
  // backend persistence). One schedule per vendor account (not per
  // grocery/restaurant mode) — matches the single settings screen the
  // vendor app already has. Null = no schedule configured yet, in which
  // case `isOpen` alone decides open/closed (see
  // `catalog.types.ts#isVendorOpenNow`). Shape:
  // { day: 0-6 (0=Sun), isOpen: boolean, openTime: "HH:mm", closeTime: "HH:mm" }[]
  businessHours: jsonb('business_hours').$type<
    { day: number; isOpen: boolean; openTime: string; closeTime: string }[]
  >(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Phase 5 (Delivery Assignment) — TRD Section 3.4 defines this table, but no
// earlier phase actually created it (only ever referenced in comments).
// current_lat/current_lng are updated periodically while online, foreground
// only (TRD Section 9.3) — never a live-tracked/background position.
export const deliveryPartners = pgTable('delivery_partners', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  // Reuses kyc_document_status's value set, same as vendors.kycStatus.
  kycStatus: kycDocumentStatusEnum('kyc_status').notNull().default('pending'),
  vehicleType: varchar('vehicle_type', { length: 30 }).notNull(),
  aadhaarNumber: varchar('aadhaar_number', { length: 20 }),
  drivingLicense: varchar('driving_license', { length: 50 }),
  bankAccount: varchar('bank_account', { length: 50 }),
  bankIfsc: varchar('bank_ifsc', { length: 20 }),
  upiId: varchar('upi_id', { length: 100 }),
  isOnline: boolean('is_online').notNull().default(false),
  currentLat: doublePrecision('current_lat'),
  currentLng: doublePrecision('current_lng'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // Added reconciling a parallel real-backend-wiring session's profile
  // screen, which shows "Partner since <year>" — genuinely missing before,
  // not backfilled/faked for existing rows (defaults to now() for them).
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  parentId: uuid('parent_id').references((): AnyPgColumn => categories.id),
  name: varchar('name', { length: 150 }).notNull(),
  imageUrl: text('image_url'),
});

export const productStatusEnum = pgEnum('product_status', ['active', 'inactive']);

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id),
  brand: varchar('brand', { length: 150 }),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  unit: varchar('unit', { length: 50 }).notNull(),
  size: varchar('size', { length: 50 }),
  mrp: doublePrecision('mrp'),
  imageUrl: text('image_url'),
  status: productStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const vendorProducts = pgTable(
  'vendor_products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    price: doublePrecision('price').notNull(),
    stockQty: integer('stock_qty').notNull().default(0),
    isAvailable: boolean('is_available').notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('vendor_products_vendor_product_idx').on(table.vendorId, table.productId)],
);

export const restaurants = pgTable('restaurants', {
  id: uuid('id').defaultRandom().primaryKey(),
  vendorId: uuid('vendor_id')
    .notNull()
    .unique()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  cuisineTags: text('cuisine_tags'),
  imageUrl: text('image_url'),
  ratingAvg: doublePrecision('rating_avg').notNull().default(0),
  isOpen: boolean('is_open').notNull().default(true),
});

export const menuCategories = pgTable('menu_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  restaurantId: uuid('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 150 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const menuItems = pgTable('menu_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  menuCategoryId: uuid('menu_category_id')
    .notNull()
    .references(() => menuCategories.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  price: doublePrecision('price').notNull(),
  imageUrl: text('image_url'),
  isVeg: boolean('is_veg').notNull().default(true),
  isAvailable: boolean('is_available').notNull().default(true),
});

export const menuItemAddons = pgTable('menu_item_addons', {
  id: uuid('id').defaultRandom().primaryKey(),
  menuItemId: uuid('menu_item_id')
    .notNull()
    .references(() => menuItems.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 150 }).notNull(),
  price: doublePrecision('price').notNull(),
  isRequired: boolean('is_required').notNull().default(false),
});

// Added post-Phase-3 (flagged then, built now): the vendor app's menu editor
// already had a Variants UI (e.g. Half/Full) with nowhere to persist to —
// the TRD schema only ever defined menu_item_addons. Same shape as addons,
// plus is_default so a variant can pre-select on the customer side.
export const menuItemVariants = pgTable('menu_item_variants', {
  id: uuid('id').defaultRandom().primaryKey(),
  menuItemId: uuid('menu_item_id')
    .notNull()
    .references(() => menuItems.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 150 }).notNull(),
  priceDelta: doublePrecision('price_delta').notNull().default(0),
  isDefault: boolean('is_default').notNull().default(false),
});

// Phase 4 (Orders, Cart & Allocation).
//
// Allocation waterfall implemented: single-vendor-covers-whole-cart ->
// pickup-radius filter -> lowest combined cost -> fastest (closest)
// tiebreak. The TRD's "minimum vendor combination" step (splitting one
// cart across multiple vendors when no single vendor covers it) is NOT
// implemented — that's a real bin-packing problem, not a phase-sized
// feature. If no single vendor covers the full cart, checkout fails
// immediately with a clear error instead of silently guessing at a split.
//
// `order_status`: vendor-controlled prefix (placed..handed_over, Phase 4)
// plus delivery-partner-controlled suffix (delivery_assigned..delivered,
// added in Phase 5). `delivery_assigned` isn't in the TRD's literal state
// diagram — added so "delivery partner accepted the assignment" has a real
// status to log (TRD Section 9.4: every manual action must hit
// order_status_history), matching the same pattern Phase 4 used for
// `vendor_accepted`. Assignment is triggered once the vendor reaches
// `handed_over` — not `ready` — so the vendor's own forward-only sequence
// stays exactly as Phase 4 built it, with no reordering risk.
export const orderStatusEnum = pgEnum('order_status', [
  'placed',
  'vendor_accepted',
  'preparing',
  'ready',
  'handed_over',
  'delivery_assigned',
  'picked_up',
  'out_for_delivery',
  'delivered',
  'failed',
  'cancelled',
]);

export const allocationOutcomeEnum = pgEnum('allocation_outcome', [
  'pending',
  'accepted',
  'rejected',
  'timeout',
]);

export const actorRoleEnum = pgEnum('actor_role', [
  'customer',
  'vendor',
  'delivery_partner',
  'system',
  'admin',
]);

export const groceryOrders = pgTable('grocery_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => users.id),
  status: orderStatusEnum('status').notNull().default('placed'),
  subtotal: doublePrecision('subtotal').notNull(),
  deliveryFee: doublePrecision('delivery_fee').notNull().default(0),
  platformCommission: doublePrecision('platform_commission').notNull().default(0),
  // Phase 8: the *rate* that produced platform_commission above, snapshotted
  // at order-creation time alongside the already-existing computed amount —
  // revenue_config resolution happens once, here, and never again; a later
  // rule change must never retroactively alter an already-placed order.
  commissionPct: doublePrecision('commission_pct').notNull().default(0),
  total: doublePrecision('total').notNull(),
  // Simple string for now — Payment module (Phase 6) owns the real
  // provider-backed payment_status lifecycle behind PaymentProvider.
  paymentStatus: varchar('payment_status', { length: 30 }).notNull().default('pending'),
  instructions: text('instructions'),
  vendorId: uuid('vendor_id').references(() => vendors.id),
  deliveryAddressId: uuid('delivery_address_id')
    .notNull()
    .references(() => addresses.id),
  // Phase 5 additions. deliveryOtp is stored in plain text deliberately —
  // unlike the login OTP (Phase 1, dev-only), this one is a real, repeatedly
  // customer-facing doorstep code for the lifetime of the delivery, not a
  // credential; the customer's own order view has to keep re-displaying it.
  deliveryPartnerId: uuid('delivery_partner_id').references(() => deliveryPartners.id),
  deliveryOtp: varchar('delivery_otp', { length: 6 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const groceryOrderItems = pgTable('grocery_order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  groceryOrderId: uuid('grocery_order_id')
    .notNull()
    .references(() => groceryOrders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id),
  qty: integer('qty').notNull(),
  unitPrice: doublePrecision('unit_price').notNull(),
});

export const allocationAttempts = pgTable('allocation_attempts', {
  id: uuid('id').defaultRandom().primaryKey(),
  groceryOrderId: uuid('grocery_order_id')
    .notNull()
    .references(() => groceryOrders.id, { onDelete: 'cascade' }),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id),
  outcome: allocationOutcomeEnum('outcome').notNull().default('pending'),
  attemptNo: integer('attempt_no').notNull(),
  slaDeadline: timestamp('sla_deadline', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const foodOrders = pgTable('food_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => users.id),
  status: orderStatusEnum('status').notNull().default('placed'),
  subtotal: doublePrecision('subtotal').notNull(),
  deliveryFee: doublePrecision('delivery_fee').notNull().default(0),
  platformCommission: doublePrecision('platform_commission').notNull().default(0),
  commissionPct: doublePrecision('commission_pct').notNull().default(0),
  total: doublePrecision('total').notNull(),
  paymentStatus: varchar('payment_status', { length: 30 }).notNull().default('pending'),
  instructions: text('instructions'),
  restaurantId: uuid('restaurant_id')
    .notNull()
    .references(() => restaurants.id),
  deliveryAddressId: uuid('delivery_address_id')
    .notNull()
    .references(() => addresses.id),
  deliveryPartnerId: uuid('delivery_partner_id').references(() => deliveryPartners.id),
  deliveryOtp: varchar('delivery_otp', { length: 6 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const foodOrderItems = pgTable('food_order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  foodOrderId: uuid('food_order_id')
    .notNull()
    .references(() => foodOrders.id, { onDelete: 'cascade' }),
  menuItemId: uuid('menu_item_id')
    .notNull()
    .references(() => menuItems.id),
  qty: integer('qty').notNull(),
  unitPrice: doublePrecision('unit_price').notNull(),
  // Snapshot of selected variant/addons at order time (name + price each) —
  // menu items can change after an order is placed, so history must not
  // depend on live joins back into menu_items/menu_item_addons.
  addonsJson: jsonb('addons_json'),
});

export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groceryOrderId: uuid('grocery_order_id').references(() => groceryOrders.id, { onDelete: 'cascade' }),
    foodOrderId: uuid('food_order_id').references(() => foodOrders.id, { onDelete: 'cascade' }),
    status: orderStatusEnum('status').notNull(),
    actorRole: actorRoleEnum('actor_role').notNull(),
    changedBy: uuid('changed_by').references(() => users.id),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'order_status_history_exactly_one_order_ref',
      sql`(${table.groceryOrderId} is not null and ${table.foodOrderId} is null) or (${table.groceryOrderId} is null and ${table.foodOrderId} is not null)`,
    ),
  ],
);

// Phase 5 (Delivery Assignment). Not in the TRD's literal schema list — same
// role for delivery matching that allocation_attempts plays for vendor
// matching (TRD Section 9.4's "Admin can see... vendor performance" pattern
// extended to delivery partners). Reuses the exact same
// pending/accepted/rejected/timeout shape and the same JobQueueService
// timeout mechanism as allocation, per the "reuse the pattern, don't
// reinvent it" instruction.
export const deliveryAssignmentOutcomeEnum = pgEnum('delivery_assignment_outcome', [
  'pending',
  'accepted',
  'rejected',
  'timeout',
]);

export const deliveryAssignments = pgTable(
  'delivery_assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groceryOrderId: uuid('grocery_order_id').references(() => groceryOrders.id, { onDelete: 'cascade' }),
    foodOrderId: uuid('food_order_id').references(() => foodOrders.id, { onDelete: 'cascade' }),
    deliveryPartnerId: uuid('delivery_partner_id')
      .notNull()
      .references(() => deliveryPartners.id),
    outcome: deliveryAssignmentOutcomeEnum('outcome').notNull().default('pending'),
    attemptNo: integer('attempt_no').notNull(),
    slaDeadline: timestamp('sla_deadline', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'delivery_assignments_exactly_one_order_ref',
      sql`(${table.groceryOrderId} is not null and ${table.foodOrderId} is null) or (${table.groceryOrderId} is null and ${table.foodOrderId} is not null)`,
    ),
  ],
);

// Phase 6 (Payments). `grocery_orders`/`food_orders.payment_status` (a plain
// varchar since Phase 1) stays as a denormalized read-model column kept in
// sync by PaymentService — cheap for every existing consumer (vendor app's
// PAYMENT_MAP, admin's PaymentBadge) that already reads it as a string. This
// table is the actual source of truth: provider, amount, the UPI deep link
// itself, and reconciliation metadata for the "no reliable UPI webhook"
// manual-reconcile path (TRD Section 4 — treated as a real MVP requirement,
// not an edge case).
export const paymentProviderEnum = pgEnum('payment_provider', ['upi_deeplink', 'cod', 'razorpay']);

// pending: UPI initiated, not yet confirmed either way.
// paid: customer self-confirmed ("I've paid") or admin reconciled as paid.
// failed: admin reconciled as failed (no gateway to auto-detect this at MVP).
// pending_cod / collected: COD's own two-state lifecycle, collected flips
// automatically when Delivery's OTP-verify (Phase 5) completes a COD order.
// refund_pending / refunded: set automatically when an already-`paid` UPI
// order gets rejected/allocation-failed/delivery-failed after the fact — the
// money left the customer's account, so it isn't just "failed", it's owed
// back. No gateway to auto-refund through (same reason `verify()` doesn't
// exist), so `refunded` is only ever reached via admin's manual queue,
// exactly like the `pending` -> `paid`/`failed` reconciliation flow.
export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'paid',
  'failed',
  'pending_cod',
  'collected',
  'refund_pending',
  'refunded',
]);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groceryOrderId: uuid('grocery_order_id').references(() => groceryOrders.id, { onDelete: 'cascade' }),
    foodOrderId: uuid('food_order_id').references(() => foodOrders.id, { onDelete: 'cascade' }),
    provider: paymentProviderEnum('provider').notNull(),
    status: paymentStatusEnum('status').notNull().default('pending'),
    amount: doublePrecision('amount').notNull(),
    upiDeepLink: text('upi_deep_link'),
    // Order id used as the UPI `tr=` reference today; would hold a real
    // gateway payment id once Razorpay (Phase 2, stubbed not implemented)
    // lands for real.
    providerRef: varchar('provider_ref', { length: 100 }),
    reconciledBy: uuid('reconciled_by').references(() => users.id),
    reconciledAt: timestamp('reconciled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'payments_exactly_one_order_ref',
      sql`(${table.groceryOrderId} is not null and ${table.foodOrderId} is null) or (${table.groceryOrderId} is null and ${table.foodOrderId} is not null)`,
    ),
  ],
);

// Phase 7 (Notifications). Matches TRD Section 3.7 exactly: device_tokens
// keyed by user_id + platform (one current token per device type per user
// — a fresh login replaces the old token for that platform rather than
// accumulating stale ones), notification_log as the append-only record of
// every dispatch attempt (channel/template/payload/status), regardless of
// whether the underlying provider is a real send or a dev-mode stub.
export const devicePlatformEnum = pgEnum('device_platform', ['ios', 'android', 'web']);

export const deviceTokens = pgTable(
  'device_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fcmToken: text('fcm_token').notNull(),
    platform: devicePlatformEnum('platform').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('device_tokens_user_platform_idx').on(table.userId, table.platform)],
);

export const notificationChannelEnum = pgEnum('notification_channel', ['push', 'email', 'sms']);
export const notificationStatusEnum = pgEnum('notification_status', ['queued', 'sent', 'failed']);

export const notificationLog = pgTable('notification_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  channel: notificationChannelEnum('channel').notNull(),
  template: varchar('template', { length: 60 }).notNull(),
  payloadJson: jsonb('payload_json').notNull(),
  status: notificationStatusEnum('status').notNull().default('queued'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Phase 8 (Revenue Config & Settlements). Rules are immutable once created
// — a "change" is always a new row with its own effective_from, never an
// UPDATE to an existing one. That's deliberate: it's both the enforcement
// mechanism for "never retroactive" (resolution always picks the winning
// row as of a given order's creation time) and the change-history audit
// trail simultaneously, with no separate history table needed.
export const revenueConfigScopeEnum = pgEnum('revenue_config_scope', ['global', 'category', 'vendor']);

export const revenueConfig = pgTable('revenue_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  scope: revenueConfigScopeEnum('scope').notNull(),
  // Vendor id (scope='vendor') or category id (scope='category'); null for
  // scope='global'. Not a real FK on purpose — a single column has to
  // point at two different tables depending on scope, and Postgres has no
  // clean way to express "FK to A or B" without a lot of extra machinery
  // this MVP doesn't need.
  scopeRefId: uuid('scope_ref_id'),
  commissionPct: doublePrecision('commission_pct').notNull(),
  // Flat fee only — matches the single hardcoded FLAT_DELIVERY_FEE this
  // replaces. A distance/tiered delivery-fee rule isn't implemented (small
  // single-city MVP scope); flagged, not silently modeled as if it existed.
  deliveryFeeFlat: doublePrecision('delivery_fee_flat').notNull(),
  // Max order total eligible for COD; null = no cap.
  codThreshold: doublePrecision('cod_threshold'),
  // Free-text "why this rule exists" — surfaced in Admin's version-history
  // view. Added when the admin UI was reconciled with a separately
  // generated shell that modeled this as a real field.
  notes: text('notes'),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Phase 9 (Product Suggestions, TRD Section 3.2). Vendor-submitted SKUs
// awaiting an Admin catalog decision. `productId` is null until approved —
// set once, pointing at the real row Admin's approval creates via the same
// `CatalogService.createProduct` path Phase 3 built (not a duplicate
// insert), so a suggestion's history stays linked to the product it became.
export const productSuggestionStatusEnum = pgEnum('product_suggestion_status', [
  'pending',
  'approved',
  'rejected',
]);

export const productSuggestions = pgTable('product_suggestions', {
  id: uuid('id').defaultRandom().primaryKey(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id),
  unit: varchar('unit', { length: 50 }).notNull(),
  size: varchar('size', { length: 50 }),
  imageUrl: text('image_url'),
  status: productSuggestionStatusEnum('status').notNull().default('pending'),
  rejectionReason: text('rejection_reason'),
  productId: uuid('product_id').references(() => products.id),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const settlements = pgTable(
  'settlements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groceryOrderId: uuid('grocery_order_id').references(() => groceryOrders.id, { onDelete: 'cascade' }),
    foodOrderId: uuid('food_order_id').references(() => foodOrders.id, { onDelete: 'cascade' }),
    vendorPayout: doublePrecision('vendor_payout').notNull(),
    deliveryPayout: doublePrecision('delivery_payout').notNull(),
    platformShare: doublePrecision('platform_share').notNull(),
    commissionPctSnapshot: doublePrecision('commission_pct_snapshot').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'settlements_exactly_one_order_ref',
      sql`(${table.groceryOrderId} is not null and ${table.foodOrderId} is null) or (${table.groceryOrderId} is null and ${table.foodOrderId} is not null)`,
    ),
  ],
);

// Post-Phase-11 MVP-completion pass: Ratings (Food). PRD Section 5 scopes
// this as MVP for Food, not Phase 2. `restaurants.ratingAvg` existed since
// Phase 3 but had no write path — this table is that write path. Grocery
// has no ratings concept anywhere in the PRD/TRD, so this is food-only
// (mirrors the food-only asymmetry Phase 4 already established for
// allocation/SLA). One rating per food order, only once it's reached
// `delivered`, enforced at the service layer (not a DB constraint, same
// style as the rest of this codebase's business-rule enforcement).
export const foodOrderRatings = pgTable(
  'food_order_ratings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    foodOrderId: uuid('food_order_id')
      .notNull()
      .unique()
      .references(() => foodOrders.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('food_order_ratings_rating_range', sql`${table.rating} between 1 and 5`)],
);
