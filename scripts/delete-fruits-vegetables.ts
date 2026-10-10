/**
 * Standalone CLI script to find and delete "Fruits & Vegetables" category
 * along with all its subcategories and associated products.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/delete-fruits-vegetables.ts
 *
 * Database connection is read from DATABASE_URL or LIVE_DATABASE_URL or MIGRATIONS_DATABASE_URL in .env.
 */
import 'dotenv/config';
import { Client } from 'pg';
import * as dns from 'dns/promises';
import { parse } from 'pg-connection-string';

async function main() {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.LIVE_DATABASE_URL ||
    process.env.MIGRATIONS_DATABASE_URL;

  if (!connectionString) {
    console.error('Error: No DATABASE_URL, LIVE_DATABASE_URL, or MIGRATIONS_DATABASE_URL found in environment.');
    process.exit(1);
  }

  const config = parse(connectionString);
  if (!config.host || !config.user) {
    console.error('Error: Unable to parse connection string.');
    process.exit(1);
  }

  console.log(`Connecting to database at ${config.host}:${config.port || 5432}/${config.database}...`);

  let resolvedHost = config.host;
  try {
    const lookup = await dns.lookup(config.host, { all: true });
    if (lookup.length > 0 && lookup[0]?.address) {
      resolvedHost = lookup[0].address;
    }
  } catch (err) {
    // Fall back to config.host directly if DNS lookup fails
  }

  const client = new Client({
    host: resolvedHost,
    port: config.port ? Number(config.port) : 5432,
    user: config.user,
    password: config.password ?? undefined,
    database: config.database ?? undefined,
    ssl:
      config.sslmode === 'require' ||
      config.sslmode === 'verify-ca' ||
      config.sslmode === 'verify-full' ||
      Boolean(config.ssl)
        ? { servername: config.host, rejectUnauthorized: false }
        : undefined,
    connectionTimeoutMillis: 30000,
  });

  await client.connect();
  console.log('Connected to PostgreSQL successfully.\n');

  try {
    await client.query('BEGIN');

    // 1. Locate categories matching 'Fruits & Vegetables' or 'Fruits and Vegetables'
    const catQuery = `
      SELECT id, name, parent_id, business_type, owner_vendor_id 
      FROM categories 
      WHERE (LOWER(name) = LOWER('Fruits & Vegetables') OR LOWER(name) = LOWER('Fruits and Vegetables'))
        AND owner_vendor_id IS NULL;
    `;
    const rootCats = await client.query(catQuery);

    if (rootCats.rows.length === 0) {
      console.log('No root category named "Fruits & Vegetables" found in categories table.');
      
      // Check if there are any categories with Fruits or Vegetables in their name
      const similar = await client.query(`
        SELECT id, name, parent_id, business_type, owner_vendor_id 
        FROM categories 
        WHERE LOWER(name) LIKE '%fruit%' OR LOWER(name) LIKE '%vegetable%'
        LIMIT 10;
      `);
      if (similar.rows.length > 0) {
        console.log('Found similar categories:');
        for (const c of similar.rows) {
          console.log(` - ID: ${c.id} | Name: "${c.name}" | Parent: ${c.parent_id} | Vendor: ${c.owner_vendor_id}`);
        }
      }
      await client.query('ROLLBACK');
      return;
    }

    for (const rootCat of rootCats.rows) {
      console.log(`\n======================================================`);
      console.log(`Processing Root Category: "${rootCat.name}" (ID: ${rootCat.id})`);
      console.log(`======================================================`);

      // 2. Find all subcategories
      const subcatsRes = await client.query(
        `SELECT id, name, parent_id FROM categories WHERE parent_id = $1 AND owner_vendor_id IS NULL;`,
        [rootCat.id],
      );
      const subcats = subcatsRes.rows;
      const allCatIds = [rootCat.id, ...subcats.map((s) => s.id)];

      console.log(`Found ${subcats.length} subcategories:`);
      for (const s of subcats) {
        console.log(` - Subcategory: "${s.name}" (ID: ${s.id})`);
      }

      // 3. Find all products in these categories
      const prodsRes = await client.query(
        `SELECT id, name, category_id, owner_vendor_id FROM products WHERE category_id = ANY($1::uuid[]);`,
        [allCatIds],
      );
      const prods = prodsRes.rows;
      console.log(`Found ${prods.length} products associated with category and subcategories.`);

      if (prods.length > 0) {
        const prodIds = prods.map((p) => p.id);

        // Check if any product is in grocery_order_items
        const orderItemsRes = await client.query(
          `SELECT oi.id, oi.product_id, p.name 
           FROM grocery_order_items oi
           JOIN products p ON oi.product_id = p.id
           WHERE oi.product_id = ANY($1::uuid[])
           LIMIT 5;`,
          [prodIds],
        );

        if (orderItemsRes.rows.length > 0) {
          console.warn(`Warning: ${orderItemsRes.rows.length} product(s) are linked to customer orders:`);
          for (const row of orderItemsRes.rows) {
            console.warn(` - Product "${row.name}" (${row.product_id}) is in order_item ${row.id}`);
          }
          console.log('Unlinking order items or cleaning up to allow deletion...');
          // Delete or handle order items if in dev/cleanup
          await client.query(
            `DELETE FROM grocery_order_items WHERE product_id = ANY($1::uuid[]);`,
            [prodIds],
          );
          console.log(`Cleaned up linked grocery_order_items for ${prodIds.length} products.`);
        }

        // Unlink product_suggestions
        const sugRes = await client.query(
          `UPDATE product_suggestions SET product_id = NULL WHERE product_id = ANY($1::uuid[]);`,
          [prodIds],
        );
        console.log(`Unlinked ${sugRes.rowCount || 0} product suggestions.`);

        // Unlink template_product_id
        const tplRes = await client.query(
          `UPDATE products SET template_product_id = NULL WHERE template_product_id = ANY($1::uuid[]);`,
          [prodIds],
        );
        console.log(`Unlinked ${tplRes.rowCount || 0} template product links.`);


        // Unlink vendor_discounts
        const discRes = await client.query(
          `UPDATE vendor_discounts SET product_id = NULL WHERE product_id = ANY($1::uuid[]);`,
          [prodIds],
        );
        console.log(`Unlinked ${discRes.rowCount || 0} vendor discount product links.`);

        // Delete vendor_products listings
        const vpRes = await client.query(
          `DELETE FROM vendor_products WHERE product_id = ANY($1::uuid[]);`,
          [prodIds],
        );
        console.log(`Deleted ${vpRes.rowCount || 0} vendor product listings.`);

        // Delete products
        const pDelRes = await client.query(
          `DELETE FROM products WHERE id = ANY($1::uuid[]);`,
          [prodIds],
        );
        console.log(`Deleted ${pDelRes.rowCount || 0} products.`);
      }

      // 4. Detach vendor-owned subcategories (set parent_id = NULL)
      const detachParentRes = await client.query(
        `UPDATE categories SET parent_id = NULL WHERE parent_id = ANY($1::uuid[]) AND owner_vendor_id IS NOT NULL;`,
        [allCatIds],
      );
      if (detachParentRes.rowCount && detachParentRes.rowCount > 0) {
        console.log(`Detached ${detachParentRes.rowCount} vendor categories having deleted parent.`);
      }

      // Unlink template_category_id on vendor categories
      const detachTplRes = await client.query(
        `UPDATE categories SET template_category_id = NULL WHERE template_category_id = ANY($1::uuid[]);`,
        [allCatIds],
      );
      if (detachTplRes.rowCount && detachTplRes.rowCount > 0) {
        console.log(`Unlinked ${detachTplRes.rowCount} vendor template category copies.`);
      }

      // Clean up category_suggestions
      const catSugRes = await client.query(
        `UPDATE category_suggestions SET category_id = NULL WHERE category_id = ANY($1::uuid[]);`,
        [allCatIds],
      );
      console.log(`Unlinked ${catSugRes.rowCount || 0} category suggestions.`);

      // Clean up product_suggestions pointing to these categories
      const prodCatSugRes = await client.query(
        `DELETE FROM product_suggestions WHERE category_id = ANY($1::uuid[]);`,
        [allCatIds],
      );
      console.log(`Deleted ${prodCatSugRes.rowCount || 0} product suggestions pointing to these categories.`);

      // 5. Delete subcategories
      if (subcats.length > 0) {
        const subIds = subcats.map((s) => s.id);
        const subDelRes = await client.query(
          `DELETE FROM categories WHERE id = ANY($1::uuid[]);`,
          [subIds],
        );
        console.log(`Deleted ${subDelRes.rowCount || 0} subcategories.`);
      }

      // 6. Delete root category
      await client.query(`DELETE FROM categories WHERE id = $1;`, [rootCat.id]);
      console.log(`Deleted Root Category "${rootCat.name}" (ID: ${rootCat.id}).`);
    }

    await client.query('COMMIT');
    console.log('\n✔ Successfully completed deletion of "Fruits & Vegetables" with all subcategories and products.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during deletion transaction:', err);
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
