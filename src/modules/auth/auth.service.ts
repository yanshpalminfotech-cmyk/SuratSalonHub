import {
    Injectable,
    UnauthorizedException,
    HttpException,
    HttpStatus,
    Logger,
    ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

import { User } from '../user/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from '../../common/strategy/access.strategy';
import { RefreshToken } from './entities/refreshtoken.entity';
import { UsersService } from '../user/user.service';
import { TokenBlacklistService } from '../redis/token-blacklist.service';
import { UserRole } from 'src/common/enums';
import { RegisterAdminDto } from './dto/register-admin.dto';
import { STATUS } from 'src/common/constant/constant';


// ── Response shapes ──────────────────────────────────────────────────────────
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

export interface LoginResponse {
    user: Omit<User, 'passwordHash'>;
    tokens: AuthTokens;
}

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,

        @InjectRepository(RefreshToken)
        private readonly refreshTokenRepo: Repository<RefreshToken>,

        private readonly jwtService: JwtService,
        private readonly config: ConfigService,
        private readonly blacklistService: TokenBlacklistService,
        private readonly userService: UsersService
    ) { }

    async registerAdmin(dto: RegisterAdminDto): Promise<Omit<User, 'passwordHash'>> {
        const adminExists = await this.userRepo.findOne({
            where: { role: UserRole.ADMIN },
        });

        if (adminExists) {
            throw new ConflictException(
                'An admin account already exists. ' +
                'Use the admin account to create additional users.',
            );
        }

        const emailTaken = await this.userRepo.findOne({ where: { email: dto.email } });
        if (emailTaken) throw new ConflictException('Email already registered');

        const phoneTaken = await this.userRepo.findOne({ where: { phone: dto.phone } });
        if (phoneTaken) throw new ConflictException('Phone number already registered');

        const rounds = this.config.get<number>('auth.bcryptRounds') ?? 12;
        const passwordHash = await bcrypt.hash(dto.password, rounds);

        const admin = this.userRepo.create({
            name: dto.name,
            email: dto.email,
            phone: dto.phone,
            passwordHash,
            role: UserRole.ADMIN,
            status: STATUS.ACTIVE,
            isLocked: false,
            failedAttempts: 0,
        });

        const saved = await this.userRepo.save(admin);

        this.logger.log(`Admin registered: ${saved.email}`);

        const { passwordHash: _, ...safeAdmin } = saved;
        return safeAdmin as Omit<User, 'passwordHash'>;
    }


    // ─────────────────────────────────────────────────────────────────────────
    // LOGIN
    // ─────────────────────────────────────────────────────────────────────────
    async login(dto: LoginDto): Promise<LoginResponse> {

        const user = await this.userRepo
            .createQueryBuilder('user')
            .addSelect('user.password')
            .where('user.email = :email', { email: dto.email })
            .getOne();

        if (!user) {
            throw new UnauthorizedException('Invalid email or password.');
        }

        if (user?.status === STATUS.DELETED) {
            throw new UnauthorizedException('Invalid email or password');
        }

        if (user?.status === STATUS.INACTIVE) {
            throw new UnauthorizedException('Account is inactive. Please contact admin.');
        }

        if (user?.isLocked) {
            throw new HttpException(
                'Account is locked due to too many failed attempts. Please contact admin.',
                HttpStatus.LOCKED,
            );
        }

        const isValid = await bcrypt.compare(
            dto.password,
            user?.passwordHash,
        );

        if (!isValid) {
            if (user) await this.handleFailedAttempt(user);
            throw new UnauthorizedException('Invalid email or password.');
        }

        if (user.failedAttempts > 0) {
            await this.userService.resetFailedAttempts(user.id);
        }

        await this.refreshTokenRepo.update(
            { user: { id: user.id } },
            { revoked: true }
        );

        const tokens = await this.generateAndStoreTokens(user);

        this.logger.log(`Login success: ${user.email} | role: ${user.role}`);

        const { passwordHash: _, ...safeUser } = user;
        return {
            user: safeUser as Omit<User, 'passwordHash'>,
            tokens,
        };
    }

    async refresh(userId: number, incomingToken: string): Promise<AuthTokens> {

        const tokenRecord = await this.refreshTokenRepo.findOne({
            where: {
                user: { id: userId },
                revoked: false
            },
            relations: ['user'],
        });

        if (!tokenRecord) {
            throw new UnauthorizedException('Session expired or logged in from another device');
        }

        const isMatch = await bcrypt.compare(incomingToken, tokenRecord.tokenHash);
        if (!isMatch) {

            await this.refreshTokenRepo.update(
                { user: { id: userId } },
                { revoked: true }
            );
            throw new UnauthorizedException('Invalid refresh token');
        }

        if (tokenRecord.expiresAt < new Date()) {
            await this.refreshTokenRepo.delete({ id: tokenRecord.id });
            throw new UnauthorizedException('Session expired. Please login again.');
        }

        await this.refreshTokenRepo.update(
            { id: tokenRecord.id },
            { revoked: true });

        const tokens = await this.generateAndStoreTokens(tokenRecord.user);

        this.logger.log(`Token rotated for user: ${userId}`);
        return tokens;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LOGOUT — invalidate BOTH tokens instantly
    // ─────────────────────────────────────────────────────────────────────────
    async logout(
        userId: number,
        accessToken: string,           
    ): Promise<void> {

        const decoded = this.jwtService.decode(accessToken) as JwtPayload & { exp: number };

        if (decoded?.jti && decoded?.exp) {
            await this.blacklistService.blacklist(decoded.jti, decoded.exp);
        }

        await this.refreshTokenRepo.update(
            { user: { id: userId }, revoked: false }, 
            { revoked: true }                        
        );

        this.logger.warn(`Logout: no matching refresh token found for user ${userId}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BRUTE FORCE
    // ─────────────────────────────────────────────────────────────────────────
    private async handleFailedAttempt(user: User): Promise<void> {
        const maxAttempts = this.config.get<number>('auth.maxFailedAttempts') ?? 5;
        const newAttempts = user.failedAttempts + 1;

        if (newAttempts >= maxAttempts) {
            await this.userRepo.update(user.id, {
                failedAttempts: newAttempts,
                isLocked: true,
            });
            //await this.userService.resetFailedAttempts(user.id);

            this.logger.warn(
                `Account locked after ${newAttempts} failed attempts: ${user.email}`,
            );
        } else {
            await this.userRepo.update(user.id, { failedAttempts: newAttempts });
            this.logger.warn(
                `Failed attempt ${newAttempts}/${maxAttempts} for: ${user.email}`,
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE — generate access + refresh tokens, store hashed refresh in DB
    // ─────────────────────────────────────────────────────────────────────────
    private async generateAndStoreTokens(user: User): Promise<AuthTokens> {

        const jti = uuidv4();

        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            jti,
            exp: 0,
        };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(
                { sub: payload.sub, email: payload.email, role: payload.role, jti },
                {
                    secret: this.config.get<string>('jwt.accessSecret'),
                    expiresIn: parseInt(this.config.get<string>('jwt.accessExpires')!),
                },
            ),
            this.jwtService.signAsync(
                { sub: payload.sub, email: payload.email, role: payload.role },
                {
                    secret: this.config.get<string>('jwt.refreshSecret'),
                    expiresIn: parseInt(this.config.get<string>('jwt.refreshExpires')!),
                },
            ),
        ]);

        const rounds = this.config.get<number>('auth.bcryptRounds') ?? 12;
        const tokenHash = await bcrypt.hash(refreshToken, rounds);
        const expiresAt = this.parseExpiryToDate(
            this.config.get<string>('jwt.refreshExpiresIn') ?? '7d',
        );

        await this.refreshTokenRepo.save(
            this.refreshTokenRepo.create({
                user: { id: user.id },
                tokenHash,
                expiresAt,
                revoked: false,
            }),
        );

        return { accessToken, refreshToken };
    }

    // ── convert "7d" / "1h" / "30m" → Date ──────────────────────────────────
    private parseExpiryToDate(expiry: string): Date {
        const unit = expiry.slice(-1);
        const value = parseInt(expiry.slice(0, -1), 10);
        const ms = { d: 86_400_000, h: 3_600_000, m: 60_000 }[unit] ?? 86_400_000;
        return new Date(Date.now() + value * ms);
    }
}