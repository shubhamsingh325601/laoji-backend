import 'dotenv/config';
import { Pool } from 'pg';

const CODE_MAP: Record<string, string> = {
  'Chaska Point Cafe': 'CHASKA10',
  'Ganpati kirana Anandilal Ji': 'GANPATI10',
  'Golden Cafe': 'GOLDEN10',
  'Jai Bhawani Bakers': 'JAIBAWANI10',
  'Mahakal flower': 'MAHAKAL10',
  'Mehta Fruits Center': 'MEHTA10',
  'Mittal Provision Store': 'MITTAL10',
  'Nagar bakery nd cakes': 'NAGAR10',
  'Om Misthan Bhandar (Ganga Bishan Ji Ki Dukan)': 'OM10',
  'RJ 20 bakers': 'RJ2010',
  'Shoe plaza': 'SHOEPLAZA10',
  'SHubham': 'SHUBHAM10',
  'The evening bites': 'EVENING10',
  'VRK Hotel & Restaurant': 'VRK10',
  'हरियाणा स्पेशल जलेबी': 'HARYANA10',
};

async function main() {
  const pool = new Pool({
    connectionString: process.env.LIVE_DATABASE_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const vendorsRes = await pool.query('SELECT id, business_name, user_id FROM vendors ORDER BY business_name ASC');
  console.log(`Found ${vendorsRes.rows.length} vendors in database.`);

  const created: any[] = [];
  for (const v of vendorsRes.rows) {
    const code = CODE_MAP[v.business_name] || (v.business_name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() + '10');
    const description = `Free delivery on orders above ₹65 for first 10 customers (${v.business_name})`;

    const query = `
      INSERT INTO coupons (
        code,
        discount_type,
        discount_value,
        min_order_value,
        max_discount,
        description,
        is_first_order_only,
        first_n_orders,
        is_active,
        vendor_id,
        beneficiary_user_id,
        show_in_app,
        affiliate_commission_type,
        affiliate_commission_value,
        max_uses_per_user,
        max_total_uses,
        total_redemptions
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      )
      ON CONFLICT (code) DO UPDATE SET
        discount_type = EXCLUDED.discount_type,
        discount_value = EXCLUDED.discount_value,
        min_order_value = EXCLUDED.min_order_value,
        description = EXCLUDED.description,
        is_active = EXCLUDED.is_active,
        vendor_id = EXCLUDED.vendor_id,
        beneficiary_user_id = EXCLUDED.beneficiary_user_id,
        show_in_app = EXCLUDED.show_in_app,
        affiliate_commission_type = EXCLUDED.affiliate_commission_type,
        affiliate_commission_value = EXCLUDED.affiliate_commission_value,
        max_uses_per_user = EXCLUDED.max_uses_per_user,
        max_total_uses = EXCLUDED.max_total_uses
      RETURNING id, code, vendor_id, beneficiary_user_id, min_order_value, max_total_uses, affiliate_commission_type, affiliate_commission_value;
    `;

    const values = [
      code,
      'free_delivery',
      0,
      65,
      null,
      description,
      false,
      null,
      true,
      v.id,
      v.user_id,
      false, // show_in_app: hidden from public app listings (creator/vendor shares code manually)
      'order_percentage',
      2,
      1,
      10,
      0,
    ];

    const res = await pool.query(query, values);
    created.push({
      vendor: v.business_name,
      code: res.rows[0].code,
      minOrder: res.rows[0].min_order_value,
      maxUsers: res.rows[0].max_total_uses,
      vendorCut: `${res.rows[0].affiliate_commission_value}% of order`,
    });
  }

  console.table(created);
  await pool.end();
}

main().catch((err) => {
  console.error('Failed to create vendor coupons:', err);
  process.exit(1);
});
