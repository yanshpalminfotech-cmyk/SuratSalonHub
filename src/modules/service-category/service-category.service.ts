import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceCategory } from './entities/service-category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { STATUS } from 'src/common/constant/constant';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { MySqlError } from 'src/common/interface/mysql-error.interface';


UpdateCategoryDto
@Injectable()
export class ServiceCategoryService {
    private readonly logger = new Logger(ServiceCategoryService.name);

    constructor(
        @InjectRepository(ServiceCategory)
        private readonly categoryRepo: Repository<ServiceCategory>,
    ) { }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /service-categories — Admin only
    // ─────────────────────────────────────────────────────────────────────────
    async create(dto: CreateCategoryDto): Promise<ServiceCategory> {
        try {
            const category = this.categoryRepo.create({
                name: dto.name.trim(),
            });

            return await this.categoryRepo.save(category);

        } catch (err) {
            const error = err as MySqlError;
            if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
                throw new ConflictException(`Category "${dto.name}" already exists`);
            }

            throw error;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /service-categories — All roles
    // ─────────────────────────────────────────────────────────────────────────
    async findAll(status?: number): Promise<ServiceCategory[]> {
        if (status == undefined) {
            return this.categoryRepo.find({
                order: { name: 'ASC' },
            });
        }
        return this.categoryRepo.find({
            where: { status },
            order: { name: 'ASC' },
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /service-categories/:id — Admin only
    // ─────────────────────────────────────────────────────────────────────────
    async update(id: number, dto: UpdateCategoryDto): Promise<ServiceCategory> {
        // 1. Ensure the category exists first
        const category = await this.findOneOrFail(id);

        if (category.status !== STATUS.ACTIVE) {
            throw new BadRequestException(
                `Category "${category.name}" cannot be updated because it is currently ${category.status === STATUS.INACTIVE ? 'Inactive' : 'Deleted'
                }. Please activate it first.`
            );
        }

        if (dto.name) {
            category.name = dto.name.trim();
        }


        try {

            const updated = await this.categoryRepo.save(category);
            this.logger.log(`Category updated: ${updated.name}`);
            return updated;

        } catch (err) {
            const error = err as MySqlError;
            if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
                throw new ConflictException(`Category "${dto.name}" already exists`);
            }

            throw error;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE /service-categories/:id — Admin only (soft delete)
    // ─────────────────────────────────────────────────────────────────────────
    async remove(id: number): Promise<{ message: string }> {
        const category = await this.findOneOrFail(id);

        if (category.status === STATUS.DELETED) {
            throw new ConflictException(
                `Category "${category.name}" already deleted before.`
            );
        }

        const serviceCount = await this.categoryRepo
            .createQueryBuilder('category')
            .innerJoin(
                'services',
                'service',
                'service.category_id = category.id AND service.status != :deleted',
                { deleted: 127 },
            )
            .where('category.id = :id', { id })
            .getCount();

        if (serviceCount > 0) {
            throw new BadRequestException(
                `Cannot delete "${category.name}" — ` +
                `${serviceCount} active service(s) exist under it. ` +
                `Please delete or reassign those services first.`,
            );
        }

        await this.categoryRepo.update(id, { status: STATUS.DELETED });

        this.logger.log(`Category soft deleted: ${category.name}`);
        return { message: `Category "${category.name}" deleted successfully` };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INTERNAL — used by ServiceModule to validate categoryId
    // ─────────────────────────────────────────────────────────────────────────
    async findOneOrFail(id: number): Promise<ServiceCategory> {
        const category = await this.categoryRepo.findOne({ where: { id } });

        if (!category) {
            throw new NotFoundException(`Category #${id} not found`);
        }

        return category;
    }
}