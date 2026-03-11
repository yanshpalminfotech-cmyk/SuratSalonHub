import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
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
import { ServiceCategoryService } from './service-category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ServiceCategory } from './entities/service-category.entity';
import { UserRole } from 'src/common/enums/roles.enum';
import { Roles } from 'src/common/decorator/roles.decorator';
import { JwtAuthGuard } from 'src/common/guard/auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { STATUS } from 'src/common/constant/constant';

@ApiTags('Service Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('service-categories')
export class ServiceCategoryController {
    constructor(
        private readonly serviceCategoryService: ServiceCategoryService,
    ) { }

    // ─────────────────────────────────────────────────────────────────────
    // POST /service-categories — Admin only
    // ─────────────────────────────────────────────────────────────────────
    @Post()
    @Roles(UserRole.ADMIN)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create service category — Admin only' })
    @ApiResponse({ status: 201, description: 'Category created successfully' })
    @ApiResponse({ status: 409, description: 'Category name already exists' })
    create(
        @Body() dto: CreateCategoryDto,
    ): Promise<ServiceCategory> {
        return this.serviceCategoryService.create(dto);
    }

    // ─────────────────────────────────────────────────────────────────────
    // GET /service-categories — All roles
    // ─────────────────────────────────────────────────────────────────────
    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get all active categories — All roles' })
    @ApiResponse({ status: 200, description: 'List of categories' })
    findAll(): Promise<ServiceCategory[]> {
        return this.serviceCategoryService.findAll(STATUS.ACTIVE);
    }

    @Roles(UserRole.ADMIN)
    @Get('admin')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get all categories — Admin' })
    @ApiResponse({ status: 200, description: 'List of categories' })
    findAllForAdmin(): Promise<ServiceCategory[]> {
        return this.serviceCategoryService.findAll();
    }


    // ─────────────────────────────────────────────────────────────────────
    // PATCH /service-categories/:id — Admin only
    // ─────────────────────────────────────────────────────────────────────
    @Patch(':id')
    @Roles(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Update category name — Admin only' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, description: 'Category updated successfully' })
    @ApiResponse({ status: 404, description: 'Category not found' })
    @ApiResponse({ status: 409, description: 'Category name already exists' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateCategoryDto,
    ): Promise<ServiceCategory> {
        return this.serviceCategoryService.update(id, dto);
    }

    // ─────────────────────────────────────────────────────────────────────
    // DELETE /service-categories/:id — Admin only (soft delete)
    // ─────────────────────────────────────────────────────────────────────
    @Delete(':id')
    @Roles(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Delete category — Admin only' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, description: 'Category deleted successfully' })
    @ApiResponse({ status: 400, description: 'Active services exist under category' })
    @ApiResponse({ status: 404, description: 'Category not found' })
    remove(
        @Param('id', ParseIntPipe) id: number,
    ): Promise<{ message: string }> {
        return this.serviceCategoryService.remove(id);
    }
}