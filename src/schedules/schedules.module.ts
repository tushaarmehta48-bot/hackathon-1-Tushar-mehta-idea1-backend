import { Module } from '@nestjs/common';
import { SchedulesRepository } from './schedules.repository.js';

@Module({
  providers: [SchedulesRepository],
  exports: [SchedulesRepository],
})
export class SchedulesModule {}
