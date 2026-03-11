import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
    @ApiProperty({ example: 'admin@suratsalon.com' })
    @IsEmail({}, { message: 'Please provide a valid email address' })
    email!: string;

    @ApiProperty({ example: 'Admin@123' })
    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters' })
    password!: string;
}