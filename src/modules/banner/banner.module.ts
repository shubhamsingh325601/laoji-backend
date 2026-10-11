import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../config/database.module';
import { ResponseCacheModule } from '../../common/cache/response-cache.module';
import { BannerService } from './banner.service';
import { AdminBannerController, PublicBannerController } from './banner.controller';

@Module({
  imports: [DatabaseModule, ResponseCacheModule],
  controllers: [PublicBannerController, AdminBannerController],
  providers: [BannerService],
})
export class BannerModule {}
