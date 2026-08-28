"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
    const rawCors = process.env.CORS_ORIGIN?.replace(/^["']|["']$/g, '').trim();
    const corsOrigins = rawCors
        ? rawCors.split(',').map((s) => s.trim())
        : ['http://localhost:8080', 'https://laoji-admin.vercel.app'];
    app.enableCors({
        origin: corsOrigins,
        credentials: true,
    });
    const port = process.env.PORT ? Number(process.env.PORT) : 3000;
    await app.listen(port, '0.0.0.0');
    console.log(`[Laoji API] Application successfully started and listening on 0.0.0.0:${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map