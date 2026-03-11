import { ApiProperty } from '@nestjs/swagger';
import { AppointmentStatus } from 'src/common/enums';

export class ApptServiceItemDto {
    @ApiProperty() serviceId!: number;
    @ApiProperty() serviceName!: string;
    @ApiProperty() price!: number;
    @ApiProperty() durationMins!: number;
}

export class ApptCustomerDto {
    @ApiProperty() id!: number;
    @ApiProperty() customerCode!: string;
    @ApiProperty() name!: string;
    @ApiProperty() phone!: string;
}

export class ApptStylistUserDto {
    @ApiProperty() name!: string;
}

export class ApptStylistDto {
    @ApiProperty() id!: number;
    @ApiProperty() specialisation!: string;
    @ApiProperty({ type: () => ApptStylistUserDto }) user!: ApptStylistUserDto;
}

export class AppointmentResponseDto {
    @ApiProperty() id!: number;
    @ApiProperty() appointmentCode!: string;
    @ApiProperty() date!: string;
    @ApiProperty() startTime!: string;
    @ApiProperty() endTime!: string;
    @ApiProperty() totalDuration!: number;
    @ApiProperty() totalAmount!: number;
    @ApiProperty({ enum: AppointmentStatus }) status!: AppointmentStatus;
    @ApiProperty({ nullable: true }) notes!: string | null;
    @ApiProperty({ type: () => ApptCustomerDto }) customer!: ApptCustomerDto;
    @ApiProperty({ type: () => ApptStylistDto }) stylist!: ApptStylistDto;
    @ApiProperty({ type: () => [ApptServiceItemDto] }) services!: ApptServiceItemDto[];
    @ApiProperty() createdAt!: Date;
    @ApiProperty() updatedAt!: Date;
}
