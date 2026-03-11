import {
    IsString,
    IsEmail,
    IsEnum,
    IsOptional,
    IsDateString,
    MaxLength,
    Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from 'src/common/enums';

export class CreateCustomerDto {
    @ApiProperty({ example: 'Priya Shah' })
    @IsString()
    @MaxLength(100)
    name!: string;

    @ApiProperty({ example: '9876543210', description: 'Indian mobile number' })
    @IsString()
    @Matches(/^[6-9]\d{9}$/, { message: 'Please provide a valid Indian mobile number' })
    phone!: string;

    @ApiPropertyOptional({ example: 'priya@example.com' })
    @IsOptional()
    @IsEmail({}, { message: 'Please provide a valid email address' })
    email?: string;

    @ApiPropertyOptional({ enum: Gender })
    @IsOptional()
    @IsEnum(Gender, { message: `gender must be one of: ${Object.values(Gender).join(', ')}` })
    gender?: Gender;

    @ApiPropertyOptional({ example: '1995-06-15', description: 'YYYY-MM-DD' })
    @IsOptional()
    @IsDateString({}, { message: 'dateOfBirth must be a valid ISO 8601 date string' })
    dateOfBirth?: string;

    @ApiPropertyOptional({ example: 'Allergic to certain hair dyes', maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    notes?: string;
}
