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

// ── Dummy hash — prevents timing attacks when email not found ────────────────
// const DUMMY_HASH = '$2b$12$dummyhashfortimingattackprevention00000000000000000000';

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
        // ── one admin only ────────────────────────────────────────────────
        const adminExists = await this.userRepo.findOne({
            where: { role: UserRole.ADMIN },
        });

        if (adminExists) {
            throw new ConflictException(
                'An admin account already exists. ' +
                'Use the admin account to create additional users.',
            );
        }

        // ── uniqueness checks ─────────────────────────────────────────────
        const emailTaken = await this.userRepo.findOne({ where: { email: dto.email } });
        if (emailTaken) throw new ConflictException('Email already registered');

        const phoneTaken = await this.userRepo.findOne({ where: { phone: dto.phone } });
        if (phoneTaken) throw new ConflictException('Phone number already registered');

        // ── hash password ─────────────────────────────────────────────────
        const rounds = this.config.get<number>('auth.bcryptRounds') ?? 12;
        const passwordHash = await bcrypt.hash(dto.password, rounds);

        // ── create admin ──────────────────────────────────────────────────
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
        // @Exclude() hides passwordHash — addSelect fetches it explicitly here
        const user = await this.userRepo
            .createQueryBuilder('user')
            .addSelect('user.password')
            .where('user.email = :email', { email: dto.email })
            .getOne();

        if (!user) {
            throw new UnauthorizedException('Invalid email or password.');
        }

        // ── deleted account — don't reveal existence ──────────────────────
        if (user?.status === STATUS.DELETED) {
            throw new UnauthorizedException('Invalid email or password');
        }

        // ── inactive account ──────────────────────────────────────────────
        if (user?.status === STATUS.INACTIVE) {
            throw new UnauthorizedException('Account is inactive. Please contact admin.');
        }

        // ── locked account — 423 ─────────────────────────────────────────
        if (user?.isLocked) {
            throw new HttpException(
                'Account is locked due to too many failed attempts. Please contact admin.',
                HttpStatus.LOCKED,
            );
        }

        // ── password check — always run bcrypt (timing attack prevention) ─
        const isValid = await bcrypt.compare(
            dto.password,
            user?.passwordHash,
        );

        if (!isValid) {
            if (user) await this.handleFailedAttempt(user);
            throw new UnauthorizedException('Invalid email or password.');
        }

        // ── success: reset brute force counters ───────────────────────────
        if (user.failedAttempts > 0) {
            // await this.userRepo.update(user.id, {
            //     failedAttempts: 0,
            //     isLocked: false,
            // });
            await this.userService.resetFailedAttempts(user.id);
        }

        await this.refreshTokenRepo.update(
            { user: { id: user.id } }, // Find active tokens for this user
            { revoked: true }                         // Set them to revoked
        );

        const tokens = await this.generateAndStoreTokens(user);

        this.logger.log(`Login success: ${user.email} | role: ${user.role}`);

        const { passwordHash: _, ...safeUser } = user;
        return {
            user: safeUser as Omit<User, 'passwordHash'>,
            tokens,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REFRESH
    // ─────────────────────────────────────────────────────────────────────────
    // async refresh(userId: number, incomingToken: string): Promise<AuthTokens> {
    //     const storedTokens = await this.refreshTokenRepo.find({
    //         where: { user: { id: userId }, revoked: false },
    //         relations: ['user'],
    //     });

    //     if (storedTokens.length === 0) {
    //         throw new UnauthorizedException('Invalid or expired refresh token');
    //     }

    //     let matchedToken: RefreshToken | null = null;

    //     for (const token of storedTokens) {
    //         const isMatch = await bcrypt.compare(incomingToken, token.tokenHash);
    //         if (isMatch) {
    //             matchedToken = token;
    //             break;
    //         }
    //     }

    //     if (!matchedToken) {
    //         throw new UnauthorizedException('Invalid or expired refresh token');
    //     }

    //     if (matchedToken.expiresAt < new Date()) {
    //         await this.refreshTokenRepo.update(matchedToken.id, { revoked: true });
    //         throw new UnauthorizedException('Refresh token expired. Please login again.');
    //     }

    //     // rotation — revoke old, issue new
    //     await this.refreshTokenRepo.update(matchedToken.id, { revoked: true });

    //     const tokens = await this.generateAndStoreTokens(matchedToken.user);

    //     this.logger.log(`Token refreshed for user: ${userId}`);
    //     return tokens;
    // }

    async refresh(userId: number, incomingToken: string): Promise<AuthTokens> {
        // 1. Fetch the SINGLE active token for this user
        const tokenRecord = await this.refreshTokenRepo.findOne({
            where: {
                user: { id: userId },
                revoked: false
            },
            relations: ['user'],
        });

        // 2. If no record exists, they were likely kicked out by another device or logged out
        if (!tokenRecord) {
            throw new UnauthorizedException('Session expired or logged in from another device');
        }

        // 3. Verify the hash
        const isMatch = await bcrypt.compare(incomingToken, tokenRecord.tokenHash);
        if (!isMatch) {
            // Security: If the token doesn't match, someone might be tampering. 
            // We delete the record to be safe (Force logout).
            // await this.refreshTokenRepo.delete({ user: { id: userId } });
            await this.refreshTokenRepo.update(
                { user: { id: userId } }, // Find active tokens for this user
                { revoked: true }                         // Set them to revoked
            );
            throw new UnauthorizedException('Invalid refresh token');
        }

        // 4. Check expiration
        if (tokenRecord.expiresAt < new Date()) {
            await this.refreshTokenRepo.delete({ id: tokenRecord.id });
            throw new UnauthorizedException('Session expired. Please login again.');
        }

        // 5. Rotation: Kill the current one and generate a brand new one
        // In Single Device mode, we just delete the old record entirely
        // await this.refreshTokenRepo.delete({ id: tokenRecord.id });
        await this.refreshTokenRepo.update(
            { id: tokenRecord.id }, // Find active tokens for this user
            { revoked: true });

        // This method (which we modified earlier) will now save the NEW single session
        const tokens = await this.generateAndStoreTokens(tokenRecord.user);

        this.logger.log(`Token rotated for user: ${userId}`);
        return tokens;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LOGOUT — invalidate BOTH tokens instantly
    // ─────────────────────────────────────────────────────────────────────────
    async logout(
        userId: number,
        accessToken: string,           // raw access token from Authorization header
    ): Promise<void> {
        // ── 1. Blacklist access token in Redis ────────────────────────────
        // decode without verifying — signature already verified by JwtAuthGuard
        const decoded = this.jwtService.decode(accessToken) as JwtPayload & { exp: number };

        if (decoded?.jti && decoded?.exp) {
            await this.blacklistService.blacklist(decoded.jti, decoded.exp);
        }

        await this.refreshTokenRepo.update(
            { user: { id: userId }, revoked: false }, // Find active tokens for this user
            { revoked: true }                         // Set them to revoked
        );

        // ── 2. Revoke refresh token in DB (current device only) ───────────
        // const storedTokens = await this.refreshTokenRepo.find({
        //     where: { user: { id: userId }, revoked: true },
        // });

        // for (const token of storedTokens) {
        //     const isMatch = await bcrypt.compare(incomingRefreshToken, token.tokenHash);
        //     if (isMatch) {
        //         await this.refreshTokenRepo.update(token.id, { revoked: true });
        //         this.logger.log(`Logout success: user ${userId}`);
        //         return;
        //     }
        // }

        // refresh token not found — still ok (access token already blacklisted)
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
        // jti = unique ID per token — used to blacklist on logout
        const jti = uuidv4();

        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            jti,
            exp: 0,   // overridden by expiresIn below — placeholder for interface
        };
        // console.log(this.config.get<string>('jwt.accessExpiresIn'));
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

        // store hashed refresh token in DB
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