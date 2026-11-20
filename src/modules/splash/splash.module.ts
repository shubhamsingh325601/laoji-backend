import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../config/database.module';
import { ResponseCacheModule } from '../../common/cache/response-cache.module';
import { SplashService } from './splash.service';
import { AdminSplashController, PublicSplashController } from './splash.controller';

@Module({
  imports: [DatabaseModule, ResponseCacheModule],
  controllers: [PublicSplashController, AdminSplashController],
  providers: [SplashService],
})
export class SplashModule {}
