import { Exclude, Expose, Type } from 'class-transformer';
import { StylistSpecialisation, StylistStatus } from 'src/common/enums';

// ── User shape inside stylist response ───────────────────────────────────────

// Admin sees full user details
export class UserInStylistAdminDto {
    @Expose()
    id!: number;
    @Expose()
    name!: string;
    @Expose()
    email!: string;
    @Expose()
    phone!: string;
}

// Others see name only
export class UserInStylistDto {
    @Expose()
    id!: number;
    @Expose()
    name!: string;
}
@Exclude()
export class StylistAdminResponseDto {
    @Expose() id!: number;
    @Expose() specialisation!: StylistSpecialisation;
    @Expose() commissionRate!: number;
    @Expose() bio!: string | null;
    @Expose() stylistStatus!: StylistStatus;   // Active / On Leave
    @Expose() status!: number;           // 0=Inactive, 1=Active, 127=Deleted
    @Expose() createdAt!: Date;
    @Expose() updatedAt!: Date;

    @Expose()
    @Type(() => UserInStylistAdminDto)
    user!: UserInStylistAdminDto;
}

// ── Receptionist + Stylist — no commissionRate, no email/phone ───────────────
@Exclude()
export class StylistResponseDto {
    @Expose() id!: number;
    @Expose() specialisation!: StylistSpecialisation;
    @Expose() bio!: string | null;
    @Expose() stylistStatus!: StylistStatus;   // Active / On Leave
    @Expose()
    @Type(() => UserInStylistDto)
    user!: UserInStylistDto;
}