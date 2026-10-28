import 'dotenv/config';
import { Client } from 'pg';
import * as path from 'path';
import * as fs from 'fs';
import * as xlsx from 'xlsx';

interface ExcelItem {
  rawName: string;
  alias: string | null;
  parentGroup: string;
  opStock: number;
  unit: string;
  taxCategory: string | null;
  extractedSize: string | null;
  extractedMrp: number | null;
  extractedBrand: string | null;
}

// Brand mapping for parent groups
const GROUP_BRAND_MAP: Record<string, string> = {
  'ADANI GROUP': 'Fortune',
  'All Out': 'All Out',
  'ASHOKA': 'Ashoka',
  'ASHWANI': 'Ashwani',
  'BAJAJ': 'Bajaj',
  'Balaji Spice': 'Balaji',
  'Bikaji': 'Bikaji',
  'Boroline': 'Boroline',
  'Britannia': 'Britannia',
  'Bunge': 'Chambal',
  'Cadbury': 'Cadbury',
  'CP SOAP': 'CP Soap',
  'CYCLE': 'Cycle',
  'Dabar': 'Dabur',
  'Denver': 'Denver',
  'DHARA': 'Dhara',
  'Doctor Soap': 'Doctor Soap',
  'Engin': 'Engine',
  'Everest': 'Everest',
  'FIGARO': 'Figaro',
  'Gangwal': 'Gangwal',
  'Garnier': 'Garnier',
  'Ghadi': 'Ghadi',
  'GODREJ': 'Godrej',
  'Goyal Protin': 'Deep Jyoti',
  'GRD SOAO': 'GRD Soap',
  'Himaliya': 'Himalaya',
  'Himani': 'Zandu',
  'Jalani': 'Jalani',
  'Jonhson&jonhson': "Johnson's",
  'Joy': 'Joy',
  'KROWN': 'Krown',
  'Marico': 'Parachute',
  'Naturigo': 'Naturigo',
  'Nestle': 'Nestle',
  'Nirma': 'Nirma',
  'Palmolive': 'Colgate',
  'Parle G': 'Parle',
  'Patanjali': 'Patanjali',
  'Pidilite': 'Pidilite',
  'Raj White': 'Raj Super',
  'Raksha': 'Raksha',
  'Ramdev spice': 'Ramdev',
  'Rasna': 'Rasna',
  'Reckit': 'Reckitt',
  'Ruchi': 'Ruchi',
  'SHALIMAR': 'Shalimar',
  'Shri Shri': 'Sri Sri Tattva',
  'SILVER COIN': 'Silver Coin',
  'Swastik Kota': 'Swastik',
  'Tata': 'Tata',
  'TOPS': 'Tops',
  'Vardan': 'Vardan',
  'Viba': 'Veeba',
  'Viba.': 'Veeba',
  'VICCO': 'Vicco',
  'VINI': 'Fogg',
  'VVF': 'Jo',
  'WILD STONE': 'Wild Stone',
  'WIPRO': 'Wipro',
  'Wonder Cleaner': 'Wonder Cleaner',
};

const SUB_BRANDS = [
  'Lux', 'Lifebuoy', 'Surf Excel', 'Wheel', 'Rin', 'Fair & Lovely', 'Glow & Lovely',
  'Close up', 'Close Up', 'Ponds', "Pond's", 'Dove', 'Sunsilk', 'Clinic Plus', 'Vaseline',
  'Kissan', 'Brooke Bond', 'Taj Mahal', 'Red Label', 'Bru', 'Boost', 'Horlicks', 'Vim',
  'Comfort', 'Domex', 'Pepsodent', 'Tresemme', 'Lipton', 'Liril', 'Hamam', 'Rexona', 'Breeze',
  'Ariel', 'Tide', 'Whisper', 'Gillette', 'Head & Shoulders', 'Pantene', 'Oral-B', 'Pampers',
  'Vicks', 'Ambi Pur', 'Amul', 'Paras', 'Saras', 'Nova', 'Madhur', 'Zuari', 'Dhampure',
  'India Gate', 'Daawat', 'Kohinoor', 'Maggi', 'Good Day', 'Marie Gold', 'Monaco', 'Krackjack',
  'Hide & Seek', '20-20', 'Dettol', 'Harpic', 'Lizol', 'Colin', 'Mortein', 'Strepsils',
  'Fevicol', 'Fevikwik', 'BoroPlus', 'Zandu', 'Navratna', 'Fast Relief', 'Santoor', 'Hit',
  'Good Knight', 'Cinthol', 'Godrej No.1', 'Aer', 'Cibaca', 'Colgate'
];

