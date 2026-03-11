import {
    IsInt,
    IsPositive,
    IsArray,
    IsDateString,
    IsString,
    IsOptional,
    MaxLength,
    Matches,
    ArrayMinSize,
    ArrayUnique,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAppointmentDto {
    @ApiProperty({ example: 1, description: 'Customer ID' })
    @IsInt()
    @IsPositive()
    customerId!: number;

    @ApiProperty({ example: 1, description: 'Stylist ID' })
    @IsInt()
    @IsPositive()
    stylistId!: number;

    @ApiProperty({ example: [1, 2], description: 'Service IDs — at least 1 required' })
    @IsArray()
    @ArrayMinSize(1)
    @ArrayUnique()
    @IsInt({ each: true })
    @IsPositive({ each: true })
    @Type(() => Number)
    serviceIds!: number[];

    @ApiProperty({ example: '2025-12-25', description: 'Appointment date (YYYY-MM-DD), cannot be in the past' })
    @IsDateString()
    date!: string;

    @ApiProperty({ example: '10:00', description: 'Start time in HH:MM format' })
    @IsString()
    @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
        message: 'startTime must be in HH:MM format (e.g. 09:30)',
    })
    startTime!: string;

    @ApiPropertyOptional({ example: 'Bride appointment, special care needed', maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    notes?: string;
}
