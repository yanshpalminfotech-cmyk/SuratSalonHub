import { IsInt, IsPositive, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from 'src/common/enums';

export class CreatePaymentDto {
    @ApiProperty({ example: 1, description: 'Appointment ID to create payment for' })
    @IsInt()
    @IsPositive()
    appointmentId!: number;

    @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
    @IsEnum(PaymentMethod)
    paymentMethod!: PaymentMethod;

    @ApiPropertyOptional({ example: 'TXN123456', maxLength: 100, description: 'UPI/Card reference number' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    transactionRef?: string;

    @ApiPropertyOptional({ example: 'Paid at front desk', maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    notes?: string;
}
