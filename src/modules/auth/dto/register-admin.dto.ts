import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterAdminDto {
  @ApiProperty({ example: 'Super Admin' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'admin@suratsalon.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email!: string;

  @ApiProperty({ example: '9000000000' })
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
}