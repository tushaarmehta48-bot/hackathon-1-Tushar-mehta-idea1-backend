import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { createObserveModule } from '@nestjs/observe';
import { validateEnv } from './config/env.schema.js';
import { HealthController } from './health.controller.js';
import { SupabaseModule } from './supabase/supabase.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { ReservationsModule } from './reservations/reservations.module.js';
import { StaffModule } from './staff/staff.module.js';
import { CheckInModule } from './check-in/check-in.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { AdminModule } from './admin/admin.module.js';
import { BlogModule } from './blog/blog.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
    }),
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'backend',
    }),
    SupabaseModule,
    UsersModule,
    AuthModule,
    AvailabilityModule,
    ReservationsModule,
    StaffModule,
    CheckInModule,
    PaymentsModule,
    AdminModule,
    BlogModule,
  ],
  controllers: [HealthController],
  providers: [
    JwtAuthGuard,
    RolesGuard,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
