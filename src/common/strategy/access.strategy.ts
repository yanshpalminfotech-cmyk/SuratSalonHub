import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../modules/user/entities/user.entity';
import { TokenBlacklistService } from './../services/token-blacklist.service';
import { STATUS } from '../constant/constant';

export interface JwtPayload {
    sub: number;   // user id
    email: string;
    role: string;
    jti: string;   // unique token ID — used for blacklisting
    exp: number;   // expiry as unix timestamp
}

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(
        config: ConfigService,

        @InjectRepository(User)
        private readonly userRepo: Repository<User>,

        private readonly blacklistService: TokenBlacklistService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: config.get<string>('jwt.accessSecret')!,
        });
    }

    async validate(payload: JwtPayload): Promise<User> {
        // ── blacklist check: was this token invalidated on logout? ─────────
        const isBlacklisted = await this.blacklistService.isBlacklisted(payload.jti);
        if (isBlacklisted) {
            throw new UnauthorizedException('Token has been invalidated. Please login again.');
        }

        const user = await this.userRepo.findOne({ where: { id: payload.sub } });

        if (!user || user.status === STATUS.DELETED) {
            throw new UnauthorizedException('User no longer exists');
        }

        if (user.status === STATUS.INACTIVE) {
            throw new UnauthorizedException('Account is inactive');
        }

        if (user.isLocked) {
            throw new UnauthorizedException('Account is locked. Please contact admin.');
        }

        return user;  // → attached as request.user in every protected route
    }
}