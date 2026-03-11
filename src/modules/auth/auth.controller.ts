import {
    Controller,
    Post,
    Body,
    Req,
    HttpCode,
    HttpStatus,
    UseGuards,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiResponse,
    ApiBody,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { AuthService, LoginResponse, AuthTokens } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
// import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
// import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
// import { RefreshJwtPayload } from './strategies/jwt-refresh.strategy';
import { JwtAuthGuard } from 'src/common/guard/auth.guard';
import { CurrentUser } from 'src/common/decorator/current-user.decorator';
import type { RefreshJwtPayload } from 'src/common/interface/jwt-payload.interface';
import { RegisterAdminDto } from './dto/register-admin.dto';


@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Register first admin — one time only',
        description:
            'Creates the initial admin account. ' +
            'Returns 409 Conflict if an admin already exists.',
    })
    @ApiResponse({ status: 201, description: 'Admin registered successfully' })
    @ApiResponse({ status: 409, description: 'Admin already exists' })
    register(@Body() dto: RegisterAdminDto): Promise<Omit<User, 'passwordHash'>> {
        return this.authService.registerAdmin(dto);
    }

    // ─────────────────────────────────────────────────────────────────────
    // POST /auth/login
    // ─────────────────────────────────────────────────────────────────────
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login with email and password' })
    @ApiResponse({ status: 200, description: 'Login successful' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    @ApiResponse({ status: 423, description: 'Account locked' })
    login(@Body() dto: LoginDto): Promise<LoginResponse> {
        return this.authService.login(dto);
    }

    // ─────────────────────────────────────────────────────────────────────
    // POST /auth/refresh
    // ─────────────────────────────────────────────────────────────────────
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @UseGuards(AuthGuard('jwt-refresh'))
    @ApiOperation({ summary: 'Refresh access token using refresh token' })
    @ApiResponse({ status: 200, description: 'New token pair issued' })
    @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
    @ApiBody({ type: RefreshTokenDto })
    refresh(
        @CurrentUser() payload: RefreshJwtPayload, @Body() _dto: RefreshTokenDto
    ): Promise<AuthTokens> {
        return this.authService.refresh(payload.sub, payload.refreshToken);
    }

    // ─────────────────────────────────────────────────────────────────────
    // POST /auth/logout
    // Invalidates BOTH tokens:
    //   access token  → blacklisted in Redis by jti
    //   refresh token → revoked in DB
    // ─────────────────────────────────────────────────────────────────────
    @Post('logout')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Logout — invalidates both access and refresh tokens instantly' })
    @ApiResponse({ status: 200, description: 'Logged out successfully' })
    async logout(
        @CurrentUser() user: User,
        @Req() req: Request,
    ): Promise<{ message: string }> {
        // extract raw access token from Authorization header
        // format: "Bearer <token>"
        const rawAccessToken = req.headers.authorization?.split(' ')[1] ?? '';

        await this.authService.logout(user.id, rawAccessToken);
        return { message: 'Logged out successfully' };
    }
}