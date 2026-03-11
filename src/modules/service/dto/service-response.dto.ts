import { Exclude, Expose, Type } from 'class-transformer';
import { Gender } from 'src/common/enums/gender.enum';


// ── Category shape inside service response ────────────────────────────────────
export class CategoryInServiceDto {
    @Expose()
    id!: number;
    @Expose()
    name!: string;
}

// ── Admin + Receptionist — full data including price ──────────────────────────
@Exclude()
export class ServiceResponseDto {
    @Expose()
    id!: number;
    @Expose()
    serviceCode!: string;
    @Expose()
    name!: string;
    @Expose()
    durationMins!: number;
    @Expose()
    price!: number;
    @Expose()
    gender!: Gender;
    @Expose()
    description!: string | null;
    @Expose()
    status!: number;

    @Expose()
    @Type(() => CategoryInServiceDto)
    category!: CategoryInServiceDto;

    @Expose() createdAt!: Date;
    @Expose() updatedAt!: Date;
}

// ── Stylist — NO price field ──────────────────────────────────────────────────
@Exclude()
export class ServiceStylistResponseDto {
    @Expose()
    id!: number;
    @Expose()
    serviceCode!: string;
    @Expose()
    name!: string;
    @Expose()
    durationMins!: number;
    @Expose()
    gender!: Gender;
    @Expose()
    description!: string | null;
    @Expose()
    status!: number;

    @Expose()
    @Type(() => CategoryInServiceDto)
    category!: CategoryInServiceDto;
}