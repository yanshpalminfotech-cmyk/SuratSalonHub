import {
    IsString,
    IsEnum,
    IsInt,
    IsPositive,
    IsNumber,
    IsOptional,
    MaxLength,
    Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from 'src/common/enums/gender.enum';


export class CreateServiceDto {
    @ApiProperty({ example: 'Hair Color' })
    @IsString()
    @MaxLength(100)
    name!: string;

    @ApiProperty({ example: 1, description: 'Category ID' })
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    categoryId!: number;

    @ApiProperty({ example: 90, description: 'Duration in minutes' })
    @Type(() => Number)
    @IsInt()
    @Min(5, { message: 'Duration must be at least 5 minutes' })
    durationMins!: number;

    @ApiProperty({ example: 2000.00 })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive({ message: 'Price must be greater than 0' })
    price!: number;

    @ApiProperty({ enum: Gender, example: Gender.UNISEX })
    @IsEnum(Gender)
    gender!: Gender;

    @ApiPropertyOptional({ example: 'Full hair color with ammonia-free dye' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;
}