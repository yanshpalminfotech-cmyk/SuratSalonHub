import {
    IsEmail,
    IsEnum,
    IsString,
    IsOptional,
    IsNumber,
    MinLength,
    MaxLength,
    Matches,
    Min,
    Max,
    ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, StylistSpecialisation } from 'src/common/enums';

export class CreateUserDto {
    @ApiProperty({ example: 'Priya Shah' })
    @IsString()
    @MaxLength(100)
    name!: string;

    @ApiProperty({ example: 'priya@suratsalon.com' })
    @IsEmail({}, { message: 'Please provide a valid email' })
    email!: string;

    @ApiProperty({ example: '9876543210' })
    @IsString()
    @Matches(/^[6-9]\d{9}$/, { message: 'Please provide a valid Indian mobile number' })
    phone!: string;

    @ApiProperty({ example: 'Admin@123' })
    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters' })
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
        message: 'Password must contain uppercase, lowercase, number and special character',
    })
    password!: string;

    @ApiProperty({ enum: UserRole, example: UserRole.STYLIST })
    @IsEnum(UserRole, { message: `Role must be one of: ${Object.values(UserRole).join(', ')}` })
    role!: UserRole;

    // ── Stylist-only fields — required when role = Stylist ────────────────────
    @ApiPropertyOptional({ enum: StylistSpecialisation })
    @ValidateIf((o) => o.role === UserRole.STYLIST)
    @IsEnum(StylistSpecialisation, {
        message: 'specialisation is required and must be valid when role is Stylist',
    })
    specialisation?: StylistSpecialisation;

    @ApiPropertyOptional({ example: 30.00, description: '0.00 to 100.00' })
    @ValidateIf((o) => o.role === UserRole.STYLIST)
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 }, {
        message: 'commissionRate is required when role is Stylist',
    })
    @Min(0)
    @Max(100)
    commissionRate?: number;
}