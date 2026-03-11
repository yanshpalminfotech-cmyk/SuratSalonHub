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
import { AppointmentStatus, StylistStatus, SlotStatus } from 'src/common/enums';

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
        if ((stylist.status as unknown as string) !== StylistStatus.ACTIVE) {
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
        if ((stylist.status as unknown as string) !== StylistStatus.ACTIVE) {
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
        const totalAmount   = services.reduce((sum, s) => sum + Number(s.price), 0);
        const endTime       = this.addMins(dto.startTime, totalDuration);

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
            const year  = new Date().getFullYear();
            const count = await manager
                .createQueryBuilder(Appointment, 'a')
                .where('a.appointmentCode LIKE :prefix', { prefix: `APT-${year}-%` })
                .getCount();
            const appointmentCode = `APT-${year}-${String(count + 1).padStart(3, '0')}`;

            // c. Insert appointment
            const appt = manager.create(Appointment, {
                appointmentCode,
                customer:      { id: dto.customerId } as any,
                stylist:       { id: dto.stylistId } as any,
                date:          dto.date,
                startTime:     dto.startTime,
                endTime,
                totalDuration,
                totalAmount,
                status:        AppointmentStatus.SCHEDULED,
                notes:         dto.notes ?? null,
            });
            const saved = await manager.save(Appointment, appt);

            // d. Insert appointment_services snapshot
            const apptServices = services.map((svc) =>
                manager.create(AppointmentServiceEntity, {
                    appointment:  { id: saved.id } as any,
                    service:      { id: svc.id } as any,
                    serviceName:  svc.name,
                    price:        Number(svc.price),
                    durationMins: Number(svc.durationMins),
                }),
            );
            await manager.save(AppointmentServiceEntity, apptServices);

            // e. Update time_slots with the real appointment_id
            await manager
                .createQueryBuilder()
                .update('time_slots')
                .set({ appointment_id: saved.id })
                .where('stylist_id = :stylistId', { stylistId: dto.stylistId })
                .andWhere('date = :date', { date: dto.date })
                .andWhere('start_time >= :startTime', { startTime: dto.startTime })
                .andWhere('start_time < :endTime', { endTime })
                .andWhere('status = :booked', { booked: SlotStatus.BOOKED })
                .execute();

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
        const { stylistId, customerId, date, status, page = 1, limit = 10 } = query;

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

        if (stylistId)  qb.andWhere('stylist.id = :stylistId', { stylistId });
        if (customerId) qb.andWhere('customer.id = :customerId', { customerId });
        if (date)       qb.andWhere('appt.date = :date', { date });
        if (status)     qb.andWhere('appt.status = :status', { status });

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
        this.guardTerminalStatus(appt.status);

        await this.dataSource.transaction(async (manager) => {
            await manager.update(Appointment, id, { status: AppointmentStatus.CANCELLED });
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
        this.guardTerminalStatus(appt.status);

        await this.appointmentRepo.update(id, { status: AppointmentStatus.COMPLETED });
        // Slots stay BOOKED — appointment was used

        this.logger.log(`Appointment #${id} completed`);
        return this.findOne(id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /appointments/:id/no-show
    // ─────────────────────────────────────────────────────────────────────────
    async noShow(id: number): Promise<AppointmentResponseDto> {
        const appt = await this.findOneOrFail(id);
        this.guardTerminalStatus(appt.status);

        await this.dataSource.transaction(async (manager) => {
            await manager.update(Appointment, id, { status: AppointmentStatus.NO_SHOW });
            await this.timeSlotService.releaseSlots(id, manager);
        });

        this.logger.log(`Appointment #${id} marked no-show, slots released`);
        return this.findOne(id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INTERNAL — reused by PaymentModule etc.
    // ─────────────────────────────────────────────────────────────────────────
    async findOneOrFail(id: number): Promise<Appointment> {
        const appt = await this.appointmentRepo.findOne({
            where: { id },
            relations: ['customer', 'stylist', 'stylist.user', 'appointmentServices', 'appointmentServices.service'],
        });

        if (!appt) throw new NotFoundException(`Appointment #${id} not found`);
        return appt;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE — map Appointment entity → response DTO
    // ─────────────────────────────────────────────────────────────────────────
    private toResponseDto = (appt: Appointment): AppointmentResponseDto => ({
        id:              appt.id,
        appointmentCode: appt.appointmentCode,
        date:            appt.date,
        startTime:       appt.startTime,
        endTime:         appt.endTime,
        totalDuration:   appt.totalDuration,
        totalAmount:     appt.totalAmount,
        status:          appt.status,
        notes:           appt.notes,
        customer: {
            id:           appt.customer.id,
            customerCode: appt.customer.customerCode,
            name:         appt.customer.name,
            phone:        appt.customer.phone,
        },
        stylist: {
            id:             appt.stylist.id,
            specialisation: appt.stylist.specialisation as unknown as string,
            user:           { name: appt.stylist.user?.name ?? '' },
        },
        services: (appt.appointmentServices ?? []).map((s) => ({
            serviceId:   s.service?.id ?? 0,
            serviceName: s.serviceName,
            price:       s.price,
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
        const mm   = String(d.getMonth() + 1).padStart(2, '0');
        const dd   = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
}
