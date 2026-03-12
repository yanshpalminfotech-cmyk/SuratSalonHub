import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    Logger,
    forwardRef,
    Inject,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { Stylist } from './entities/stylist.entity';
import { StylistWorkingSchedule } from './entities/stylist-working-schedule.entity';
import { StylistService as StylistServiceEntity } from './entities/stylist-service.entity';
import { ServiceService } from '../service/service.service';
import { UpdateStylistDto } from './dto/update-stylist.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { AssignServicesDto } from './dto/assign-service.dto';
import { QueryStylistDto } from './dto/query-stylist.dto';
import { StylistAdminResponseDto, StylistResponseDto } from './dto/stylist-response.dto';
import { MySqlError } from 'src/common/interface/mysql-error.interface';
import { UserRole, DayOfWeek, StylistSpecialisation, StylistStatus } from 'src/common/enums';
import { User } from '../user/entities/user.entity';
import { STATUS } from 'src/common/constant/constant';

// ── matches STATUS constant in src/common/constant/constant.ts ───────────────
export interface PaginatedStylists {
    data: StylistAdminResponseDto[] | StylistResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// day order for consistent schedule response
const DAY_ORDER: DayOfWeek[] = [
    DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY, DayOfWeek.SUNDAY,
];

@Injectable()
export class StylistsService {
    private readonly logger = new Logger(StylistsService.name);

    constructor(
        @InjectRepository(Stylist)
        private readonly stylistRepo: Repository<Stylist>,

        @InjectRepository(User)
        private readonly userRepo: Repository<User>,

        @InjectRepository(StylistServiceEntity)
        private readonly stylistServiceRepo: Repository<StylistServiceEntity>,

        private readonly dataSource: DataSource,

        @Inject(forwardRef(() => ServiceService))
        private readonly serviceService: ServiceService,
    ) { }

