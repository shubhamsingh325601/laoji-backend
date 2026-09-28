import 'dotenv/config';
import { Pool } from 'pg';

/**
 * Reconciles duplicate order records created by duplicate checkout submissions.
 * Invariant: For orders from the same customer placed within 60s for the same vendor/items:
 * - If one order progressed (e.g. accepted, out_for_delivery, delivered) and the other is still orphaned in 'placed' status:
 *   The orphaned 'placed' order is reconciled to 'cancelled' with an explanatory audit record in order_status_history.
 * - If dryRun = true (default), reports findings without updating.
 */
async function reconcileDuplicateOrders(dryRun = true) {
  const url = process.env.MIGRATIONS_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('No database URL provided');
    return;
  }
  const pool = new Pool({ connectionString: url });

  try {
    console.log(`Starting duplicate order audit (dryRun=${dryRun})...`);

    // 1. Food orders audit
    const foodOrdersRes = await pool.query(`
      SELECT o.id, o.customer_id, o.restaurant_id, o.status, o.total, o.payment_status, o.created_at
      FROM food_orders o
      ORDER BY o.customer_id, o.created_at ASC
    `);

    const foodDuplicates: { canonical: any; duplicate: any }[] = [];
    for (let i = 0; i < foodOrdersRes.rows.length; i++) {
      for (let j = i + 1; j < foodOrdersRes.rows.length; j++) {
        const a = foodOrdersRes.rows[i];
        const b = foodOrdersRes.rows[j];
        if (a.customer_id === b.customer_id && a.restaurant_id === b.restaurant_id && Math.abs(a.total - b.total) < 0.01) {
          const timeDiff = Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          if (timeDiff <= 60000) { // within 60 seconds
            const canonical = a.status !== 'placed' ? a : b;
            const duplicate = canonical.id === a.id ? b : a;
            if (duplicate.status === 'placed' && canonical.status !== 'placed') {
              foodDuplicates.push({ canonical, duplicate });
            }
          }
        }
      }
    }

    console.log(`Found ${foodDuplicates.length} candidate duplicate food orders:`);
    for (const pair of foodDuplicates) {
      console.log(`Canonical [${pair.canonical.status}]: ${pair.canonical.id} (${pair.canonical.created_at})`);
      console.log(`Duplicate [${pair.duplicate.status}]: ${pair.duplicate.id} (${pair.duplicate.created_at})`);

      if (!dryRun) {
        await pool.query(
          `UPDATE food_orders SET status = 'cancelled' WHERE id = $1 AND status = 'placed'`,
          [pair.duplicate.id]
        );
        await pool.query(
          `INSERT INTO order_status_history (food_order_id, status, actor_role, changed_at)
           VALUES ($1, 'cancelled', 'system', NOW())`,
          [pair.duplicate.id]
        );
        console.log(`Reconciled duplicate ${pair.duplicate.id} -> cancelled.`);
      }
    }

    console.log('Reconciliation check complete.');
  } catch (err) {
    console.error('Error during reconciliation:', err);
  } finally {
    await pool.end();
  }
}

const isLiveRun = process.argv.includes('--apply');
reconcileDuplicateOrders(!isLiveRun);
