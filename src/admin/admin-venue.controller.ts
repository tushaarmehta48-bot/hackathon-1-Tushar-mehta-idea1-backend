import { Body, Controller, Delete, Get, Param, Patch, Post, Query, StreamableFile } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../users/user.types.js';
import { AdminService } from './admin.service.js';
import {
  AdminExceptionsQueryDto,
  AdminReportQueryDto,
  AssignStaffRoleDto,
  CreateDiningAreaDto,
  CreateExceptionDto,
  CreateSeasonDto,
  CreateShiftDto,
  CreateTableBlockDto,
  CreateTableDto,
  UpdateBookingPolicyDto,
  UpdateDiningAreaDto,
  UpdateSeasonDto,
  UpdateShiftDto,
  UpdateTableDto,
} from './dto/admin-mutations.dto.js';

@Controller('admin')
@Roles('ADMIN')
export class AdminVenueController {
  constructor(private readonly admin: AdminService) {}

  @Get('venue')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  venueSnapshot() {
    return this.admin.getVenueSnapshot();
  }

  @Get('booking-policy')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  bookingPolicy() {
    return this.admin.getBookingPolicy();
  }

  @Patch('booking-policy')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  updateBookingPolicy(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateBookingPolicyDto) {
    return this.admin.updateBookingPolicy(user, dto);
  }

  @Get('dining-areas')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  listAreas() {
    return this.admin.listDiningAreas();
  }

  @Post('dining-areas')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  createArea(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDiningAreaDto) {
    return this.admin.createDiningArea(user, dto);
  }

  @Patch('dining-areas/:id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  updateArea(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDiningAreaDto,
  ) {
    return this.admin.updateDiningArea(user, id, dto);
  }

  @Get('tables')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  listTables() {
    return this.admin.listTables();
  }

  @Post('tables')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  createTable(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTableDto) {
    return this.admin.createTable(user, dto);
  }

  @Patch('tables/:id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  updateTable(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.admin.updateTable(user, id, dto);
  }

  @Get('shifts')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  listShifts() {
    return this.admin.listShifts();
  }

  @Post('shifts')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  createShift(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateShiftDto) {
    return this.admin.createShift(user, dto);
  }

  @Patch('shifts/:id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  updateShift(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateShiftDto,
  ) {
    return this.admin.updateShift(user, id, dto);
  }

  @Get('seasons')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  listSeasons() {
    return this.admin.listSeasons();
  }

  @Post('seasons')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  createSeason(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSeasonDto) {
    return this.admin.createSeason(user, dto);
  }

  @Patch('seasons/:id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  updateSeason(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSeasonDto,
  ) {
    return this.admin.updateSeason(user, id, dto);
  }

  @Get('exceptions')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  listExceptions(@Query() query: AdminExceptionsQueryDto) {
    return this.admin.listExceptions(query.from, query.to);
  }

  @Post('exceptions')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  createException(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateExceptionDto) {
    return this.admin.createException(user, dto);
  }

  @Delete('exceptions/:id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  deleteException(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.admin.deleteException(user, id);
  }

  @Get('table-blocks')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  listBlocks(@Query('from') from: string, @Query('to') to: string) {
    return this.admin.listTableBlocks(from, to);
  }

  @Post('table-blocks')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  createBlock(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTableBlockDto) {
    return this.admin.createTableBlock(user, dto);
  }

  @Patch('table-blocks/:id/deactivate')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  deactivateBlock(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.admin.deactivateTableBlock(user, id);
  }

  @Get('staff-profiles')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  listStaff() {
    return this.admin.listStaffProfiles();
  }

  @Post('staff-profiles/assign-role')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  assignRole(@CurrentUser() user: AuthenticatedUser, @Body() dto: AssignStaffRoleDto) {
    return this.admin.assignStaffRole(user, dto);
  }

  @Get('reports/summary')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  reportSummary(@Query() query: AdminReportQueryDto) {
    return this.admin.reportSummary(query.from, query.to);
  }

  @Get('reports/analytics')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  reportAnalytics(@Query() query: AdminReportQueryDto) {
    return this.admin.reportAnalytics(query.from, query.to);
  }

  @Get('reports/export')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  async reportExport(@Query() query: AdminReportQueryDto) {
    const buffer = await this.admin.exportReportExcel(query.from, query.to);
    const filename = `iturrieta-report-${query.from}-${query.to}.xlsx`;
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
