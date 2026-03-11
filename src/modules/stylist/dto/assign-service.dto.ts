import {
    IsArray,
    IsInt,
    IsPositive,
    ArrayUnique,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class AssignServicesDto {
    @ApiProperty({
        example: [1, 3, 5],
        description: 'List of service IDs to assign. Empty array removes all.',
        type: [Number],
    })
    @IsArray()
    @IsInt({ each: true })
    @IsPositive({ each: true })
    @ArrayUnique({ message: 'Duplicate service IDs are not allowed' })
    @Type(() => Number)
    serviceIds!: number[];
}