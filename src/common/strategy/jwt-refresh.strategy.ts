import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from '../interface/jwt-payload.interface';


// extends JwtPayload — carries raw refresh token forward into service
export interface RefreshJwtPayload extends JwtPayload {
    refreshToken: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
    constructor(config: ConfigService) {
        super({
            // refresh token comes in request body, not Authorization header
            jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
            ignoreExpiration: false,
            secretOrKey: config.get<string>('jwt.refreshSecret')!,
            passReqToCallback: true,  // needed to extract raw token from body
        });
    }

    validate(req: Request, payload: JwtPayload): RefreshJwtPayload {
        const refreshToken = req.body?.refreshToken as string | undefined;

        if (!refreshToken) {
            throw new UnauthorizedException('Refresh token not provided');
        }

        return { ...payload, refreshToken };
    }
}