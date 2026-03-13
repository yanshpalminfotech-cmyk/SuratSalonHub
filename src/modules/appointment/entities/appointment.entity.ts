import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';
import { Customer } from '../../customer/entities/customer.entity';
import { Stylist } from '../../stylist/entities/stylist.entity';
import { AppointmentStatus } from 'src/common/enums';
import { AppointmentServiceEntity } from './appointment-service.entity';

@Entity('appointments')
@Index('idx_appt_customer_id', ['customer'])
@Index('idx_appt_stylist_id', ['stylist'])
@Index('idx_appt_date', ['date'])
@Index('idx_appt_status', ['appointmentStatus'])
export class Appointment {
    @PrimaryGeneratedColumn({ unsigned: true })
    id!: number;

    @Column({ name: 'appointment_code', type: 'varchar', length: 20, unique: true })
    appointmentCode!: string;              // APT-2025-001

    @ManyToOne(() => Customer, {
        nullable: false,
        onDelete: 'RESTRICT',
    })
    @JoinColumn({ name: 'customer_id' })
    customer!: Customer;

    @ManyToOne(() => Stylist, {
        nullable: false,
        onDelete: 'RESTRICT',
    })
    @JoinColumn({ name: 'stylist_id' })
    stylist!: Stylist;

    @Column({ type: 'date' })
    date!: string;                         // 'YYYY-MM-DD'

    @Column({ name: 'start_time', type: 'time' })
    startTime!: string;                    // 'HH:MM:SS'

    @Column({ name: 'end_time', type: 'time' })
    endTime!: string;                      // 'HH:MM:SS'

    @Column({ name: 'total_duration', type: 'smallint', unsigned: true })
    totalDuration!: number;                // total minutes

    @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
    totalAmount!: number;                  // snapshot sum of prices

    @Column({ name: 'appointment_status', type: 'enum', enum: AppointmentStatus, default: AppointmentStatus.SCHEDULED })
    appointmentStatus!: AppointmentStatus;

    @Column({ type: 'tinyint', default: 1, comment: '1 for active, 0 for inactive, 127 for deleted' })
    status!: number;

    @Column({ type: 'text', nullable: true, default: null })
    notes!: string | null;

    @OneToMany(() => AppointmentServiceEntity, (as) => as.appointment, { cascade: true })
    appointmentServices!: AppointmentServiceEntity[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
