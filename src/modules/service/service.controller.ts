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
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiParam,
    ApiResponse,
} from '@nestjs/swagger';
import { ServiceService, PaginatedServices } from './service.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { QueryServiceDto } from './dto/query-service.dto';
import { ServiceResponseDto, ServiceStylistResponseDto } from './dto/service-response.dto';
import { Service } from './entities/service.entity';
import { JwtAuthGuard } from 'src/common/guard/auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorator/roles.decorator';
import { CurrentUser } from 'src/common/decorator/current-user.decorator';
import { UserRole } from 'src/common/enums/index';
import { User } from '../user/entities/user.entity';

@ApiTags('Services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('services')
export class ServiceController {
    constructor(private readonly serviceService: ServiceService) { }

    // ─────────────────────────────────────────────────────────────────────
    // POST /services — Admin only
    // ─────────────────────────────────────────────────────────────────────
    @Post()
    @Roles(UserRole.ADMIN)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create service — Admin only' })
    @ApiResponse({ status: 201, description: 'Service created successfully' })
    @ApiResponse({ status: 400, description: 'Category is inactive' })
    @ApiResponse({ status: 404, description: 'Category not found' })
    @ApiResponse({ status: 409, description: 'Service name already exists' })
    create(@Body() dto: CreateServiceDto): Promise<Service> {
        return this.serviceService.create(dto);
    }

    // ─────────────────────────────────────────────────────────────────────
    // GET /services — All roles (role-aware response)
    // MUST be declared before GET /services/:id
    // ─────────────────────────────────────────────────────────────────────
    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get all services — All roles (role-aware response)' })
    @ApiResponse({ status: 200, description: 'Paginated list of services' })
    findAll(
        @Query() query: QueryServiceDto,
        @CurrentUser() user: User,
    ): Promise<PaginatedServices> {
        return this.serviceService.findAll(query, user.role);
    }

    @Get('admin')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get all services — All roles (role-aware response)' })
    @ApiResponse({ status: 200, description: 'Paginated list of services' })
    findAllForAdmin(
        @Query() query: QueryServiceDto,
        @CurrentUser() user: User,
    ): Promise<PaginatedServices> {
        return this.serviceService.findAllForAdmin(query, user.role);
    }



    // ─────────────────────────────────────────────────────────────────────
    // PATCH /services/:id/toggle — Admin only
    // MUST be declared before PATCH /services/:id
    // else "toggle" is parsed as :id → ParseIntPipe throws 400
    // ─────────────────────────────────────────────────────────────────────
    @Patch(':id/toggle')
    @Roles(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Toggle service availability — Admin only' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, description: 'Availability toggled' })
    @ApiResponse({ status: 404, description: 'Service not found' })
    toggle(
        @Param('id', ParseIntPipe) id: number,
    ): Promise<{ message: string; status: number }> {
        return this.serviceService.toggleAvailability(id);
    }

    // ─────────────────────────────────────────────────────────────────────
    // GET /services/:id — All roles (role-aware response)
    // ─────────────────────────────────────────────────────────────────────
    @Get(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get service by ID — All roles (role-aware response)' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, description: 'Service details' })
    @ApiResponse({ status: 404, description: 'Service not found' })
    findOne(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser() user: User,
    ): Promise<ServiceResponseDto | ServiceStylistResponseDto> {
        return this.serviceService.findOne(id, user.role);
    }

    // ─────────────────────────────────────────────────────────────────────
    // PATCH /services/:id — Admin only
    // ─────────────────────────────────────────────────────────────────────
    @Patch(':id')
    @Roles(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Update service — Admin only' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, description: 'Service updated successfully' })
    @ApiResponse({ status: 400, description: 'Service or category is inactive' })
    @ApiResponse({ status: 404, description: 'Service or category not found' })
    @ApiResponse({ status: 409, description: 'Service name already exists' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateServiceDto,
    ): Promise<Service> {
        return this.serviceService.update(id, dto);
    }

    // ─────────────────────────────────────────────────────────────────────
    // DELETE /services/:id — Admin only (soft delete)
    // ─────────────────────────────────────────────────────────────────────
    @Delete(':id')
    @Roles(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Soft delete service — Admin only' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, description: 'Service deleted successfully' })
    @ApiResponse({ status: 404, description: 'Service not found' })
    @ApiResponse({ status: 409, description: 'Service already deleted' })
    remove(
        @Param('id', ParseIntPipe) id: number,
    ): Promise<{ message: string }> {
        return this.serviceService.remove(id);
    }
}