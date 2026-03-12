import {
    Controller,
    Get,
    Post,
    Patch,
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
    ApiQuery,
    ApiResponse,
} from '@nestjs/swagger';
import { AppointmentService, PaginatedAppointments } from './appointment.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { QueryAppointmentDto } from './dto/query-appointment.dto';
import { AppointmentResponseDto } from './dto/appointment-response.dto';
import { UserRole } from 'src/common/enums';
import { Roles } from 'src/common/decorator/roles.decorator';
import { JwtAuthGuard } from 'src/common/guard/auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';

@ApiTags('Appointments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appointments')
export class AppointmentController {
    constructor(private readonly appointmentService: AppointmentService) { }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /appointments/available-slots  ← MUST be before GET /:id
    // ─────────────────────────────────────────────────────────────────────────
    @Get('available-slots')
    @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get available start times for a stylist + service combo — Admin + Receptionist' })
    @ApiQuery({ name: 'stylistId', required: true, type: Number })
    @ApiQuery({ name: 'date', required: true, type: String, description: 'YYYY-MM-DD' })
    @ApiQuery({ name: 'serviceIds', required: true, type: String, description: 'Comma-separated service IDs e.g. 1,2,3' })
    @ApiResponse({ status: 200, description: 'Available start times returned' })
    async getAvailableSlots(
        @Query('stylistId', ParseIntPipe) stylistId: number,
        @Query('date') date: string,
        @Query('serviceIds') serviceIdsRaw: string,
    ): Promise<object> {
        const serviceIds = serviceIdsRaw
            .split(',')
            .map((s) => parseInt(s.trim(), 10))
            .filter(Boolean);
        return this.appointmentService.getAvailableSlots(stylistId, date, serviceIds);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /appointments — Admin + Receptionist
    // ─────────────────────────────────────────────────────────────────────────
    @Post()
    @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Book a new appointment — Admin + Receptionist' })
    @ApiResponse({ status: 201, type: AppointmentResponseDto })
    @ApiResponse({ status: 400, description: 'Validation error / past date / inactive customer or stylist' })
    @ApiResponse({ status: 409, description: 'Time slot no longer available' })
    create(@Body() dto: CreateAppointmentDto): Promise<AppointmentResponseDto> {
        return this.appointmentService.create(dto);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /appointments — Admin + Receptionist (paginated)
    // ─────────────────────────────────────────────────────────────────────────
    @Get()
    @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get all appointments with filters — Admin + Receptionist' })
    @ApiResponse({ status: 200, description: 'Paginated appointments list' })
    findAll(@Query() query: QueryAppointmentDto): Promise<PaginatedAppointments> {
        return this.appointmentService.findAll(query);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /appointments/:id/cancel  ← MUST be before PATCH /:id (if any)
    // ─────────────────────────────────────────────────────────────────────────
    @Patch(':id/cancel')
    @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Cancel appointment and release slots — Admin + Receptionist' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, type: AppointmentResponseDto })
    @ApiResponse({ status: 400, description: 'Appointment already in terminal status' })
    cancel(@Param('id', ParseIntPipe) id: number): Promise<AppointmentResponseDto> {
        return this.appointmentService.cancel(id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /appointments/:id/complete
    // ─────────────────────────────────────────────────────────────────────────
    @Patch(':id/complete')
    @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Mark appointment as completed — Admin + Receptionist' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, type: AppointmentResponseDto })
    @ApiResponse({ status: 400, description: 'Appointment already in terminal status' })
    complete(@Param('id', ParseIntPipe) id: number): Promise<AppointmentResponseDto> {
        return this.appointmentService.complete(id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /appointments/:id/no-show
    // ─────────────────────────────────────────────────────────────────────────
    @Patch(':id/no-show')
    @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Mark appointment as no-show and release slots — Admin + Receptionist' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, type: AppointmentResponseDto })
    @ApiResponse({ status: 400, description: 'Appointment already in terminal status' })
    noShow(@Param('id', ParseIntPipe) id: number): Promise<AppointmentResponseDto> {
        return this.appointmentService.noShow(id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /appointments/:id ← declared LAST to avoid swallowing named routes
    // ─────────────────────────────────────────────────────────────────────────
    @Get(':id')
    @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get appointment by ID — Admin + Receptionist' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, type: AppointmentResponseDto })
    @ApiResponse({ status: 404, description: 'Appointment not found' })
    findOne(@Param('id', ParseIntPipe) id: number): Promise<AppointmentResponseDto> {
        return this.appointmentService.findOne(id);
    }
}
