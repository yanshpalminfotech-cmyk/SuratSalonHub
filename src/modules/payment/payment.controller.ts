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
    ApiResponse,
} from '@nestjs/swagger';
import { PaymentService, PaginatedPayments } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdateCollectDto } from './dto/update-collect.dto';
import { UpdateRefundDto } from './dto/update-refund.dto';
import { QueryPaymentDto } from './dto/query-payment.dto';
import { Payment } from './entities/payment.entity';
import { UserRole } from 'src/common/enums';
import { Roles } from 'src/common/decorator/roles.decorator';
import { JwtAuthGuard } from 'src/common/guard/auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentController {
    constructor(private readonly paymentService: PaymentService) { }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /payments/appointment/:appointmentId  ← MUST be before GET /:id
    // ─────────────────────────────────────────────────────────────────────────
    @Get('appointment/:appointmentId')
    @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get payment by appointment ID — Admin + Receptionist' })
    @ApiParam({ name: 'appointmentId', type: Number })
    @ApiResponse({ status: 200, type: Payment })
    @ApiResponse({ status: 404, description: 'No payment found for appointment' })
    findByAppointment(
        @Param('appointmentId', ParseIntPipe) appointmentId: number,
    ): Promise<Payment> {
        return this.paymentService.findByAppointment(appointmentId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /payments — Admin + Receptionist (paginated)
    // ─────────────────────────────────────────────────────────────────────────
    @Get()
    @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get all payments with filters — Admin + Receptionist' })
    @ApiResponse({ status: 200, description: 'Paginated payments list' })
    findAll(@Query() query: QueryPaymentDto): Promise<PaginatedPayments> {
        return this.paymentService.findAll(query);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /payments — Admin + Receptionist
    // ─────────────────────────────────────────────────────────────────────────
    @Post()
    @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create payment for an appointment — Admin + Receptionist' })
    @ApiResponse({ status: 201, type: Payment })
    @ApiResponse({ status: 400, description: 'Appointment cancelled or no-show' })
    @ApiResponse({ status: 409, description: 'Payment already exists for this appointment' })
    create(@Body() dto: CreatePaymentDto): Promise<Payment> {
        return this.paymentService.create(dto);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /payments/:id/collect  ← MUST be before PATCH /:id (if any)
    // ─────────────────────────────────────────────────────────────────────────
    @Patch(':id/collect')
    @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Mark payment as Paid — Admin + Receptionist' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, type: Payment })
    @ApiResponse({ status: 400, description: 'Already collected or refunded' })
    collect(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateCollectDto,
    ): Promise<Payment> {
        return this.paymentService.collect(id, dto);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /payments/:id/refund  ← MUST be before PATCH /:id (if any)
    // ─────────────────────────────────────────────────────────────────────────
    @Patch(':id/refund')
    @Roles(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Mark payment as Refunded — Admin only' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, type: Payment })
    @ApiResponse({ status: 400, description: 'Pending (not collected yet) or already refunded' })
    refund(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateRefundDto,
    ): Promise<Payment> {
        return this.paymentService.refund(id, dto);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /payments/:id  ← declared LAST
    // ─────────────────────────────────────────────────────────────────────────
    @Get(':id')
    @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get payment by ID — Admin + Receptionist' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, type: Payment })
    @ApiResponse({ status: 404, description: 'Payment not found' })
    findOne(@Param('id', ParseIntPipe) id: number): Promise<Payment> {
        return this.paymentService.findOne(id);
    }
}
