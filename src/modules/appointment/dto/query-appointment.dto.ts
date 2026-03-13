import { IsOptional, IsInt, IsPositive, IsDateString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentStatus } from 'src/common/enums';

export class QueryAppointmentDto {
    @ApiPropertyOptional({ description: 'Filter by stylist ID' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    stylistId?: number;

    @ApiPropertyOptional({ description: 'Filter by customer ID' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    customerId?: number;

    @ApiPropertyOptional({ description: 'Filter by date (YYYY-MM-DD)' })
    @IsOptional()
    @IsDateString()
    date?: string;

    @ApiPropertyOptional({ enum: AppointmentStatus })
    @IsOptional()
    @IsEnum(AppointmentStatus)
    appointmentStatus?: AppointmentStatus;

    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    page?: number = 1;

    @ApiPropertyOptional({ default: 10, maximum: 50 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    limit?: number = 10;
}
