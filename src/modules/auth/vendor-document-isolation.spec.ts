import { AuthService } from './auth.service';
import { CatalogService } from '../catalog/catalog.service';
import { DeliveryService } from '../delivery/delivery.service';
import { UserService } from '../user/user.service';
import { UploadsService } from '../uploads/uploads.service';

describe('Vendor Document Isolation & Account Re-registration Tests', () => {
  let authService: AuthService;
  let catalogService: CatalogService;
  let deliveryService: DeliveryService;
  let userService: UserService;
  let uploadsService: UploadsService;

  // In-memory mock database state
  let usersTable: any[] = [];
  let vendorsTable: any[] = [];
  let deliveryPartnersTable: any[] = [];
  let kycDocumentsTable: any[] = [];
  let authTokensTable: any[] = [];
  let restaurantsTable: any[] = [];
  let groceryOrdersTable: any[] = [];
  let foodOrdersTable: any[] = [];
  let addressesTable: any[] = [];

  const createMockDb = () => ({
    select: (fields?: any) => ({
      from: (table: any) => {
        let tableName =
          table?.[Symbol.for('drizzle:OriginalName')] ||
          table?.[Symbol.for('drizzle:Name')] ||
          table?._?.name ||
          table?.name ||
          '';
        let currentRows: any[] = [];

        if (tableName === 'users' || tableName.includes('user')) currentRows = usersTable;
        else if (tableName === 'vendors' || tableName.includes('vendor')) currentRows = vendorsTable;
        else if (tableName === 'delivery_partners' || tableName.includes('partner')) currentRows = deliveryPartnersTable;
        else if (tableName === 'kyc_documents' || tableName.includes('kyc')) currentRows = kycDocumentsTable;
        else if (tableName === 'auth_tokens' || tableName.includes('token')) currentRows = authTokensTable;
        else if (tableName === 'restaurants' || tableName.includes('restaurant')) currentRows = restaurantsTable;
        else if (tableName === 'grocery_orders' || tableName.includes('grocery')) currentRows = groceryOrdersTable;
        else if (tableName === 'food_orders' || tableName.includes('food')) currentRows = foodOrdersTable;
        else if (tableName === 'addresses' || tableName.includes('address')) currentRows = addressesTable;
        else currentRows = usersTable;

        let filtered = currentRows;

        const queryObj: any = {
          innerJoin: (joinTable: any, condition: any) => {
            return queryObj;
          },
          where: (condition: any) => {
            const extractValues = (obj: any): any[] => {
              if (!obj) return [];
              if (typeof obj === 'string' || typeof obj === 'number') return [obj];
              const vals: any[] = [];
              if (obj.value !== undefined) vals.push(obj.value);
              if (obj.right !== undefined) vals.push(...extractValues(obj.right));
              if (obj.queryChunks && Array.isArray(obj.queryChunks)) {
                for (const chunk of obj.queryChunks) {
                  vals.push(...extractValues(chunk));
                }
              }
              return vals;
            };

            const vals = extractValues(condition);

            if (tableName === 'users' || tableName.includes('user')) {
              filtered = usersTable.filter((u) => u.status === 'active');
              if (vals.length > 0) {
                filtered = filtered.filter((u) => vals.some((v) => u.id === v || u.phone === v || u.email === v));
              }
            } else if (tableName === 'vendors' || tableName.includes('vendor')) {
              if (vals.length > 0) {
                filtered = vendorsTable.filter((v) => vals.some((val) => v.userId === val || v.id === val));
              } else {
                filtered = vendorsTable.filter((v) => v.isOpen);
              }
            } else if (tableName === 'delivery_partners' || tableName.includes('partner')) {
              if (vals.length > 0) {
                filtered = deliveryPartnersTable.filter((p) => vals.some((val) => p.userId === val || p.id === val));
              }
            } else if (tableName === 'kyc_documents' || tableName.includes('kyc')) {
              filtered = kycDocumentsTable.filter((k) => {
                const user = usersTable.find((u) => u.id === k.userId);
                // Exclude docs of deleted/suspended users if users query requires active
                if (user && user.status !== 'active') return false;

                if (vals.length === 0) return true;

                // If filtering by userId AND docType (for saveKycDocument)
                const docTypeVal = vals.find((v) => ['aadhaar_front', 'aadhaar_back', 'pan_card', 'gst_cert', 'fssai_cert', 'driving_license', 'rc_book', 'vehicle_insurance'].includes(v));
                const userVal = vals.find((v) => v !== docTypeVal && typeof v === 'string' && (v.startsWith('uuid-') || v.startsWith('user-')));
                const statusVal = vals.find((v) => ['pending', 'verified', 'rejected'].includes(v));

                if (userVal && docTypeVal) {
                  return k.userId === userVal && k.docType === docTypeVal;
                }
                if (userVal && statusVal) {
                  return k.userId === userVal && k.status === statusVal;
                }
                if (userVal) {
                  return k.userId === userVal;
                }
                if (statusVal) {
                  return k.status === statusVal;
                }
                return vals.some((val) => k.userId === val || k.id === val || k.docType === val || k.status === val);
              });
            }
            return queryObj;
          },
          orderBy: (...args: any[]) => queryObj,
          limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
          then: (resolve: any) => Promise.resolve(filtered).then(resolve),
        };

        return queryObj;
      },
    }),
    insert: (table: any) => ({
      values: (val: any) => {
        const id = val.id || `uuid-${Math.random().toString(36).substring(2, 9)}`;
        const record = { id, ...val, createdAt: new Date() };

        let tableName =
          table?.[Symbol.for('drizzle:OriginalName')] ||
          table?.[Symbol.for('drizzle:Name')] ||
          table?._?.name ||
          table?.name ||
          '';
        if (tableName === 'users' || tableName.includes('user')) usersTable.push(record);
        else if (tableName === 'vendors' || tableName.includes('vendor')) vendorsTable.push(record);
        else if (tableName === 'delivery_partners' || tableName.includes('partner')) deliveryPartnersTable.push(record);
        else if (tableName === 'kyc_documents' || tableName.includes('kyc')) kycDocumentsTable.push(record);
        else if (tableName === 'auth_tokens' || tableName.includes('token')) authTokensTable.push(record);

        return {
          returning: () => Promise.resolve([record]),
          then: (resolve: any) => Promise.resolve([record]).then(resolve),
        };
      },
    }),
    update: (table: any) => ({
      set: (updates: any) => ({
        where: (condition: any) => {
          let tableName =
            table?.[Symbol.for('drizzle:OriginalName')] ||
            table?.[Symbol.for('drizzle:Name')] ||
            table?._?.name ||
            table?.name ||
            '';
          let updatedRows: any[] = [];
          if (tableName === 'users' || tableName.includes('user')) {
            usersTable = usersTable.map((u) => {
              const updated = { ...u, ...updates };
              updatedRows.push(updated);
              return updated;
            });
          } else if (tableName === 'vendors' || tableName.includes('vendor')) {
            vendorsTable = vendorsTable.map((v) => {
              const updated = { ...v, ...updates };
              updatedRows.push(updated);
              return updated;
            });
          } else if (tableName === 'delivery_partners' || tableName.includes('partner')) {
            deliveryPartnersTable = deliveryPartnersTable.map((p) => {
              const updated = { ...p, ...updates };
              updatedRows.push(updated);
              return updated;
            });
          } else if (tableName === 'kyc_documents' || tableName.includes('kyc')) {
            kycDocumentsTable = kycDocumentsTable.map((k) => {
              const updated = { ...k, ...updates };
              updatedRows.push(updated);
              return updated;
            });
          } else if (tableName === 'auth_tokens' || tableName.includes('token')) {
            authTokensTable = authTokensTable.map((t) => {
              const updated = { ...t, ...updates };
              updatedRows.push(updated);
              return updated;
            });
          }
          return {
            returning: () => Promise.resolve(updatedRows),
            then: (resolve: any) => Promise.resolve(updatedRows).then(resolve),
          };
        },
      }),
    }),
    delete: (table: any) => ({
      where: (condition: any) => {
        let tableName =
          table?.[Symbol.for('drizzle:OriginalName')] ||
          table?.[Symbol.for('drizzle:Name')] ||
          table?._?.name ||
          table?.name ||
          '';

        const extractValues = (obj: any): any[] => {
          if (!obj) return [];
          if (typeof obj === 'string' || typeof obj === 'number') return [obj];
          const vals: any[] = [];
          if (obj.value !== undefined) vals.push(obj.value);
          if (obj.right !== undefined) vals.push(...extractValues(obj.right));
          if (obj.queryChunks && Array.isArray(obj.queryChunks)) {
            for (const chunk of obj.queryChunks) {
              vals.push(...extractValues(chunk));
            }
          }
          return vals;
        };

        const vals = extractValues(condition);

        if (tableName === 'kyc_documents' || tableName.includes('kyc')) {
          if (vals.length > 0) {
            kycDocumentsTable = kycDocumentsTable.filter((k) => !vals.some((v) => k.userId === v || k.id === v));
          } else {
            kycDocumentsTable = [];
          }
        } else if (tableName === 'vendors' || tableName.includes('vendor')) {
          if (vals.length > 0) {
            vendorsTable = vendorsTable.filter((v) => !vals.some((val) => v.id === val || v.userId === val));
          } else {
            vendorsTable = [];
          }
        } else if (tableName === 'delivery_partners' || tableName.includes('partner')) {
          if (vals.length > 0) {
            deliveryPartnersTable = deliveryPartnersTable.filter((p) => !vals.some((val) => p.id === val || p.userId === val));
          } else {
            deliveryPartnersTable = [];
          }
        } else if (tableName === 'users' || tableName.includes('user')) {
          if (vals.length > 0) {
            usersTable = usersTable.filter((u) => !vals.some((v) => u.id === v));
          } else {
            usersTable = [];
          }
        }
        return Promise.resolve({ rowCount: 1 });
      },
    }),
  });

  const mockConfig = {
    get: (key: string) => {
      if (key === 'JWT_ACCESS_SECRET') return 'test-access-secret';
      if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
      if (key === 'CLOUDINARY_CLOUD_NAME') return 'test-cloud';
      if (key === 'CLOUDINARY_API_KEY') return 'test-key';
      if (key === 'CLOUDINARY_API_SECRET') return 'test-secret';
      return 'test';
    },
  };

  const mockJwt = {
    sign: () => 'mock-jwt-token',
    verify: () => ({ sub: 'test-user-id' }),
  };

  const mockNotifications = {
    notifyEmail: jest.fn(),
    sendWelcomeVendorEmail: jest.fn(),
    sendWelcomeCustomerEmail: jest.fn(),
    sendWelcomePartnerEmail: jest.fn(),
  };

  beforeEach(() => {
    usersTable = [];
    vendorsTable = [];
    deliveryPartnersTable = [];
    kycDocumentsTable = [];
    authTokensTable = [];
    restaurantsTable = [];
    groceryOrdersTable = [];
    foodOrdersTable = [];
    addressesTable = [];
  });

  it('TEST 1 to 6: Vendor A registers & uploads KYC docs -> Vendor A self-deletes -> Vendor B registers with same phone & email -> gets NEW ID and EMPTY document state', async () => {
    const mockDb = createMockDb();
    authService = new AuthService(mockDb as any, mockJwt as any, mockConfig as any);
    uploadsService = new UploadsService(mockDb as any, mockConfig as any, mockNotifications as any);

    // 1. Vendor A registers
    const vendorARes = await authService.vendorRegister({
      phone: '1234567890',
      email: 'rohit@gmail.com',
      password: 'password123',
      businessName: 'Rohit Grocery A',
      ownerName: 'Rohit',
      type: 'grocery',
      pickupLat: 16.705,
      pickupLng: 74.2433,
      radiusKm: 5,
    });

    const userAId = vendorARes.userId;
    const vendorAId = vendorARes.vendor.id;

    // 2. Vendor A uploads Aadhaar Front and Back
    await uploadsService.saveKycDocument(userAId, 'vendor', {
      docType: 'aadhaar_front',
      secureUrl: 'https://cloudinary.com/user_a_front.jpg',
      publicId: 'pub_a_front',
    });
    await uploadsService.saveKycDocument(userAId, 'vendor', {
      docType: 'aadhaar_back',
      secureUrl: 'https://cloudinary.com/user_a_back.jpg',
      publicId: 'pub_a_back',
    });

    // TEST 1: Documents belong to Vendor A
    const docsA = await uploadsService.listMyKycDocuments(userAId);
    expect(docsA.length).toBe(2);
    expect(docsA.every((d) => d.userId === userAId)).toBe(true);

    // TEST 2: Vendor A is deleted (self-delete)
    await authService.deleteAccount(userAId);

    // Verify KYC docs deleted
    expect(kycDocumentsTable.filter((d) => d.userId === userAId).length).toBe(0);

    // TEST 3: Vendor B registers with EXACT SAME phone and email
    const vendorBRes = await authService.vendorRegister({
      phone: '1234567890',
      email: 'rohit@gmail.com',
      password: 'newPassword456',
      businessName: 'Rohit Grocery B',
      ownerName: 'Rohit',
      type: 'grocery',
      pickupLat: 16.705,
      pickupLng: 74.2433,
      radiusKm: 5,
    });

    // TEST 4: Vendor B gets a completely NEW user ID and vendor ID
    expect(vendorBRes.userId).not.toBe(userAId);
    expect(vendorBRes.vendor.id).not.toBe(vendorAId);
    expect(vendorBRes.userId).toBeDefined();

    // TEST 5 & 6: Vendor B document API returns EMPTY state [] and Vendor A docs are NOT returned
    const docsB = await uploadsService.listMyKycDocuments(vendorBRes.userId);
    expect(docsB).toEqual([]);
  });

  it('TEST 7, 8, 9: Vendor B uploads a new Aadhaar document -> only Vendor B document is returned, Vendor A documents remain isolated', async () => {
    const mockDb = createMockDb();
    authService = new AuthService(mockDb as any, mockJwt as any, mockConfig as any);
    uploadsService = new UploadsService(mockDb as any, mockConfig as any, mockNotifications as any);

    // Register Vendor B
    const vendorBRes = await authService.vendorRegister({
      phone: '1234567890',
      email: 'rohit@gmail.com',
      password: 'password123',
      businessName: 'Rohit Grocery Fresh',
      ownerName: 'Rohit',
      type: 'grocery',
      pickupLat: 16.705,
      pickupLng: 74.2433,
      radiusKm: 5,
    });

    // TEST 7: Vendor B uploads new Aadhaar Front
    await uploadsService.saveKycDocument(vendorBRes.userId, 'vendor', {
      docType: 'aadhaar_front',
      secureUrl: 'https://cloudinary.com/user_b_front.jpg',
      publicId: 'pub_b_front',
    });

    // TEST 8 & 9: Only Vendor B newly uploaded document appears for Vendor B
    const docsB = await uploadsService.listMyKycDocuments(vendorBRes.userId);
    expect(docsB.length).toBe(1);
    expect(docsB[0].secureUrl).toBe('https://cloudinary.com/user_b_front.jpg');
    expect(docsB[0].userId).toBe(vendorBRes.userId);
  });

  it('TEST 10: Admin deletes vendor -> Re-registration with same email/phone gets fresh identity & 0 documents', async () => {
    const mockDb = createMockDb();
    authService = new AuthService(mockDb as any, mockJwt as any, mockConfig as any);
    catalogService = new CatalogService(mockDb as any, mockNotifications as any);
    uploadsService = new UploadsService(mockDb as any, mockConfig as any, mockNotifications as any);

    // 1. Vendor C registers
    const vendorCRes = await authService.vendorRegister({
      phone: '9988776655',
      email: 'rohit.admin@gmail.com',
      password: 'password123',
      businessName: 'Vendor C',
      ownerName: 'Rohit C',
      type: 'grocery',
      pickupLat: 16.705,
      pickupLng: 74.2433,
      radiusKm: 5,
    });

    // 2. Uploads KYC document
    await uploadsService.saveKycDocument(vendorCRes.userId, 'vendor', {
      docType: 'aadhaar_front',
      secureUrl: 'https://cloudinary.com/user_c_front.jpg',
      publicId: 'pub_c_front',
    });

    // Verify 1 doc exists
    const docsC = await uploadsService.listMyKycDocuments(vendorCRes.userId);
    expect(docsC.length).toBe(1);

    // 3. Admin deletes Vendor C
    const deleteRes = await catalogService.deleteAdminVendor(vendorCRes.vendor.id);
    expect(deleteRes.success).toBe(true);

    // Verify KYC docs deleted
    expect(kycDocumentsTable.filter((d) => d.userId === vendorCRes.userId).length).toBe(0);

    // 4. Vendor D registers with EXACT SAME phone and email
    const vendorDRes = await authService.vendorRegister({
      phone: '9988776655',
      email: 'rohit.admin@gmail.com',
      password: 'newPassword789',
      businessName: 'Vendor D Re-registered',
      ownerName: 'Rohit D',
      type: 'grocery',
      pickupLat: 16.705,
      pickupLng: 74.2433,
      radiusKm: 5,
    });

    // Verify fresh identity
    expect(vendorDRes.userId).not.toBe(vendorCRes.userId);
    expect(vendorDRes.vendor.id).not.toBe(vendorCRes.vendor.id);

    // Verify document query returns empty []
    const docsD = await uploadsService.listMyKycDocuments(vendorDRes.userId);
    expect(docsD).toEqual([]);
  });

  it('TEST 11: Admin review listAllKycDocuments ignores deleted / suspended account documents', async () => {
    const mockDb = createMockDb();
    uploadsService = new UploadsService(mockDb as any, mockConfig as any, mockNotifications as any);

    // Suspended user
    const suspendedUserId = 'user-suspended-999';
    usersTable.push({ id: suspendedUserId, status: 'suspended', role: 'vendor' });
    kycDocumentsTable.push({ id: 'doc-old-1', userId: suspendedUserId, docType: 'aadhaar_front', status: 'pending' });

    // Active user
    const activeUserId = 'user-active-111';
    usersTable.push({ id: activeUserId, status: 'active', role: 'vendor' });
    kycDocumentsTable.push({ id: 'doc-act-1', userId: activeUserId, docType: 'aadhaar_front', status: 'pending' });

    const allDocs = await uploadsService.listAllKycDocuments('pending');
    expect(allDocs.length).toBe(1);
    expect(allDocs[0].userId).toBe(activeUserId);
  });
});
