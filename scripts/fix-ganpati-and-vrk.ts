import 'dotenv/config';
import { Client } from 'pg';
import * as dns from 'dns/promises';
import { parse } from 'pg-connection-string';

const VRK_PRICE_MAP: Record<string, number> = {
  // Sandwiches & Breads
  'Garlic Bread': 70,
  'Cheese Garlic Bread': 90,
  'Veg-Cheese Garlic Bread': 110,

  // Fried Rice
  'Fried Rice': 90,
  'Schezwan Fried Rice': 100,
  'Chilly Garlic Fried Rice': 110,
  'Mashroom Fried Rice': 120,

  // Sizzlers
  'Veg Sizzler': 180,
  'Chinese Sizzler': 200,
  'VRK Special (Paneer Corn & Mushroom Cheese Sizzler)': 230,

  // Soups
  'Coriander Soup': 70,
  'Hot & Sour Soup': 80,
  'Cream Of Tomato': 80,
  'Veg Clear Soup': 70,
  'Manchow Soup': 80,

  // Starters
  'Veg Manchurian Dry/Gravy': 110,
  'Veg Pakoda': 80,
  'Hara-Bhara Kabab': 120,
  'Paneer 65': 140,
  'Chilly Paneer Dry/Gravy': 140,
  'Soya Chaap': 130,
  'Paneer Pakoda': 120,
  'Paneer Tikka': 160,
  'Paneer Hariyali Tikka': 160,
  'OOH La La Paneer Tikka': 170,
  'Aachari Paneer Tikka': 160,
  'Lahsuni Paneer Tikka': 160,

  // Snacks & Fast Food
  'Paav Bhaji': 70,
  'Veg Maggie': 45,
  'Butter Maggie': 55,
  'Punjabi Tadka Maggie': 65,
  'Chole Bhature': 80,
  'Chole Kulche': 70,
  'Amritsari Chole Kulche': 85,
  'French Fries': 60,
  'Crispy Corn': 90,
  'Chilly Potato': 80,
  'Honey Chilly Potato': 95,
  'Pindy Chana': 90,
  'American Chopsy': 110,
  'Chinese Bhel': 90,
  'Chilly Fry': 40,

  // Papad & Salad
  'Rosted Papad': 15,
  'Rosted Masala Papad': 30,
  'Fried Papad': 25,
  'Fried Masala Papad': 40,
  'Rosted Churi Papad': 40,
  'Fried Churi Papad': 50,
  'Onion Salad': 30,
  'Green Salad': 50,
  'Sirka Salad': 40,
  'Kachumar Salad': 60,

  // Raita & Curd
  'Plain Curd': 40,
  'Bundi Raita': 60,
  'Mix Veg. Raita': 70,
  'Pineapple Raita': 80,
  'Fruit Raita': 90,

  // Beverages
  'Mineral Water': 20,
  "Cold Drink's": 25,
  'Tea (chai)': 15,
  'Masala/Kulhad/Lemon Tea': 20,
  'Butter Milk (Chhach)': 20,
  'Fresh Lemon Soda': 40,
  'Vrk Special Lassi': 50,
  'Vrk Special Hot Coffee': 40,
  'Vrk Special Cold Coffee': 60,
  'Virgin Mojito': 70,
  'Blue Lagoon': 80,
  'Milk Shake': 70,
  'Vanilla Shake': 80,
  'Strawberry Shake': 80,
  'Mango Shake': 80,
  'Chocolate Shake': 90,
  'Butter Scotch Shake': 90,
  'Pineapple Shake': 80,
  'Oreo Shake': 100,
  'Kitkat Shake': 110,

  // Kaju & Special Gravy
  'Kaaju Curry': 190,
  'Kaaju Masala': 200,
  'Methi Malai Matar': 170,
  'Navratan Korma': 180,
  'Malai Kofta': 170,
  'Sham Savera Kofta': 190,
  'Rajasthani Kofta': 160,
  'Mashroom Masala/Matar': 170,
  'Baby Corn Mashroom Masala': 180,
  'VRK Special Anokhi Handi': 220,

  // Veg Main Course
  'Sev Tamatar': 110,
  'Sev Bhaji': 120,
  'Besan Gatta': 120,
  'Aaloo Matar/Gobhi': 110,
  'Dum Aaloo': 120,
  'Kashmiri Dum Aaloo': 140,
  'Chana Masala': 120,
  'Mix Veg': 130,
  'Veg Kolhapuri': 140,
  'Veg Jaipuri': 140,
  'Veg Handi': 140,
  'Veg Kadhai': 140,
  'Boiled Veg': 100,
  'Corn Palak': 130,
  'Matar Mashroom': 160,
  'Palak Mashroom': 160,
  'Malai Pyaaz': 150,
  'Kadhai Chaap': 150,
  'Chaap Gravy': 150,
  'Chaap Butter Masala': 160,
  'Paneer Chaap': 170,
  'VRK Special Sabji': 190,

  // Dal
  'Dal Fry': 90,
  'Dal Tadka': 100,
  'Dal Kolhapuri': 110,
  'Dal Makhani': 140,
  'VRK Special Dal': 150,

  // Tandoor Se
  'Tandoori Roti Plain': 10,
  'Tandoori Roti Butter': 15,
  'Missi Roti': 25,
  'Onion Missi Roti': 30,
  'Plain Naan': 35,
  'Butter Naan': 40,
  'Garlic Naan': 50,
  'Stuff Naan': 60,
  'Kashmiri Naan': 70,
  'Cheese Garlic Naan': 80,
  'Lachha Paratha': 35,
  'Pudina Paratha': 40,
  'Green Chilly Paratha': 40,
  'Aloo Pyaz Paratha': 60,
  'Paneer Paratha': 80,
  'VRK Special Roti': 30,
};

