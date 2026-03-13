import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    UnauthorizedException,
    Logger,
    Inject,
    forwardRef,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { UserRole } from 'src/common/enums';
import { STATUS } from 'src/common/constant/constant';
import { MySqlError } from 'src/common/interface/mysql-error.interface';
import { JwtPayload } from 'src/common/strategy/access.strategy';
import { JwtService } from '@nestjs/jwt';
import { TokenBlacklistService } from '../redis/token-blacklist.service';
import { RefreshToken } from '../auth/entities/refreshtoken.entity';
import { StylistsService } from '../stylist/stylist.service';

export interface PaginatedUsers {
    data: User[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

@Injectable()
export class UsersService {
    private readonly logger = new Logger(UsersService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,

        private readonly dataSource: DataSource,
        private readonly config: ConfigService,
        private readonly jwtService: JwtService,
        private readonly blacklistService: TokenBlacklistService,
        @InjectRepository(RefreshToken)
        private readonly refreshTokenRepo: Repository<RefreshToken>,
        // forwardRef — breaks circular dependency (Users ↔ Stylists)
        @Inject(forwardRef(() => StylistsService))
        private readonly stylistsService: StylistsService,
    ) { }

    async create(dto: CreateUserDto): Promise<User> {
        const rounds = this.config.get<number>('security.bcryptRounds');
        const passwordHash = await bcrypt.hash(dto.password, (rounds)!);

        try {
            const user = await this.dataSource.transaction(async (manager) => {
                const newUser = manager.create(User, {
                    ...dto,
                    passwordHash,
                    status: STATUS.ACTIVE,
                });

                const savedUser = await manager.save(User, newUser);

                if (dto.role === UserRole.STYLIST) {
                    await this.stylistsService.createProfileInTransaction(
                        manager,
                        savedUser,
                        dto.specialisation!,
                        dto.commissionRate!,
                    );
                }

                return savedUser;
            });

            this.logger.log(`User created: ${user.email}`);
            return user;

        } catch (err) {
            const error = err as MySqlError;
            if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
                const message = error.sqlMessage || '';

                if (message.includes('email')) {
                    throw new ConflictException('Email is already registered');
                }
                if (message.includes('phone')) {
                    throw new ConflictException('Phone number is already registered');
                }
                console.log(message);
                throw new ConflictException('User with these details already exists');
            }

            throw error;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET ALL USERS (paginated)
    // ─────────────────────────────────────────────────────────────────────────
    async findAll(query: QueryUserDto): Promise<PaginatedUsers> {
        const { role, page = 1, limit = 10 } = query;

        const qb = this.userRepo
            .createQueryBuilder('user')
            .where('user.status != :deleted', { deleted: STATUS.DELETED })
            .orderBy('user.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);

        if (role) {
            qb.andWhere('user.role = :role', { role });
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
    // GET SINGLE USER
    // ─────────────────────────────────────────────────────────────────────────
    async findOne(id: number): Promise<User> {
        const user = await this.userRepo.findOne({
            where: { id },
        });

        if (!user) {
            throw new NotFoundException(`User #${id} not found`);
        }

        return user;
    }




    // ─────────────────────────────────────────────────────────────────────────
    // UPDATE USER
    // ─────────────────────────────────────────────────────────────────────────
    async update(id: number, dto: UpdateUserDto): Promise<User> {
        const user = await this.findOne(id);

        if (user.status !== STATUS.ACTIVE) {
            throw new ConflictException(
                'Activate this user to edit.'
            );
        }

        if (user.id == id && dto.password) {
            throw new ForbiddenException(
                'Action Denied: You cannot update your own password through this administrative route. Please use the Security Settings in your profile.'
            );
        }

        try {
            // 2. Merge the DTO changes into the existing user entity
            Object.assign(user, dto);

            // 3. Save the changes - Database will check unique constraints here
            return await this.userRepo.save(user);

        } catch (err) {
            const error = err as MySqlError;
            // 4. Handle MySQL Duplicate Entry (Error 1062)
            if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
                const message = error.sqlMessage || '';

                if (message.includes('email')) {
                    throw new ConflictException('This email is already taken by another user');
                }
                if (message.includes('phone')) {
                    throw new ConflictException('This phone number is already taken by another user');
                }

                throw new ConflictException('Update failed: Unique constraint violation');
            }

            // Re-throw other unexpected database errors
            throw error;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UNLOCK ACCOUNT (Admin)
    // ─────────────────────────────────────────────────────────────────────────
    async unlock(id: number): Promise<User> {
        const user = await this.findOne(id);

        if (user.status !== STATUS.ACTIVE) {
            throw new ConflictException(
                'This user is not active or deleted.'
            );
        }

        if (!user.isLocked) {
            throw new BadRequestException('Account is not locked.');
        }

        user.isLocked = false;
        user.failedAttempts = 0;

        await this.userRepo.save(user);

        this.logger.log(`Account unlocked: ${user.email}`);

        return user;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SOFT DELETE (Admin)
    // ─────────────────────────────────────────────────────────────────────────
    async remove(id: number): Promise<{ message: string }> {
        const user = await this.findOne(id);

        if (user.status === STATUS.DELETED) {
            throw new ConflictException(
                'This user account has already been deleted.'
            );
        }

        await this.userRepo.update(id, { status: STATUS.DELETED });

        this.logger.log(`User soft deleted: ${user.email}`);
        return { message: `User #${id} deleted successfully` };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHANGE OWN PASSWORD
    // ─────────────────────────────────────────────────────────────────────────
    async changePassword(id: number, dto: ChangePasswordDto, accessToken: string): Promise<{ message: string }> {
        // fetch with passwordHash (normally excluded by @Exclude)
        const user = await this.userRepo
            .createQueryBuilder('user')
            .addSelect('user.passwordHash')  // explicitly select excluded field
            .where('user.id = :id', { id })
            .getOne();

        if (!user) throw new NotFoundException('User not found.');

        if (user.status !== STATUS.ACTIVE) throw new ConflictException('Cannot change password for an inactive user. Please activate the account first.');

        const isValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);

        if (!isValid) {
            throw new UnauthorizedException('Current password is incorrect');
        }

        if (dto.currentPassword === dto.newPassword) {
            throw new BadRequestException('New password must be different from current password');
        }

        const rounds = this.config.get<number>('auth.bcryptRounds') ?? 12;
        const passwordHash = await bcrypt.hash(dto.newPassword, rounds);

        await this.userRepo.update(id, { passwordHash });

        const decoded = this.jwtService.decode(accessToken) as JwtPayload & { exp: number };

        if (decoded?.jti && decoded?.exp) {
            await this.blacklistService.blacklist(decoded.jti, decoded.exp);
        }

        await this.refreshTokenRepo.update(
            { user: { id: user.id }, revoked: false }, // Find active tokens for this user
            { revoked: true }                         // Set them to revoked
        );

        this.logger.log(`Password changed for user: ${user.email}`);
        return { message: 'Password changed successfully' };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FIND BY EMAIL (used by AuthService)
    // ─────────────────────────────────────────────────────────────────────────
    async findByEmail(email: string): Promise<User | null> {
        return this.userRepo
            .createQueryBuilder('user')
            .addSelect('user.passwordHash')
            .where('user.email = :email', { email })
            .getOne();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UPDATE FAILED ATTEMPTS (used by AuthService)
    // ─────────────────────────────────────────────────────────────────────────
    async incrementFailedAttempts(user: User): Promise<void> {
        const maxAttempts = this.config.get<number>('auth.maxFailedAttempts') ?? 5;
        const newAttempts = user.failedAttempts + 1;

        if (newAttempts >= maxAttempts) {
            await this.userRepo.update(user.id, {
                failedAttempts: newAttempts,
                isLocked: true,
            });
            this.logger.warn(`Account locked after ${newAttempts} failed attempts: ${user.email}`);
        } else {
            await this.userRepo.update(user.id, { failedAttempts: newAttempts });
        }
    }

    async resetFailedAttempts(userId: number): Promise<void> {
        await this.userRepo.update(userId, {
            failedAttempts: 0,
            isLocked: false,
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE HELPERS
    // ─────────────────────────────────────────────────────────────────────────
    // private async ensureEmailUnique(email: string): Promise<void> {
    //     const exists = await this.userRepo.findOne({ where: { email } });
    //     if (exists) throw new ConflictException('Email already registered');
    // }

    // private async ensurePhoneUnique(phone: string): Promise<void> {
    //     const exists = await this.userRepo.findOne({ where: { phone } });
    //     if (exists) throw new ConflictException('Phone number already registered');
    // }
}