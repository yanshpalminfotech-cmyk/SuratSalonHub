import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    ParseIntPipe,
    HttpCode,
    HttpStatus,
    UseGuards,
    Req,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiParam,
} from '@nestjs/swagger';
import { UsersService, PaginatedUsers } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { UserRole } from 'src/common/enums/roles.enum';
import { User } from './entities/user.entity';
import { Roles } from 'src/common/decorator/roles.decorator';
import { CurrentUser } from 'src/common/decorator/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guard/auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import type { Request } from 'express';
@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    // ── IMPORTANT: static routes MUST come before :id routes ─────────────
    // GET /users/me  →  must be declared before GET /users/:id
    // otherwise NestJS will treat "me" as an id param

    // ─────────────────────────────────────────────────────────────────────
    // GET /users/me — own profile (all roles)
    // ─────────────────────────────────────────────────────────────────────
    @ApiBearerAuth()
    @Get('me')
    @ApiOperation({ summary: 'Get own profile' })
    getMe(@CurrentUser() user: User): Promise<User> {
        return this.usersService.findOne(user.id);
    }

    // ─────────────────────────────────────────────────────────────────────
    // PATCH /users/me/password — change own password (all roles)
    // ─────────────────────────────────────────────────────────────────────
    @Patch('me/password')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Change own password' })
    changePassword(
        @CurrentUser() user: User,
        @Body() dto: ChangePasswordDto, @Req() req: Request,
    ): Promise<{ message: string }> {
        const rawAccessToken = req.headers.authorization?.split(' ')[1] ?? '';
        return this.usersService.changePassword(user.id, dto,rawAccessToken);
    }

    // ─────────────────────────────────────────────────────────────────────
    // POST /users — create user (Admin only)
    // ─────────────────────────────────────────────────────────────────────
    @Post()
    @Roles(UserRole.ADMIN)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new user — Admin only' })
    create(@Body() dto: CreateUserDto): Promise<User> {
        return this.usersService.create(dto);
    }

    // ─────────────────────────────────────────────────────────────────────
    // GET /users — all users paginated (Admin only)
    // ─────────────────────────────────────────────────────────────────────
    @Get()
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Get all users with pagination — Admin only' })
    findAll(@Query() query: QueryUserDto): Promise<PaginatedUsers> {
        return this.usersService.findAll(query);
    }

    // ─────────────────────────────────────────────────────────────────────
    // GET /users/:id — single user (Admin only)
    // ─────────────────────────────────────────────────────────────────────
    @Get(':id')
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Get user by ID — Admin only' })
    @ApiParam({ name: 'id', type: Number })
    findOne(@Param('id', ParseIntPipe) id: number): Promise<User> {
        return this.usersService.findOne(id);
    }

    // ─────────────────────────────────────────────────────────────────────
    // PATCH /users/:id — update user (Admin only)
    // ─────────────────────────────────────────────────────────────────────
    @Patch(':id')
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Update user — Admin only' })
    @ApiParam({ name: 'id', type: Number })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateUserDto,
    ): Promise<User> {
        return this.usersService.update(id, dto);
    }

    // ─────────────────────────────────────────────────────────────────────
    // PATCH /users/:id/unlock — unlock locked account (Admin only)
    // ─────────────────────────────────────────────────────────────────────
    @Patch(':id/unlock')
    @Roles(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Unlock brute-force locked account — Admin only' })
    @ApiParam({ name: 'id', type: Number })
    unlock(@Param('id', ParseIntPipe) id: number): Promise<User> {
        return this.usersService.unlock(id);
    }

    // ─────────────────────────────────────────────────────────────────────
    // DELETE /users/:id — soft delete (Admin only)
    // ─────────────────────────────────────────────────────────────────────
    @Delete(':id')
    @Roles(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Soft delete user (status=127) — Admin only' })
    @ApiParam({ name: 'id', type: Number })
    remove(
        @Param('id', ParseIntPipe) id: number,
    ): Promise<{ message: string }> {
        return this.usersService.remove(id);
    }
}