    // ─────────────────────────────────────────────────────────────────────────
    // INTERNAL — called by UserService inside transaction on stylist user create
    // ─────────────────────────────────────────────────────────────────────────
    async createProfileInTransaction(
        manager: EntityManager,
        user: User,
        specialisation: StylistSpecialisation,
        commissionRate: number,
    ): Promise<Stylist> {
        const stylist = manager.create(Stylist, {
            user,
            specialisation,
            commissionRate,
            bio: null,
            stylistsStatus: StylistStatus.ACTIVE,  // availability enum
            status: STATUS.ACTIVE,  // soft-delete numeric
        });

        const savedStylist = await manager.save(Stylist, stylist);

        // ── seed 7 schedule records (all days off by default) ─────────────
        const schedules = DAY_ORDER.map((day) =>
            manager.create(StylistWorkingSchedule, {
                stylist: savedStylist,
                dayOfWeek: day,
                isWorking: false,
                startTime: null,
                endTime: null,
            }),
        );

        await manager.save(StylistWorkingSchedule, schedules);

        this.logger.log(
            `Stylist profile created for user: ${user.email} | specialisation: ${specialisation}`,
        );

        return savedStylist;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /stylists — All roles
    // ─────────────────────────────────────────────────────────────────────────
    async findAll(query: QueryStylistDto, role: UserRole): Promise<PaginatedStylists> {
        const { status, specialisation, page = 1, limit = 10 } = query;

        const qb = this.stylistRepo
            .createQueryBuilder('stylist')
            .leftJoinAndSelect('stylist.user', 'user')
            .orderBy('user.name', 'ASC')
            .skip((page - 1) * limit)
            .take(limit);

        // status query param filters by stylistsStatus (availability enum)
        if (status) {
            qb.andWhere('stylist.stylistsStatus = :stylistsStatus', { stylistsStatus: status });
        }

        if (specialisation) {
            qb.andWhere('stylist.specialisation = :specialisation', { specialisation });
        }

        const [stylists, total] = await qb.getManyAndCount();

        return {
            data: this.serializeForRole(stylists, role),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /stylists/:id — All roles
    // ─────────────────────────────────────────────────────────────────────────
    async findOne(
        id: number,
        role: UserRole,
    ): Promise<StylistAdminResponseDto | StylistResponseDto> {
        const stylist = await this.findOneOrFail(id);
        return this.serializeForRole([stylist], role)[0];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /stylists/:id/schedule — All roles
    // ─────────────────────────────────────────────────────────────────────────
    async getSchedule(id: number, userRole: UserRole): Promise<StylistWorkingSchedule[]> {
        const stylist = await this.stylistRepo.findOne({
            where: { id },
            relations: ['user', 'workingSchedules'],
        });

        // 2. If the Stylist ID doesn't exist at all
        if (!stylist) {
            throw new NotFoundException(`Stylist with ID ${id} not found.`);
        }

        // 3. Status Check (Bypass if the requester is an ADMIN)
        if (userRole !== UserRole.ADMIN) {

            // Check the status from your Stylist entity (StylistStatus enum)
            if (stylist.user.status === STATUS.DELETED) {
                throw new NotFoundException('The requested stylist is no longer available.');
            }

            if (stylist.user.status === STATUS.INACTIVE) {
                throw new ForbiddenException(
                    `Stylist "${stylist.user.name}" is currently inactive. Schedule is private.`
                );
            }
        }

        // 4. Sort schedules by DayOfWeek index before returning
        if (stylist.workingSchedules) {
            stylist.workingSchedules.sort(
                (a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek),
            );
        }

        return stylist.workingSchedules;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /stylists/:id/services — All roles (role-aware)
    // ─────────────────────────────────────────────────────────────────────────
    async getServices(id: number, role: UserRole): Promise<any> {
        await this.findOneOrFail(id);

        const assignments = await this.stylistServiceRepo.find({
            where: { stylist: { id } },
            relations: ['service', 'service.category'],
        });

        const services = assignments
            .map((a) => a.service)
            .filter((s) => s.status !== 127);

        return this.serviceService.serializeServicesForRole(services, role);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /stylists/:id — Admin only
    // ─────────────────────────────────────────────────────────────────────────
    async update(id: number, dto: UpdateStylistDto): Promise<Stylist> {
        const stylist = await this.findOneOrFail(id);

        // dto.status maps to stylistsStatus (Active / On Leave availability enum)
        // NOT the numeric status field (which is for soft delete only)
        if (dto.specialisation !== undefined) stylist.specialisation = dto.specialisation;
        if (dto.commissionRate !== undefined) stylist.commissionRate = dto.commissionRate;
        if (dto.bio !== undefined) stylist.bio = dto.bio?.trim() ?? null;
        if (dto.stylistStatus !== undefined) stylist.stylistStatus = dto.stylistStatus;

        try {
            const updated = await this.stylistRepo.save(stylist);
            this.logger.log(`Stylist #${id} updated`);
            return updated;
        } catch (err) {
            const error = err as MySqlError;
            if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
                throw new ConflictException('Duplicate entry detected');
            }
            throw err;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /stylists/:id/schedule — Admin only (full replace)
    // ─────────────────────────────────────────────────────────────────────────
    async updateSchedule(
        id: number,
        dto: UpdateScheduleDto,
    ): Promise<StylistWorkingSchedule[]> {
        const stylist = await this.findOneOrFail(id);

        const days = dto.schedule.map((s) => s.dayOfWeek);
        const uniqueDays = new Set(days);

        if (uniqueDays.size !== 7) {
            throw new BadRequestException(
                'Schedule must contain exactly 7 unique days (Monday to Sunday)',
            );
        }

        for (const day of dto.schedule) {
            if (day.isWorking && day.startTime && day.endTime) {
                if (day.startTime >= day.endTime) {
                    throw new BadRequestException(
                        `${day.dayOfWeek}: startTime must be before endTime`,
                    );
                }
            }
        }

        await this.dataSource.transaction(async (manager) => {
            await manager.delete(StylistWorkingSchedule, { stylist: { id } });

            const newSchedules = dto.schedule.map((day) =>
                manager.create(StylistWorkingSchedule, {
                    stylist,
                    dayOfWeek: day.dayOfWeek,
                    isWorking: day.isWorking,
                    startTime: day.isWorking ? day.startTime ?? null : null,
                    endTime: day.isWorking ? day.endTime ?? null : null,
                }),
            );

            await manager.save(StylistWorkingSchedule, newSchedules);
        });

        this.logger.log(`Schedule updated for stylist #${id}`);
        return this.getSchedule(id, UserRole.ADMIN);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /stylists/:id/services — Admin only (full replace)
    // ─────────────────────────────────────────────────────────────────────────
    async assignServices(
        id: number,
        dto: AssignServicesDto,
    ): Promise<{ message: string; total: number }> {
        const stylist = await this.findOneOrFail(id);

        if (dto.serviceIds.length > 0) {
            const validServices = await this.serviceService.findByIds(dto.serviceIds);

            if (validServices.length !== dto.serviceIds.length) {
                const validIds = validServices.map((s) => s.id);
                const invalidIds = dto.serviceIds.filter((sid) => !validIds.includes(sid));
                throw new BadRequestException(
                    `Service IDs [${invalidIds.join(', ')}] are invalid, inactive, or deleted`,
                );
            }

            await this.dataSource.transaction(async (manager) => {
                await manager.delete(StylistServiceEntity, { stylist: { id } });

                const assignments = validServices.map((service) =>
                    manager.create(StylistServiceEntity, { stylist, service }),
                );

                await manager.save(StylistServiceEntity, assignments);
            });
        } else {
            await this.stylistServiceRepo.delete({ stylist: { id } });
        }

        this.logger.log(
            `Services assigned to stylist #${id}: [${dto.serviceIds.join(', ')}]`,
        );

        return {
            message: 'Services assigned successfully',
            total: dto.serviceIds.length,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE /stylists/:id — Admin only (soft delete via numeric status)
    // ─────────────────────────────────────────────────────────────────────────
    async remove(id: number): Promise<{ message: string }> {
        const stylist = await this.findOneOrFail(id);

        // findOneOrFail already blocks DELETED stylists
        // this check is explicit for 409 response
        if (stylist.user.status === STATUS.DELETED) {
            throw new ConflictException('Stylist is already deleted');
        }

        // ── guard: no scheduled appointments ─────────────────────────────
        const scheduledCount = await this.dataSource
            .getRepository('appointments')
            .count({
                where: {
                    stylist: { id },
                    status: 'Scheduled',
                },
            });

        if (scheduledCount > 0) {
            throw new BadRequestException(
                `Cannot delete stylist — ${scheduledCount} scheduled appointment(s) exist. ` +
                `Please reassign or cancel them first.`,
            );
        }

        // soft delete → numeric status = 127
        await this.userRepo.update(stylist.user.id, {
            status: STATUS.DELETED
        });

        this.logger.log(`Stylist #${id} soft deleted`);
        return { message: 'Stylist deleted successfully' };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INTERNAL — reused by UserService + AppointmentModule
    // ─────────────────────────────────────────────────────────────────────────
    async findOneOrFail(id: number): Promise<Stylist> {
        const stylist = await this.stylistRepo.findOne({
            where: { id },
            relations: ['user'],
        });

        // use numeric status for soft delete check (not stylistsStatus enum)
        if (!stylist || stylist.user.status === STATUS.DELETED) {
            throw new NotFoundException(`Stylist #${id} not found`);
        }

        return stylist;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE — serialize based on caller role
    // ─────────────────────────────────────────────────────────────────────────
    private serializeForRole(
        stylists: Stylist[],
        role: UserRole,
    ): StylistAdminResponseDto[] | StylistResponseDto[] {
        if (role === UserRole.ADMIN) {
            return plainToInstance(StylistAdminResponseDto, stylists, {
                excludeExtraneousValues: true,
            });
        }

        return plainToInstance(StylistResponseDto, stylists, {
            excludeExtraneousValues: true,
        });
    }
}