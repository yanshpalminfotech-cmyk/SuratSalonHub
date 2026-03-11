import {
    IsEnum,
    IsOptional,
    IsString,
    IsNumber,
    Min,
    Max,
    MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { StylistSpecialisation, StylistStatus } from 'src/common/enums';

export class UpdateStylistDto {
    @ApiPropertyOptional({ enum: StylistSpecialisation })
    @IsOptional()
    @IsEnum(StylistSpecialisation)
    specialisation?: StylistSpecialisation;

    @ApiPropertyOptional({ example: 30.00, description: '0.00 to 100.00' })
    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    @Max(100)
    commissionRate?: number;

    @ApiPropertyOptional({ example: 'Specialist in bridal makeup' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    bio?: string;

    @ApiPropertyOptional({ enum: StylistStatus })
    @IsOptional()
    @IsEnum(StylistStatus)
    status?: StylistStatus;
}