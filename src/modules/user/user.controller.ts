import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { AuthService } from '../auth/auth.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly auth: AuthService) {}

  @Get('me')
  me(@CurrentUser() user: JwtAccessPayload) {
    return this.auth.me(user.sub);
  }
}
