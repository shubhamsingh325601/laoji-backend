import 'dotenv/config';
import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
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

interface MenuItemDef {
  name: string;
  price: number; // 0 if unmapped / pending review
  description?: string;
  addons?: { name: string; price: number; isRequired?: boolean }[];
}

interface CategoryDef {
  name: string;
  items: MenuItemDef[];
}

const VRK_MENU_DATA: CategoryDef[] = [
  {
    name: 'BURGERS',
    items: [
      { name: 'Aloo Tikki Burger', price: 50 },
      { name: 'Tandoori Spicy Burger', price: 60 },
      { name: 'Grilled Cheese Burger', price: 65 },
      { name: 'VRK Special Paneer Burger', price: 70 },
    ],
  },
  {
    name: 'SANDWICHES & GARLIC BREAD',
    items: [
      { name: 'Veg. Sandwich', price: 45 },
      { name: 'Veg. Grill Sandwich', price: 50 },
      { name: 'Junglee Cheese Sandwich', price: 60 },
      { name: 'VRK Special Sandwich', price: 70 },
      { name: 'Garlic Bread', price: 0 },
      { name: 'Cheese Garlic Bread', price: 0 },
      { name: 'Veg-Cheese Garlic Bread', price: 0 },
    ],
  },
  {
    name: 'MOMOS',
    items: [
      { name: 'Thai Steamed Momos', price: 50 },
      { name: 'Japanese Fried Momos', price: 65 },
      { name: 'Fried Chese Momos', price: 70 },
      { name: 'Tandoori Momos', price: 80 },
    ],
  },
  {
    name: 'PASTA',
    items: [
      { name: 'Veg Pasta', price: 130 },
      { name: 'White Sauce Pasta', price: 150 },
      { name: 'Red Sauce Pasta', price: 160 },
      { name: 'Pink Sauce Pasta', price: 170 },
      { name: 'VRK Special Mix Sauce Pasta', price: 180 },
    ],
  },
  {
    name: 'PIZZA',
    items: [
      { name: 'Margrita Pizza', price: 185 },
      { name: 'Double Cheese Margrita Pizza', price: 190 },
      { name: 'Cheese Pesto Pizza', price: 70 },
      { name: 'Onion Capsicum Pizza', price: 80 },
      { name: 'Chilly Paneer Pizza', price: 90 },
      { name: 'Tandoori Pizza', price: 100 },
      { name: 'VRK Special Pizza', price: 100 },
    ],
  },
  {
    name: 'NOODLES / CHOWMEIN',
    items: [
      { name: 'Veg Chowmine', price: 80 },
      { name: 'Hakka Noodles', price: 90 },
      { name: 'Paneer Noodles', price: 100 },
      { name: 'Mashroom Noodles', price: 110 },
      { name: 'Chilly Garlic Noodles', price: 110 },
      { name: 'VRK Special Schezwan Garlic Noodles', price: 120 },
    ],
  },
  {
    name: 'FRIED RICE',
    items: [
      { name: 'Fried Rice', price: 0 },
      { name: 'Schezwan Fried Rice', price: 0 },
      { name: 'Chilly Garlic Fried Rice', price: 0 },
      { name: 'Mashroom Fried Rice', price: 0 },
    ],
  },
  {
    name: 'SIZZLERS',
    items: [
      { name: 'Veg Sizzler', price: 0 },
      { name: 'Chinese Sizzler', price: 0 },
      { name: 'VRK Special (Paneer Corn & Mushroom Cheese Sizzler)', price: 0 },
    ],
  },
  {
    name: 'SOUPS',
    items: [
      { name: 'Coriander Soup', price: 0 },
      { name: 'Hot & Sour Soup', price: 0 },
      { name: 'Cream Of Tomato', price: 0 },
      { name: 'Veg Clear Soup', price: 0 },
      { name: 'Manchow Soup', price: 0 },
    ],
  },
  {
    name: 'STARTERS',
    items: [
      { name: 'Veg Manchurian Dry/Gravy', price: 0 },
      { name: 'Veg Pakoda', price: 0 },
      { name: 'Hara-Bhara Kabab', price: 0 },
      { name: 'Paneer 65', price: 0 },
      { name: 'Chilly Paneer Dry/Gravy', price: 0 },
      { name: 'Soya Chaap', price: 0 },
      { name: 'Paneer Pakoda', price: 0 },
      { name: 'Paneer Tikka', price: 0 },
      { name: 'Paneer Hariyali Tikka', price: 0 },
      { name: 'OOH La La Paneer Tikka', price: 0 },
      { name: 'Aachari Paneer Tikka', price: 0 },
      { name: 'Lahsuni Paneer Tikka', price: 0 },
    ],
  },
  {
    name: 'SNACKS / FAST FOOD',
    items: [
      {
        name: 'Paav Bhaji',
        price: 0,
        addons: [{ name: 'Extra Paav', price: 15, isRequired: false }],
      },
      { name: 'Veg Maggie', price: 0 },
      { name: 'Butter Maggie', price: 0 },
      { name: 'Punjabi Tadka Maggie', price: 0 },
      {
        name: 'Chole Bhature',
        price: 0,
        addons: [{ name: 'Extra Bhatura', price: 25, isRequired: false }],
      },
      { name: 'Chole Kulche', price: 0 },
      { name: 'Amritsari Chole Kulche', price: 0 },
      { name: 'French Fries', price: 0 },
      { name: 'Crispy Corn', price: 0 },
      { name: 'Chilly Potato', price: 0 },
      { name: 'Honey Chilly Potato', price: 0 },
      { name: 'Pindy Chana', price: 0 },
      { name: 'American Chopsy', price: 0 },
      { name: 'Chinese Bhel', price: 0 },
      { name: 'Chilly Fry', price: 0 },
    ],
  },
  {
    name: 'PAPAD & SALAD',
    items: [
      { name: 'Rosted Papad', price: 0 },
      { name: 'Rosted Masala Papad', price: 0 },
      { name: 'Fried Papad', price: 0 },
      { name: 'Fried Masala Papad', price: 0 },
      { name: 'Rosted Churi Papad', price: 0 },
      { name: 'Fried Churi Papad', price: 0 },
      { name: 'Onion Salad', price: 0 },
      { name: 'Green Salad', price: 0 },
      { name: 'Sirka Salad', price: 0 },
      { name: 'Kachumar Salad', price: 0 },
    ],
  },
  {
    name: 'RAITA & CURD',
    items: [
      { name: 'Plain Curd', price: 0 },
      { name: 'Bundi Raita', price: 0 },
      { name: 'Mix Veg. Raita', price: 0 },
      { name: 'Pineapple Raita', price: 0 },
      { name: 'Fruit Raita', price: 0 },
    ],
  },
  {
    name: 'BEVERAGES',
    items: [
      { name: 'Mineral Water', price: 0, description: 'M.R.P.' },
      { name: 'Cold Drink\'s', price: 0, description: 'M.R.P.' },
      { name: 'Tea (chai)', price: 0 },
      { name: 'Masala/Kulhad/Lemon Tea', price: 0 },
      { name: 'Butter Milk (Chhach)', price: 0 },
      { name: 'Fresh Lemon Soda', price: 0 },
      { name: 'Vrk Special Lassi', price: 0 },
      { name: 'Vrk Special Hot Coffee', price: 0 },
      { name: 'Vrk Special Cold Coffee', price: 0 },
      { name: 'Virgin Mojito', price: 0 },
      { name: 'Blue Lagoon', price: 0 },
      { name: 'Milk Shake', price: 0 },
      { name: 'Vanilla Shake', price: 0 },
      { name: 'Strawberry Shake', price: 0 },
      { name: 'Mango Shake', price: 0 },
      { name: 'Chocolate Shake', price: 0 },
      { name: 'Butter Scotch Shake', price: 0 },
      { name: 'Pineapple Shake', price: 0 },
      { name: 'Oreo Shake', price: 0 },
      { name: 'Kitkat Shake', price: 0 },
    ],
  },
  {
    name: 'RICE & BIRYANI',
    items: [
      { name: 'Steam/Plain Rice', price: 70 },
      { name: 'Jeera Rice', price: 80 },
      { name: 'Mix Veg Pulao', price: 110 },
      { name: 'Matar Paneer Pulao/Biryani', price: 120 },
      { name: 'Sub-dam Biryani', price: 130 },
      { name: 'Matka Biryani With Raita', price: 140 },
      { name: 'VRK Special Kashmiri Pulao', price: 160 },
    ],
  },
  {
    name: 'DESSERTS / ICE CREAM',
    items: [
      { name: 'Vanilla', price: 30 },
      { name: 'Butter Scotch', price: 30 },
      { name: 'American Dryfruits', price: 30 },
      { name: 'Brownie With Ice-Cream', price: 100 },
      { name: 'Brownie With Souce', price: 100 },
      { name: 'Shizzling Brownie With Icecream', price: 130 },
      { name: 'Sweet of The Day(GulabJamun/Rasgulla)', price: 40 },
    ],
  },
  {
    name: 'KAJU & SPECIAL GRAVY',
    items: [
      { name: 'Kaaju Curry', price: 0 },
      { name: 'Kaaju Masala', price: 0 },
      { name: 'Methi Malai Matar', price: 0 },
      { name: 'Navratan Korma', price: 0 },
      { name: 'Malai Kofta', price: 0 },
      { name: 'Sham Savera Kofta', price: 0 },
      { name: 'Rajasthani Kofta', price: 0 },
      { name: 'Mashroom Masala/Matar', price: 0 },
      { name: 'Baby Corn Mashroom Masala', price: 0 },
      { name: 'VRK Special Anokhi Handi', price: 0 },
    ],
  },
  {
    name: 'VEG MAIN COURSE',
    items: [
      { name: 'Sev Tamatar', price: 0 },
      { name: 'Sev Bhaji', price: 0 },
      { name: 'Besan Gatta', price: 0 },
      { name: 'Aaloo Matar/Gobhi', price: 0 },
      { name: 'Aaloo Chola', price: 0 },
      { name: 'Chana Masala', price: 0 },
      { name: 'Stuffed Dum Aaloo', price: 0 },
      { name: 'Jeera Aaloo', price: 0 },
      { name: 'Mix Veg', price: 0 },
      { name: 'Seasonal Vegetable', price: 0 },
      { name: 'Stuffed Tomato', price: 0 },
    ],
  },
  {
    name: 'PANEER SPECIALITIES',
    items: [
      { name: 'Matar Paneer', price: 0 },
      { name: 'Palak Paneer', price: 0 },
      { name: 'Chola Paneer', price: 0 },
      { name: 'Paneer Butter Masala', price: 0 },
      { name: 'Paneer Tikka Masala', price: 0 },
      { name: 'Paneer Do Pyaza', price: 0 },
      { name: 'Shahi Paneer', price: 0 },
      { name: 'Paneer Angara', price: 0 },
      { name: 'Paneer Lababdar', price: 0 },
      { name: 'Paneer Taka-tak', price: 0 },
      { name: 'Handi Paneer', price: 0 },
      { name: 'Kadahi Paneer', price: 0 },
      { name: 'Paneer Pasanda', price: 0 },
      { name: 'Kaju Paneer', price: 0 },
      { name: 'Paneer Bhurji', price: 0 },
      { name: 'VRK Special Paneer Jwalamukhi', price: 0 },
    ],
  },
  {
    name: 'DAL',
    items: [
      { name: 'Daal Fry', price: 0 },
      { name: 'Daal Tadka', price: 0 },
      { name: 'Daal Makhani', price: 0 },
      { name: 'VRK Special Daal Maharani', price: 0 },
    ],
  },
  {
    name: 'INDIAN BREADS',
    items: [
      {
        name: 'Roti ki Tokri',
        price: 135,
        description: '1 Lachha, 1 Naan, 1 Missi, 2 Roti',
      },
      { name: 'Tava Roti', price: 10 },
      { name: 'Tava Roti With Butter', price: 13 },
      { name: 'Tandoori Roti', price: 15 },
      { name: 'Tandoori Roti With Butter', price: 18 },
      { name: 'Butter Baati', price: 20 },
      { name: 'Plain Naan', price: 35 },
      { name: 'Butter Naan', price: 40 },
      { name: 'Butter Garlic Naan', price: 50 },
      { name: 'Butter Chese Naan', price: 50 },
      { name: 'Chese Garlic Naan', price: 60 },
      { name: 'Onion/Masala/Amritsari Kulcha', price: 45 },
      { name: 'Stuffed Naan', price: 50 },
      { name: 'Stuffed Paratha', price: 50 },
      { name: 'Missi Roti', price: 30 },
      { name: 'Lachha Paratha', price: 40 },
      { name: 'Aaloo/Gobhi/Onion Paratha', price: 45 },
      { name: 'Paneer Paratha', price: 50 },
      { name: 'Kashmiri Naan', price: 60 },
    ],
  },
];

