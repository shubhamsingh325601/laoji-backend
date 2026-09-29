import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../config/database.module';
import { NotificationModule } from '../notification/notification.module';
import { AreaManagerService } from './area-manager.service';
import { AdminAreaManagerController } from './admin-area-manager.controller';

@Module({
  imports: [DatabaseModule, NotificationModule],
  controllers: [AdminAreaManagerController],
  providers: [AreaManagerService],
  exports: [AreaManagerService],
})
export class AreaManagerModule {}
