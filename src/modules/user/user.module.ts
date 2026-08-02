import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UserController } from './user.controller';
import { AddressController } from './address.controller';

@Module({
  imports: [AuthModule],
  controllers: [UserController, AddressController],
})
export class UserModule {}