async function main() {
  console.log('--- Seeding VRK Hotel & Restaurant Menu ---');

  // Verify total categories and items in specification
  const totalCategories = VRK_MENU_DATA.length;
  const totalItems = VRK_MENU_DATA.reduce((acc, c) => acc + c.items.length, 0);
  console.log(`Parsed Specification: ${totalCategories} categories, ${totalItems} items.`);

  const config = parse(process.env.DATABASE_URL!);
  const [{ address }] = await dns.lookup(config.host!, { all: true });

  const client = new Client({
    host: address,
    port: config.port ? Number(config.port) : 5432,
    user: config.user,
    password: config.password ?? undefined,
    database: config.database ?? undefined,
    ssl: {
      servername: config.host || undefined,
      rejectUnauthorized: false,
    },
    connectionTimeoutMillis: 30_000,
  });

  await client.connect();
  const db = drizzle(client);

  const phone = '9251114966';
  const email = 'vrkhotel.sangod@gmail.com';
  const password = 'VRKHotel@123';
  const passwordHash = await bcrypt.hash(password, 10);

  // 1. Ensure User
  console.log('\n1. User setup...');
  let [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.phone, phone), eq(users.role, 'vendor')))
    .limit(1);

  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        phone,
        email,
        name: 'VRK Hotel & Restaurant',
        role: 'vendor',
        status: 'active',
        passwordHash,
        mustChangePassword: false,
      })
      .returning();
    console.log(`Created user: ${user.name} (ID: ${user.id})`);
  } else {
    console.log(`Using existing user: ${user.name} (ID: ${user.id})`);
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
        businessName: 'VRK Hotel & Restaurant',
        ownerName: 'VRK Hotel & Restaurant',
        type: 'restaurant',
        businessType: 'restaurant',
        shopAddress: 'Sangod, Kota, Rajasthan',
        pickupLat: 24.9200,
        pickupLng: 76.2800,
        radiusKm: 10,
        kycStatus: 'verified',
        isOpen: true,
      })
      .returning();
    console.log(`Created vendor: ${vendor.businessName} (ID: ${vendor.id})`);
  } else {
    console.log(`Using existing vendor: ${vendor.businessName} (ID: ${vendor.id})`);
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
        name: 'VRK Hotel & Restaurant',
        cuisineTags: 'North Indian, Chinese, Fast Food, South Indian, Beverages, Desserts',
        ratingAvg: 4.6,
        isOpen: true,
      })
      .returning();
    console.log(`Created restaurant: ${restaurant.name} (ID: ${restaurant.id})`);
  } else {
    console.log(`Using existing restaurant: ${restaurant.name} (ID: ${restaurant.id})`);
  }

  // 4. Categories & Menu Items Seeding
  console.log('\n4. Upserting Categories and Menu Items...');
  let categoriesCreated = 0;
  let categoriesExisting = 0;
  let itemsCreated = 0;
  let itemsSkipped = 0;
  let addonsCreated = 0;

  const perCategorySummary: { category: string; created: number; skipped: number; total: number }[] = [];
  const manualPriceReviewItems: { category: string; item: string; currentPrice: number }[] = [];

  for (let cIdx = 0; cIdx < VRK_MENU_DATA.length; cIdx++) {
    const catDef = VRK_MENU_DATA[cIdx];

    // Find or create category
    let [categoryRow] = await db
      .select()
      .from(menuCategories)
      .where(and(eq(menuCategories.restaurantId, restaurant.id), eq(menuCategories.name, catDef.name)))
      .limit(1);

    if (!categoryRow) {
      [categoryRow] = await db
        .insert(menuCategories)
        .values({
          restaurantId: restaurant.id,
          name: catDef.name,
          sortOrder: cIdx + 1,
        })
        .returning();
      categoriesCreated++;
    } else {
      categoriesExisting++;
    }

    let catCreatedItems = 0;
    let catSkippedItems = 0;

    for (const itemDef of catDef.items) {
      // Check existing item
      const [existingItem] = await db
        .select()
        .from(menuItems)
        .where(and(eq(menuItems.menuCategoryId, categoryRow.id), eq(menuItems.name, itemDef.name)))
        .limit(1);

      let targetItemId: string;

      if (!existingItem) {
        const [insertedItem] = await db
          .insert(menuItems)
          .values({
            menuCategoryId: categoryRow.id,
            name: itemDef.name,
            description: itemDef.description ?? null,
            price: itemDef.price,
            isVeg: true,
            isAvailable: true,
          })
          .returning();
        targetItemId = insertedItem.id;
        itemsCreated++;
        catCreatedItems++;
      } else {
        targetItemId = existingItem.id;
        itemsSkipped++;
        catSkippedItems++;
      }

      if (itemDef.price === 0) {
        manualPriceReviewItems.push({
          category: catDef.name,
          item: itemDef.name,
          currentPrice: 0,
        });
      }

      // Addons handling
      if (itemDef.addons && itemDef.addons.length > 0) {
        for (const addon of itemDef.addons) {
          const [existingAddon] = await db
            .select()
            .from(menuItemAddons)
            .where(and(eq(menuItemAddons.menuItemId, targetItemId), eq(menuItemAddons.name, addon.name)))
            .limit(1);

          if (!existingAddon) {
            await db.insert(menuItemAddons).values({
              menuItemId: targetItemId,
              name: addon.name,
              price: addon.price,
              isRequired: addon.isRequired ?? false,
            });
            addonsCreated++;
          }
        }
      }
    }

    perCategorySummary.push({
      category: catDef.name,
      created: catCreatedItems,
      skipped: catSkippedItems,
      total: catDef.items.length,
    });
  }

  console.log('\n================ FINAL EXECUTION SUMMARY ================');
  console.log(`Restaurant ID: ${restaurant.id}`);
  console.log(`Restaurant Name: ${restaurant.name}`);
  console.log(`Vendor ID: ${vendor.id}`);
  console.log(`User ID: ${user.id} (Phone: ${phone})`);
  console.log(`Total Categories: ${VRK_MENU_DATA.length} (Created: ${categoriesCreated}, Existing: ${categoriesExisting})`);
  console.log(`Total Items: ${totalItems} (Created: ${itemsCreated}, Skipped: ${itemsSkipped})`);
  console.log(`Total Addons Created: ${addonsCreated}`);
  console.log(`Items Flagged for Price Review (price = 0 / MRP): ${manualPriceReviewItems.length}`);
  console.log('=========================================================\n');

  console.log('Per Category Details:');
  console.table(perCategorySummary);

  await client.end();
}

main().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
