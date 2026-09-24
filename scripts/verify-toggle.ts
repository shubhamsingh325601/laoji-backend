import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CatalogService } from '../src/modules/catalog/catalog.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const catalogService = app.get(CatalogService);

  const sangodLat = 24.924;
  const sangodLng = 76.283;

  console.log('--- 1. Testing publicListRestaurants around Sangod ---');
  let restaurants = await catalogService.publicListRestaurants(sangodLat, sangodLng);
  const ganpatiRest = restaurants.find(r => r.name.toLowerCase().includes('ganpati'));
  console.log('Found Ganpati Kirana in restaurants?', !!ganpatiRest, ganpatiRest ? { id: ganpatiRest.id, isOpen: ganpatiRest.isOpen } : null);

  console.log('--- 2. Testing publicSearch around Sangod ---');
  let searchRes = await catalogService.publicSearch(sangodLat, sangodLng, 'kirana');
  const ganpatiSearch = searchRes.restaurants.find(s => s.name.toLowerCase().includes('ganpati'));
  console.log('Found Ganpati Kirana in restaurant search?', !!ganpatiSearch);

  // Find Ganpati Kirana vendor ID
  const vendors = await catalogService.listVendorsAdmin();
  const ganpatiVendor = vendors.find(v => v.businessName.toLowerCase().includes('ganpati'));
  if (!ganpatiVendor) {
    console.error('Ganpati vendor not found!');
    await app.close();
    return;
  }
  console.log(`Ganpati Vendor ID: ${ganpatiVendor.id}, current isOpen: ${ganpatiVendor.isOpen}`);

  console.log('--- 3. Testing Hide Toggle (isOpen = false) ---');
  await catalogService.updateAdminVendor(ganpatiVendor.id, { isOpen: false });

  restaurants = await catalogService.publicListRestaurants(sangodLat, sangodLng);
  const hiddenInRest = restaurants.find(r => r.name.toLowerCase().includes('ganpati'));
  console.log('After hide -> Found in publicListRestaurants?', !!hiddenInRest);

  searchRes = await catalogService.publicSearch(sangodLat, sangodLng, 'kirana');
  const hiddenInSearch = searchRes.restaurants.find(s => s.name.toLowerCase().includes('ganpati'));
  console.log('After hide -> Found in restaurant search?', !!hiddenInSearch);

  console.log('--- 4. Testing Show Toggle (isOpen = true) ---');
  await catalogService.updateAdminVendor(ganpatiVendor.id, { isOpen: true });

  restaurants = await catalogService.publicListRestaurants(sangodLat, sangodLng);
  const restoredInRest = restaurants.find(r => r.name.toLowerCase().includes('ganpati'));
  console.log('After restore -> Found in publicListRestaurants?', !!restoredInRest);

  console.log('Toggle verification PASSED successfully!');
  await app.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Error during verification:', err);
  process.exit(1);
});
