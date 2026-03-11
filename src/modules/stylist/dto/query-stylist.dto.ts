import { IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { StylistSpecialisation, StylistStatus } from 'src/common/enums';

export class QueryStylistDto {
    @ApiPropertyOptional({ enum: StylistStatus })
    @IsOptional()
    @IsEnum(StylistStatus)
    status?: StylistStatus;

    @ApiPropertyOptional({ enum: StylistSpecialisation })
    @IsOptional()
    @IsEnum(StylistSpecialisation)
    specialisation?: StylistSpecialisation;

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