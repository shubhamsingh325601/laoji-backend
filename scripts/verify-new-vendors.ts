import 'dotenv/config';
import { Client } from 'pg';
import * as dns from 'dns/promises';
import { parse } from 'pg-connection-string';

async function main() {
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
  });

  await client.connect();

  const phones = ['9571660837', '8209202625', '6378756442'];
  for (const phone of phones) {
    console.log(`\n====================================================`);
    console.log(`Checking account for Phone: ${phone}`);
    console.log(`====================================================`);

    const u = await client.query('SELECT id, phone, email, name, role, status, must_change_password FROM users WHERE phone = $1', [phone]);
    console.log('USER:', u.rows[0]);

    if (u.rows[0]) {
      const v = await client.query('SELECT id, business_name, owner_name, type, shop_address, kyc_status, is_open FROM vendors WHERE user_id = $1', [u.rows[0].id]);
      console.log('VENDOR:', v.rows[0]);

      if (v.rows[0]) {
        const r = await client.query('SELECT id, name, cuisine_tags, is_open FROM restaurants WHERE vendor_id = $1', [v.rows[0].id]);
        console.log('RESTAURANT:', r.rows[0]);

        if (r.rows[0]) {
          const mc = await client.query('SELECT count(*) FROM menu_categories WHERE restaurant_id = $1', [r.rows[0].id]);
          const mi = await client.query('SELECT count(*) FROM menu_items WHERE menu_category_id IN (SELECT id FROM menu_categories WHERE restaurant_id = $1)', [r.rows[0].id]);
          const miv = await client.query('SELECT count(*) FROM menu_item_variants WHERE menu_item_id IN (SELECT id FROM menu_items WHERE menu_category_id IN (SELECT id FROM menu_categories WHERE restaurant_id = $1))', [r.rows[0].id]);
          const mia = await client.query('SELECT count(*) FROM menu_item_addons WHERE menu_item_id IN (SELECT id FROM menu_items WHERE menu_category_id IN (SELECT id FROM menu_categories WHERE restaurant_id = $1))', [r.rows[0].id]);
          const vp = await client.query('SELECT count(*) FROM vendor_products WHERE vendor_id = $1', [v.rows[0].id]);

          console.log('COUNTS:', {
            menuCategories: Number(mc.rows[0].count),
            menuItems: Number(mi.rows[0].count),
            menuItemVariants: Number(miv.rows[0].count),
            menuItemAddons: Number(mia.rows[0].count),
            vendorProducts: Number(vp.rows[0].count),
          });

          // Print sample categories
          const sampleCats = await client.query('SELECT id, name FROM menu_categories WHERE restaurant_id = $1 ORDER BY sort_order LIMIT 5', [r.rows[0].id]);
          console.log('SAMPLE CATEGORIES:', sampleCats.rows.map(c => c.name));

          // Print sample items
          const sampleItems = await client.query(
            `SELECT mi.name, mi.price, count(mv.id) as variants_count, count(ma.id) as addons_count
             FROM menu_items mi
             LEFT JOIN menu_item_variants mv ON mi.id = mv.menu_item_id
             LEFT JOIN menu_item_addons ma ON mi.id = ma.menu_item_id
             WHERE mi.menu_category_id IN (SELECT id FROM menu_categories WHERE restaurant_id = $1)
             GROUP BY mi.id, mi.name, mi.price
             LIMIT 5`,
            [r.rows[0].id]
          );
          console.log('SAMPLE ITEMS:', sampleItems.rows);
        }
      }
    }
  }

  await client.end();
}

main().catch(console.error);