// Mapping from the 81 Parent Groups to Root Category Name
const GROUP_TO_ROOT_MAP: Record<string, string> = {
  // Grains, Rice, Pulses, Flours
  'Rice & Pulses': 'pulse and rice',
  'SILVER COIN': 'pulse and rice',
  'Besan': 'pulse and rice',
  'Sabudana': 'pulse and rice',
  'ADANI GROUP': 'pulse and rice',
  'Gangwal': 'pulse and rice',
  'Swastik Kota': 'pulse and rice',

  // Edible Oils, Ghee, Vanaspati
  'Oil': 'Ghee ,oil and vanaspati',
  'GHEE': 'Ghee ,oil and vanaspati',
  'Bunge': 'Ghee ,oil and vanaspati',
  'Engin': 'Ghee ,oil and vanaspati',
  'Goyal Protin': 'Ghee ,oil and vanaspati',
  'DHARA': 'Ghee ,oil and vanaspati',
  'SHALIMAR': 'Ghee ,oil and vanaspati',
  'FIGARO': 'Ghee ,oil and vanaspati',
  'Ruchi': 'Ghee ,oil and vanaspati',

  // Spices & Masala
  'Everest': 'masala',
  'Vardan': 'masala',
  'ASHOKA': 'masala',
  'Spice': 'masala',
  'Jalani': 'masala',
  'ASHWANI': 'masala',
  'Balaji Spice': 'masala',
  'Ramdev spice': 'masala',
  'Masala': 'masala',

  // Snacks, Biscuits, Confectionery, Sauces
  'TOPS': 'Snacks and Namkeens',
  'Parle G': 'Snacks and Namkeens',
  'Nestle': 'Snacks and Namkeens',
  'Bikaji': 'Snacks and Namkeens',
  'Britannia': 'Snacks and Namkeens',
  'Cadbury': 'Snacks and Namkeens',
  'ITC': 'Snacks and Namkeens',
  'Shri Shri': 'Snacks and Namkeens',
  'Viba': 'Snacks and Namkeens',
  'Viba.': 'Snacks and Namkeens',
  'Rasna': 'Snacks and Namkeens',
  'KROWN': 'Snacks and Namkeens',

  // Dry Fruits & Nuts
  'DRY FRUIT': 'Dry fruits',
  'Naturigo': 'Dry fruits',
  'Coconut': 'Dry fruits',

  // Sugar
  'Sugar': 'Sugar and jeggery',

  // Tea
  'Tea': 'Tea',

  // Tata products
  'Tata': 'Tata',

  // Frozen
  'Frozen': 'Frozen',

  // Pooja & Agarbatti
  'Pooja': 'Dhoop and Agarbatti',
  'CYCLE': 'Dhoop and Agarbatti',

  // General, Personal Care, Household & Cleaning
  'General': 'General and cosmetics',
  'Hul': 'General and cosmetics',
  'P&G': 'General and cosmetics',
  'Dabar': 'General and cosmetics',
  'Raj White': 'General and cosmetics',
  'GODREJ': 'General and cosmetics',
  'Palmolive': 'General and cosmetics',
  'Wonder Cleaner': 'General and cosmetics',
  'Himani': 'General and cosmetics',
  'WIPRO': 'General and cosmetics',
  'Patanjali': 'General and cosmetics',
  'Marico': 'General and cosmetics',
  'Jonhson&jonhson': 'General and cosmetics',
  'BAJAJ': 'General and cosmetics',
  'Joy': 'General and cosmetics',
  'Nirma': 'General and cosmetics',
  'Reckit': 'General and cosmetics',
  'Himaliya': 'General and cosmetics',
  'All Out': 'General and cosmetics',
  'Denver': 'General and cosmetics',
  'Ghadi': 'General and cosmetics',
  'Raksha': 'General and cosmetics',
  'WILD STONE': 'General and cosmetics',
  'Maxx Acid': 'General and cosmetics',
  'Tobacco': 'General and cosmetics',
  'VINI': 'General and cosmetics',
  'Pidilite': 'General and cosmetics',
  'Garnier': 'General and cosmetics',
  'JHADU': 'General and cosmetics',
  'CP SOAP': 'General and cosmetics',
  'GRD SOAO': 'General and cosmetics',
  'VICCO': 'General and cosmetics',
  'Boroline': 'General and cosmetics',
  'Doctor Soap': 'General and cosmetics',
  'VVF': 'General and cosmetics',
};

