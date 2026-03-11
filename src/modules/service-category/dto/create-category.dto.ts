import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
    @ApiProperty({ example: 'Hair' })
    @IsString()
    @MinLength(2, { message: 'Category name must be at least 2 characters' })
    @MaxLength(50, { message: 'Category name must not exceed 50 characters' })
    name!: string;
}