import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdateCollectDto } from './dto/update-collect.dto';
import { UpdateRefundDto } from './dto/update-refund.dto';
import { QueryPaymentDto } from './dto/query-payment.dto';
import { AppointmentService } from '../appointment/appointment.service';
import { PaymentStatus, AppointmentStatus } from 'src/common/enums';
import { MySqlError } from 'src/common/interface/mysql-error.interface';

export interface PaginatedPayments {
    data: Payment[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

@Injectable()
export class PaymentService {
    private readonly logger = new Logger(PaymentService.name);

    constructor(
        @InjectRepository(Payment)
        private readonly paymentRepo: Repository<Payment>,

        private readonly appointmentService: AppointmentService,
    ) { }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /payments — Admin + Receptionist
    // ─────────────────────────────────────────────────────────────────────────
    async create(dto: CreatePaymentDto): Promise<Payment> {
        // 1. Validate appointment exists (throws 404 internally)
        const appointment = await this.appointmentService.findOneOrFail(dto.appointmentId);

        // 2. Block payment for terminal appointment statuses
        if (appointment.status === AppointmentStatus.CANCELLED) {
            throw new BadRequestException('Cannot create payment for a cancelled appointment');
        }
        if (appointment.status === AppointmentStatus.NO_SHOW) {
            throw new BadRequestException('Cannot create payment for a no-show appointment');
        }

        // 3. Check no existing payment (application-level guard)
        const existing = await this.paymentRepo.findOne({
            where: { appointment: { id: dto.appointmentId } },
        });
        if (existing) {
            throw new ConflictException('Payment already exists for this appointment');
        }

        // 4. Amount always from appointment — never from request body
        const payment = this.paymentRepo.create({
            appointment:    { id: dto.appointmentId } as any,
            amount:         Number(appointment.totalAmount),
            paymentMethod:  dto.paymentMethod,
            paymentStatus:  PaymentStatus.PENDING,
            transactionRef: dto.transactionRef ?? null,
            notes:          dto.notes ?? null,
            paidAt:         null,
        });

        try {
            const saved = await this.paymentRepo.save(payment);
            this.logger.log(`Payment created for appointment #${dto.appointmentId} | amount: ₹${saved.amount}`);
            return this.findOneOrFail(saved.id);
        } catch (err) {
            const error = err as MySqlError;
            if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
                throw new ConflictException('Payment already exists for this appointment');
            }
            throw err;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /payments — Admin + Receptionist (paginated, filtered)
    // ─────────────────────────────────────────────────────────────────────────
    async findAll(query: QueryPaymentDto): Promise<PaginatedPayments> {
        const {
            appointmentId, paymentStatus, paymentMethod,
            stylistId, fromDate, toDate,
            page = 1, limit = 10,
        } = query;

        const qb = this.paymentRepo
            .createQueryBuilder('payment')
            .leftJoinAndSelect('payment.appointment', 'appointment')
            .leftJoinAndSelect('appointment.customer', 'customer')
            .leftJoinAndSelect('appointment.stylist', 'stylist')
            .leftJoinAndSelect('stylist.user', 'user')
            .orderBy('payment.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);

        if (appointmentId) qb.andWhere('appointment.id = :appointmentId', { appointmentId });
        if (paymentStatus)  qb.andWhere('payment.paymentStatus = :paymentStatus', { paymentStatus });
        if (paymentMethod)  qb.andWhere('payment.paymentMethod = :paymentMethod', { paymentMethod });
        if (stylistId)      qb.andWhere('stylist.id = :stylistId', { stylistId });
        if (fromDate)       qb.andWhere('payment.paidAt >= :fromDate', { fromDate });
        if (toDate)         qb.andWhere('payment.paidAt <= :toDate', { toDate });

        const [data, total] = await qb.getManyAndCount();

        return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /payments/appointment/:appointmentId — Admin + Receptionist
    // ─────────────────────────────────────────────────────────────────────────
    async findByAppointment(appointmentId: number): Promise<Payment> {
        const payment = await this.paymentRepo.findOne({
            where: { appointment: { id: appointmentId } },
            relations: ['appointment', 'appointment.customer', 'appointment.stylist', 'appointment.stylist.user', 'appointment.appointmentServices'],
        });

        if (!payment) {
            throw new NotFoundException(`No payment found for appointment #${appointmentId}`);
        }

        return payment;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /payments/:id — Admin + Receptionist
    // ─────────────────────────────────────────────────────────────────────────
    async findOne(id: number): Promise<Payment> {
        return this.findOneOrFail(id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /payments/:id/collect — Admin + Receptionist
    // ─────────────────────────────────────────────────────────────────────────
    async collect(id: number, dto: UpdateCollectDto): Promise<Payment> {
        const payment = await this.findOneOrFail(id);

        // Status guard
        if (payment.paymentStatus === PaymentStatus.PAID) {
            throw new BadRequestException('Payment is already collected');
        }
        if (payment.paymentStatus === PaymentStatus.REFUNDED) {
            throw new BadRequestException('Payment has been refunded and cannot be re-collected');
        }

        // Appointment guard
        if (payment.appointment.status === AppointmentStatus.CANCELLED) {
            throw new BadRequestException('Cannot collect payment for a cancelled appointment');
        }

        payment.paymentStatus  = PaymentStatus.PAID;
        payment.paymentMethod  = dto.paymentMethod;
        payment.transactionRef = dto.transactionRef ?? payment.transactionRef;
        payment.notes          = dto.notes ?? payment.notes;
        payment.paidAt         = new Date();   // server-set timestamp

        const updated = await this.paymentRepo.save(payment);
        this.logger.log(`Payment #${id} collected | method: ${dto.paymentMethod} | amount: ₹${updated.amount}`);
        return updated;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /payments/:id/refund — Admin only
    // ─────────────────────────────────────────────────────────────────────────
    async refund(id: number, dto: UpdateRefundDto): Promise<Payment> {
        const payment = await this.findOneOrFail(id);

        // Status guard
        if (payment.paymentStatus === PaymentStatus.PENDING) {
            throw new BadRequestException('Cannot refund a payment that has not been collected yet');
        }
        if (payment.paymentStatus === PaymentStatus.REFUNDED) {
            throw new BadRequestException('Payment is already refunded');
        }

        payment.paymentStatus  = PaymentStatus.REFUNDED;
        payment.notes          = dto.notes ?? payment.notes;
        payment.transactionRef = dto.transactionRef ?? payment.transactionRef;

        const updated = await this.paymentRepo.save(payment);
        this.logger.log(`Payment #${id} refunded | amount: ₹${updated.amount}`);
        return updated;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INTERNAL — reused across methods + by ReportModule
    // ─────────────────────────────────────────────────────────────────────────
    async findOneOrFail(id: number): Promise<Payment> {
        const payment = await this.paymentRepo.findOne({
            where: { id },
            relations: ['appointment', 'appointment.customer', 'appointment.stylist', 'appointment.stylist.user', 'appointment.appointmentServices'],
        });

        if (!payment) throw new NotFoundException(`Payment #${id} not found`);
        return payment;
    }
}
