import {
    Injectable,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JsonWebTokenError, TokenExpiredError } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {

    // override canActivate to add custom pre-checks if needed in future
    canActivate(context: ExecutionContext) {
        return super.canActivate(context);
    }

    // override handleRequest to control exactly what error is thrown
    // passport calls this after strategy.validate() completes
    handleRequest<TUser = any>(
        err: Error | null,
        user: TUser | false,
        info: Error | null,
    ): TUser {

        // ── expired token ────────────────────────────────────────────────
        if (info instanceof TokenExpiredError) {
            throw new UnauthorizedException(
                'Access token has expired. Please refresh your token.',
            );
        }

        // ── malformed / invalid signature ────────────────────────────────
        if (info instanceof JsonWebTokenError) {
            throw new UnauthorizedException(
                'Invalid access token. Please login again.',
            );
        }

        // ── no token provided ────────────────────────────────────────────
        if (info?.message === 'No auth token') {
            throw new UnauthorizedException(
                'Access token is required. Please login.',
            );
        }

        // ── strategy threw an error (e.g. blacklisted, user deleted) ─────
        if (err) {
            throw err instanceof UnauthorizedException
                ? err
                : new UnauthorizedException(err.message);
        }

        // ── user not returned from strategy.validate() ────────────────────
        if (!user) {
            throw new UnauthorizedException('Authentication failed.');
        }

        return user;
    }
}