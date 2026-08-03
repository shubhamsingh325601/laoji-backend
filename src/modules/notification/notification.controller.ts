import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { NotificationService } from './notification.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { ContactSupportDto } from './dto/contact-support.dto';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Post('device-token')
  registerDeviceToken(@CurrentUser() user: JwtAccessPayload, @Body() dto: RegisterDeviceTokenDto) {
    return this.notifications.registerDeviceToken(user.sub, dto.fcmToken, dto.platform);
  }

  // Post-Phase-11 MVP-completion pass (Customer Support) — used by all
  // three phone-auth apps (customer/vendor/delivery), per the PRD's
  // "basic (contact/help)" MVP scope.
  @Throttle({ supportContact: { limit: 5, ttl: 60_000 } })
  @Post('support')
  async contactSupport(@CurrentUser() user: JwtAccessPayload, @Body() dto: ContactSupportDto) {
    await this.notifications.sendSupportMessage(user.sub, user.role, dto.subject, dto.message);
    return { ok: true };
  }
}