async function run() {
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

  console.log('=== 1. FIXING VRK HOTEL & RESTAURANT ===');
  const vrkRestId = 'f543bb14-2025-4d7f-bb2b-884c99e9c1e1';
  const vrkVendorId = '5a1cd5a6-03b3-459e-9076-fb6afa3b2a03';

  // Set image and ensure open
  const vrkImage = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800';
  await client.query(`
    UPDATE restaurants
    SET image_url = $1, is_open = true, rating_avg = 4.6
    WHERE id = $2
  `, [vrkImage, vrkRestId]);

  await client.query(`
    UPDATE vendors
    SET image_url = $1, is_open = true, kyc_status = 'verified'
    WHERE id = $2
  `, [vrkImage, vrkVendorId]);
  console.log('Updated VRK image and open status.');

  // Update zero-priced items
  let updatedPrices = 0;
  for (const [name, price] of Object.entries(VRK_PRICE_MAP)) {
    const res = await client.query(`
      UPDATE menu_items mi
      SET price = $1, is_available = true
      FROM menu_categories mc
      WHERE mc.id = mi.menu_category_id
        AND mc.restaurant_id = $2
        AND mi.name ILIKE $3
    `, [price, vrkRestId, name]);
    if (res.rowCount && res.rowCount > 0) {
      updatedPrices += res.rowCount;
    }
  }
  console.log(`Updated prices for ${updatedPrices} VRK menu items.`);

  // Check any remaining zero-priced items and set fallback price or availability
  const zeroRes = await client.query(`
    SELECT mi.id, mi.name, mc.name as cat_name
    FROM menu_items mi
    JOIN menu_categories mc ON mc.id = mi.menu_category_id
    WHERE mc.restaurant_id = $1 AND mi.price = 0
  `, [vrkRestId]);
  console.log(`Remaining zero-price items for VRK: ${zeroRes.rows.length}`);
  if (zeroRes.rows.length > 0) {
    for (const row of zeroRes.rows) {
      console.log(`  - ${row.cat_name} -> ${row.name}`);
      await client.query('UPDATE menu_items SET price = 99 WHERE id = $1', [row.id]);
    }
    console.log('Set default fallback price for remaining items.');
  }

  console.log('\n=== 2. FIXING GANPATI KIRANA STOREFRONT ===');
  const ganpatiRestId = '0741baa1-5d82-4e4e-803b-e548948e7e49';
  const ganpatiVendorId = 'b82bcfdf-d8e1-4e9f-958d-942207f620ec';

  // Ensure vendor and restaurant are open with image
  const ganpatiImage = 'https://res.cloudinary.com/dwmotm3fj/image/upload/v1790072241/laoji/production/6c2692ad-bccf-41cf-98f8-366334d7ba28/business/igs58slkhxkgd73a7npz.png';
  await client.query(`
    UPDATE restaurants
    SET image_url = $1, is_open = true, name = 'Ganpati kirana Anandilal Ji'
    WHERE id = $2
  `, [ganpatiImage, ganpatiRestId]);

  await client.query(`
    UPDATE vendors
    SET image_url = $1, is_open = true, kyc_status = 'verified'
    WHERE id = $2
  `, [ganpatiImage, ganpatiVendorId]);

  // Fetch all 95 products for Ganpati Kirana
  const gpProductsRes = await client.query(`
    SELECT 
      vp.id as vp_id,
      vp.price,
      vp.is_available,
      p.id as prod_id,
      p.name,
      p.description,
      p.image_url,
      c.id as cat_id,
      c.name as cat_name
    FROM vendor_products vp
    JOIN products p ON p.id = vp.product_id
    JOIN categories c ON c.id = p.category_id
    WHERE vp.vendor_id = $1
    ORDER BY c.name, p.name
  `, [ganpatiVendorId]);

  console.log(`Found ${gpProductsRes.rows.length} vendor_products for Ganpati Kirana.`);

  // Group products by category
  const categoriesMap = new Map<string, typeof gpProductsRes.rows>();
  for (const row of gpProductsRes.rows) {
    if (!categoriesMap.has(row.cat_name)) {
      categoriesMap.set(row.cat_name, []);
    }
    categoriesMap.get(row.cat_name)!.push(row);
  }

  // Create menu_categories and menu_items for Ganpati Kirana's storefront
  let catsCreated = 0;
  let itemsCreated = 0;
  let sortOrder = 1;

  for (const [catName, prods] of categoriesMap.entries()) {
    // Check if menu_category exists for this restaurant
    let mcRes = await client.query(`
      SELECT id FROM menu_categories WHERE restaurant_id = $1 AND name = $2 LIMIT 1
    `, [ganpatiRestId, catName]);

    let menuCatId: string;
    if (mcRes.rows.length > 0) {
      menuCatId = mcRes.rows[0].id;
    } else {
      const insMc = await client.query(`
        INSERT INTO menu_categories (restaurant_id, name, sort_order)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [ganpatiRestId, catName, sortOrder++]);
      menuCatId = insMc.rows[0].id;
      catsCreated++;
    }

    // Insert menu_items
    for (const p of prods) {
      const miRes = await client.query(`
        SELECT id FROM menu_items WHERE menu_category_id = $1 AND name = $2 LIMIT 1
      `, [menuCatId, p.name]);

      if (miRes.rows.length === 0) {
        await client.query(`
          INSERT INTO menu_items (menu_category_id, name, description, price, image_url, is_veg, is_available)
          VALUES ($1, $2, $3, $4, $5, true, $6)
        `, [
          menuCatId,
          p.name,
          p.description,
          p.price,
          p.image_url,
          p.is_available,
        ]);
        itemsCreated++;
      } else {
        // Update price and availability
        await client.query(`
          UPDATE menu_items
          SET price = $1, is_available = $2, image_url = COALESCE($3, image_url), description = COALESCE($4, description)
          WHERE id = $5
        `, [p.price, p.is_available, p.image_url, p.description, miRes.rows[0].id]);
      }
    }
  }

  console.log(`Synced Ganpati Kirana storefront: ${catsCreated} new categories, ${itemsCreated} new items.`);

  // Verify counts
  const vrkVerify = await client.query(`
    SELECT count(mi.id) as total_items, count(mi.id) FILTER (WHERE mi.price > 0) as priced_items
    FROM menu_items mi
    JOIN menu_categories mc ON mc.id = mi.menu_category_id
    WHERE mc.restaurant_id = $1
  `, [vrkRestId]);
  console.log('\nVRK Item Stats after fix:', vrkVerify.rows[0]);

  const gpVerify = await client.query(`
    SELECT count(mi.id) as total_items, count(mi.id) FILTER (WHERE mi.price > 0) as priced_items
    FROM menu_items mi
    JOIN menu_categories mc ON mc.id = mi.menu_category_id
    WHERE mc.restaurant_id = $1
  `, [ganpatiRestId]);
  console.log('Ganpati Kirana Item Stats after fix:', gpVerify.rows[0]);

  await client.end();
}

run().catch(console.error);
