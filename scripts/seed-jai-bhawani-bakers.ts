import 'dotenv/config';
import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, inArray } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import * as dns from 'dns/promises';
import { parse } from 'pg-connection-string';
import {
  users,
  vendors,
  restaurants,
  menuCategories,
  menuItems,
  menuItemAddons,
} from '../drizzle/schema';

interface MenuItemSpec {
  name: string;
  price: number;
  description: string;
  image: string;
  hasAddons?: boolean;
}

interface CategorySpec {
  name: string;
  sortOrder: number;
  items: MenuItemSpec[];
}

const JAI_BHAWANI_MENU: CategorySpec[] = [
  {
    name: 'Fresh Baked Pizza',
    sortOrder: 1,
    items: [
      {
        name: 'Paneer Pizza',
        price: 120,
        description: 'Fresh pizza crust topped with soft paneer cubes, capsicum, onions & mozzarella cheese (Panir Pijaa)',
        image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500',
        hasAddons: true,
      },
      {
        name: 'Tandoori Pizza',
        price: 140,
        description: 'Crisp pizza loaded with smoky spiced tandoori paneer, onions & tandoori sauce (Tanduri Pijaa)',
        image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500',
        hasAddons: true,
      },
      {
        name: 'Special Pizza',
        price: 170,
        description: 'Jai Bhawani chef special loaded pizza with extra cheese burst, double paneer & rich toppings (Spaisal Pijaa)',
        image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500',
        hasAddons: true,
      },
    ],
  },
  {
    name: 'Patties & Puffs',
    sortOrder: 2,
    items: [
      {
        name: 'Masala Patties',
        price: 30,
        description: 'Crisp & flaky baked golden puff stuffed with spicy seasoned potato filling (Masala Petij)',
        image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500',
        hasAddons: true,
      },
      {
        name: 'Cheese Patties',
        price: 40,
        description: 'Golden baked flaky puff loaded with savory filling and melted gooey cheese (Chij Petij)',
        image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500',
        hasAddons: true,
      },
      {
        name: 'Mozzarella Cheese Patties',
        price: 45,
        description: 'Crispy flaky patties stuffed with stretchy premium mozzarella cheese & herbs (Mojo Rola Chij Petij)',
        image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500',
        hasAddons: true,
      },
      {
        name: 'Paneer Patties',
        price: 50,
        description: 'Flaky baked puff pastry filled with delicious spiced fresh cottage cheese (Panir Petij)',
        image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500',
        hasAddons: true,
      },
      {
        name: 'Special Patties',
        price: 60,
        description: 'Jai Bhawani signature jumbo special patties packed with paneer, cheese & spices (Spaisal Petij)',
        image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500',
        hasAddons: true,
      },
    ],
  },
  {
    name: 'Sandwiches',
    sortOrder: 3,
    items: [
      {
        name: 'Veg Sandwich',
        price: 50,
        description: 'Freshly prepared grilled sandwich with crunchy garden vegetables & green mint chutney (Vej Sandwich)',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500',
        hasAddons: true,
      },
      {
        name: 'Cheese Sandwich',
        price: 60,
        description: 'Golden grilled sandwich toasted with rich melted cheese and seasoned herbs (Chij Sandwich)',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500',
        hasAddons: true,
      },
      {
        name: 'Paneer Tikka Sandwich',
        price: 70,
        description: 'Toasted crisp bread packed with spiced paneer tikka chunks and tangy sauces (Panir Tika Sandwich)',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500',
        hasAddons: true,
      },
      {
        name: 'Lajawab Sandwich',
        price: 90,
        description: 'Chef signature super loaded multi-decker sandwich with double paneer, cheese & secret spices (Lajwab Sandwich)',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500',
        hasAddons: true,
      },
    ],
  },
  {
    name: 'Fast Food & Noodles',
    sortOrder: 4,
    items: [
      {
        name: 'Masala Maggi',
        price: 50,
        description: 'Hot and delicious spiced classic Maggi noodles tossed with fresh vegetables & butter (Meggi)',
        image: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=500',
      },
      {
        name: 'Veg Chowmein',
        price: 60,
        description: 'Wok tossed street style noodles with crunchy cabbage, bell peppers, carrots & chili garlic (Charmin)',
        image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500',
      },
    ],
  },
];

