import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRefundDto {
    @ApiPropertyOptional({ maxLength: 500, description: 'Reason for refund' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    notes?: string;

    @ApiPropertyOptional({ maxLength: 100, description: 'Refund transaction reference' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    transactionRef?: string;
}
