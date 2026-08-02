import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [NotificationModule],
  controllers: [UploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}
