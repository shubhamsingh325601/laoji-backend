/**
 * copy-vendor-images-to-laoji-cloudinary.ts
 *
 * Yeh script sabhi active (show_in_app = true) vendors ki images ko
 * source Cloudinary se target "LaojiCoudinary" account mein copy karta hai
 * AUR DB mein bhi naye URLs update karta hai.
 *
 * Images processed:
 *   1. vendors.image_url        — vendor ki shop/profile photo
 *      → DB update: UPDATE vendors SET image_url = <new_url> WHERE id = <vendor_id>
 *
 *   2. kyc_documents.secure_url — vendor ke verification documents
 *      (aadhaar_front, aadhaar_back, pan, gst, etc.)
 *      → DB update: UPDATE kyc_documents SET secure_url = <new_url>,
 *                                            public_id  = <new_public_id>
 *                   WHERE id = <doc_id>
 *
 * Usage:
 *   npx ts-node -r dotenv/config scripts/copy-vendor-images-to-laoji-cloudinary.ts
 *
 * .env mein yeh variables chahiye:
 *   # Source Cloudinary (current / purana account)
 *   CLOUDINARY_CLOUD_NAME=...
 *   CLOUDINARY_API_KEY=...
 *   CLOUDINARY_API_SECRET=...
 *
 *   # Target Cloudinary (LaojiCoudinary — naya account)
 *   LAOJI_CLOUDINARY_CLOUD_NAME=...
 *   LAOJI_CLOUDINARY_API_KEY=...
 *   LAOJI_CLOUDINARY_API_SECRET=...
 *
 *   DATABASE_URL=...   (Supabase / Postgres connection string)
 *
 * Safe to re-run:
 *   Checkpoint file (copy-vendor-images-checkpoint.json) save hota rehta hai.
 *   Re-run pe already-done images skip ho jaati hain aur DB update bhi
 *   sirf unhi rows pe hota hai jinke URL abhi tak purane hain.
 */

import 'dotenv/config';
import * as dns from 'dns';
import * as dnsPromises from 'dns/promises';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { Client } from 'pg';
import { parse } from 'pg-connection-string';

// Windows / Supabase pooler pe ECONNRESET avoid karne ke liye
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface VendorRow {
  id: string;
  user_id: string;
  business_name: string;
  image_url: string | null;
  kyc_status: string;
  is_open: boolean;
}

interface KycDocRow {
  id: string;
  user_id: string;
  doc_type: string;
  secure_url: string;
  public_id: string;
  status: string;
}

interface CheckpointEntry {
  newUrl: string;
  newPublicId: string;
  dbUpdated: boolean;
}

// ---------------------------------------------------------------------------
// Checkpoint — re-run pe already processed items skip ho jaate hain
// ---------------------------------------------------------------------------
const CHECKPOINT_PATH = path.join(__dirname, 'copy-vendor-images-checkpoint.json');

function loadCheckpoint(): Record<string, CheckpointEntry> {
  try {
    if (fs.existsSync(CHECKPOINT_PATH)) {
      return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf8'));
    }
  } catch {
    /* ignore */
  }
  return {};
}

function saveCheckpoint(map: Record<string, CheckpointEntry>) {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(map, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Target Cloudinary (LaojiCoudinary) configure karna
// ---------------------------------------------------------------------------
function configureTargetCloudinary() {
  const cloudName = process.env.LAOJI_CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.LAOJI_CLOUDINARY_API_KEY;
  const apiSecret = process.env.LAOJI_CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Target Cloudinary credentials missing!\n' +
      'Set LAOJI_CLOUDINARY_CLOUD_NAME, LAOJI_CLOUDINARY_API_KEY, ' +
      'LAOJI_CLOUDINARY_API_SECRET in .env',
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key:    apiKey,
    api_secret: apiSecret,
    secure:     true,
  });

  console.log(`✓ Target Cloudinary configured: cloud_name = ${cloudName}`);
}

