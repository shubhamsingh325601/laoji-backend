import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { NotificationService } from './notification.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/notifications')
export class AdminNotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  listRecent() {
    return this.notifications.listRecentForAdmin();
  }
}
