import { Module } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { MeController } from './me.controller.js';

@Module({
  controllers: [MeController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
