import { Body, Controller, Delete, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { AuthService } from '../auth/auth.service';
import { UpdateEmailDto } from './dto/update-email.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly auth: AuthService) {}

  @Get('me')
  me(@CurrentUser() user: JwtAccessPayload) {
    return this.auth.me(user.sub);
  }

  @Patch('me/email')
  updateEmail(@CurrentUser() user: JwtAccessPayload, @Body() dto: UpdateEmailDto) {
    return this.auth.updateEmail(user.sub, dto.email);
  }

  @Patch('me/profile')
  updateProfile(@CurrentUser() user: JwtAccessPayload, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user.sub, dto);
  }

  @Patch('me')
  updateProfileDirect(@CurrentUser() user: JwtAccessPayload, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user.sub, dto);
  }

  @Delete('me')
  deleteAccount(@CurrentUser() user: JwtAccessPayload) {
    return this.auth.deleteAccount(user.sub);
  }
}
