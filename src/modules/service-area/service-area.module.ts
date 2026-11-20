import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../config/database.module';
import { ResponseCacheModule } from '../../common/cache/response-cache.module';
import { ServiceAreaService } from './service-area.service';
import { AdminServiceAreaController, PublicServiceAreaController } from './service-area.controller';

@Module({
  imports: [DatabaseModule, ResponseCacheModule],
  controllers: [PublicServiceAreaController, AdminServiceAreaController],
  providers: [ServiceAreaService],
  exports: [ServiceAreaService],
})
export class ServiceAreaModule {}
