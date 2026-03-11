import { IsOptional, IsInt, IsPositive, IsEnum, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, PaymentStatus } from 'src/common/enums';

export class QueryPaymentDto {
    @ApiPropertyOptional({ description: 'Filter by appointment ID' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    appointmentId?: number;

    @ApiPropertyOptional({ enum: PaymentStatus })
    @IsOptional()
    @IsEnum(PaymentStatus)
    paymentStatus?: PaymentStatus;

    @ApiPropertyOptional({ enum: PaymentMethod })
    @IsOptional()
    @IsEnum(PaymentMethod)
    paymentMethod?: PaymentMethod;

    @ApiPropertyOptional({ description: 'Filter by stylist ID (via appointment)' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    stylistId?: number;

    @ApiPropertyOptional({ description: 'From paid_at date (YYYY-MM-DD)' })
    @IsOptional()
    @IsDateString()
    fromDate?: string;

    @ApiPropertyOptional({ description: 'To paid_at date (YYYY-MM-DD)' })
    @IsOptional()
    @IsDateString()
    toDate?: string;

    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 10, maximum: 50 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(50)
    limit?: number = 10;
}
