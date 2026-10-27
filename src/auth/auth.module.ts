import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { ReservationAccessService } from './reservation-access.service.js';
import { AdminAuthController } from './admin-auth.controller.js';
import { StaffAuthController } from './staff-auth.controller.js';
import { PortalAuthController } from './portal-auth.controller.js';
import { PortalAuthService } from './portal-auth.service.js';

@Module({
  imports: [UsersModule],
  controllers: [AdminAuthController, StaffAuthController, PortalAuthController],
  providers: [ReservationAccessService, PortalAuthService],
  exports: [ReservationAccessService],
})
export class AuthModule {}
