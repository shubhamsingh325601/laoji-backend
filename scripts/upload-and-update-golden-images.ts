import 'dotenv/config';
import * as dns from 'dns';
import * as dnsPromises from 'dns/promises';
import * as fs from 'fs';
import * as path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { Client } from 'pg';
import { parse } from 'pg-connection-string';

// Ensure IPv4 first so Cloudinary API doesn't hit ECONNRESET on Windows
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const ROOT_DIR = path.resolve(__dirname, '../..');
const BACKEND_DIR = path.resolve(__dirname, '..');
const ASSETS_COPY_DIR = path.join(BACKEND_DIR, 'assets/golden-cafe-images');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Explicit file-to-dish name mapping
const FILE_TO_ITEM_MAP: Record<string, string> = {
  'aalu-began.jpg': 'Aalu Bengan',
  'aalu-bhindi.jpg': 'Aalu Bhindi',
  'aalu-chilli.jpg': 'Aalu Chilli',
  'aalu-chole.jpg': 'Aalu Chole',
  'aalu-fry.jpg': 'Aalu Fry',
  'aalu-gobhi-matar.jpg': 'Aalu Gobhi Matar',
  'aalu-gobhi.jpg': 'Aalu Gobhi',
  'aalu-masala.jpg': 'Aalu Masala',
  'aalu-matar.jpg': 'Aalu Matar',
  'aalu-palak.jpg': 'Aalu Palak',
  'aalu-pyaaz.jpg': 'Aalu Pyaz',
  'aalu-shimla-mirch.jpg': 'Aalu Shimla Mirch',
  'aalu-tamatar.jpg': 'Aalu Tamatar',
  'bengan-masala.jpg': 'Bengan Masala',
  'besan-gatta.jpg': 'Besan Gatta',
  'bharwa-bengan.jpg': 'Bharwa Bengan',
  'bhindi-fry.jpg': 'Bhindi Fry',
  'bhindi-masala.jpg': 'Bhindi Masala',
  'bhindi-pyaaz.jpg': 'Bhindi Pyaz',
  'boondi-raita.jpg': 'Boondi Raita',
  'butter-paneer-masala.jpg': 'Butter Paneer Masala',
  'chola-masala.jpg': 'Chola Masala',
  'chola-paneer.jpg': 'Chola Paneer',
  'dahi-fry.jpg': 'Dahi Fry',
  'dal tadka.jpg': 'Dal Tadka',
  'dal-butter.jpg': 'Dal Butter',
  'dal-fry-makkhan.jpg': 'Dal Fry Makkhan',
  'dal-fry.jpg': 'Dal Fry',
  'dal-makhani.jpg': 'Dal Makhani',
  'dal-paneer-masal.jpg': 'Dal Paneer Masala',
  'dum alu.jpg': 'Dum Aalu',
  'fried-rice.jpg': 'Fried Rice',
  'gatta-masala.jpg': 'Gatta Masala',
  'gobhi-masala.jpg': 'Gobhi Masala',
  'gobhi-paneer.jpg': 'Gobhi Paneer',
  'golden-special-paneer.jpg': 'Golden Special Paneer',
  'gujarati-kadhi.jpg': 'Gujarati Kadhi',
  'handi-paneer.jpg': 'Handi Paneer',
  'kadai-paneer.jpg': 'Kadai Paneer',
  'kadi-pakoda.jpg': 'Kadhi Pakoda',
  'kaju-butter-fry.jpg': 'Kaju Butter Fry',
  'kaju-kari-red.jpg': 'Kaju Kari Red',
  'kaju-kari-white.jpg': 'Kaju Kari White',
  'kaju-masala.jpg': 'Kaju Masala',
  'kaju-matar.jpg': 'Kaju Matar',
  'kaju-paneer.jpg': 'Kaju Paneer',
  'kaju-pulap.jpg': 'Kaju Pulao',
  'kashmiri-pulao.jpg': 'Kashmiri Pulao',
  'malai-kofta.jpg': 'Malai Kofta',
  'malai-paneer.jpg': 'Malai Paneer',
  'masala-chhach.jpg': 'Masala Chhach',
  'masala-papad.jpg': 'Masala Papad',
  'matar-masala.jpg': 'Matar Masala',
  'matar-panner.jpg': 'Matar Paneer',
  'matar-pulao.jpg': 'Matar Pulao',
  'meetha-chawal.jpg': 'Meetha Chawal',
  'mix-vegetables..jpg': 'Mix Vegetable',
  'namkeen-chawal.jpg': 'Namkin Chawal',
  'pakodi-masala.jpg': 'Pakodi Masala',
  'palak-paneer.jpg': 'Palak Paneer',
  'paneer-bhurji.jpg': 'Paneer Bhurji',
  'paneer-korma.jpg': 'Paneer Korma',
  'paneer-lababdar.jpg': 'Paneer Lababdar',
  'paneer-masala.jpg': 'Paneer Masala',
  'paneer-pasanda.jpg': 'Paneer Pasanda',
  'paneer-pulao.jpg': 'Paneer Pulao',
  'paneer-shimla-mirch.jpg': 'Paneer Shimla Mirch',
  'paneer-takatak.jpg': 'Paneer Takatak',
  'paneer-toofani.jpg': 'Paneer Toofani',
  'papad-fry.jpg': 'Papad Fry',
  'punjabi-dal-makhani.jpg': 'Punjabi Dal Makhani',
  'schezwan-rice.jpg': 'Schezwan Rice',
  'sev-bhaji-special.jpg': 'Sev Bhaji Special',
  'sev-tamatar.jpg': 'Sev Tamatar',
  'shahi-paneer.jpg': 'Shahi Paneer',
  'stream-rice.jpg': 'Steam Rice',
  'veg-biryani.jpg': 'Veg Biryani',
  'VEG-pulao.jpg': 'Veg Pulao',
  'veg-raita.jpg': 'Veg Raita',
  'zeera-aalu.jpg': 'Zeera Aalu',
  'zeera-rice.jpg': 'Zeera Rice',
};