const STANDARD_ADDONS = [
  { name: 'Extra Cheese', price: 15 },
  { name: 'Extra Mayonnaise', price: 10 },
  { name: 'Extra Paneer', price: 20 },
];

async function main() {
  const config = parse(process.env.DATABASE_URL!);
  const [{ address }] = await dns.lookup(config.host!, { all: true });
  const client = new Client({
    host: address,
    port: config.port ? Number(config.port) : 5432,
    user: config.user,
    password: config.password ?? undefined,
    database: config.database ?? undefined,
    ssl: { servername: config.host || undefined, rejectUnauthorized: false },
  });

  await client.connect();
  const db = drizzle(client);

  const phone = '8239892814';
  const email = 'laliitsuman@gmail.com';
  const plainPassword = 'JaiBhawani@123';
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const businessName = 'Jai Bhawani Bakers';
  const ownerName = 'Lalit suman';
  const shopAddress = 'Kothi wale Balaji ke samne, Sangod, Rajasthan 325601';
  const cuisineTags = 'Bakery nd fastfood, Pizza, Patties, Sandwiches, Chinese, Snacks';
  const storeImage = 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800';
  const sangodLat = 24.924;
  const sangodLng = 76.283;

  const businessHours = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    isOpen: true,
    openTime: '07:00',
    closeTime: '23:00',
  }));

  console.log('\n======================================================');
  console.log('SEEDING VENDOR: Jai Bhawani Bakers (Lalit suman)');
  console.log('======================================================');

  // 1. Ensure User
  console.log('\n1. User setup...');
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        phone,
        email,
        name: `${ownerName} (${businessName})`,
        role: 'vendor',
        status: 'active',
        passwordHash,
        mustChangePassword: false,
      })
      .returning();
    console.log(`✔ User created: ID ${user.id} | Phone: ${user.phone}`);
  } else {
    [user] = await db
      .update(users)
      .set({
        email,
        name: `${ownerName} (${businessName})`,
        role: 'vendor',
        status: 'active',
        passwordHash,
        mustChangePassword: false,
      })
      .where(eq(users.id, user.id))
      .returning();
    console.log(`✔ User updated: ID ${user.id} | Phone: ${user.phone}`);
  }

  // 2. Ensure Vendor
  console.log('\n2. Vendor setup...');
  let [vendor] = await db
    .select()
    .from(vendors)
    .where(eq(vendors.userId, user.id))
    .limit(1);

  if (!vendor) {
    [vendor] = await db
      .insert(vendors)
      .values({
        userId: user.id,
        businessName,
        ownerName,
        type: 'restaurant',
        businessType: 'restaurant',
        shopAddress,
        pickupLat: sangodLat,
        pickupLng: sangodLng,
        radiusKm: 15,
        kycStatus: 'verified',
        isOpen: true,
        businessHours,
        imageUrl: storeImage,
      })
      .returning();
    console.log(`✔ Vendor created: ID ${vendor.id} | ${vendor.businessName}`);
  } else {
    [vendor] = await db
      .update(vendors)
      .set({
        businessName,
        ownerName,
        type: 'restaurant',
        businessType: 'restaurant',
        shopAddress,
        pickupLat: sangodLat,
        pickupLng: sangodLng,
        radiusKm: 15,
        kycStatus: 'verified',
        isOpen: true,
        businessHours,
        imageUrl: storeImage,
      })
      .where(eq(vendors.id, vendor.id))
      .returning();
    console.log(`✔ Vendor updated: ID ${vendor.id} | ${vendor.businessName}`);
  }

  // 3. Ensure Restaurant
  console.log('\n3. Restaurant setup...');
  let [restaurant] = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.vendorId, vendor.id))
    .limit(1);

  if (!restaurant) {
    [restaurant] = await db
      .insert(restaurants)
      .values({
        vendorId: vendor.id,
        name: businessName,
        cuisineTags,
        imageUrl: storeImage,
        ratingAvg: 4.8,
        isOpen: true,
      })
      .returning();
    console.log(`✔ Restaurant created: ID ${restaurant.id} | ${restaurant.name}`);
  } else {
    [restaurant] = await db
      .update(restaurants)
      .set({
        name: businessName,
        cuisineTags,
        imageUrl: storeImage,
        ratingAvg: 4.8,
        isOpen: true,
      })
      .where(eq(restaurants.id, restaurant.id))
      .returning();
    console.log(`✔ Restaurant updated: ID ${restaurant.id} | ${restaurant.name}`);
  }

  // 4. Upsert Menu Categories and Menu Items
  console.log('\n4. Upserting Menu Categories & Items...');
  let totalCategories = 0;
  let totalItems = 0;
  let totalAddons = 0;

  for (const catSpec of JAI_BHAWANI_MENU) {
    let [catRow] = await db
      .select()
      .from(menuCategories)
      .where(and(eq(menuCategories.restaurantId, restaurant.id), eq(menuCategories.name, catSpec.name)))
      .limit(1);

    if (!catRow) {
      [catRow] = await db
        .insert(menuCategories)
        .values({
          restaurantId: restaurant.id,
          name: catSpec.name,
          sortOrder: catSpec.sortOrder,
        })
        .returning();
      console.log(`  + Category created: "${catRow.name}" (ID: ${catRow.id})`);
    } else {
      [catRow] = await db
        .update(menuCategories)
        .set({ sortOrder: catSpec.sortOrder })
        .where(eq(menuCategories.id, catRow.id))
        .returning();
      console.log(`  ~ Category updated: "${catRow.name}" (ID: ${catRow.id})`);
    }
    totalCategories++;

    for (const itemSpec of catSpec.items) {
      let [itemRow] = await db
        .select()
        .from(menuItems)
        .where(and(eq(menuItems.menuCategoryId, catRow.id), eq(menuItems.name, itemSpec.name)))
        .limit(1);

      if (!itemRow) {
        [itemRow] = await db
          .insert(menuItems)
          .values({
            menuCategoryId: catRow.id,
            name: itemSpec.name,
            description: itemSpec.description,
            price: itemSpec.price,
            imageUrl: itemSpec.image,
            isVeg: true,
            isAvailable: true,
          })
          .returning();
        console.log(`    + Item created: ${itemRow.name} (₹${itemRow.price})`);
      } else {
        [itemRow] = await db
          .update(menuItems)
          .set({
            description: itemSpec.description,
            price: itemSpec.price,
            imageUrl: itemSpec.image,
            isVeg: true,
            isAvailable: true,
          })
          .where(eq(menuItems.id, itemRow.id))
          .returning();
        console.log(`    ~ Item updated: ${itemRow.name} (₹${itemRow.price})`);
      }
      totalItems++;

      // Standard Addons
      if (itemSpec.hasAddons) {
        for (const addon of STANDARD_ADDONS) {
          const [existingAddon] = await db
            .select()
            .from(menuItemAddons)
            .where(and(eq(menuItemAddons.menuItemId, itemRow.id), eq(menuItemAddons.name, addon.name)))
            .limit(1);

          if (!existingAddon) {
            await db.insert(menuItemAddons).values({
              menuItemId: itemRow.id,
              name: addon.name,
              price: addon.price,
              isRequired: false,
            });
            totalAddons++;
          }
        }
      }
    }
  }

  // 5. Verification output
  console.log('\n======================================================');
  console.log('SUMMARY OF JAI BHAWANI BAKERS LISTING');
  console.log('======================================================');
  console.log(`Vendor Name:    ${vendor.businessName}`);
  console.log(`Owner Name:     ${vendor.ownerName}`);
  console.log(`Phone:          ${phone}`);
  console.log(`Email:          ${email}`);
  console.log(`Vendor Password:${plainPassword}`);
  console.log(`Address:        ${vendor.shopAddress}`);
  console.log(`Vendor ID:      ${vendor.id}`);
  console.log(`Restaurant ID:  ${restaurant.id}`);
  console.log(`Categories:     ${totalCategories}`);
  console.log(`Menu Items:     ${totalItems}`);
  console.log(`Addons:         ${totalAddons}`);
  console.log('======================================================\n');

  // Verify all listings for this vendor
  const checkRes = await client.query(`
    SELECT mi.id, mc.name as category, mi.name as item, mi.price, mi.is_available, mi.is_veg
    FROM menu_items mi
    JOIN menu_categories mc ON mi.menu_category_id = mc.id
    WHERE mc.restaurant_id = $1
    ORDER BY mc.sort_order, mi.price
  `, [restaurant.id]);

  console.log(`Verified ${checkRes.rows.length} menu items stored under Jai Bhawani Bakers:`);
  console.table(checkRes.rows);

  await client.end();
}

main().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
