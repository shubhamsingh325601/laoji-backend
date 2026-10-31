"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.use((req, _res, next) => {
        const rawPath = req.path || req.url?.split('?')[0];
        if (rawPath === '/me' || rawPath === '/me/') {
            req.url = '/api/v1/me' + (req.url?.includes('?') ? '?' + req.url.split('?')[1] : '');
        }
        else if (rawPath === '/admin/me' || rawPath === '/admin/me/') {
            req.url = '/api/v1/admin/me' + (req.url?.includes('?') ? '?' + req.url.split('?')[1] : '');
        }
        next();
    });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
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
    const laojiAdminPreviewOrigin = /^https:\/\/laoji-admin-[a-z0-9-]+-shubham-singhs-projects-fad54e54\.vercel\.app$/;
    app.enableCors({
        origin: [...corsOrigins, laojiAdminPreviewOrigin],
        credentials: true,
    });
    const port = process.env.PORT ? Number(process.env.PORT) : 3000;
    await app.listen(port, '0.0.0.0');
    console.log(`[Laoji API] Application successfully started and listening on 0.0.0.0:${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map