import {
    Injectable,
    Logger,
    BadRequestException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Appointment } from './entities/appointment.entity';
import { AppointmentServiceEntity } from './entities/appointment-service.entity';
import { StylistService as StylistServiceJunction } from '../stylist/entities/stylist-service.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { QueryAppointmentDto } from './dto/query-appointment.dto';
import { AppointmentResponseDto } from './dto/appointment-response.dto';
import { CustomerService } from '../customer/customer.service';
import { StylistsService } from '../stylist/stylist.service';
import { ServiceService } from '../service/service.service';
import { TimeSlotService } from '../time-slot/time-slot.service';
import { TimeSlot } from '../time-slot/entities/time-slot.entity';
import { STATUS } from 'src/common/constant/constant';
import { AppointmentStatus, StylistStatus, SlotStatus, PaymentStatus, PaymentMethod } from 'src/common/enums';
import { Payment } from '../payment/entities/payment.entity';

export interface PaginatedAppointments {
    data: AppointmentResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

@Injectable()
export class AppointmentService {
    private readonly logger = new Logger(AppointmentService.name);

    constructor(
        @InjectRepository(Appointment)
        private readonly appointmentRepo: Repository<Appointment>,

        @InjectRepository(AppointmentServiceEntity)
        private readonly apptServiceRepo: Repository<AppointmentServiceEntity>,

        @InjectRepository(StylistServiceJunction)
        private readonly stylistServiceJunctionRepo: Repository<StylistServiceJunction>,

        private readonly dataSource: DataSource,
        private readonly customerService: CustomerService,
        private readonly stylistsService: StylistsService,
        private readonly serviceService: ServiceService,
        private readonly timeSlotService: TimeSlotService,
    ) { }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /appointments/available-slots
    // ─────────────────────────────────────────────────────────────────────────
    async getAvailableSlots(
        stylistId: number,
        date: string,
        serviceIds: number[],
    ): Promise<object> {
        // 1. Validate stylist is active
        const stylist = await this.stylistsService.findOneOrFail(stylistId);
        if ((stylist.stylistStatus) !== StylistStatus.ACTIVE) {
            throw new BadRequestException('Stylist is not available');
        }

        // 2. Validate services exist and are active
        const services = await this.serviceService.findByIds(serviceIds);
        if (services.length !== serviceIds.length) {
            throw new BadRequestException('Some service IDs are invalid or inactive');
        }

        // 3. Validate all services are assigned to this stylist
        await this.ensureServicesAssigned(stylistId, serviceIds, services.reduce((m, s) => m.set(s.id, s.name), new Map<number, string>()));

        // 4. Calculate total duration and fetch consecutive slots
        const totalDuration = services.reduce((sum, s) => sum + Number(s.durationMins), 0);
        const availableStartTimes = await this.timeSlotService.getConsecutiveSlots(stylistId, date, totalDuration);

        return {
            date,
            totalDuration,
            stylist: { id: stylist.id, name: stylist.user?.name ?? '' },
            availableStartTimes,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /appointments
    // ─────────────────────────────────────────────────────────────────────────
    async create(dto: CreateAppointmentDto): Promise<AppointmentResponseDto> {
        // 1. Past-date guard
        const today = this.todayString();
        if (dto.date < today) {
            throw new BadRequestException('Cannot book appointment in the past');
        }

        // 2. Validate customer
        const customer = await this.customerService.findOneOrFail(dto.customerId);

        // 3. Validate stylist
        const stylist = await this.stylistsService.findOneOrFail(dto.stylistId);
        if ((stylist.stylistStatus) !== StylistStatus.ACTIVE) {
            throw new BadRequestException('Stylist is not available');
        }

        // 4. Validate services
        const services = await this.serviceService.findByIds(dto.serviceIds);
        if (services.length !== dto.serviceIds.length) {
            throw new BadRequestException('Some service IDs are invalid or inactive');
        }

        // 5. Validate services assigned to stylist
        const serviceNameMap = services.reduce((m, s) => m.set(s.id, s.name), new Map<number, string>());
        await this.ensureServicesAssigned(dto.stylistId, dto.serviceIds, serviceNameMap);

        // 6. Calculate totals
        const totalDuration = services.reduce((sum, s) => sum + Number(s.durationMins), 0);
        const totalAmount = services.reduce((sum, s) => sum + Number(s.price), 0);
        const endTime = this.addMins(dto.startTime, totalDuration);

        // 7. TRANSACTION — slot booking + appointment creation (atomic)
        const savedAppointment = await this.dataSource.transaction(async (manager) => {
            // a. Book time slots (pessimistic lock — throws 409 if unavailable)
            await this.timeSlotService.bookSlots(
                dto.stylistId,
                dto.date,
                dto.startTime,
                totalDuration,
                0,           // placeholder — updated after appointment insert
                manager,
            );

            // b. Generate appointment code INSIDE transaction (race-condition safe)
            const year = new Date().getFullYear();
            const count = await manager
                .createQueryBuilder(Appointment, 'a')
                .where('a.appointmentCode LIKE :prefix', { prefix: `APT-${year}-%` })
                .getCount();
            const appointmentCode = `APT-${year}-${String(count + 1).padStart(3, '0')}`;

            // c. Insert appointment
            const appt = manager.create(Appointment, {
                appointmentCode,
                customer: { id: dto.customerId } as any,
                stylist: { id: dto.stylistId } as any,
                date: dto.date,
                startTime: dto.startTime,
                endTime,
                totalDuration,
                totalAmount,
                appointmentStatus: AppointmentStatus.SCHEDULED,
                status: STATUS.ACTIVE,
                notes: dto.notes ?? null,
            });
            const saved = await manager.save(Appointment, appt);

            // d. Insert appointment_services snapshot
            const apptServices = services.map((svc) =>
                manager.create(AppointmentServiceEntity, {
                    appointment: { id: saved.id } as any,
                    service: { id: svc.id } as any,
                    serviceName: svc.name,
                    price: Number(svc.price),
                    durationMins: Number(svc.durationMins),
                }),
            );
            await manager.save(AppointmentServiceEntity, apptServices);

            // e. Update time_slots with the real appointment_id
            await manager
                .createQueryBuilder()
                .update(TimeSlot)
                .set({ appointmentId: saved.id })
                .where('stylist_id = :stylistId', { stylistId: dto.stylistId })
                .andWhere('date = :date', { date: dto.date })
                .andWhere('start_time >= :startTime', { startTime: dto.startTime })
                .andWhere('start_time < :endTime', { endTime })
                .andWhere('status = :booked', { booked: SlotStatus.BOOKED })
                .execute();

            // f. Create a Pending Payment record tying it to this appointment
            const payment = manager.create(Payment, {
                appointment: { id: saved.id } as any,
                amount: totalAmount,
                paymentMethod: PaymentMethod.CASH, // Default to cash, updated upon collection
                paymentStatus: PaymentStatus.PENDING,
                transactionRef: null,
                notes: null,
                paidAt: null,
            });
            await manager.save(Payment, payment);

            return saved;
        });

        this.logger.log(
            `Appointment created: ${savedAppointment.appointmentCode} | ` +
            `customer #${dto.customerId} | stylist #${dto.stylistId} | ${dto.date} ${dto.startTime}`,
        );

        return this.findOne(savedAppointment.id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /appointments (paginated)
    // ─────────────────────────────────────────────────────────────────────────
    async findAll(query: QueryAppointmentDto): Promise<PaginatedAppointments> {
        const { stylistId, customerId, date, appointmentStatus, page = 1, limit = 10 } = query;

        const qb = this.appointmentRepo
            .createQueryBuilder('appt')
            .leftJoinAndSelect('appt.customer', 'customer')
            .leftJoinAndSelect('appt.stylist', 'stylist')
            .leftJoinAndSelect('stylist.user', 'user')
            .leftJoinAndSelect('appt.appointmentServices', 'apptSvc')
            .orderBy('appt.date', 'DESC')
            .addOrderBy('appt.startTime', 'ASC')
            .skip((page - 1) * limit)
            .take(limit);

        qb.andWhere('appt.status = :activeStatus', { activeStatus: STATUS.ACTIVE });

        if (stylistId) qb.andWhere('stylist.id = :stylistId', { stylistId });
        if (customerId) qb.andWhere('customer.id = :customerId', { customerId });
        if (date) qb.andWhere('appt.date = :date', { date });
        if (appointmentStatus) qb.andWhere('appt.appointmentStatus = :appointmentStatus', { appointmentStatus });

        const [appointments, total] = await qb.getManyAndCount();

        return {
            data: appointments.map(this.toResponseDto),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /appointments/:id
    // ─────────────────────────────────────────────────────────────────────────
    async findOne(id: number): Promise<AppointmentResponseDto> {
        const appt = await this.findOneOrFail(id);
        return this.toResponseDto(appt);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /appointments/:id/cancel
    // ─────────────────────────────────────────────────────────────────────────
    async cancel(id: number): Promise<AppointmentResponseDto> {
        const appt = await this.findOneOrFail(id);
        this.guardTerminalStatus(appt.appointmentStatus);

        await this.dataSource.transaction(async (manager) => {
            await manager.update(Appointment, id, { appointmentStatus: AppointmentStatus.CANCELLED });
            await this.timeSlotService.releaseSlots(id, manager);
        });

        this.logger.log(`Appointment #${id} cancelled`);
        return this.findOne(id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /appointments/:id/complete
    // ─────────────────────────────────────────────────────────────────────────
    async complete(id: number): Promise<AppointmentResponseDto> {
        const appt = await this.findOneOrFail(id);
        this.guardTerminalStatus(appt.appointmentStatus);

        await this.appointmentRepo.update(id, { appointmentStatus: AppointmentStatus.COMPLETED });
        // Slots stay BOOKED — appointment was used

        this.logger.log(`Appointment #${id} completed`);
        return this.findOne(id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /appointments/:id/no-show
    // ─────────────────────────────────────────────────────────────────────────
    async noShow(id: number): Promise<AppointmentResponseDto> {
        const appt = await this.findOneOrFail(id);
        this.guardTerminalStatus(appt.appointmentStatus);

        await this.appointmentRepo.update(id, { appointmentStatus: AppointmentStatus.NO_SHOW });
        // Slots stay BOOKED — the time has already passed or was held for this no-show appointment

        this.logger.log(`Appointment #${id} marked no-show, slots remain booked`);
        return this.findOne(id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /appointments/my-schedule — Stylist daily schedule (raw SQL)
    // ─────────────────────────────────────────────────────────────────────────
    // async getMySchedule(userId: number, date?: string): Promise<unknown[]> {
    //     // default to today if date not provided
    //     const targetDate = date ?? this.todayString();

    //     // Query 1 — appointments for this stylist on the given date
    //     const appointments: Record<string, unknown>[] = await this.dataSource.query(
    //         `SELECT
    //            a.id               AS appointmentId,
    //            a.appointment_code AS appointmentCode,
    //            a.date             AS date,
    //            a.start_time       AS startTime,
    //            a.end_time         AS endTime,
    //            a.total_duration   AS totalDuration,
    //            a.status           AS status,
    //            a.notes            AS notes,
    //            c.name             AS customerName,
    //            c.phone            AS customerPhone,
    //            c.gender           AS customerGender
    //          FROM appointments a
    //          INNER JOIN stylists  st ON st.id = a.stylist_id
    //          INNER JOIN customers c  ON c.id  = a.customer_id
    //          WHERE st.user_id = ?
    //            AND DATE(a.date) = ?
    //          ORDER BY a.start_time ASC`,
    //         [userId, targetDate],
    //     );

    //     // return empty array early — no need to query services
    //     if (appointments.length === 0) return [];

    //     // Query 2 — services for all fetched appointments
    //     const appointmentIds = appointments.map((a) => Number(a.appointmentId));

    //     const services: Record<string, unknown>[] = await this.dataSource.query(
    //         `SELECT
    //            as_.appointment_id AS appointmentId,
    //            as_.service_name   AS serviceName,
    //            as_.duration_mins  AS durationMins
    //          FROM appointment_services as_
    //          WHERE as_.appointment_id IN (?)
    //          ORDER BY as_.appointment_id, as_.service_name`,
    //         [appointmentIds],
    //     );

    //     // group services under their appointment
    //     const servicesMap = services.reduce(
    //         (acc: Record<number, { serviceName: string; durationMins: number }[]>, s) => {
    //             const key = Number(s.appointmentId);
    //             if (!acc[key]) acc[key] = [];
    //             acc[key].push({
    //                 serviceName:  String(s.serviceName),
    //                 durationMins: Number(s.durationMins),
    //             });
    //             return acc;
    //         },
    //         {},
    //     );

    //     // assemble response — intentionally exclude all financial data
    //     return appointments.map((a) => ({
    //         appointmentId:   Number(a.appointmentId),
    //         appointmentCode: a.appointmentCode,
    //         date:            a.date,
    //         startTime:       a.startTime,
    //         endTime:         a.endTime,
    //         totalDuration:   Number(a.totalDuration),
    //         status:          a.status,
    //         notes:           a.notes ?? null,
    //         customer: {
    //             name:   a.customerName,
    //             phone:  a.customerPhone,
    //             gender: a.customerGender,
    //         },
    //         services: servicesMap[Number(a.appointmentId)] ?? [],
    //     }));
    // }
    async getMySchedule(userId: number, date?: string): Promise<unknown[]> {
        const targetDate = date ?? new Date().toISOString().split('T')[0];

        // Query 1 — appointments via QueryBuilder
        // TypeORM handles param binding safely — no manual placeholders
        const appointments = await this.dataSource
            .getRepository(Appointment)
            .createQueryBuilder('a')
            .innerJoin('a.stylist', 'st')
            .innerJoin('st.user', 'u')
            .innerJoin('a.customer', 'c')
            .select([
                'a.id',
                'a.appointmentCode',
                'a.date',
                'a.startTime',
                'a.endTime',
                'a.totalDuration',
                'a.appointmentStatus',
                'a.notes',
                'c.name',
                'c.phone',
                'c.gender',
            ])
            .where('u.id = :userId', { userId })
            .andWhere('a.date = :date', { date: targetDate })
            .andWhere('a.status = :activeStatus', { activeStatus: STATUS.ACTIVE })
            .orderBy('a.startTime', 'ASC')
            .getMany();

        if (appointments.length === 0) return [];

        // Query 2 — services via QueryBuilder
        // IN (:...ids) — TypeORM expands array automatically ✅
        const appointmentIds = appointments.map((a) => a.id);

        const services = await this.dataSource
            .getRepository(AppointmentServiceEntity)
            .createQueryBuilder('as')
            .innerJoin('as.appointment', 'appt')
            .select([
                'as.id',
                'as.serviceName',
                'as.durationMins',
                'appt.id',
                // intentionally NO as.price — stylist cannot see billing
            ])
            .where('appt.id IN (:...ids)', { ids: appointmentIds })
            .orderBy('as.serviceName', 'ASC')
            .getMany();

        // group services under their appointment
        const servicesMap = services.reduce(
            (acc: Record<number, { serviceName: string; durationMins: number }[]>, s) => {
                const apptId = s.appointment.id;
                if (!acc[apptId]) acc[apptId] = [];
                acc[apptId].push({
                    serviceName: s.serviceName,
                    durationMins: s.durationMins,
                });
                return acc;
            },
            {},
        );

        // assemble — no financial data
        return appointments.map((a) => ({
            appointmentId: a.id,
            appointmentCode: a.appointmentCode,
            date: a.date,
            startTime: a.startTime,
            endTime: a.endTime,
            totalDuration: a.totalDuration,
            appointmentStatus: a.appointmentStatus,
            notes: a.notes ?? null,
            customer: {
                name: a.customer.name,
                phone: a.customer.phone,
                gender: a.customer.gender,
            },
            services: servicesMap[a.id] ?? [],
        }));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /appointments/:id/services/:serviceId/complete
    // ─────────────────────────────────────────────────────────────────────────
    async markServiceComplete(
        appointmentId: number,
        serviceId: number,
        userId: number,
    ): Promise<{ message: string; appointmentCompleted: boolean }> {
        // Step 1 — Verify stylist owns this appointment
        const stylistRepo = this.dataSource.getRepository('Stylist');
        const st = await stylistRepo.findOne({ where: { user: { id: userId } } });
        if (!st) {
            throw new ConflictException('Stylist profile not found');
        }

        const appt = await this.appointmentRepo.findOne({
            where: { id: appointmentId, stylist: { id: st.id }, status: STATUS.ACTIVE },
        });

        if (!appt) {
            throw new ConflictException('This appointment does not belong to you');
        }

        // Step 2 — Verify appointment is Scheduled
        if (appt.appointmentStatus !== AppointmentStatus.SCHEDULED) {
            throw new BadRequestException(`Cannot mark service complete on a ${appt.appointmentStatus} appointment`);
        }

        // Step 3 — Verify service belongs to appointment
        const apptSvc = await this.apptServiceRepo.findOne({
            where: { id: serviceId, appointment: { id: appointmentId } },
        });

        if (!apptSvc) {
            throw new NotFoundException('Service not found in this appointment');
        }

        // Step 4 — Mark service complete
        if (apptSvc.isCompleted) {
            throw new BadRequestException('Service already marked complete');
        }

        await this.apptServiceRepo.update({ id: serviceId }, { isCompleted: true });

        // Step 5 — Check if ALL services are now complete
        const allServices = await this.apptServiceRepo.find({
            where: { appointment: { id: appointmentId } },
        });

        const total = allServices.length;
        const completed = allServices.filter(s => s.isCompleted || s.id === serviceId).length;

        // Step 6 — If all complete → auto-advance appointment
        if (completed === total) {
            await this.appointmentRepo.update(appointmentId, { appointmentStatus: AppointmentStatus.COMPLETED });
            // Slots stay BOOKED — appointment was used

            this.logger.log(`Appointment #${appointmentId} auto-completed: all services done`);
            return { message: 'All services complete. Appointment marked Completed.', appointmentCompleted: true };
        }

        const remaining = total - completed;
        return { message: `Service marked complete. ${remaining} service(s) remaining.`, appointmentCompleted: false };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // INTERNAL — reused by PaymentModule etc.
    // ─────────────────────────────────────────────────────────────────────────
    async findOneOrFail(id: number): Promise<Appointment> {
        const appt = await this.appointmentRepo.findOne({
            where: { id, status: STATUS.ACTIVE },
            relations: ['customer', 'stylist', 'stylist.user', 'appointmentServices', 'appointmentServices.service'],
        });

        if (!appt) throw new NotFoundException(`Appointment #${id} not found`);
        return appt;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE — map Appointment entity → response DTO
    // ─────────────────────────────────────────────────────────────────────────
    private toResponseDto = (appt: Appointment): AppointmentResponseDto => ({
        id: appt.id,
        appointmentCode: appt.appointmentCode,
        date: appt.date,
        startTime: appt.startTime,
        endTime: appt.endTime,
        totalDuration: appt.totalDuration,
        totalAmount: appt.totalAmount,
        appointmentStatus: appt.appointmentStatus,
        notes: appt.notes,
        customer: {
            id: appt.customer.id,
            customerCode: appt.customer.customerCode,
            name: appt.customer.name,
            phone: appt.customer.phone,
        },
        stylist: {
            id: appt.stylist.id,
            specialisation: appt.stylist.specialisation as unknown as string,
            user: { name: appt.stylist.user?.name ?? '' },
        },
        services: (appt.appointmentServices ?? []).map((s) => ({
            serviceId: s.service?.id ?? 0,
            serviceName: s.serviceName,
            price: s.price,
            durationMins: s.durationMins,
        })),
        createdAt: appt.createdAt,
        updatedAt: appt.updatedAt,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE — validate that stylist offers all requested services
    // ─────────────────────────────────────────────────────────────────────────
    private async ensureServicesAssigned(
        stylistId: number,
        serviceIds: number[],
        serviceNameMap: Map<number, string>,
    ): Promise<void> {
        const assigned = await this.stylistServiceJunctionRepo.find({
            where: serviceIds.map((id) => ({ stylist: { id: stylistId }, service: { id } })),
            relations: ['service'],
        });

        const assignedIds = new Set(assigned.map((a) => a.service.id));
        for (const sid of serviceIds) {
            if (!assignedIds.has(sid)) {
                throw new BadRequestException(
                    `Stylist does not offer service: ${serviceNameMap.get(sid) ?? sid}`,
                );
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE — block further status changes for terminal states
    // ─────────────────────────────────────────────────────────────────────────
    private guardTerminalStatus(status: AppointmentStatus): void {
        if (status === AppointmentStatus.COMPLETED) {
            throw new BadRequestException('Appointment is already completed');
        }
        if (status === AppointmentStatus.CANCELLED) {
            throw new BadRequestException('Appointment is already cancelled');
        }
        if (status === AppointmentStatus.NO_SHOW) {
            throw new BadRequestException('Appointment is already marked as no-show');
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE — time arithmetic helpers
    // ─────────────────────────────────────────────────────────────────────────
    private timeToMins(time: string): number {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    }

    private minsToTime(mins: number): string {
        const h = Math.floor(mins / 60).toString().padStart(2, '0');
        const m = (mins % 60).toString().padStart(2, '0');
        return `${h}:${m}`;
    }

    private addMins(time: string, mins: number): string {
        return this.minsToTime(this.timeToMins(time) + mins);
    }

    private todayString(): string {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
}
