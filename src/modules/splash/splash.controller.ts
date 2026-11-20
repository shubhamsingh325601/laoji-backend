import { Body, Controller, Get, Param, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ResponseCacheInterceptor } from '../../common/cache/response-cache.interceptor';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { assertSplashApp, SplashService } from './splash.service';

@UseInterceptors(ResponseCacheInterceptor)
@Controller('splash')
export class PublicSplashController {
  constructor(private readonly splash: SplashService) {}

  // `configured: false` tells an app to keep using its older fallback (the
  // banner with placement "splash"); once saved in Admin this is the truth.
  @Get()
  get(@Query('app') app = 'customer') {
    return this.splash.get(assertSplashApp(app));
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/splash')
export class AdminSplashController {
  constructor(private readonly splash: SplashService) {}

  @Get()
  async list() {
    return { splashes: await this.splash.listAll() };
  }

  @Put(':app')
  save(@Param('app') app: string, @Body() body: unknown) {
    return this.splash.save(assertSplashApp(app), body);
  }
}
