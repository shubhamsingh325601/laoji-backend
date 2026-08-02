import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { NotificationService } from './notification.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Post('device-token')
  registerDeviceToken(@CurrentUser() user: JwtAccessPayload, @Body() dto: RegisterDeviceTokenDto) {
    return this.notifications.registerDeviceToken(user.sub, dto.fcmToken, dto.platform);
  }
}
