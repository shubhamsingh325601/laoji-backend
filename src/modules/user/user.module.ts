import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { UserController } from './user.controller';
import { AddressController } from './address.controller';
import { AdminUserController } from './admin-user.controller';
import { UserService } from './user.service';
import { AdminAccountsController } from './admin-accounts.controller';
import { AdminAccountsService } from './admin-accounts.service';

@Module({
  imports: [AuthModule, NotificationModule],
  controllers: [UserController, AddressController, AdminUserController, AdminAccountsController],
  providers: [UserService, AdminAccountsService],
  exports: [UserService],
})
export class UserModule {}
