import {
    Controller,
    Get,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    ParseIntPipe,
    HttpCode,
    HttpStatus,
    UseGuards,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiParam,
    ApiResponse,
} from '@nestjs/swagger';
import { StylistsService, PaginatedStylists } from './stylist.service';
import { UpdateStylistDto } from './dto/update-stylist.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { AssignServicesDto } from './dto/assign-service.dto';
import { QueryStylistDto } from './dto/query-stylist.dto';
import { JwtAuthGuard } from 'src/common/guard/auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorator/roles.decorator';
import { CurrentUser } from 'src/common/decorator/current-user.decorator';
import { UserRole } from 'src/common/enums/index';
import { User } from '../user/entities/user.entity';

@ApiTags('Stylists')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stylists')
export class StylistController {
    constructor(private readonly stylistsService: StylistsService) { }

    // ── ROUTE ORDER MATTERS ───────────────────────────────────────────────────
    // GET  /stylists                   → before /:id
    // GET  /stylists/:id/schedule      → static sub-route — fine
    // GET  /stylists/:id/services      → static sub-route — fine
    // PATCH /stylists/:id/schedule     → MUST be before PATCH /:id
    // PATCH /stylists/:id/services     → MUST be before PATCH /:id
    // PATCH /stylists/:id
    // DELETE /stylists/:id

    // ─────────────────────────────────────────────────────────────────────
    // GET /stylists — All roles (role-aware response)
    // ─────────────────────────────────────────────────────────────────────
    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get all stylists — All roles (role-aware response)' })
    @ApiResponse({ status: 200, description: 'Paginated list of stylists' })
    findAll(
        @Query() query: QueryStylistDto,
        @CurrentUser() user: User,
    ): Promise<PaginatedStylists> {
        return this.stylistsService.findAll(query, user.role);
    }

    // ─────────────────────────────────────────────────────────────────────
    // GET /stylists/:id — All roles (role-aware response)
    // ─────────────────────────────────────────────────────────────────────
    @Get(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get stylist by ID — All roles (role-aware response)' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, description: 'Stylist profile' })
    @ApiResponse({ status: 404, description: 'Stylist not found' })
    findOne(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser() user: User,
    ): Promise<any> {
        return this.stylistsService.findOne(id, user.role);
    }

    // ─────────────────────────────────────────────────────────────────────
    // GET /stylists/:id/schedule — All roles
    // ─────────────────────────────────────────────────────────────────────
    @Get(':id/schedule')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get stylist working schedule — All roles' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, description: '7-day working schedule' })
    @ApiResponse({ status: 404, description: 'Stylist not found' })
    getSchedule(@Param('id', ParseIntPipe) id: number, @CurrentUser('role') role: UserRole,): Promise<any> {
        return this.stylistsService.getSchedule(id,role);
    }

    // ─────────────────────────────────────────────────────────────────────
    // GET /stylists/:id/services — All roles (role-aware)
    // ─────────────────────────────────────────────────────────────────────
    @Get(':id/services')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get services offered by stylist — All roles' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, description: 'List of assigned services' })
    @ApiResponse({ status: 404, description: 'Stylist not found' })
    getServices(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser() user: User,
    ): Promise<any> {
        return this.stylistsService.getServices(id, user.role);
    }

    // ─────────────────────────────────────────────────────────────────────
    // PATCH /stylists/:id/schedule — Admin only (full 7-day replace)
    // MUST be declared before PATCH /:id
    // ─────────────────────────────────────────────────────────────────────
    @Patch(':id/schedule')
    @Roles(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Update stylist working schedule — Admin only' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, description: 'Schedule updated' })
    @ApiResponse({ status: 400, description: 'Invalid schedule data' })
    @ApiResponse({ status: 404, description: 'Stylist not found' })
    updateSchedule(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateScheduleDto,
    ): Promise<any> {
        return this.stylistsService.updateSchedule(id, dto);
    }

    // ─────────────────────────────────────────────────────────────────────
    // PATCH /stylists/:id/services — Admin only (full replace)
    // MUST be declared before PATCH /:id
    // ─────────────────────────────────────────────────────────────────────
    @Patch(':id/services')
    @Roles(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Assign services to stylist — Admin only' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, description: 'Services assigned successfully' })
    @ApiResponse({ status: 400, description: 'Some service IDs are invalid or inactive' })
    @ApiResponse({ status: 404, description: 'Stylist not found' })
    assignServices(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: AssignServicesDto,
    ): Promise<{ message: string; total: number }> {
        return this.stylistsService.assignServices(id, dto);
    }

    // ─────────────────────────────────────────────────────────────────────
    // PATCH /stylists/:id — Admin only
    // ─────────────────────────────────────────────────────────────────────
    @Patch(':id')
    @Roles(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Update stylist profile — Admin only' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, description: 'Stylist updated successfully' })
    @ApiResponse({ status: 404, description: 'Stylist not found' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateStylistDto,
    ): Promise<any> {
        return this.stylistsService.update(id, dto);
    }

    // ─────────────────────────────────────────────────────────────────────
    // DELETE /stylists/:id — Admin only (soft delete)
    // ─────────────────────────────────────────────────────────────────────
    @Delete(':id')
    @Roles(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Soft delete stylist — Admin only' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, description: 'Stylist deleted successfully' })
    @ApiResponse({ status: 400, description: 'Stylist has scheduled appointments' })
    @ApiResponse({ status: 404, description: 'Stylist not found' })
    @ApiResponse({ status: 409, description: 'Stylist already deleted' })
    remove(
        @Param('id', ParseIntPipe) id: number,
    ): Promise<{ message: string }> {
        return this.stylistsService.remove(id);
    }
}