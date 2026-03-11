import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from 'src/common/enums';

export class UpdateCollectDto {
    @ApiProperty({ enum: PaymentMethod, description: 'Payment method at collection time' })
    @IsEnum(PaymentMethod)
    paymentMethod!: PaymentMethod;

    @ApiPropertyOptional({ maxLength: 100 })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    transactionRef?: string;

    @ApiPropertyOptional({ maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    notes?: string;
}
