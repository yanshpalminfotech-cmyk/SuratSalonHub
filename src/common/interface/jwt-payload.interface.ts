/**
 * Base payload — fields common to both access and refresh tokens.
 * Matches what we put in jwtService.signAsync({ sub, email, role })
 */
export interface BaseJwtPayload {
    sub: number;   // user id
    email: string;
    role: string;
    iat?: number;   // issued at — auto-added by JWT library
    exp?: number;   // expiry   — auto-added by JWT library
}

/**
 * Access token payload.
 * Includes jti (JWT ID) for Redis blacklisting on logout.
 */
export interface JwtPayload extends BaseJwtPayload {
    jti: string;     // unique token ID — stored in Redis blacklist on logout
    exp: number;     // required (not optional) — needed for Redis TTL calculation
}

/**
 * What passport attaches to request.user after jwt-refresh strategy validates.
 * Carries the raw refresh token string forward into AuthService.refresh().
 * Does NOT include jti — refresh tokens are not blacklisted, they are revoked in DB.
 */
export interface RefreshJwtPayload extends BaseJwtPayload {
    refreshToken: string;  // raw token string extracted from req.body
}