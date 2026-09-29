import 'dotenv/config';
import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import * as dns from 'dns/promises';
import { parse } from 'pg-connection-string';
import {
  users,
  vendors,
  restaurants,
  menuCategories,
  menuItems,
  categories,
  products,
  vendorProducts,
} from '../drizzle/schema';

interface VendorDef {
  businessName: string;
  ownerName: string;
  phone: string;
  email: string | null;
  shopAddress: string;
  plainPassword: string;
  type: 'grocery' | 'restaurant' | 'both';
  businessType: string;
  lat: number;
  lng: number;
  imageUrl: string;
  // If restaurant
  cuisineTags?: string;
  menu?: {
    category: string;
    items: {
      name: string;
      price: number;
      description: string;
      imageUrl: string;
      isVeg: boolean;
    }[];
  }[];
  // If grocery
  groceryCatalog?: {
    categoryName: string;
    categoryImage: string;
    items: {
      name: string;
      unit: string;
      price: number;
      mrp: number;
      description: string;
      imageUrl: string;
    }[];
  };
}

const VENDORS_TO_REGISTER: VendorDef[] = [
  // 1. RJ 20 bakers
  {
    businessName: 'RJ 20 bakers',
    ownerName: 'Irshad Khan',
    phone: '9057575394',
    email: 'Irshad1091997@gmail.com',
    shopAddress: 'Koliyo ka bad shyam medical ke pass sangod',
    plainPassword: 'RJ20Bakers@123',
    type: 'restaurant',
    businessType: 'restaurant',
    lat: 24.924,
    lng: 76.283,
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800',
    cuisineTags: 'Bakery, Cakes, Pastries, Patties, Fast Food, Snacks',
    menu: [
      {
        category: 'Fresh Cakes & Pastries',
        items: [
          {
            name: 'Fresh Pineapple Cake (500g)',
            price: 250,
            description: 'Delicious fresh eggless pineapple cake loaded with whipped cream and pineapple chunks',
            imageUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500',
            isVeg: true,
          },
          {
            name: 'Chocolate Truffle Cake (500g)',
            price: 300,
            description: 'Rich dark chocolate glaze cake topped with chocolate shavings',
            imageUrl: 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?w=500',
            isVeg: true,
          },
          {
            name: 'Black Forest Cake (500g)',
            price: 280,
            description: 'Classic black forest cake with chocolate flakes and red cherries',
            imageUrl: 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=500',
            isVeg: true,
          },
          {
            name: 'Black Forest Pastry',
            price: 40,
            description: 'Fresh soft black forest slice pastry with rich cream',
            imageUrl: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=500',
            isVeg: true,
          },
          {
            name: 'Pineapple Pastry',
            price: 35,
            description: 'Fresh slice of sweet and tangy pineapple pastry',
            imageUrl: 'https://images.unsplash.com/photo-1535141192574-5d4897c13136?w=500',
            isVeg: true,
          },
        ],
      },
      {
        category: 'Hot Patties & Baked Snacks',
        items: [
          {
            name: 'Aloo Masala Patties',
            price: 25,
            description: 'Crispy flaky hot baked puff pastry filled with spiced potato masala',
            imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500',
            isVeg: true,
          },
          {
            name: 'Cheese Patties',
            price: 35,
            description: 'Flaky baked patties loaded with spicy filling and gooey cheese',
            imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500',
            isVeg: true,
          },
          {
            name: 'Paneer Patties',
            price: 45,
            description: 'Golden puff filled with seasoned soft fresh paneer cubes',
            imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500',
            isVeg: true,
          },
        ],
      },
      {
        category: 'Pizzas & Fast Food',
        items: [
          {
            name: 'Cheese Paneer Pizza',
            price: 130,
            description: 'Fresh pizza crust topped with mozzarella cheese, spiced paneer and capsicum',
            imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500',
            isVeg: true,
          },
          {
            name: 'Veg Cheese Burger',
            price: 60,
            description: 'Crisp vegetable patty burger with slice of cheese and creamy sauce',
            imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500',
            isVeg: true,
          },
        ],
      },
      {
        category: 'Beverages & Shakes',
        items: [
          {
            name: 'Cold Coffee',
            price: 60,
            description: 'Rich chilled creamy blended coffee',
            imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500',
            isVeg: true,
          },
          {
            name: 'Chocolate Milkshake',
            price: 70,
            description: 'Thick chocolate shake topped with chocolate syrup',
            imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500',
            isVeg: true,
          },
        ],
      },
    ],
  },

  // 2. Mahakal flower
  {
    businessName: 'Mahakal flower',
    ownerName: 'Ashok suman',
    phone: '9887675172',
    email: 'ashoksuman.sangod@gmail.com',
    shopAddress: 'Gandhi choraha sangod',
    plainPassword: 'Mahakal@123',
    type: 'grocery',
    businessType: 'general',
    lat: 24.924,
    lng: 76.283,
    imageUrl: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800',
    groceryCatalog: {
      categoryName: 'Flowers & Pooja Items',
      categoryImage: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=500',
      items: [
        {
          name: 'Fresh Rose Garland / गुलाब की माला',
          unit: '1 piece',
          price: 50,
          mrp: 60,
          description: 'Fresh fragrant red rose garland crafted specially for pooja and welcoming deities',
          imageUrl: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=500',
        },
        {
          name: 'Marigold Garland / गेंदे के फूल की माला',
          unit: '1 piece',
          price: 30,
          mrp: 35,
          description: 'Bright golden and orange marigold flower garland (genda mala) for puja & mandir',
          imageUrl: 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=500',
        },
        {
          name: 'Fresh Loose Pooja Flowers / खुले पूजा के फूल',
          unit: '250 g pack',
          price: 40,
          mrp: 50,
          description: 'Mix of fresh marigold, rose petals and seasonal flowers for daily worship and aarti',
          imageUrl: 'https://images.unsplash.com/photo-1534067783941-51c9c23ecefd?w=500',
        },
        {
          name: 'Fresh Red Roses / ताजे गुलाब के फूल',
          unit: '100 g pack',
          price: 30,
          mrp: 40,
          description: 'Fresh red rose blossoms handpicked for daily pooja or decorations',
          imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500',
        },
        {
          name: 'Lotus Flower / पूजा का कमल फूल',
          unit: '1 piece',
          price: 30,
          mrp: 35,
          description: 'Fresh sacred pink lotus flower for Laxmi Pooja and special rituals',
          imageUrl: 'https://images.unsplash.com/photo-1508615039623-a25605d2b022?w=500',
        },
        {
          name: 'Jasmine Mogra Veni / मोगरा गजरा',
          unit: '1 piece',
          price: 40,
          mrp: 50,
          description: 'Fragrant sweet smelling natural white mogra hair veni / garland',
          imageUrl: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=500',
        },
        {
          name: 'Fresh Rose Bouquet / गुलाब का गुलदस्ता',
          unit: '1 bouquet',
          price: 150,
          mrp: 180,
          description: 'Handcrafted fresh red rose bouquet wrapped neatly for birthdays, gifts and celebrations',
          imageUrl: 'https://images.unsplash.com/photo-1582794543139-8ac9cb0f7b11?w=500',
        },
      ],
    },
  },

  // 3. Mehta Fruits Center
  {
    businessName: 'Mehta Fruits Center',
    ownerName: 'Manish Mehta',
    phone: '8209005285',
    email: 'manishmehta0236@gmail.com',
    shopAddress: 'Gandhi choraha sangod',
    plainPassword: 'MehtaFruits@123',
    type: 'grocery',
    businessType: 'vegetables_fruits',
    lat: 24.924,
    lng: 76.283,
    imageUrl: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=800',
    groceryCatalog: {
      categoryName: 'Fruits & Vegetables',
      categoryImage: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=500',
      items: [
        {
          name: 'Fresh Apple (Shimla/Kashmiri) / ताजा सेब',
          unit: '1 kg',
          price: 120,
          mrp: 140,
          description: 'Crisp, sweet, and juicy premium fresh apples',
          imageUrl: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500',
        },
        {
          name: 'Fresh Banana (Robusta) / ताजा केला',
          unit: '1 dozen',
          price: 50,
          mrp: 60,
          description: 'Naturally ripened fresh sweet bananas',
          imageUrl: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=500',
        },
        {
          name: 'Fresh Pomegranate / ताजा अनार',
          unit: '1 kg',
          price: 140,
          mrp: 160,
          description: 'Rich ruby red seeds, packed with antioxidants and sweet juice',
          imageUrl: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=500',
        },
        {
          name: 'Sweet Orange (Mausambi) / मौसंबी',
          unit: '1 kg',
          price: 70,
          mrp: 80,
          description: 'Fresh juicy sweet limes, ideal for healthy morning juice',
          imageUrl: 'https://images.unsplash.com/photo-1582979512210-99b6a53386f9?w=500',
        },
        {
          name: 'Fresh Papaya / मीठा पपीता',
          unit: '1 piece (approx 1 kg)',
          price: 45,
          mrp: 55,
          description: 'Farm-fresh ripe sweet yellow papaya',
          imageUrl: 'https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=500',
        },
        {
          name: 'Green Grapes / ताजे अंगूर',
          unit: '500 g',
          price: 60,
          mrp: 75,
          description: 'Sweet and seedless crisp fresh green grapes',
          imageUrl: 'https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=500',
        },
        {
          name: 'Fresh Guava / अमरूद',
          unit: '1 kg',
          price: 50,
          mrp: 60,
          description: 'Crisp green ripe guavas with sweet pink/white pulp',
          imageUrl: 'https://images.unsplash.com/photo-1536511135899-738c7f999908?w=500',
        },
        {
          name: 'Mix Seasonal Fruit Basket / फ्रूट बास्केट',
          unit: '1 basket (approx 3 kg)',
          price: 250,
          mrp: 299,
          description: 'Assorted seasonal fresh fruits basket including apples, bananas, pomegranate and oranges',
          imageUrl: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=500',
        },
      ],
    },
  },

  // 4. Nagar bakery nd cakes
  {
    businessName: 'Nagar bakery nd cakes',
    ownerName: 'Sumit nagar',
    phone: '8619225450',
    email: 'sumitnagar.sangod@gmail.com',
    shopAddress: 'Kota road near sbi bank sangod',
    plainPassword: 'NagarBakery@123',
    type: 'restaurant',
    businessType: 'restaurant',
    lat: 24.925,
    lng: 76.282,
    imageUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800',
    cuisineTags: 'Bakery, Cakes, Pastries, Patties, Cookies, Snacks, Fast Food',
    menu: [
      {
        category: 'Birthday Cakes & Pastries',
        items: [
          {
            name: 'Fresh Pineapple Cake (500g)',
            price: 250,
            description: 'Soft sponge cake layered with rich cream and juicy pineapple bits',
            imageUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500',
            isVeg: true,
          },
          {
            name: 'Butterscotch Crunch Cake (500g)',
            price: 280,
            description: 'Caramel infused butterscotch cake with crunchy praline bits',
            imageUrl: 'https://images.unsplash.com/photo-1562777717-dc6984f65a63?w=500',
            isVeg: true,
          },
          {
            name: 'Rich Dark Chocolate Cake (500g)',
            price: 300,
            description: 'Decadent chocolate cake covered in smooth chocolate ganache',
            imageUrl: 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?w=500',
            isVeg: true,
          },
          {
            name: 'Chocolate Pastry',
            price: 40,
            description: 'Moist chocolate slice pastry with creamy filling',
            imageUrl: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=500',
            isVeg: true,
          },
        ],
      },
      {
        category: 'Patties & Rolls',
        items: [
          {
            name: 'Masala Aloo Patties',
            price: 25,
            description: 'Fresh oven baked flaky potato stuffed warm puff',
            imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500',
            isVeg: true,
          },
          {
            name: 'Cheese Patties',
            price: 35,
            description: 'Flaky baked patties with melting cheese and potato stuffing',
            imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500',
            isVeg: true,
          },
          {
            name: 'Paneer Patties',
            price: 45,
            description: 'Flaky puff packed with spicy seasoned fresh paneer',
            imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500',
            isVeg: true,
          },
          {
            name: 'Sweet Cream Roll',
            price: 20,
            description: 'Classic crisp golden wafer horn filled with vanilla cream',
            imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500',
            isVeg: true,
          },
        ],
      },
      {
        category: 'Cookies & Bakery Snacks',
        items: [
          {
            name: 'Jeera Butter Cookies (250g)',
            price: 60,
            description: 'Crispy salted cumin seed bakery cookies',
            imageUrl: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500',
            isVeg: true,
          },
          {
            name: 'Crispy Bakery Rusk / Toast (250g)',
            price: 50,
            description: 'Crunchy golden baked tea rusks infused with cardamom',
            imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500',
            isVeg: true,
          },
        ],
      },
      {
        category: 'Burgers & Sandwiches',
        items: [
          {
            name: 'Veg Cheese Burger',
            price: 60,
            description: 'Soft bun with crispy vegetable cutlet, onion, tomato and cheese',
            imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500',
            isVeg: true,
          },
          {
            name: 'Veg Grilled Sandwich',
            price: 60,
            description: 'Golden grilled bread slices loaded with fresh veggies, herbs and green chutney',
            imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500',
            isVeg: true,
          },
        ],
      },
    ],
  },
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

  console.log('========================================================');
  console.log('REGISTERING SANGOD MARKET VENDORS GIVEN BY JINESHWAR');
  console.log('========================================================\n');

  const registeredList: any[] = [];

  const businessHours = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    isOpen: true,
    openTime: '07:00',
    closeTime: '23:00',
  }));

  for (const vSpec of VENDORS_TO_REGISTER) {
    console.log(`\n--------------------------------------------------------`);
    console.log(`Processing: ${vSpec.businessName} (${vSpec.ownerName})`);
    console.log(`Phone: ${vSpec.phone} | Password: ${vSpec.plainPassword}`);
    console.log(`--------------------------------------------------------`);

    const passwordHash = await bcrypt.hash(vSpec.plainPassword, 10);

    // 1. User
    let [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.phone, vSpec.phone), eq(users.role, 'vendor')))
      .limit(1);

    if (!user) {
      [user] = await db
        .insert(users)
        .values({
          phone: vSpec.phone,
          email: vSpec.email,
          name: `${vSpec.ownerName} (${vSpec.businessName})`,
          role: 'vendor',
          status: 'active',
          passwordHash,
          mustChangePassword: false,
        })
        .returning();
      console.log(`✔ Created User: ${user.id} | Phone: ${user.phone}`);
    } else {
      [user] = await db
        .update(users)
        .set({
          name: `${vSpec.ownerName} (${vSpec.businessName})`,
          email: vSpec.email,
          status: 'active',
          passwordHash,
          mustChangePassword: false,
        })
        .where(eq(users.id, user.id))
        .returning();
      console.log(`✔ Updated User: ${user.id} | Phone: ${user.phone}`);
    }

    // 2. Vendor profile
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
          businessName: vSpec.businessName,
          ownerName: vSpec.ownerName,
          type: vSpec.type,
          businessType: vSpec.businessType,
          shopAddress: vSpec.shopAddress,
          pickupLat: vSpec.lat,
          pickupLng: vSpec.lng,
          radiusKm: 15,
          kycStatus: 'verified',
          isOpen: true,
          imageUrl: vSpec.imageUrl,
          businessHours,
        })
        .returning();
      console.log(`✔ Created Vendor Profile: ${vendor.id} | ${vendor.businessName}`);
    } else {
      [vendor] = await db
        .update(vendors)
        .set({
          businessName: vSpec.businessName,
          ownerName: vSpec.ownerName,
          type: vSpec.type,
          businessType: vSpec.businessType,
          shopAddress: vSpec.shopAddress,
          pickupLat: vSpec.lat,
          pickupLng: vSpec.lng,
          radiusKm: 15,
          kycStatus: 'verified',
          isOpen: true,
          imageUrl: vSpec.imageUrl,
          businessHours,
        })
        .where(eq(vendors.id, vendor.id))
        .returning();
      console.log(`✔ Updated Vendor Profile: ${vendor.id} | ${vendor.businessName}`);
    }

    // 3. Restaurant setup if applicable
    if (vSpec.type === 'restaurant' || vSpec.type === 'both') {
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
            name: vSpec.businessName,
            cuisineTags: vSpec.cuisineTags,
            imageUrl: vSpec.imageUrl,
            ratingAvg: 4.8,
            isOpen: true,
          })
          .returning();
        console.log(`✔ Created Restaurant: ${restaurant.id} | ${restaurant.name}`);
      } else {
        [restaurant] = await db
          .update(restaurants)
          .set({
            name: vSpec.businessName,
            cuisineTags: vSpec.cuisineTags,
            imageUrl: vSpec.imageUrl,
            ratingAvg: 4.8,
            isOpen: true,
          })
          .where(eq(restaurants.id, restaurant.id))
          .returning();
        console.log(`✔ Updated Restaurant: ${restaurant.id} | ${restaurant.name}`);
      }

      // Populate menu if provided
      if (vSpec.menu) {
        let catOrder = 1;
        for (const catSpec of vSpec.menu) {
          let [catRow] = await db
            .select()
            .from(menuCategories)
            .where(and(eq(menuCategories.restaurantId, restaurant.id), eq(menuCategories.name, catSpec.category)))
            .limit(1);

          if (!catRow) {
            [catRow] = await db
              .insert(menuCategories)
              .values({
                restaurantId: restaurant.id,
                name: catSpec.category,
                sortOrder: catOrder++,
              })
              .returning();
            console.log(`  + Menu Category: ${catRow.name}`);
          }

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
                  imageUrl: itemSpec.imageUrl,
                  isVeg: itemSpec.isVeg,
                  isAvailable: true,
                })
                .returning();
              console.log(`    + Menu Item: ${itemRow.name} (₹${itemRow.price})`);
            } else {
              await db
                .update(menuItems)
                .set({
                  price: itemSpec.price,
                  description: itemSpec.description,
                  imageUrl: itemSpec.imageUrl,
                  isVeg: itemSpec.isVeg,
                  isAvailable: true,
                })
                .where(eq(menuItems.id, itemRow.id));
              console.log(`    ~ Menu Item updated: ${itemRow.name} (₹${itemRow.price})`);
            }
          }
        }
      }
    }

    // 4. Grocery Catalog setup if applicable
    if (vSpec.groceryCatalog) {
      const gCat = vSpec.groceryCatalog;
      let [cat] = await db
        .select()
        .from(categories)
        .where(eq(categories.name, gCat.categoryName))
        .limit(1);

      if (!cat) {
        [cat] = await db
          .insert(categories)
          .values({
            name: gCat.categoryName,
            imageUrl: gCat.categoryImage,
            businessType: vSpec.businessType === 'general' ? 'grocery' : vSpec.businessType,
          })
          .returning();
        console.log(`✔ Created Catalog Category: ${cat.name}`);
      }

      for (const p of gCat.items) {
        let [prod] = await db
          .select()
          .from(products)
          .where(and(eq(products.name, p.name), eq(products.categoryId, cat.id)))
          .limit(1);

        if (!prod) {
          [prod] = await db
            .insert(products)
            .values({
              categoryId: cat.id,
              name: p.name,
              unit: p.unit,
              description: p.description,
              imageUrl: p.imageUrl,
              status: 'active',
              mrp: p.mrp,
            })
            .returning();
          console.log(`  + Product: ${prod.name}`);
        }

        let [existingVP] = await db
          .select()
          .from(vendorProducts)
          .where(and(eq(vendorProducts.vendorId, vendor.id), eq(vendorProducts.productId, prod.id)))
          .limit(1);

        if (!existingVP) {
          await db.insert(vendorProducts).values({
            vendorId: vendor.id,
            productId: prod.id,
            price: p.price,
            isAvailable: true,
            stockQty: 100,
          });
          console.log(`    + Linked to vendor @ ₹${p.price}`);
        } else {
          await db
            .update(vendorProducts)
            .set({
              price: p.price,
              isAvailable: true,
              stockQty: 100,
            })
            .where(eq(vendorProducts.id, existingVP.id));
          console.log(`    ~ Updated vendor price @ ₹${p.price}`);
        }
      }
    }

    // 5. Verify bcrypt password compare
    const isPwValid = await bcrypt.compare(vSpec.plainPassword, user.passwordHash!);
    if (!isPwValid) {
      throw new Error(`Password check failed for ${vSpec.businessName}!`);
    }

    registeredList.push({
      businessName: vSpec.businessName,
      ownerName: vSpec.ownerName,
      phone: vSpec.phone,
      email: vSpec.email,
      password: vSpec.plainPassword,
      address: vSpec.shopAddress,
      type: vSpec.type,
      businessType: vSpec.businessType,
      vendorId: vendor.id,
      userId: user.id,
      loginVerified: isPwValid,
    });
  }

  console.log('\n======================================================');
  console.log('ALL 4 SANGOD VENDORS REGISTERED SUCCESSFULLY!');
  console.log('======================================================');
  console.table(registeredList.map(r => ({
    'Business Name': r.businessName,
    'Owner': r.ownerName,
    'Mobile (Login ID)': r.phone,
    'Password': r.password,
    'Type': `${r.type} (${r.businessType})`,
    'Status': 'Active & Verified',
  })));

  await client.end();
}

main().catch((err) => {
  console.error('Registration failed:', err);
  process.exit(1);
});