// ---------------------------------------------------------------------------
// URL se buffer download
// ---------------------------------------------------------------------------
function downloadToBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, (res) => {
      // Redirects follow karo (Cloudinary kabhi kabhi redirect karta hai)
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        resolve(downloadToBuffer(res.headers.location));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} while downloading: ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error(`Timeout downloading: ${url}`));
    });
  });
}

// ---------------------------------------------------------------------------
// Buffer → target Cloudinary upload
// ---------------------------------------------------------------------------
function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: string,
  publicId: string,
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        overwrite:     true,
        resource_type: 'image',
      },
      (error, result) => {
        if (error)   return reject(error);
        if (!result) return reject(new Error('Cloudinary returned no result'));
        resolve(result);
      },
    );
    stream.end(buffer);
  });
}

// ---------------------------------------------------------------------------
// Source URL → download → upload → return { newUrl, newPublicId }
// ---------------------------------------------------------------------------
async function copyImage(
  sourceUrl: string,
  folder: string,
  publicId: string,
): Promise<{ newUrl: string; newPublicId: string }> {
  const buffer = await downloadToBuffer(sourceUrl);
  const result = await uploadBufferToCloudinary(buffer, folder, publicId);
  return { newUrl: result.secure_url, newPublicId: result.public_id };
}

