import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../config/database.module';
import { ResponseCacheModule } from '../../common/cache/response-cache.module';
import { HomeTabService } from './home-tab.service';
import { AdminHomeTabController, PublicHomeTabController } from './home-tab.controller';

@Module({
  imports: [DatabaseModule, ResponseCacheModule],
  controllers: [PublicHomeTabController, AdminHomeTabController],
  providers: [HomeTabService],
})
export class HomeTabModule {}
