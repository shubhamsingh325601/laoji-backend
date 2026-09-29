import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../config/database.module';
import { BannerService } from './banner.service';
import { AdminBannerController, PublicBannerController } from './banner.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [PublicBannerController, AdminBannerController],
  providers: [BannerService],
})
export class BannerModule {}