// Normalized clean subcategory name
function cleanCategoryName(rawGroup: string): string {
  if (rawGroup === 'Viba.' || rawGroup === 'Viba') return 'Veeba';
  if (rawGroup === 'GRD SOAO') return 'GRD Soap';
  if (rawGroup === 'Hul') return 'HUL';
  if (rawGroup === 'Jonhson&jonhson') return 'Johnson & Johnson';
  if (rawGroup === 'Dabar') return 'Dabur';
  if (rawGroup === 'Himaliya') return 'Himalaya';
  if (rawGroup === 'Reckit') return 'Reckitt';
  if (rawGroup === 'Ramdev spice') return 'Ramdev Spices';
  if (rawGroup === 'Shri Shri') return 'Sri Sri Tattva';
  if (rawGroup === 'JHADU') return 'Jhadu & Brooms';
  if (rawGroup === 'CP SOAP') return 'CP Soap';
  if (rawGroup === 'DRY FRUIT') return 'Dry Fruits';
  if (rawGroup === 'Engin') return 'Engine';
  if (rawGroup === 'CYCLE') return 'Cycle';
  return rawGroup;
}

function parseItem(row: any[]): ExcelItem | null {
  if (!row || !row[0] || row[0] === 'Total') return null;
  const rawName = String(row[0]).trim();
  if (!rawName) return null;

  const alias = row[1] ? String(row[1]).trim() : null;
  const parentGroup = row[2] ? String(row[2]).trim() : 'General';
  const opStock = row[3] !== undefined && row[3] !== null && !isNaN(Number(row[3])) ? Number(row[3]) : 0;
  const unit = row[4] ? String(row[4]).trim() : 'Pcs.';
  const taxCategory = row[5] ? String(row[5]).trim() : null;

  // Extract price like "30/-", "65/-", "5/"
  const priceMatch = rawName.match(/\s+(\d+(?:\.\d+)?)\s*(?:\/-|\/)(?:\s|$)/);
  const extractedMrp = priceMatch ? parseFloat(priceMatch[1]) : null;

  // Extract size like "100gm", "1kg", "500ml", "100*4", "15ltr", "100g", "8 ML", "900GM"
  const sizeMatch =
    rawName.match(/(\d+(?:\.\d+)?\s*(?:kg|g|gm|gms|ml|ltr|l|liter|litres|meter|metre|pc|pcs|piece|pieces|tablet|capsule|pack|pouch|dozen)(?:\s|$))/i) ||
    rawName.match(/(\d+\s*\*\s*\d+(?:\s*(?:gm|g|ml))?)/i);
  const extractedSize = sizeMatch ? sizeMatch[1].trim() : null;

  // Extract brand
  let extractedBrand: string | null = null;
  for (const sb of SUB_BRANDS) {
    if (new RegExp('\\b' + sb + '\\b', 'i').test(rawName)) {
      extractedBrand = sb;
      break;
    }
  }
  if (!extractedBrand && GROUP_BRAND_MAP[parentGroup]) {
    extractedBrand = GROUP_BRAND_MAP[parentGroup];
  }

  return {
    rawName,
    alias,
    parentGroup,
    opStock,
    unit,
    taxCategory,
    extractedSize,
    extractedMrp,
    extractedBrand,
  };
}