// ---------------------------------------------------------------------------
// Cloudinary URL se original folder + filename nikalna
// ---------------------------------------------------------------------------
function parseCloudinaryUrl(url: string): { folder: string; fileName: string } | null {
  try {
    // https://res.cloudinary.com/{cloud}/image/upload/v{ver}/{folder}/{file}.{ext}
    const match = url.match(/\/image\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
    if (!match) return null;
    const parts = match[1].split('/');
    const fileName = parts.pop()!;
    const folder   = parts.join('/');
    return { folder, fileName };
  } catch {
    return null;
  }
}

function sanitize(str: string): string {
  return str.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
}

// ---------------------------------------------------------------------------
// DB connection (IPv4-forced for Supabase pooler)
// ---------------------------------------------------------------------------
async function createDbClient(): Promise<Client> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set in .env');

  const config = parse(dbUrl);
  let host = config.host!;

  try {
    const results = await dnsPromises.lookup(host, { all: true });
    const ipv4 = results.find((r) => r.family === 4);
    if (ipv4) host = ipv4.address;
  } catch {
    /* original host use karo */
  }

  const client = new Client({
    host,
    port:     config.port ? Number(config.port) : 5432,
    user:     config.user,
    password: config.password ?? undefined,
    database: config.database ?? undefined,
    ssl:      { servername: config.host || undefined, rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('='.repeat(65));
  console.log('  Vendor Images → LaojiCoudinary  (copy + DB update)');
  console.log('='.repeat(65));

  // 1. Target Cloudinary configure
  configureTargetCloudinary();

  // 2. DB connect karo
  console.log('\n[Step 1] Database se connect ho raha hun...');
  const db = await createDbClient();
  console.log('✓ DB connected');

  // 3. Active vendors fetch
  console.log('\n[Step 2] Active vendors fetch kar raha hun (show_in_app = true)...');
  const vendorsRes = await db.query<VendorRow>(`
    SELECT id, user_id, business_name, image_url, kyc_status, is_open
    FROM   vendors
    WHERE  show_in_app = true
    ORDER  BY created_at ASC
  `);
  const activeVendors = vendorsRes.rows;
  console.log(`✓ ${activeVendors.length} active vendors mile`);

  if (activeVendors.length === 0) {
    console.log('Koi active vendor nahi mila. Script khatam.');
    await db.end();
    return;
  }

  // 4. KYC documents fetch (sirf active vendors ke)
  console.log('\n[Step 3] KYC / verification documents fetch kar raha hun...');
  const vendorUserIds = activeVendors.map((v) => v.user_id);
  const kycRes = await db.query<KycDocRow>(`
    SELECT id, user_id, doc_type, secure_url, public_id, status
    FROM   kyc_documents
    WHERE  user_id = ANY($1::uuid[])
    ORDER  BY uploaded_at ASC
  `, [vendorUserIds]);
  const kycDocs = kycRes.rows.filter((d) => d.secure_url?.startsWith('http'));
  console.log(`✓ ${kycDocs.length} KYC documents mile`);

  // 5. Checkpoint load
  const checkpoint = loadCheckpoint();

  let totalCopied  = 0;
  let totalSkipped = 0;
  let totalFailed  = 0;
  let dbUpdated    = 0;

  const CONCURRENCY = 3;

  // -------------------------------------------------------------------------
  // Helper: ek image process karo (copy + DB update)
  // -------------------------------------------------------------------------
  async function processVendorImage(vendor: VendorRow, index: number, total: number) {
    const sourceUrl = vendor.image_url!;
    const key       = `vendor_profile_${vendor.id}`;
    const cp        = checkpoint[key];

    // Already copied AND DB updated → full skip
    if (cp?.dbUpdated) {
      totalSkipped++;
      console.log(`  [SKIP] "${vendor.business_name}" — already done`);
      return;
    }

    let newUrl       = cp?.newUrl;
    let newPublicId  = cp?.newPublicId;

    // Agar copy ho chuki hai lekin DB update nahi hua — sirf DB update karo
    if (!newUrl) {
      try {
        const parsed = parseCloudinaryUrl(sourceUrl);
        const folder   = parsed?.folder   ?? `laoji/production/${vendor.user_id}/business`;
        const fileName = parsed?.fileName ?? sanitize(`profile_${vendor.id}`);

        const result = await copyImage(sourceUrl, folder, fileName);
        newUrl       = result.newUrl;
        newPublicId  = result.newPublicId;

        checkpoint[key] = { newUrl, newPublicId, dbUpdated: false };
        saveCheckpoint(checkpoint);
        totalCopied++;
        console.log(`  [${index}/${total}] ✓ Cloudinary copy: "${vendor.business_name}"`);
        console.log(`         ${sourceUrl}`);
        console.log(`      →  ${newUrl}`);
      } catch (err: any) {
        totalFailed++;
        console.error(`  [FAIL] Copy "${vendor.business_name}": ${err?.message ?? err}`);
        return;
      }
    } else {
      totalSkipped++;
      console.log(`  [${index}/${total}] ↷ Already on Cloudinary, only DB update needed: "${vendor.business_name}"`);
    }

    // DB update — vendors.image_url
    try {
      await db.query(
        `UPDATE vendors SET image_url = $1 WHERE id = $2`,
        [newUrl, vendor.id],
      );
      checkpoint[key] = { newUrl: newUrl!, newPublicId: newPublicId!, dbUpdated: true };
      saveCheckpoint(checkpoint);
      dbUpdated++;
      console.log(`         ✓ DB updated: vendors.image_url`);
    } catch (err: any) {
      console.error(`  [FAIL] DB update vendors.image_url for "${vendor.business_name}": ${err?.message ?? err}`);
    }
  }

  async function processKycDoc(doc: KycDocRow, index: number, total: number) {
    const sourceUrl = doc.secure_url;
    const key       = `kyc_${doc.id}`;
    const cp        = checkpoint[key];

    if (cp?.dbUpdated) {
      totalSkipped++;
      console.log(`  [SKIP] KYC ${doc.doc_type} (user: ${doc.user_id.substring(0, 8)}...) — already done`);
      return;
    }

    let newUrl      = cp?.newUrl;
    let newPublicId = cp?.newPublicId;

    if (!newUrl) {
      try {
        const parsed   = parseCloudinaryUrl(sourceUrl);
        const folder   = parsed?.folder   ?? `laoji/production/${doc.user_id}/kyc`;
        const fileName = parsed?.fileName ?? sanitize(`${doc.doc_type}_${doc.id}`);

        const result = await copyImage(sourceUrl, folder, fileName);
        newUrl       = result.newUrl;
        newPublicId  = result.newPublicId;

        checkpoint[key] = { newUrl, newPublicId, dbUpdated: false };
        saveCheckpoint(checkpoint);
        totalCopied++;
        console.log(`  [${index}/${total}] ✓ Cloudinary copy: KYC ${doc.doc_type} (user: ${doc.user_id.substring(0, 8)}...)`);
        console.log(`         ${sourceUrl}`);
        console.log(`      →  ${newUrl}`);
      } catch (err: any) {
        totalFailed++;
        console.error(`  [FAIL] Copy KYC ${doc.doc_type} (${doc.user_id.substring(0, 8)}...): ${err?.message ?? err}`);
        return;
      }
    } else {
      totalSkipped++;
      console.log(`  [${index}/${total}] ↷ Already on Cloudinary, only DB update needed: KYC ${doc.doc_type}`);
    }

    // DB update — kyc_documents.secure_url + public_id
    try {
      await db.query(
        `UPDATE kyc_documents SET secure_url = $1, public_id = $2 WHERE id = $3`,
        [newUrl, newPublicId, doc.id],
      );
      checkpoint[key] = { newUrl: newUrl!, newPublicId: newPublicId!, dbUpdated: true };
      saveCheckpoint(checkpoint);
      dbUpdated++;
      console.log(`         ✓ DB updated: kyc_documents.secure_url + public_id`);
    } catch (err: any) {
      console.error(`  [FAIL] DB update kyc_documents for ${doc.doc_type} (${doc.user_id.substring(0, 8)}...): ${err?.message ?? err}`);
    }
  }

  // -------------------------------------------------------------------------
  // Step 4: Vendor profile images
  // -------------------------------------------------------------------------
  const vendorsWithImage = activeVendors.filter(
    (v) => v.image_url && v.image_url.startsWith('http'),
  );
  console.log(`\n[Step 4] Vendor profile images (${vendorsWithImage.length} vendors ke paas image hai)...`);

  for (let i = 0; i < vendorsWithImage.length; i += CONCURRENCY) {
    const chunk = vendorsWithImage.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map((vendor, ci) =>
        processVendorImage(vendor, i + ci + 1, vendorsWithImage.length),
      ),
    );
  }

  // -------------------------------------------------------------------------
  // Step 5: KYC documents
  // -------------------------------------------------------------------------
  console.log(`\n[Step 5] KYC verification documents (${kycDocs.length} documents)...`);

  for (let i = 0; i < kycDocs.length; i += CONCURRENCY) {
    const chunk = kycDocs.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map((doc, ci) =>
        processKycDoc(doc, i + ci + 1, kycDocs.length),
      ),
    );
  }

  // -------------------------------------------------------------------------
  // DB disconnect
  // -------------------------------------------------------------------------
  await db.end();

  // -------------------------------------------------------------------------
  // Final summary
  // -------------------------------------------------------------------------
  const totalImages = vendorsWithImage.length + kycDocs.length;
  console.log('\n' + '='.repeat(65));
  console.log('  Summary');
  console.log('='.repeat(65));
  console.log(`  Total images processed  : ${totalImages}`);
  console.log(`  ✓ Cloudinary pe copy    : ${totalCopied}`);
  console.log(`  ✓ DB rows updated       : ${dbUpdated}`);
  console.log(`  ↷ Skipped (already done): ${totalSkipped}`);
  console.log(`  ✗ Failed                : ${totalFailed}`);
  console.log(`\n  Checkpoint saved at: ${CHECKPOINT_PATH}`);

  if (totalFailed > 0) {
    console.log(
      `\n  ⚠  ${totalFailed} images fail huyi.\n` +
      `     Script dubara run karo — sirf failed wali retry hongi.\n` +
      `     Successful entries checkpoint mein hain aur skip ho jaayengi.`,
    );
    process.exit(1);
  } else {
    console.log('\n  ✅ Sab kuch successfully migrate ho gaya!');
  }
  console.log('');
}

main().catch((err) => {
  console.error('\n[FATAL]', err?.message ?? err);
  process.exit(1);
});
