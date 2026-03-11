import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { STATUS } from 'src/common/constant/constant';
import { MySqlError } from 'src/common/interface/mysql-error.interface';

export interface PaginatedCustomers {
    data: Customer[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

@Injectable()
export class CustomerService {
    private readonly logger = new Logger(CustomerService.name);

    constructor(
        @InjectRepository(Customer)
        private readonly customerRepo: Repository<Customer>,

        private readonly dataSource: DataSource,
    ) { }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /customers — Admin + Receptionist
    // ─────────────────────────────────────────────────────────────────────────
    async create(dto: CreateCustomerDto): Promise<Customer> {
        const customerCode = await this.generateCustomerCode();

        const customer = this.customerRepo.create({
            customerCode,
            name: dto.name,
            phone: dto.phone,
            email: dto.email ?? null,
            gender: dto.gender ?? null,
            dateOfBirth: dto.dateOfBirth ?? null,
            notes: dto.notes ?? null,
            status: STATUS.ACTIVE,
        });

        try {
            const saved = await this.customerRepo.save(customer);
            this.logger.log(`Customer created: ${saved.name} | code: ${saved.customerCode}`);
            return saved;
        } catch (err) {
            const error = err as MySqlError;
            if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
                const message = error.sqlMessage || '';
                if (message.includes('phone')) {
                    throw new ConflictException('Phone number is already registered');
                }
                if (message.includes('email')) {
                    throw new ConflictException('Email is already registered');
                }
                throw new ConflictException('Customer with these details already exists');
            }
            throw err;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /customers — Admin + Receptionist (paginated)
    // ─────────────────────────────────────────────────────────────────────────
    async findAll(query: QueryCustomerDto): Promise<PaginatedCustomers> {
        const { search, status, page = 1, limit = 10 } = query;

        const qb = this.customerRepo
            .createQueryBuilder('customer')
            .where('customer.status != :deleted', { deleted: STATUS.DELETED })
            .orderBy('customer.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);

        if (search) {
            qb.andWhere(
                '(customer.name LIKE :search OR customer.phone LIKE :search)',
                { search: `%${search}%` },
            );
        }

        if (status !== undefined) {
            qb.andWhere('customer.status = :status', { status });
        }

        const [data, total] = await qb.getManyAndCount();

        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /customers/search — Quick lookup (appointment booking)
    // ─────────────────────────────────────────────────────────────────────────
    async search(q: string): Promise<Customer[]> {
        return this.customerRepo
            .createQueryBuilder('customer')
            .where('customer.status != :deleted', { deleted: STATUS.DELETED })
            .andWhere(
                '(customer.name LIKE :q OR customer.phone LIKE :q OR customer.email LIKE :q)',
                { q: `%${q}%` },
            )
            .orderBy('customer.name', 'ASC')
            .take(10)
            .getMany();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /customers/:id — Admin + Receptionist
    // ─────────────────────────────────────────────────────────────────────────
    async findOne(id: number): Promise<Customer> {
        return this.findOneOrFail(id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /customers/:id — Admin + Receptionist
    // ─────────────────────────────────────────────────────────────────────────
    async update(id: number, dto: UpdateCustomerDto): Promise<Customer> {
        const customer = await this.findOneOrFail(id);

        if (customer.status === STATUS.INACTIVE) {
            throw new BadRequestException('Customer is inactive. Please activate first.');
        }

        if (dto.name !== undefined) customer.name = dto.name;
        if (dto.phone !== undefined) customer.phone = dto.phone;
        if (dto.email !== undefined) customer.email = dto.email ?? null;
        if (dto.gender !== undefined) customer.gender = dto.gender ?? null;
        if (dto.dateOfBirth !== undefined) customer.dateOfBirth = dto.dateOfBirth ?? null;
        if (dto.notes !== undefined) customer.notes = dto.notes ?? null;

        try {
            const updated = await this.customerRepo.save(customer);
            this.logger.log(`Customer #${id} updated`);
            return updated;
        } catch (err) {
            const error = err as MySqlError;
            if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
                const message = error.sqlMessage || '';
                if (message.includes('phone')) {
                    throw new ConflictException('This phone number is already taken by another customer');
                }
                if (message.includes('email')) {
                    throw new ConflictException('This email is already taken by another customer');
                }
                throw new ConflictException('Update failed: unique constraint violation');
            }
            throw err;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE /customers/:id — Admin only (soft delete)
    // ─────────────────────────────────────────────────────────────────────────
    async remove(id: number): Promise<{ message: string }> {
        const customer = await this.findOneOrFail(id);

        if (customer.status === STATUS.DELETED) {
            throw new ConflictException('Customer already deleted');
        }

        // Guard: no scheduled appointments
        const scheduledCount = await this.dataSource
            .getRepository('appointments')
            .count({
                where: {
                    customer: { id },
                    status: 'Scheduled',
                },
            });

        if (scheduledCount > 0) {
            throw new BadRequestException(
                `Cannot delete customer — ${scheduledCount} scheduled appointment(s) exist`,
            );
        }

        await this.customerRepo.update(id, { status: STATUS.DELETED });
        this.logger.log(`Customer #${id} soft deleted`);
        return { message: `Customer #${id} deleted successfully` };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INTERNAL — reused by AppointmentModule
    // ─────────────────────────────────────────────────────────────────────────
    async findOneOrFail(id: number): Promise<Customer> {
        const customer = await this.customerRepo.findOne({ where: { id } });

        if (!customer || customer.status === STATUS.DELETED) {
            throw new NotFoundException(`Customer #${id} not found`);
        }

        return customer;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE — generate CUST-{YYYY}-{NNN}
    // ─────────────────────────────────────────────────────────────────────────
    private async generateCustomerCode(): Promise<string> {
        const year = new Date().getFullYear();

        // Count ALL customers for this year (including deleted) for sequential numbering
        const count = await this.customerRepo
            .createQueryBuilder('customer')
            .where('YEAR(customer.created_at) = :year', { year })
            .getCount();

        const seq = String(count + 1).padStart(3, '0');
        return `CUST-${year}-${seq}`;
    }
}
