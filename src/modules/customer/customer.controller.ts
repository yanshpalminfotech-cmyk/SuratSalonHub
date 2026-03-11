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
    ApiQuery,
    ApiResponse,
} from '@nestjs/swagger';
import { CustomerService, PaginatedCustomers } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { Customer } from './entities/customer.entity';
import { UserRole } from 'src/common/enums';
import { Roles } from 'src/common/decorator/roles.decorator';
import { JwtAuthGuard } from 'src/common/guard/auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomerController {
    constructor(private readonly customerService: CustomerService) { }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /customers/search — Quick lookup for appointment booking
    // ⚠ MUST be declared before GET /customers/:id
    // ─────────────────────────────────────────────────────────────────────────
    @Get('search')
    @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Quick customer search by name / phone / email — Admin + Receptionist' })
    @ApiQuery({ name: 'q', required: true, type: String, description: 'Search term' })
    @ApiResponse({ status: 200, description: 'List of matching customers (max 10)' })
    quickSearch(@Query('q') q: string): Promise<Customer[]> {
        return this.customerService.search(q ?? '');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /customers — Admin + Receptionist
    // ─────────────────────────────────────────────────────────────────────────
    @Post()
    @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new customer — Admin + Receptionist' })
    @ApiResponse({ status: 201, description: 'Customer created', type: Customer })
    @ApiResponse({ status: 409, description: 'Phone or email already registered' })
    create(@Body() dto: CreateCustomerDto): Promise<Customer> {
        return this.customerService.create(dto);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /customers — Admin + Receptionist (paginated)
    // ─────────────────────────────────────────────────────────────────────────
    @Get()
    @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get all customers with pagination — Admin + Receptionist' })
    @ApiResponse({ status: 200, description: 'Paginated customer list' })
    findAll(@Query() query: QueryCustomerDto): Promise<PaginatedCustomers> {
        return this.customerService.findAll(query);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /customers/:id — Admin + Receptionist
    // ─────────────────────────────────────────────────────────────────────────
    @Get(':id')
    @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get customer by ID — Admin + Receptionist' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, type: Customer })
    @ApiResponse({ status: 404, description: 'Customer not found or deleted' })
    findOne(@Param('id', ParseIntPipe) id: number): Promise<Customer> {
        return this.customerService.findOne(id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /customers/:id — Admin + Receptionist
    // ─────────────────────────────────────────────────────────────────────────
    @Patch(':id')
    @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Update customer — Admin + Receptionist' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, type: Customer })
    @ApiResponse({ status: 400, description: 'Customer is inactive' })
    @ApiResponse({ status: 409, description: 'Phone or email conflict' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateCustomerDto,
    ): Promise<Customer> {
        return this.customerService.update(id, dto);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE /customers/:id — Admin only
    // ─────────────────────────────────────────────────────────────────────────
    @Delete(':id')
    @Roles(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Soft delete customer (status=127) — Admin only' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, description: 'Customer soft deleted' })
    @ApiResponse({ status: 400, description: 'Scheduled appointments exist' })
    @ApiResponse({ status: 409, description: 'Customer already deleted' })
    remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
        return this.customerService.remove(id);
    }
}
