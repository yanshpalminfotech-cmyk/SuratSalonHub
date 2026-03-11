import {
    IsEmail,
    IsOptional,
    IsString,
    MaxLength,
    Matches,
    MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
    @ApiPropertyOptional({ example: 'Priya Shah' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    name?: string;

    @ApiPropertyOptional({ example: 'priya@suratsalon.com' })
    @IsOptional()
    @IsEmail({}, { message: 'Please provide a valid email' })
    email?: string;

    @ApiPropertyOptional({ example: '9876543210' })
    @IsOptional()
    @IsString()
    @Matches(/^[6-9]\d{9}$/, { message: 'Please provide a valid Indian mobile number' })
    phone?: string;

    @ApiProperty({ example: 'Admin@123' })
    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters' })
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
        message: 'Password must contain uppercase, lowercase, number and special character',
    })
    @IsOptional()
    password?: string;
}