import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Vendor Document Isolation & Re-registration (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Flow 1: Vendor A registers -> uploads documents -> deletes account -> Vendor B registers with same phone/email -> gets fresh identity & empty document state', async () => {
    const testPhone = '9988771122';
    const testEmail = 'rohit.test1@gmail.com';

    // 1. Vendor A registers
    const regResA = await request(app.getHttpServer())
      .post('/auth/vendor/register')
      .send({
        phone: testPhone,
        email: testEmail,
        password: 'password123',
        businessName: 'Vendor A Store',
        ownerName: 'Rohit Old',
        type: 'grocery',
        pickupLat: 16.705,
        pickupLng: 74.2433,
        radiusKm: 5,
      })
      .expect(201);

    const vendorA = regResA.body;
    expect(vendorA.tokens).toBeDefined();
    expect(vendorA.tokens.accessToken).toBeDefined();
    expect(vendorA.userId).toBeDefined();
    expect(vendorA.vendor.id).toBeDefined();

    const tokenA = vendorA.tokens.accessToken;

    // 2. Vendor A uploads Aadhaar Front
    const uploadFrontResA = await request(app.getHttpServer())
      .post('/uploads/kyc-documents')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        docType: 'aadhaar_front',
        secureUrl: 'https://res.cloudinary.com/laoji/image/upload/vendor_a_aadhaar_front.jpg',
        publicId: 'vendor_a_aadhaar_front_pub',
      })
      .expect(201);

    expect(uploadFrontResA.body.userId).toBe(vendorA.userId);
    expect(uploadFrontResA.body.docType).toBe('aadhaar_front');

    // 3. Vendor A uploads Aadhaar Back
    const uploadBackResA = await request(app.getHttpServer())
      .post('/uploads/kyc-documents')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        docType: 'aadhaar_back',
        secureUrl: 'https://res.cloudinary.com/laoji/image/upload/vendor_a_aadhaar_back.jpg',
        publicId: 'vendor_a_aadhaar_back_pub',
      })
      .expect(201);

    expect(uploadBackResA.body.userId).toBe(vendorA.userId);

    // 4. Verify Vendor A document list
    const docsResA = await request(app.getHttpServer())
      .get('/uploads/kyc-documents/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(Array.isArray(docsResA.body)).toBe(true);
    expect(docsResA.body.length).toBe(2);

    // 5. Vendor A deletes account
    const deleteResA = await request(app.getHttpServer())
      .delete('/vendors/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(deleteResA.body.success).toBe(true);

    // 6. Vendor B registers with the EXACT SAME phone and email
    const regResB = await request(app.getHttpServer())
      .post('/auth/vendor/register')
      .send({
        phone: testPhone,
        email: testEmail,
        password: 'password123',
        businessName: 'Vendor B Store',
        ownerName: 'Rohit New',
        type: 'grocery',
        pickupLat: 16.705,
        pickupLng: 74.2433,
        radiusKm: 5,
      })
      .expect(201);

    const vendorB = regResB.body;
    expect(vendorB.tokens).toBeDefined();
    expect(vendorB.userId).toBeDefined();

    // 7. Verify Vendor B has a NEW identity (NEW userId and NEW vendorId)
    expect(vendorB.userId).not.toBe(vendorA.userId);
    expect(vendorB.vendor.id).not.toBe(vendorA.vendor.id);

    const tokenB = vendorB.tokens.accessToken;

    // 8. Verify Vendor B document API returns EMPTY state []
    const docsResB = await request(app.getHttpServer())
      .get('/uploads/kyc-documents/me')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    expect(Array.isArray(docsResB.body)).toBe(true);
    expect(docsResB.body.length).toBe(0);

    // 9. Vendor B uploads a brand new Aadhaar Front
    const uploadFrontResB = await request(app.getHttpServer())
      .post('/uploads/kyc-documents')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        docType: 'aadhaar_front',
        secureUrl: 'https://res.cloudinary.com/laoji/image/upload/vendor_b_aadhaar_front.jpg',
        publicId: 'vendor_b_aadhaar_front_pub',
      })
      .expect(201);

    expect(uploadFrontResB.body.userId).toBe(vendorB.userId);

    // 10. Verify only Vendor B's newly uploaded document is returned
    const docsResBAfter = await request(app.getHttpServer())
      .get('/uploads/kyc-documents/me')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    expect(docsResBAfter.body.length).toBe(1);
    expect(docsResBAfter.body[0].secureUrl).toBe(
      'https://res.cloudinary.com/laoji/image/upload/vendor_b_aadhaar_front.jpg',
    );
    expect(docsResBAfter.body[0].userId).toBe(vendorB.userId);
  });

  it('Flow 2: Admin deletes vendor -> Re-registration with same phone/email gets fresh identity & empty document state', async () => {
    const testPhone = '9988773344';
    const testEmail = 'rohit.admin_test@gmail.com';

    // 1. Vendor C registers
    const regResC = await request(app.getHttpServer())
      .post('/auth/vendor/register')
      .send({
        phone: testPhone,
        email: testEmail,
        password: 'password123',
        businessName: 'Vendor C Store',
        ownerName: 'Rohit Admin Test',
        type: 'grocery',
        pickupLat: 16.705,
        pickupLng: 74.2433,
        radiusKm: 5,
      })
      .expect(201);

    const vendorC = regResC.body;
    const tokenC = vendorC.tokens.accessToken;

    // 2. Vendor C uploads KYC documents
    await request(app.getHttpServer())
      .post('/uploads/kyc-documents')
      .set('Authorization', `Bearer ${tokenC}`)
      .send({
        docType: 'aadhaar_front',
        secureUrl: 'https://res.cloudinary.com/laoji/image/upload/vendor_c_front.jpg',
        publicId: 'vendor_c_front_pub',
      })
      .expect(201);

    // Verify 1 doc exists
    const docsResC = await request(app.getHttpServer())
      .get('/uploads/kyc-documents/me')
      .set('Authorization', `Bearer ${tokenC}`)
      .expect(200);
    expect(docsResC.body.length).toBe(1);

    // 3. Admin deletes Vendor C
    const deleteVendorRes = await request(app.getHttpServer())
      .delete(`/admin/vendors/${vendorC.vendor.id}`)
      .expect(200);
    expect(deleteVendorRes.body.success).toBe(true);

    // 4. Vendor D registers with the exact same phone and email
    const regResD = await request(app.getHttpServer())
      .post('/auth/vendor/register')
      .send({
        phone: testPhone,
        email: testEmail,
        password: 'password123',
        businessName: 'Vendor D Store',
        ownerName: 'Rohit Re-registered',
        type: 'grocery',
        pickupLat: 16.705,
        pickupLng: 74.2433,
        radiusKm: 5,
      })
      .expect(201);

    const vendorD = regResD.body;
    expect(vendorD.userId).not.toBe(vendorC.userId);
    expect(vendorD.vendor.id).not.toBe(vendorC.vendor.id);

    // 5. Vendor D's document query returns EMPTY state []
    const tokenD = vendorD.tokens.accessToken;
    const docsResD = await request(app.getHttpServer())
      .get('/uploads/kyc-documents/me')
      .set('Authorization', `Bearer ${tokenD}`)
      .expect(200);

    expect(Array.isArray(docsResD.body)).toBe(true);
    expect(docsResD.body.length).toBe(0);
  });
});
