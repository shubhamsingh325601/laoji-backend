import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const rawCors = process.env.CORS_ORIGIN?.replace(/^["']|["']$/g, '').trim();
  const defaultOrigins = [
    'http://localhost:8080',
    'http://localhost:8081',
    'https://laoji-admin.vercel.app',
    'https://www.laojionline.com',
    'https://laojionline.com',
  ];
  const corsOrigins = rawCors
    ? Array.from(new Set([...rawCors.split(',').map((s) => s.trim()), 'https://www.laojionline.com', 'https://laojionline.com']))
    : defaultOrigins;

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`[Laoji API] Application successfully started and listening on 0.0.0.0:${port}`);
}
bootstrap();
