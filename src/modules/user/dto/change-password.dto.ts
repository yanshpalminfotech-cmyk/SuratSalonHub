import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
    @ApiProperty({ example: 'OldPass@123' })
    @IsString()
    currentPassword!: string;

    @ApiProperty({ example: 'NewPass@123' })
    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters' })
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
        message: 'Password must contain uppercase, lowercase, number and special character',
    })
    newPassword!: string;
}