async function main() {
  console.log('====================================================');
  console.log('LAOJI MASTER CATALOG IMPORTER');
  console.log('====================================================');

  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://postgres.zhkcmlgvowllaakmxjyc:Supabase%404753@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to database successfully.');

  // 1. Read Excel file
  const excelPath = path.resolve(__dirname, '../../1792070432978_1792070429094_OM_ListofItems.xlsx');
  console.log(`Reading Excel file from: ${excelPath}`);
  if (!fs.existsSync(excelPath)) {
    throw new Error(`File not found: ${excelPath}`);
  }

  const wb = xlsx.readFile(excelPath);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rawRows: any[][] = xlsx.utils.sheet_to_json(ws, { header: 1 });

  const items: ExcelItem[] = [];
  for (let i = 4; i < rawRows.length; i++) {
    const item = parseItem(rawRows[i]);
    if (item) items.push(item);
  }
  console.log(`Parsed ${items.length} valid product items from sheet.`);

  // 2. Load and verify Master Root Categories (owner_vendor_id IS NULL and parent_id IS NULL)
  console.log('\n--- 1. Loading / Ensuring Root Categories ---');
  const rootCatRows = await client.query(`
    SELECT id, name, parent_id, business_type
    FROM categories
    WHERE owner_vendor_id IS NULL AND parent_id IS NULL
  `);

  const rootCatMap = new Map<string, string>(); // name.toLowerCase() -> id
  for (const r of rootCatRows.rows) {
    rootCatMap.set(r.name.trim().toLowerCase(), r.id);
  }

  // Ensure all required root categories exist
  const requiredRoots = [
    'pulse and rice',
    'Ghee ,oil and vanaspati',
    'masala',
    'Snacks and Namkeens',
    'Dry fruits',
    'Sugar and jeggery',
    'Tea',
    'Tata',
    'Frozen',
    'Dhoop and Agarbatti',
    'General and cosmetics',
  ];

  for (const rootName of requiredRoots) {
    const key = rootName.trim().toLowerCase();
    if (!rootCatMap.has(key)) {
      console.log(`Creating missing root category: "${rootName}"...`);
      const res = await client.query(
        `INSERT INTO categories (name, business_type, parent_id, owner_vendor_id)
         VALUES ($1, 'grocery', NULL, NULL)
         RETURNING id`,
        [rootName]
      );
      rootCatMap.set(key, res.rows[0].id);
    }
  }

  // 3. Ensure all Subcategories exist under their respective root categories
  console.log('\n--- 2. Ensuring Master Subcategories ---');
  const existingSubCatRows = await client.query(`
    SELECT id, name, parent_id
    FROM categories
    WHERE owner_vendor_id IS NULL AND parent_id IS NOT NULL
  `);

  // Map: (parent_id + ":" + name.toLowerCase()) -> id
  const subCatMap = new Map<string, string>();
  for (const s of existingSubCatRows.rows) {
    subCatMap.set(`${s.parent_id}:${s.name.trim().toLowerCase()}`, s.id);
  }

  // Set of unique groups from Excel
  const uniqueGroups = Array.from(new Set(items.map((i) => i.parentGroup))).sort();
  const groupToSubCatId = new Map<string, string>();

  let subCatsCreated = 0;
  let subCatsExisting = 0;

  for (const rawGroup of uniqueGroups) {
    const rootName = GROUP_TO_ROOT_MAP[rawGroup] || 'General and cosmetics';
    const rootId = rootCatMap.get(rootName.trim().toLowerCase())!;
    const cleanName = cleanCategoryName(rawGroup);
    const subCatKey = `${rootId}:${cleanName.trim().toLowerCase()}`;

    let subCatId: string;
    const existingId = subCatMap.get(subCatKey);
    if (existingId) {
      subCatId = existingId;
      subCatsExisting++;
    } else {
      const res = await client.query(
        `INSERT INTO categories (name, parent_id, business_type, owner_vendor_id)
         VALUES ($1, $2, 'grocery', NULL)
         RETURNING id`,
        [cleanName, rootId]
      );
      subCatId = res.rows[0].id as string;
      subCatMap.set(subCatKey, subCatId);
      subCatsCreated++;
    }
    groupToSubCatId.set(rawGroup, subCatId);
  }

  console.log(`Subcategories ready: ${subCatsCreated} created, ${subCatsExisting} existing.`);

  // 4. Load existing Master Products to prevent duplicates
  console.log('\n--- 3. Checking Existing Master Products ---');
  const existingProdRows = await client.query(`
    SELECT id, name, category_id
    FROM products
    WHERE owner_vendor_id IS NULL
  `);
  const existingProdMap = new Map<string, string>(); // name.toLowerCase() -> id
  for (const p of existingProdRows.rows) {
    existingProdMap.set(p.name.trim().toLowerCase(), p.id);
  }
  console.log(`Existing master products count: ${existingProdMap.size}`);

  // 5. Batch Insert / Upsert Products
  console.log('\n--- 4. Importing Products into Master Catalog ---');
  let insertedCount = 0;
  let updatedCount = 0;

  const BATCH_SIZE = 100;
  for (let b = 0; b < items.length; b += BATCH_SIZE) {
    const chunk = items.slice(b, b + BATCH_SIZE);
    await client.query('BEGIN');

    try {
      for (const item of chunk) {
        const subCatId = groupToSubCatId.get(item.parentGroup)!;
        const prodKey = item.rawName.trim().toLowerCase();
        const existingId = existingProdMap.get(prodKey);

        const attributes = {
          alias: item.alias,
          taxCategory: item.taxCategory,
          opStock: item.opStock,
          parentGroup: item.parentGroup,
        };

        const description = `${item.rawName} - ${item.parentGroup} (${item.unit})`;

        if (existingId) {
          await client.query(
            `UPDATE products
             SET category_id = $1,
                 brand = COALESCE($2, brand),
                 unit = $3,
                 size = COALESCE($4, size),
                 mrp = COALESCE($5, mrp),
                 description = $6,
                 attributes = $7,
                 status = 'active'
             WHERE id = $8`,
            [
              subCatId,
              item.extractedBrand,
              item.unit,
              item.extractedSize,
              item.extractedMrp,
              description,
              JSON.stringify(attributes),
              existingId,
            ]
          );
          updatedCount++;
        } else {
          const res = await client.query(
            `INSERT INTO products (
               category_id,
               brand,
               name,
               description,
               unit,
               size,
               mrp,
               attributes,
               status,
               owner_vendor_id,
               template_product_id
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', NULL, NULL)
             RETURNING id`,
            [
              subCatId,
              item.extractedBrand,
              item.rawName,
              description,
              item.unit,
              item.extractedSize,
              item.extractedMrp,
              JSON.stringify(attributes),
            ]
          );
          existingProdMap.set(prodKey, res.rows[0].id);
          insertedCount++;
        }
      }

      await client.query('COMMIT');
      process.stdout.write(`\rProgress: ${Math.min(b + BATCH_SIZE, items.length)} / ${items.length} items processed`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`\nBatch failed around row ${b}:`, err);
      throw err;
    }
  }

  console.log('\n\n--- 5. Verification & Summary ---');
  const summaryRes = await client.query(`
    SELECT 
      root.name as root_category,
      sub.name as subcategory,
      count(p.id) as product_count
    FROM categories root
    JOIN categories sub ON sub.parent_id = root.id
    LEFT JOIN products p ON p.category_id = sub.id AND p.owner_vendor_id IS NULL
    WHERE root.owner_vendor_id IS NULL
    GROUP BY root.name, sub.name
    HAVING count(p.id) > 0
    ORDER BY root.name, product_count DESC
  `);

  console.log(`Total Products Inserted: ${insertedCount}`);
  console.log(`Total Products Updated: ${updatedCount}`);
  console.log(`\nActive Subcategories with Product Counts:`);
  console.table(summaryRes.rows.slice(0, 30));
  if (summaryRes.rows.length > 30) {
    console.log(`... and ${summaryRes.rows.length - 30} more subcategories.`);
  }

  const totalsRes = await client.query(`
    SELECT
      (SELECT count(*) FROM categories WHERE owner_vendor_id IS NULL AND parent_id IS NULL) as root_categories_count,
      (SELECT count(*) FROM categories WHERE owner_vendor_id IS NULL AND parent_id IS NOT NULL) as subcategories_count,
      (SELECT count(*) FROM products WHERE owner_vendor_id IS NULL) as master_products_count
  `);
  console.log('\nFinal Master Catalog Database Totals:');
  console.table(totalsRes.rows);

  await client.end();
  console.log('Done!');
}

main().catch((err) => {
  console.error('Fatal import error:', err);
  process.exit(1);
});
