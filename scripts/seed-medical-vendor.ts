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
  categories,
  products,
  vendorProducts,
} from '../drizzle/schema';

const MEDICINES = [
  {
    name: 'Dolo 650 Tablets (Strip of 15)',
    unit: '15 tablets',
    price: 30,
    mrp: 34,
    description: 'Paracetamol 650mg tablets for quick relief from high fever, body pain & headache.',
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500',
  },
  {
    name: 'Vicks VapoRub Relief Balm',
    unit: '25 ml jar',
    price: 45,
    mrp: 50,
    description: 'Trusted Ayurvedic formulation for fast relief from cold, cough, blocked nose and chest congestion.',
    image: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=500',
  },
  {
    name: 'Crocin Advance 500mg (Strip of 15)',
    unit: '15 tablets',
    price: 24,
    mrp: 28,
    description: 'Fast releasing paracetamol tablet designed to start acting within 5 minutes for headache & fever.',
    image: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=500',
  },
  {
    name: 'Digene Antacid Gel (Mint Flavour)',
    unit: '200 ml bottle',
    price: 138,
    mrp: 162,
    description: 'Doctor recommended antacid gel for instant soothing relief from acidity, heartburn and gas.',
    image: 'https://images.unsplash.com/photo-1550572017-ed200f5e6343?w=500',
  },
  {
    name: 'Electral ORS Powder (WHO Formula)',
    unit: '21.8g sachet',
    price: 22,
    mrp: 25,
    description: 'WHO recommended oral rehydration salt for quick energy and body fluid restoration during weakness or dehydration.',
    image: 'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=500',
  },
  {
    name: 'Moov Pain Relief Spray',
    unit: '50 g spray',
    price: 165,
    mrp: 195,
    description: 'Fast acting pain relief aerosol spray for quick relief from backache, joint pain, neck ache & muscle sprains.',
    image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=500',
  },
  {
    name: 'Volini Pain Relief Gel (Micro-Particles)',
    unit: '30 g tube',
    price: 105,
    mrp: 125,
    description: 'Scientifically proven formulation for fast relief from severe back pain, knee pain & shoulder pain.',
    image: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=500',
  },
  {
    name: 'Strepsils Sore Throat Lozenges (Honey & Lemon)',
    unit: 'Strip of 8 lozenges',
    price: 35,
    mrp: 40,
    description: 'Antibacterial lozenges that give dual relief from sore throat, itching and irritating dry cough.',
    image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=500',
  },
  {
    name: 'Dettol Antiseptic Liquid Disinfectant',
    unit: '125 ml bottle',
    price: 74,
    mrp: 85,
    description: 'Hospital grade antiseptic liquid for cleansing minor cuts, scratches, insect bites and hygienic disinfection.',
    image: 'https://images.unsplash.com/photo-1584744982491-665216d95f8b?w=500',
  },
  {
    name: 'Band-Aid Washproof Medicated Plasters',
    unit: 'Pack of 20 strips',
    price: 45,
    mrp: 50,
    description: 'Water resistant adhesive strips with antiseptic pad to protect everyday cuts and scrapes from water and dirt.',
    image: 'https://images.unsplash.com/photo-1583947581924-860bda6a26df?w=500',
  },
  {
    name: 'Dabur Pudina Hara Active Pearls',
    unit: 'Strip of 10 pearls',
    price: 30,
    mrp: 35,
    description: 'Ayurvedic cooling liquid pearls that relieve stomach ache, gas, heaviness and indigestion naturally.',
    image: 'https://images.unsplash.com/photo-1577401239170-897942555fb3?w=500',
  },
  {
    name: 'Cipladine 5% Antiseptic Ointment',
    unit: '20 g tube',
    price: 42,
    mrp: 48,
    description: 'Broad spectrum microbicidal ointment for prevention and treatment of skin infections in cuts, burns and wounds.',
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500',
  },
];

async function main() {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const parsed = parse(connStr);
  let host = parsed.host || 'localhost';
  try {
    const resolved = await dns.lookup(host);
    host = resolved.address;
  } catch {
    // ignore
  }

  const client = new Client({
    user: parsed.user || undefined,
    password: parsed.password || undefined,
    host,
    port: parsed.port ? parseInt(parsed.port, 10) : 5432,
    database: parsed.database || undefined,
    ssl: {
      servername: parsed.host || undefined,
      rejectUnauthorized: false,
    },
    connectionTimeoutMillis: 30_000,
  });

  await client.connect();
  const db = drizzle(client);

  console.log('Connected to database. Seeding Sanjivani Medicos...');

  // 1. Create or get Pharmacy category
  let [cat] = await db
    .select()
    .from(categories)
    .where(eq(categories.name, 'Pharmacy & Medicines'))
    .limit(1);

  if (!cat) {
    [cat] = await db
      .insert(categories)
      .values({
        name: 'Pharmacy & Medicines',
        imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500',
      })
      .returning();
    console.log('Created category: Pharmacy & Medicines');
  }

  // 2. Create or get Vendor User
  const vendorPhone = '9829012345';
  let [vendorUser] = await db
    .select()
    .from(users)
    .where(and(eq(users.phone, vendorPhone), eq(users.role, 'vendor')))
    .limit(1);

  if (!vendorUser) {
    const passwordHash = await bcrypt.hash('Sanjivani@123', 10);
    [vendorUser] = await db
      .insert(users)
      .values({
        phone: vendorPhone,
        role: 'vendor',
        passwordHash,
        name: 'Dr. Ramesh Sharma (Sanjivani Medicos)',
      })
      .returning();
    console.log('Created vendor user: Dr. Ramesh Sharma');
  }

  // 3. Create or get Vendor Profile
  let [vendor] = await db
    .select()
    .from(vendors)
    .where(eq(vendors.userId, vendorUser.id))
    .limit(1);

  if (!vendor) {
    [vendor] = await db
      .insert(vendors)
      .values({
        userId: vendorUser.id,
        businessName: 'Sanjivani Medicos & Pharmacy',
        ownerName: 'Dr. Ramesh Sharma',
        type: 'grocery',
        shopAddress: 'Shop No. 4, Hospital Road, Sangod, Rajasthan 325601',
        pickupLat: 24.918,
        pickupLng: 76.285,
        radiusKm: 2000,
        kycStatus: 'verified',
        isOpen: true,
      })
      .returning();
    console.log('Created vendor: Sanjivani Medicos & Pharmacy');
  }

  // 4. Create products & link to vendor
  for (const m of MEDICINES) {
    let [prod] = await db
      .select()
      .from(products)
      .where(and(eq(products.name, m.name), eq(products.categoryId, cat.id)))
      .limit(1);

    if (!prod) {
      [prod] = await db
        .insert(products)
        .values({
          categoryId: cat.id,
          name: m.name,
          unit: m.unit,
          description: m.description,
          imageUrl: m.image,
          status: 'active',
          mrp: m.mrp,
        })
        .returning();
      console.log(`Created product: ${m.name}`);
    }

    // Link in vendorProducts
    const [existingVP] = await db
      .select()
      .from(vendorProducts)
      .where(and(eq(vendorProducts.vendorId, vendor.id), eq(vendorProducts.productId, prod.id)))
      .limit(1);

    if (!existingVP) {
      await db.insert(vendorProducts).values({
        vendorId: vendor.id,
        productId: prod.id,
        price: m.price,
        isAvailable: true,
        stockQty: 100,
      });
      console.log(`Linked to vendor: ${m.name} @ Rs ${m.price}`);
    }
  }

  console.log('✔ Successfully seeded Sanjivani Medicos & Pharmacy with medicines!');
  await client.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
