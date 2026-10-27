import { Module } from '@nestjs/common';
import { AuditRepository } from '../ops/audit.repository.js';
import { AdminVenueController } from './admin-venue.controller.js';
import { AdminRepository } from './admin.repository.js';
import { AdminService } from './admin.service.js';

@Module({
  controllers: [AdminVenueController],
  providers: [AdminService, AdminRepository, AuditRepository],
})
export class AdminModule {}
