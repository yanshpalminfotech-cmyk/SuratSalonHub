import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    Unique,
} from 'typeorm';
import { Stylist } from '../../stylist/entities/stylist.entity';
import { SlotStatus } from 'src/common/enums';

@Entity('time_slots')
@Unique('uq_stylist_date_start', ['stylist', 'date', 'startTime'])  // DB-level double-booking guard
@Index('idx_slots_stylist_id', ['stylist'])
@Index('idx_slots_date', ['date'])
@Index('idx_slots_status', ['status'])
@Index('idx_slots_appointment_id', ['appointmentId'])
export class TimeSlot {
    @PrimaryGeneratedColumn({ unsigned: true })
    id!: number;

    @ManyToOne(() => Stylist, {
        nullable: false,
        onDelete: 'RESTRICT',
    })
    @JoinColumn({ name: 'stylist_id' })
    stylist!: Stylist;

    // NULL = available, filled = booked by that appointment
    @Column({ name: 'appointment_id', type: 'int', unsigned: true, nullable: true, default: null })
    appointmentId!: number | null;

    @Column({ type: 'date' })
    date!: string;                          // 'YYYY-MM-DD'

    @Column({ name: 'start_time', type: 'time' })
    startTime!: string;                     // '09:00:00'

    @Column({ name: 'end_time', type: 'time' })
    endTime!: string;                       // '09:15:00'

    @Column({ type: 'enum', enum: SlotStatus, default: SlotStatus.AVAILABLE })
    status!: SlotStatus;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
