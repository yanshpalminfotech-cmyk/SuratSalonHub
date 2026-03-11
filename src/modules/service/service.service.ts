import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { Service } from './entities/service.entity';
import { ServiceCategoryService } from '../service-category/service-category.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { QueryServiceDto } from './dto/query-service.dto';
import { ServiceResponseDto, ServiceStylistResponseDto } from './dto/service-response.dto';
import { MySqlError } from 'src/common/interface/mysql-error.interface';
import { UserRole } from 'src/common/enums/roles.enum';
import { STATUS } from 'src/common/constant/constant';


export interface PaginatedServices {
    data: ServiceResponseDto[] | ServiceStylistResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

@Injectable()
export class ServiceService {
    private readonly logger = new Logger(ServiceService.name);

    constructor(
        @InjectRepository(Service)
        private readonly serviceRepo: Repository<Service>,

        private readonly categoryService: ServiceCategoryService,
    ) { }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /services — Admin only
    // ─────────────────────────────────────────────────────────────────────────
    async create(dto: CreateServiceDto): Promise<Service> {
        // ── validate category ─────────────────────────────────────────────
        const category = await this.categoryService.findOneOrFail(dto.categoryId);

        if (category.status === STATUS.INACTIVE) {
            throw new BadRequestException(
                `Category "${category.name}" is inactive. Please activate it first.`,
            );
        }

        // ── generate service_code ─────────────────────────────────────────
        // count ALL including deleted — code never repeats
        const count = await this.serviceRepo.count();
        const serviceCode = `SRV-${String(count + 1).padStart(3, '0')}`;

        const service = this.serviceRepo.create({
            serviceCode,
            name: dto.name.trim(),
            category,
            durationMins: dto.durationMins,
            price: dto.price,
            gender: dto.gender,
            description: dto.description?.trim() ?? null,
            status: STATUS.ACTIVE,
        });

        try {
            const saved = await this.serviceRepo.save(service);
            this.logger.log(`Service created: ${saved.serviceCode} — ${saved.name}`);
            return saved;
        } catch (err) {
            const error = err as MySqlError;
            if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
                throw new ConflictException(
                    `Service "${dto.name}" already exists`,
                );
            }
            throw err;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /services — All roles (paginated + filtered + role-aware response)
    // ─────────────────────────────────────────────────────────────────────────
    async findAll(query: QueryServiceDto, role: UserRole): Promise<PaginatedServices> {
        const { categoryId, gender, isAvailable, search, page = 1, limit = 10 } = query;

        const qb = this.serviceRepo
            .createQueryBuilder('service')
            .leftJoinAndSelect('service.category', 'category')
            .where('service.status != :deleted', { deleted: STATUS.DELETED })
            .orderBy('service.name', 'ASC')
            .skip((page - 1) * limit)
            .take(limit);

        if (categoryId) {
            qb.andWhere('category.id = :categoryId', { categoryId });
        }

        if (gender) {
            qb.andWhere('service.gender = :gender', { gender });
        }

        if (isAvailable === true) {
            qb.andWhere('service.status = :active', { active: STATUS.ACTIVE });
        }

        if (isAvailable === false) {
            qb.andWhere('service.status = :inactive', { inactive: STATUS.INACTIVE });
        }

        if (search) {
            qb.andWhere('service.name LIKE :search', { search: `%${search}%` });
        }

        const [services, total] = await qb.getManyAndCount();

        return {
            data: this.serializeForRole(services, role),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }


    async findAllForAdmin(query: QueryServiceDto, role: UserRole): Promise<PaginatedServices> {
        const { categoryId, gender, isAvailable, search, page = 1, limit = 10 } = query;

        const qb = this.serviceRepo
            .createQueryBuilder('service')
            .leftJoinAndSelect('service.category', 'category')
            .orderBy('service.name', 'ASC')
            .skip((page - 1) * limit)
            .take(limit);

        if (categoryId) {
            qb.andWhere('category.id = :categoryId', { categoryId });
        }

        if (gender) {
            qb.andWhere('service.gender = :gender', { gender });
        }

        if (isAvailable === true) {
            qb.andWhere('service.status = :active', { active: STATUS.ACTIVE });
        }

        if (isAvailable === false) {
            qb.andWhere('service.status = :inactive', { inactive: STATUS.INACTIVE });
        }

        if (search) {
            qb.andWhere('service.name LIKE :search', { search: `%${search}%` });
        }

        const [services, total] = await qb.getManyAndCount();

        return {
            data: this.serializeForRole(services, role),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /services/:id — All roles (role-aware response)
    // ─────────────────────────────────────────────────────────────────────────
    async findOne(
        id: number,
        role: UserRole,
    ): Promise<ServiceResponseDto | ServiceStylistResponseDto> {
        const service = await this.serviceRepo.findOne({
            where: { id },
            relations: ['category'],
        });

        if (!service || service.status === STATUS.DELETED) {
            throw new NotFoundException(`Service #${id} not found`);
        }

        return this.serializeForRole([service], role)[0];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /services/:id/toggle — Admin only
    // ─────────────────────────────────────────────────────────────────────────
    async toggleAvailability(id: number): Promise<{ message: string; status: number }> {
        const service = await this.findOneOrFail(id);

        const newStatus = service.status === STATUS.ACTIVE
            ? STATUS.INACTIVE
            : STATUS.ACTIVE;

        await this.serviceRepo.update(id, { status: newStatus });

        const label = newStatus === STATUS.ACTIVE ? 'active' : 'inactive';
        this.logger.log(`Service "${service.name}" toggled to ${label}`);

        return {
            message: `Service "${service.name}" is now ${label}`,
            status: newStatus,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /services/:id — Admin only
    // ─────────────────────────────────────────────────────────────────────────
    async update(id: number, dto: UpdateServiceDto): Promise<Service> {
        const service = await this.findOneOrFail(id);

        // cannot update inactive service — must toggle first
        if (service.status === STATUS.INACTIVE) {
            throw new BadRequestException(
                `Service "${service.name}" is inactive. Please activate it first.`,
            );
        }

        // ── update category if provided ───────────────────────────────────
        if (dto.categoryId) {
            const category = await this.categoryService.findOneOrFail(dto.categoryId);

            if (category.status === STATUS.INACTIVE) {
                throw new BadRequestException(
                    `Category "${category.name}" is inactive. Please activate it first.`,
                );
            }

            service.category = category;
        }

        // ── apply only provided fields ────────────────────────────────────
        if (dto.name !== undefined) service.name = dto.name.trim();
        if (dto.durationMins !== undefined) service.durationMins = dto.durationMins;
        if (dto.price !== undefined) service.price = dto.price;
        if (dto.gender !== undefined) service.gender = dto.gender;
        if (dto.description !== undefined) service.description = dto.description?.trim() ?? null;

        try {
            const updated = await this.serviceRepo.save(service);
            this.logger.log(`Service updated: ${updated.serviceCode} — ${updated.name}`);
            return updated;
        } catch (err) {
            const error = err as MySqlError;
            if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
                throw new ConflictException(
                    `Service "${dto.name}" already exists`,
                );
            }
            throw err;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE /services/:id — Admin only (soft delete)
    // ─────────────────────────────────────────────────────────────────────────
    async remove(id: number): Promise<{ message: string }> {
        const service = await this.findOneOrFail(id);

        if (service.status === STATUS.DELETED) {
            throw new ConflictException(
                `Service "${service.name}" is already deleted.`,
            );
        }

        await this.serviceRepo.update(id, { status: STATUS.DELETED });

        this.logger.log(`Service soft deleted: ${service.serviceCode} — ${service.name}`);
        return { message: `Service "${service.name}" deleted successfully` };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INTERNAL — used by StylistModule to validate service IDs on assignment
    // ─────────────────────────────────────────────────────────────────────────
    async findByIds(ids: number[]): Promise<Service[]> {
        if (ids.length === 0) return [];

        return this.serviceRepo
            .createQueryBuilder('service')
            .where('service.id IN (:...ids)', { ids })
            .andWhere('service.status = :active', { active: STATUS.ACTIVE })
            .getMany();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE HELPERS
    // ─────────────────────────────────────────────────────────────────────────
    private async findOneOrFail(id: number): Promise<Service> {
        const service = await this.serviceRepo.findOne({
            where: { id },
            relations: ['category'],
        });

        if (!service || service.status === STATUS.DELETED) {
            throw new NotFoundException(`Service #${id} not found`);
        }

        return service;
    }

    // maps entity array to correct DTO shape based on caller's role
    private serializeForRole(
        services: Service[],
        role: UserRole,
    ): ServiceResponseDto[] | ServiceStylistResponseDto[] {
        if (role === UserRole.STYLIST) {
            return plainToInstance(ServiceStylistResponseDto, services, {
                excludeExtraneousValues: true,
            });
        }

        return plainToInstance(ServiceResponseDto, services, {
            excludeExtraneousValues: true,
        });
    }
}