import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
    ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '../../modules/user/entities/user.entity';
import { ROLES_KEY } from '../decorator/roles.decorator';
import { UserRole } from '../enums/roles.enum';
import { STATUS } from '../constant/constant';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        // read required roles from @Roles() decorator
        // getAllAndOverride → method-level decorator takes priority over class-level
        const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
            ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );

        // no @Roles() on this route → allow through
        // JwtAuthGuard still runs before this — so route is still protected
        if (!requiredRoles || requiredRoles.length === 0) return true;

        const request = context.switchToHttp().getRequest();
        const user = request.user as User | undefined;

        // ── not authenticated ────────────────────────────────────────────
        // should not reach here normally — JwtAuthGuard runs first
        // but guard order could be misconfigured, so handle explicitly
        if (!user) {
            throw new UnauthorizedException(
                'You must be logged in to access this resource.',
            );
        }

        // ── account deactivated or soft deleted ──────────────────────────
        // extra safety — JwtAccessStrategy already checks this
        // but guard is a second layer of defence
        if (user.status !== STATUS.ACTIVE) {
            throw new UnauthorizedException(
                'Your account is inactive. Please contact admin.',
            );
        }

        // ── locked account ───────────────────────────────────────────────
        if (user.isLocked) {
            throw new UnauthorizedException(
                'Your account is locked. Please contact admin.',
            );
        }

        // ── role check ───────────────────────────────────────────────────
        const hasRole = requiredRoles.includes(user.role);

        if (!hasRole) {
            // 403 not 401 — user IS authenticated, just not authorised
            // document explicitly requires 403 for wrong role
            throw new ForbiddenException(
                `Access denied. This action requires one of these roles: ${requiredRoles.join(', ')}`,
            );
        }

        return true;
    }
}