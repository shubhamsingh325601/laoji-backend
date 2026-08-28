import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { UserController } from './user.controller';
import { AddressController } from './address.controller';
import { AdminUserController } from './admin-user.controller';
import { UserService } from './user.service';

@Module({
  imports: [AuthModule, NotificationModule],
  controllers: [UserController, AddressController, AdminUserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
