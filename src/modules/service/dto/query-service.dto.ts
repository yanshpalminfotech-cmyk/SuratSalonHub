import {
    IsEnum,
    IsOptional,
    IsInt,
    IsBoolean,
    IsString,
    Min,
    Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from 'src/common/enums/gender.enum';


export class QueryServiceDto {
    @ApiPropertyOptional({ description: 'Filter by category ID' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    categoryId?: number;

    @ApiPropertyOptional({ enum: Gender })
    @IsOptional()
    @IsEnum(Gender)
    gender?: Gender;

    @ApiPropertyOptional({ description: 'true = active only, false = inactive only' })
    @IsOptional()
    @Transform(({ value }) => value === 'true')
    @IsBoolean()
    isAvailable?: boolean;

    @ApiPropertyOptional({ description: 'Search by service name' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 10 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(50)
    limit?: number = 10;
}