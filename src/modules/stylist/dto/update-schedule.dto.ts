import {
    IsEnum,
    IsBoolean,
    IsOptional,
    IsString,
    Matches,
    ValidateIf,
    ValidateNested,
    ArrayMinSize,
    ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { DayOfWeek } from 'src/common/enums';

export class ScheduleDayDto {
    @ApiProperty({ enum: DayOfWeek })
    @IsEnum(DayOfWeek)
    dayOfWeek!: DayOfWeek;

    @ApiProperty({ example: true })
    @IsBoolean()
    isWorking!: boolean;

    // required only when isWorking = true
    @ApiProperty({ example: '09:00', required: false })
    @ValidateIf((o) => o.isWorking === true)
    @IsString()
    @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
        message: 'startTime must be in HH:MM format',
    })
    startTime?: string | null;

    @ApiProperty({ example: '18:00', required: false })
    @ValidateIf((o) => o.isWorking === true)
    @IsString()
    @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
        message: 'endTime must be in HH:MM format',
    })
    endTime?: string | null;
}

export class UpdateScheduleDto {
    @ApiProperty({ type: [ScheduleDayDto], description: 'Exactly 7 days required' })
    @ValidateNested({ each: true })
    @Type(() => ScheduleDayDto)
    @ArrayMinSize(7, { message: 'All 7 days must be provided' })
    @ArrayMaxSize(7, { message: 'Exactly 7 days must be provided' })
    schedule!: ScheduleDayDto[];
}