async function main() {
  console.log('--- Golden Cafe Menu Images Uploader & DB Syncer ---');

  if (!fs.existsSync(ASSETS_COPY_DIR)) {
    fs.mkdirSync(ASSETS_COPY_DIR, { recursive: true });
  }

  // 1. Check existing files & copy to assets folder
  const filesToProcess = Object.keys(FILE_TO_ITEM_MAP);
  console.log(`Total configured images: ${filesToProcess.length}`);

  for (const filename of filesToProcess) {
    const src = path.join(ROOT_DIR, filename);
    if (!fs.existsSync(src)) {
      console.warn(`Warning: source file not found: ${src}`);
      continue;
    }
    const dest = path.join(ASSETS_COPY_DIR, filename);
    fs.copyFileSync(src, dest);
  }
  console.log(`Copied images to: ${ASSETS_COPY_DIR}`);

  // 2. Upload to Cloudinary with concurrency limit
  const uploadMapPath = path.join(__dirname, 'golden-cafe-image-map.json');
  let uploadMap: Record<string, string> = {};
  if (fs.existsSync(uploadMapPath)) {
    try {
      uploadMap = JSON.parse(fs.readFileSync(uploadMapPath, 'utf8'));
    } catch {
      uploadMap = {};
    }
  }

  console.log('\nUploading images to Cloudinary (folder: laoji/vendors/golden-cafe/menu)...');
  const CONCURRENCY = 4;
  let uploadedCount = 0;

  for (let i = 0; i < filesToProcess.length; i += CONCURRENCY) {
    const chunk = filesToProcess.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (filename) => {
        const itemName = FILE_TO_ITEM_MAP[filename];
        const filePath = path.join(ROOT_DIR, filename);

        if (!fs.existsSync(filePath)) return;

        // Skip if already uploaded and URL looks valid
        if (uploadMap[itemName] && uploadMap[itemName].startsWith('https://res.cloudinary.com/')) {
          uploadedCount++;
          console.log(`[${uploadedCount}/${filesToProcess.length}] Already uploaded: "${itemName}" -> ${uploadMap[itemName]}`);
          return;
        }

        try {
          const publicId = filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
          const res = await cloudinary.uploader.upload(filePath, {
            folder: 'laoji/vendors/golden-cafe/menu',
            public_id: publicId,
            overwrite: true,
            resource_type: 'image',
          });

          uploadMap[itemName] = res.secure_url;
          uploadedCount++;
          console.log(`[${uploadedCount}/${filesToProcess.length}] Uploaded: "${itemName}" (${filename}) -> ${res.secure_url}`);
          // Save map incrementally
          fs.writeFileSync(uploadMapPath, JSON.stringify(uploadMap, null, 2), 'utf8');
        } catch (err: any) {
          console.error(`Error uploading "${filename}" (${itemName}):`, err?.message || err);
        }
      }),
    );
  }

  fs.writeFileSync(uploadMapPath, JSON.stringify(uploadMap, null, 2), 'utf8');
  console.log(`\nCloudinary upload completed. Total mapped items: ${Object.keys(uploadMap).length}`);

  // 3. Connect to live Postgres DB
  console.log('\nConnecting to Postgres DB to update Golden Cafe menu items...');
  const config = parse(process.env.DATABASE_URL!);
  const [{ address }] = await dnsPromises.lookup(config.host!, { all: true });
  const client = new Client({
    host: address,
    port: config.port ? Number(config.port) : 5432,
    user: config.user,
    password: config.password ?? undefined,
    database: config.database ?? undefined,
    ssl: { servername: config.host || undefined, rejectUnauthorized: false },
  });
  await client.connect();

  const rRes = await client.query("SELECT id, name FROM restaurants WHERE name ILIKE '%Golden Cafe%'");
  if (rRes.rows.length === 0) {
    throw new Error('Golden Cafe restaurant not found in DB!');
  }
  const restaurantId = rRes.rows[0].id;
  console.log(`Found Golden Cafe restaurant ID: ${restaurantId}`);

  // Fetch all menu items for Golden Cafe
  const itemsRes = await client.query(`
    SELECT mi.id, mi.name, mi.image_url, mc.name as cat_name
    FROM menu_items mi
    JOIN menu_categories mc ON mi.menu_category_id = mc.id
    WHERE mc.restaurant_id = $1
  `, [restaurantId]);

  console.log(`Found ${itemsRes.rows.length} total menu items for Golden Cafe in DB.`);

  let updatedCount = 0;
  for (const dbItem of itemsRes.rows) {
    const newImageUrl = uploadMap[dbItem.name];
    if (newImageUrl && newImageUrl !== dbItem.image_url) {
      await client.query(`
        UPDATE menu_items
        SET image_url = $1
        WHERE id = $2
      `, [newImageUrl, dbItem.id]);
      updatedCount++;
      console.log(`  ✓ Updated [${dbItem.cat_name}] "${dbItem.name}" -> ${newImageUrl}`);
    } else if (newImageUrl && newImageUrl === dbItem.image_url) {
      console.log(`  - Already up-to-date: "${dbItem.name}"`);
    }
  }

  console.log(`\nDatabase updated successfully: ${updatedCount} items modified.`);
  await client.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
