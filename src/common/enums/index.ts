export enum StylistSpecialisation {
    HAIR_STYLIST = 'Hair Stylist',
    BEAUTICIAN = 'Beautician',
    MAKEUP_ARTIST = 'Makeup Artist',
    SPA_THERAPIST = 'Spa Therapist',
}

export enum StylistStatus {
    ACTIVE = 'Active',
    ON_LEAVE = 'On Leave',
}

export enum DayOfWeek {
    MONDAY = 'Monday',
    TUESDAY = 'Tuesday',
    WEDNESDAY = 'Wednesday',
    THURSDAY = 'Thursday',
    FRIDAY = 'Friday',
    SATURDAY = 'Saturday',
    SUNDAY = 'Sunday',
}
export enum Gender {
    UNISEX = 'Unisex',
    Male = 'Male',
    FEMALE = 'Female'
}

export enum UserRole {
    ADMIN = 'Admin',
    STYLIST = 'Stylist',
    RECEPTIONIST = 'Receptionist'
}

export enum SlotStatus {
    AVAILABLE = 'Available',
    BOOKED    = 'Booked',
}

export enum AppointmentStatus {
    SCHEDULED  = 'Scheduled',
    COMPLETED  = 'Completed',
    CANCELLED  = 'Cancelled',
    NO_SHOW    = 'No-Show',
}

export enum PaymentMethod {
    CASH  = 'Cash',
    CARD  = 'Card',
    UPI   = 'UPI',
    OTHER = 'Other',
}

export enum PaymentStatus {
    PENDING  = 'Pending',
    PAID     = 'Paid',
    REFUNDED = 'Refunded',
}
