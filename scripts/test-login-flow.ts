import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const authService = app.get(AuthService);

  console.log('--- 1. Testing login with owner@laojionline.com & Admin@123 ---');
  try {
    const res1 = await authService.adminLogin('owner@laojionline.com', 'Admin@123');
    console.log('Login SUCCESS! userId:', res1.userId, 'role:', res1.role);
  } catch (err: any) {
    console.error('Login failed:', err.message);
  }

  console.log('--- 2. Testing login with admin@laojionline.com (alias) ---');
  try {
    const res2 = await authService.adminLogin('admin@laojionline.com', 'Admin@123');
    console.log('Alias Login SUCCESS! userId:', res2.userId, 'role:', res2.role);
  } catch (err: any) {
    console.error('Alias Login failed:', err.message);
  }

  console.log('--- 3. Testing login with phone 8005803078 ---');
  try {
    const res3 = await authService.adminLogin('8005803078', 'Admin@123');
    console.log('Phone Login SUCCESS! userId:', res3.userId, 'role:', res3.role);
  } catch (err: any) {
    console.error('Phone Login failed:', err.message);
  }

  console.log('--- 4. Testing login with old admin123@gmail.com ---');
  try {
    const res4 = await authService.adminLogin('admin123@gmail.com', 'Admin@123');
    console.log('Old Admin Login SUCCESS! userId:', res4.userId, 'role:', res4.role);
  } catch (err: any) {
    console.error('Old Admin Login failed:', err.message);
  }

  await app.close();
}

main().catch(console.error);
