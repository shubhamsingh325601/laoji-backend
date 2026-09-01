"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.foodOrderRatings = exports.settlements = exports.productSuggestions = exports.productSuggestionStatusEnum = exports.revenueConfig = exports.revenueConfigScopeEnum = exports.notificationLog = exports.notificationStatusEnum = exports.notificationChannelEnum = exports.deviceTokens = exports.devicePlatformEnum = exports.payments = exports.paymentStatusEnum = exports.paymentProviderEnum = exports.deliveryAssignments = exports.deliveryAssignmentOutcomeEnum = exports.orderStatusHistory = exports.foodOrderItems = exports.foodOrders = exports.allocationAttempts = exports.groceryOrderItems = exports.groceryOrders = exports.actorRoleEnum = exports.allocationOutcomeEnum = exports.orderStatusEnum = exports.menuItemVariants = exports.menuItemAddons = exports.menuItems = exports.menuCategories = exports.restaurants = exports.vendorProducts = exports.products = exports.productStatusEnum = exports.categories = exports.deliveryPartners = exports.vendors = exports.vendorTypeEnum = exports.kycDocuments = exports.kycDocumentStatusEnum = exports.otpCodes = exports.addresses = exports.authTokens = exports.users = exports.userStatusEnum = exports.userRoleEnum = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
exports.userRoleEnum = (0, pg_core_1.pgEnum)('user_role', [
    'customer',
    'vendor',
    'delivery_partner',
    'admin',
]);
exports.userStatusEnum = (0, pg_core_1.pgEnum)('user_status', ['active', 'suspended']);
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    phone: (0, pg_core_1.varchar)('phone', { length: 20 }),
    email: (0, pg_core_1.varchar)('email', { length: 255 }),
    passwordHash: (0, pg_core_1.text)('password_hash'),
    role: (0, exports.userRoleEnum)('role').notNull(),
    status: (0, exports.userStatusEnum)('status').notNull().default('active'),
    mustChangePassword: (0, pg_core_1.boolean)('must_change_password').notNull().default(false),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('users_phone_role_idx').on(table.phone, table.role),
    (0, pg_core_1.uniqueIndex)('users_email_idx').on(table.email),
]);
exports.authTokens = (0, pg_core_1.pgTable)('auth_tokens', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id')
        .notNull()
        .references(() => exports.users.id, { onDelete: 'cascade' }),
    refreshTokenHash: (0, pg_core_1.text)('refresh_token_hash').notNull(),
    deviceId: (0, pg_core_1.varchar)('device_id', { length: 255 }),
    expiresAt: (0, pg_core_1.timestamp)('expires_at', { withTimezone: true }).notNull(),
    revokedAt: (0, pg_core_1.timestamp)('revoked_at', { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.addresses = (0, pg_core_1.pgTable)('addresses', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id')
        .notNull()
        .references(() => exports.users.id, { onDelete: 'cascade' }),
    label: (0, pg_core_1.varchar)('label', { length: 100 }),
    lat: (0, pg_core_1.doublePrecision)('lat').notNull(),
    lng: (0, pg_core_1.doublePrecision)('lng').notNull(),
    formattedAddress: (0, pg_core_1.text)('formatted_address').notNull(),
    isDefault: (0, pg_core_1.boolean)('is_default').notNull().default(false),
});
exports.otpCodes = (0, pg_core_1.pgTable)('otp_codes', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    phone: (0, pg_core_1.varchar)('phone', { length: 20 }).notNull(),
    purpose: (0, pg_core_1.varchar)('purpose', { length: 30 }).notNull().default('login'),
    codeHash: (0, pg_core_1.text)('code_hash').notNull(),
    attemptCount: (0, pg_core_1.integer)('attempt_count').notNull().default(0),
    expiresAt: (0, pg_core_1.timestamp)('expires_at', { withTimezone: true }).notNull(),
    consumedAt: (0, pg_core_1.timestamp)('consumed_at', { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.kycDocumentStatusEnum = (0, pg_core_1.pgEnum)('kyc_document_status', [
    'pending',
    'verified',
    'rejected',
]);
exports.kycDocuments = (0, pg_core_1.pgTable)('kyc_documents', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id')
        .notNull()
        .references(() => exports.users.id, { onDelete: 'cascade' }),
    role: (0, exports.userRoleEnum)('role').notNull(),
    docType: (0, pg_core_1.varchar)('doc_type', { length: 50 }).notNull(),
    secureUrl: (0, pg_core_1.text)('secure_url').notNull(),
    publicId: (0, pg_core_1.varchar)('public_id', { length: 255 }).notNull(),
    status: (0, exports.kycDocumentStatusEnum)('status').notNull().default('pending'),
    rejectionReason: (0, pg_core_1.text)('rejection_reason'),
    reviewedBy: (0, pg_core_1.uuid)('reviewed_by').references(() => exports.users.id),
    reviewedAt: (0, pg_core_1.timestamp)('reviewed_at', { withTimezone: true }),
    uploadedAt: (0, pg_core_1.timestamp)('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.vendorTypeEnum = (0, pg_core_1.pgEnum)('vendor_type', ['grocery', 'restaurant', 'both']);
exports.vendors = (0, pg_core_1.pgTable)('vendors', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id')
        .notNull()
        .unique()
        .references(() => exports.users.id, { onDelete: 'cascade' }),
    businessName: (0, pg_core_1.varchar)('business_name', { length: 200 }).notNull(),
    ownerName: (0, pg_core_1.varchar)('owner_name', { length: 200 }).notNull(),
    type: (0, exports.vendorTypeEnum)('type').notNull(),
    shopAddress: (0, pg_core_1.text)('shop_address'),
    gstNumber: (0, pg_core_1.varchar)('gst_number', { length: 50 }),
    aadhaarNumber: (0, pg_core_1.varchar)('aadhaar_number', { length: 20 }),
    bankAccount: (0, pg_core_1.varchar)('bank_account', { length: 50 }),
    bankIfsc: (0, pg_core_1.varchar)('bank_ifsc', { length: 20 }),
    upiId: (0, pg_core_1.varchar)('upi_id', { length: 100 }),
    kycStatus: (0, exports.kycDocumentStatusEnum)('kyc_status').notNull().default('pending'),
    pickupLat: (0, pg_core_1.doublePrecision)('pickup_lat').notNull(),
    pickupLng: (0, pg_core_1.doublePrecision)('pickup_lng').notNull(),
    radiusKm: (0, pg_core_1.doublePrecision)('radius_km').notNull().default(5),
    isOpen: (0, pg_core_1.boolean)('is_open').notNull().default(true),
    businessHours: (0, pg_core_1.jsonb)('business_hours').$type(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.deliveryPartners = (0, pg_core_1.pgTable)('delivery_partners', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id')
        .notNull()
        .unique()
        .references(() => exports.users.id, { onDelete: 'cascade' }),
    kycStatus: (0, exports.kycDocumentStatusEnum)('kyc_status').notNull().default('pending'),
    vehicleType: (0, pg_core_1.varchar)('vehicle_type', { length: 30 }).notNull(),
    aadhaarNumber: (0, pg_core_1.varchar)('aadhaar_number', { length: 20 }),
    drivingLicense: (0, pg_core_1.varchar)('driving_license', { length: 50 }),
    bankAccount: (0, pg_core_1.varchar)('bank_account', { length: 50 }),
    bankIfsc: (0, pg_core_1.varchar)('bank_ifsc', { length: 20 }),
    upiId: (0, pg_core_1.varchar)('upi_id', { length: 100 }),
    isOnline: (0, pg_core_1.boolean)('is_online').notNull().default(false),
    currentLat: (0, pg_core_1.doublePrecision)('current_lat'),
    currentLng: (0, pg_core_1.doublePrecision)('current_lng'),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.categories = (0, pg_core_1.pgTable)('categories', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    parentId: (0, pg_core_1.uuid)('parent_id').references(() => exports.categories.id),
    name: (0, pg_core_1.varchar)('name', { length: 150 }).notNull(),
    imageUrl: (0, pg_core_1.text)('image_url'),
});
exports.productStatusEnum = (0, pg_core_1.pgEnum)('product_status', ['active', 'inactive']);
exports.products = (0, pg_core_1.pgTable)('products', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    categoryId: (0, pg_core_1.uuid)('category_id')
        .notNull()
        .references(() => exports.categories.id),
    brand: (0, pg_core_1.varchar)('brand', { length: 150 }),
    name: (0, pg_core_1.varchar)('name', { length: 200 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    unit: (0, pg_core_1.varchar)('unit', { length: 50 }).notNull(),
    size: (0, pg_core_1.varchar)('size', { length: 50 }),
    mrp: (0, pg_core_1.doublePrecision)('mrp'),
    imageUrl: (0, pg_core_1.text)('image_url'),
    status: (0, exports.productStatusEnum)('status').notNull().default('active'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.vendorProducts = (0, pg_core_1.pgTable)('vendor_products', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    vendorId: (0, pg_core_1.uuid)('vendor_id')
        .notNull()
        .references(() => exports.vendors.id, { onDelete: 'cascade' }),
    productId: (0, pg_core_1.uuid)('product_id')
        .notNull()
        .references(() => exports.products.id, { onDelete: 'cascade' }),
    price: (0, pg_core_1.doublePrecision)('price').notNull(),
    stockQty: (0, pg_core_1.integer)('stock_qty').notNull().default(0),
    isAvailable: (0, pg_core_1.boolean)('is_available').notNull().default(true),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [(0, pg_core_1.uniqueIndex)('vendor_products_vendor_product_idx').on(table.vendorId, table.productId)]);
exports.restaurants = (0, pg_core_1.pgTable)('restaurants', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    vendorId: (0, pg_core_1.uuid)('vendor_id')
        .notNull()
        .unique()
        .references(() => exports.vendors.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.varchar)('name', { length: 200 }).notNull(),
    cuisineTags: (0, pg_core_1.text)('cuisine_tags'),
    imageUrl: (0, pg_core_1.text)('image_url'),
    ratingAvg: (0, pg_core_1.doublePrecision)('rating_avg').notNull().default(0),
    isOpen: (0, pg_core_1.boolean)('is_open').notNull().default(true),
});
exports.menuCategories = (0, pg_core_1.pgTable)('menu_categories', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    restaurantId: (0, pg_core_1.uuid)('restaurant_id')
        .notNull()
        .references(() => exports.restaurants.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.varchar)('name', { length: 150 }).notNull(),
    sortOrder: (0, pg_core_1.integer)('sort_order').notNull().default(0),
});
exports.menuItems = (0, pg_core_1.pgTable)('menu_items', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    menuCategoryId: (0, pg_core_1.uuid)('menu_category_id')
        .notNull()
        .references(() => exports.menuCategories.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.varchar)('name', { length: 200 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    price: (0, pg_core_1.doublePrecision)('price').notNull(),
    imageUrl: (0, pg_core_1.text)('image_url'),
    isVeg: (0, pg_core_1.boolean)('is_veg').notNull().default(true),
    isAvailable: (0, pg_core_1.boolean)('is_available').notNull().default(true),
});
exports.menuItemAddons = (0, pg_core_1.pgTable)('menu_item_addons', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    menuItemId: (0, pg_core_1.uuid)('menu_item_id')
        .notNull()
        .references(() => exports.menuItems.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.varchar)('name', { length: 150 }).notNull(),
    price: (0, pg_core_1.doublePrecision)('price').notNull(),
    isRequired: (0, pg_core_1.boolean)('is_required').notNull().default(false),
});
exports.menuItemVariants = (0, pg_core_1.pgTable)('menu_item_variants', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    menuItemId: (0, pg_core_1.uuid)('menu_item_id')
        .notNull()
        .references(() => exports.menuItems.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.varchar)('name', { length: 150 }).notNull(),
    priceDelta: (0, pg_core_1.doublePrecision)('price_delta').notNull().default(0),
    isDefault: (0, pg_core_1.boolean)('is_default').notNull().default(false),
});
exports.orderStatusEnum = (0, pg_core_1.pgEnum)('order_status', [
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
exports.allocationOutcomeEnum = (0, pg_core_1.pgEnum)('allocation_outcome', [
    'pending',
    'accepted',
    'rejected',
    'timeout',
]);
exports.actorRoleEnum = (0, pg_core_1.pgEnum)('actor_role', [
    'customer',
    'vendor',
    'delivery_partner',
    'system',
    'admin',
]);
exports.groceryOrders = (0, pg_core_1.pgTable)('grocery_orders', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    customerId: (0, pg_core_1.uuid)('customer_id')
        .notNull()
        .references(() => exports.users.id),
    status: (0, exports.orderStatusEnum)('status').notNull().default('placed'),
    subtotal: (0, pg_core_1.doublePrecision)('subtotal').notNull(),
    deliveryFee: (0, pg_core_1.doublePrecision)('delivery_fee').notNull().default(0),
    platformCommission: (0, pg_core_1.doublePrecision)('platform_commission').notNull().default(0),
    commissionPct: (0, pg_core_1.doublePrecision)('commission_pct').notNull().default(0),
    total: (0, pg_core_1.doublePrecision)('total').notNull(),
    paymentStatus: (0, pg_core_1.varchar)('payment_status', { length: 30 }).notNull().default('pending'),
    instructions: (0, pg_core_1.text)('instructions'),
    vendorId: (0, pg_core_1.uuid)('vendor_id').references(() => exports.vendors.id),
    deliveryAddressId: (0, pg_core_1.uuid)('delivery_address_id')
        .notNull()
        .references(() => exports.addresses.id),
    deliveryPartnerId: (0, pg_core_1.uuid)('delivery_partner_id').references(() => exports.deliveryPartners.id),
    deliveryOtp: (0, pg_core_1.varchar)('delivery_otp', { length: 6 }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.groceryOrderItems = (0, pg_core_1.pgTable)('grocery_order_items', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    groceryOrderId: (0, pg_core_1.uuid)('grocery_order_id')
        .notNull()
        .references(() => exports.groceryOrders.id, { onDelete: 'cascade' }),
    productId: (0, pg_core_1.uuid)('product_id')
        .notNull()
        .references(() => exports.products.id),
    qty: (0, pg_core_1.integer)('qty').notNull(),
    unitPrice: (0, pg_core_1.doublePrecision)('unit_price').notNull(),
});
exports.allocationAttempts = (0, pg_core_1.pgTable)('allocation_attempts', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    groceryOrderId: (0, pg_core_1.uuid)('grocery_order_id')
        .notNull()
        .references(() => exports.groceryOrders.id, { onDelete: 'cascade' }),
    vendorId: (0, pg_core_1.uuid)('vendor_id')
        .notNull()
        .references(() => exports.vendors.id),
    outcome: (0, exports.allocationOutcomeEnum)('outcome').notNull().default('pending'),
    attemptNo: (0, pg_core_1.integer)('attempt_no').notNull(),
    slaDeadline: (0, pg_core_1.timestamp)('sla_deadline', { withTimezone: true }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.foodOrders = (0, pg_core_1.pgTable)('food_orders', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    customerId: (0, pg_core_1.uuid)('customer_id')
        .notNull()
        .references(() => exports.users.id),
    status: (0, exports.orderStatusEnum)('status').notNull().default('placed'),
    subtotal: (0, pg_core_1.doublePrecision)('subtotal').notNull(),
    deliveryFee: (0, pg_core_1.doublePrecision)('delivery_fee').notNull().default(0),
    platformCommission: (0, pg_core_1.doublePrecision)('platform_commission').notNull().default(0),
    commissionPct: (0, pg_core_1.doublePrecision)('commission_pct').notNull().default(0),
    total: (0, pg_core_1.doublePrecision)('total').notNull(),
    paymentStatus: (0, pg_core_1.varchar)('payment_status', { length: 30 }).notNull().default('pending'),
    instructions: (0, pg_core_1.text)('instructions'),
    restaurantId: (0, pg_core_1.uuid)('restaurant_id')
        .notNull()
        .references(() => exports.restaurants.id),
    deliveryAddressId: (0, pg_core_1.uuid)('delivery_address_id')
        .notNull()
        .references(() => exports.addresses.id),
    deliveryPartnerId: (0, pg_core_1.uuid)('delivery_partner_id').references(() => exports.deliveryPartners.id),
    deliveryOtp: (0, pg_core_1.varchar)('delivery_otp', { length: 6 }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.foodOrderItems = (0, pg_core_1.pgTable)('food_order_items', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    foodOrderId: (0, pg_core_1.uuid)('food_order_id')
        .notNull()
        .references(() => exports.foodOrders.id, { onDelete: 'cascade' }),
    menuItemId: (0, pg_core_1.uuid)('menu_item_id')
        .notNull()
        .references(() => exports.menuItems.id),
    qty: (0, pg_core_1.integer)('qty').notNull(),
    unitPrice: (0, pg_core_1.doublePrecision)('unit_price').notNull(),
    addonsJson: (0, pg_core_1.jsonb)('addons_json'),
});
exports.orderStatusHistory = (0, pg_core_1.pgTable)('order_status_history', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    groceryOrderId: (0, pg_core_1.uuid)('grocery_order_id').references(() => exports.groceryOrders.id, { onDelete: 'cascade' }),
    foodOrderId: (0, pg_core_1.uuid)('food_order_id').references(() => exports.foodOrders.id, { onDelete: 'cascade' }),
    status: (0, exports.orderStatusEnum)('status').notNull(),
    actorRole: (0, exports.actorRoleEnum)('actor_role').notNull(),
    changedBy: (0, pg_core_1.uuid)('changed_by').references(() => exports.users.id),
    changedAt: (0, pg_core_1.timestamp)('changed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.check)('order_status_history_exactly_one_order_ref', (0, drizzle_orm_1.sql) `(${table.groceryOrderId} is not null and ${table.foodOrderId} is null) or (${table.groceryOrderId} is null and ${table.foodOrderId} is not null)`),
]);
exports.deliveryAssignmentOutcomeEnum = (0, pg_core_1.pgEnum)('delivery_assignment_outcome', [
    'pending',
    'accepted',
    'rejected',
    'timeout',
]);
exports.deliveryAssignments = (0, pg_core_1.pgTable)('delivery_assignments', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    groceryOrderId: (0, pg_core_1.uuid)('grocery_order_id').references(() => exports.groceryOrders.id, { onDelete: 'cascade' }),
    foodOrderId: (0, pg_core_1.uuid)('food_order_id').references(() => exports.foodOrders.id, { onDelete: 'cascade' }),
    deliveryPartnerId: (0, pg_core_1.uuid)('delivery_partner_id')
        .notNull()
        .references(() => exports.deliveryPartners.id),
    outcome: (0, exports.deliveryAssignmentOutcomeEnum)('outcome').notNull().default('pending'),
    attemptNo: (0, pg_core_1.integer)('attempt_no').notNull(),
    slaDeadline: (0, pg_core_1.timestamp)('sla_deadline', { withTimezone: true }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.check)('delivery_assignments_exactly_one_order_ref', (0, drizzle_orm_1.sql) `(${table.groceryOrderId} is not null and ${table.foodOrderId} is null) or (${table.groceryOrderId} is null and ${table.foodOrderId} is not null)`),
]);
exports.paymentProviderEnum = (0, pg_core_1.pgEnum)('payment_provider', ['upi_deeplink', 'cod', 'razorpay']);
exports.paymentStatusEnum = (0, pg_core_1.pgEnum)('payment_status', [
    'pending',
    'paid',
    'failed',
    'pending_cod',
    'collected',
    'refund_pending',
    'refunded',
]);
exports.payments = (0, pg_core_1.pgTable)('payments', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    groceryOrderId: (0, pg_core_1.uuid)('grocery_order_id').references(() => exports.groceryOrders.id, { onDelete: 'cascade' }),
    foodOrderId: (0, pg_core_1.uuid)('food_order_id').references(() => exports.foodOrders.id, { onDelete: 'cascade' }),
    provider: (0, exports.paymentProviderEnum)('provider').notNull(),
    status: (0, exports.paymentStatusEnum)('status').notNull().default('pending'),
    amount: (0, pg_core_1.doublePrecision)('amount').notNull(),
    upiDeepLink: (0, pg_core_1.text)('upi_deep_link'),
    providerRef: (0, pg_core_1.varchar)('provider_ref', { length: 100 }),
    reconciledBy: (0, pg_core_1.uuid)('reconciled_by').references(() => exports.users.id),
    reconciledAt: (0, pg_core_1.timestamp)('reconciled_at', { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.check)('payments_exactly_one_order_ref', (0, drizzle_orm_1.sql) `(${table.groceryOrderId} is not null and ${table.foodOrderId} is null) or (${table.groceryOrderId} is null and ${table.foodOrderId} is not null)`),
]);
exports.devicePlatformEnum = (0, pg_core_1.pgEnum)('device_platform', ['ios', 'android', 'web']);
exports.deviceTokens = (0, pg_core_1.pgTable)('device_tokens', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id')
        .notNull()
        .references(() => exports.users.id, { onDelete: 'cascade' }),
    fcmToken: (0, pg_core_1.text)('fcm_token').notNull(),
    platform: (0, exports.devicePlatformEnum)('platform').notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [(0, pg_core_1.uniqueIndex)('device_tokens_user_platform_idx').on(table.userId, table.platform)]);
exports.notificationChannelEnum = (0, pg_core_1.pgEnum)('notification_channel', ['push', 'email', 'sms']);
exports.notificationStatusEnum = (0, pg_core_1.pgEnum)('notification_status', ['queued', 'sent', 'failed']);
exports.notificationLog = (0, pg_core_1.pgTable)('notification_log', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id')
        .notNull()
        .references(() => exports.users.id, { onDelete: 'cascade' }),
    channel: (0, exports.notificationChannelEnum)('channel').notNull(),
    template: (0, pg_core_1.varchar)('template', { length: 60 }).notNull(),
    payloadJson: (0, pg_core_1.jsonb)('payload_json').notNull(),
    status: (0, exports.notificationStatusEnum)('status').notNull().default('queued'),
    sentAt: (0, pg_core_1.timestamp)('sent_at', { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.revenueConfigScopeEnum = (0, pg_core_1.pgEnum)('revenue_config_scope', ['global', 'category', 'vendor']);
exports.revenueConfig = (0, pg_core_1.pgTable)('revenue_config', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    scope: (0, exports.revenueConfigScopeEnum)('scope').notNull(),
    scopeRefId: (0, pg_core_1.uuid)('scope_ref_id'),
    commissionPct: (0, pg_core_1.doublePrecision)('commission_pct').notNull(),
    deliveryFeeFlat: (0, pg_core_1.doublePrecision)('delivery_fee_flat').notNull(),
    codThreshold: (0, pg_core_1.doublePrecision)('cod_threshold'),
    notes: (0, pg_core_1.text)('notes'),
    effectiveFrom: (0, pg_core_1.timestamp)('effective_from', { withTimezone: true }).notNull(),
    createdBy: (0, pg_core_1.uuid)('created_by').references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.productSuggestionStatusEnum = (0, pg_core_1.pgEnum)('product_suggestion_status', [
    'pending',
    'approved',
    'rejected',
]);
exports.productSuggestions = (0, pg_core_1.pgTable)('product_suggestions', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    vendorId: (0, pg_core_1.uuid)('vendor_id')
        .notNull()
        .references(() => exports.vendors.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.varchar)('name', { length: 200 }).notNull(),
    categoryId: (0, pg_core_1.uuid)('category_id')
        .notNull()
        .references(() => exports.categories.id),
    unit: (0, pg_core_1.varchar)('unit', { length: 50 }).notNull(),
    size: (0, pg_core_1.varchar)('size', { length: 50 }),
    imageUrl: (0, pg_core_1.text)('image_url'),
    status: (0, exports.productSuggestionStatusEnum)('status').notNull().default('pending'),
    rejectionReason: (0, pg_core_1.text)('rejection_reason'),
    productId: (0, pg_core_1.uuid)('product_id').references(() => exports.products.id),
    reviewedBy: (0, pg_core_1.uuid)('reviewed_by').references(() => exports.users.id),
    reviewedAt: (0, pg_core_1.timestamp)('reviewed_at', { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.settlements = (0, pg_core_1.pgTable)('settlements', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    groceryOrderId: (0, pg_core_1.uuid)('grocery_order_id').references(() => exports.groceryOrders.id, { onDelete: 'cascade' }),
    foodOrderId: (0, pg_core_1.uuid)('food_order_id').references(() => exports.foodOrders.id, { onDelete: 'cascade' }),
    vendorPayout: (0, pg_core_1.doublePrecision)('vendor_payout').notNull(),
    deliveryPayout: (0, pg_core_1.doublePrecision)('delivery_payout').notNull(),
    platformShare: (0, pg_core_1.doublePrecision)('platform_share').notNull(),
    commissionPctSnapshot: (0, pg_core_1.doublePrecision)('commission_pct_snapshot').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.check)('settlements_exactly_one_order_ref', (0, drizzle_orm_1.sql) `(${table.groceryOrderId} is not null and ${table.foodOrderId} is null) or (${table.groceryOrderId} is null and ${table.foodOrderId} is not null)`),
]);
exports.foodOrderRatings = (0, pg_core_1.pgTable)('food_order_ratings', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    foodOrderId: (0, pg_core_1.uuid)('food_order_id')
        .notNull()
        .unique()
        .references(() => exports.foodOrders.id, { onDelete: 'cascade' }),
    customerId: (0, pg_core_1.uuid)('customer_id')
        .notNull()
        .references(() => exports.users.id),
    restaurantId: (0, pg_core_1.uuid)('restaurant_id')
        .notNull()
        .references(() => exports.restaurants.id, { onDelete: 'cascade' }),
    rating: (0, pg_core_1.integer)('rating').notNull(),
    comment: (0, pg_core_1.text)('comment'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [(0, pg_core_1.check)('food_order_ratings_rating_range', (0, drizzle_orm_1.sql) `${table.rating} between 1 and 5`)]);
//# sourceMappingURL=schema.js.map