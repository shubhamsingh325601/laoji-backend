import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { NotificationService } from './notification.service';
import { SendAdminNotificationDto } from './dto/send-admin-notification.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/notifications')
export class AdminNotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  listRecent() {
    return this.notifications.listRecentForAdmin();
  }

  @Post('send')
  sendNotification(@Body() dto: SendAdminNotificationDto) {
    return this.notifications.sendAdminNotification(dto);
  }
}
