import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';
import { Appointment } from '../../appointment/entities/appointment.entity';
import { PaymentMethod, PaymentStatus } from 'src/common/enums';

@Entity('payments')
@Index('idx_payment_status', ['paymentStatus'])
@Index('idx_payment_paid_at', ['paidAt'])
export class Payment {
    @PrimaryGeneratedColumn({ unsigned: true })
    id!: number;

    // UNIQUE — one payment per appointment (DB-level guard)
    @Index('idx_payment_appointment_id')
    @OneToOne(() => Appointment, { nullable: false, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'appointment_id' })
    appointment!: Appointment;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    amount!: number;                                // always from appointment.totalAmount

    @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod })
    paymentMethod!: PaymentMethod;

    @Column({ name: 'payment_status', type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
    paymentStatus!: PaymentStatus;

    @Column({ name: 'transaction_ref', type: 'varchar', length: 100, nullable: true, default: null })
    transactionRef!: string | null;                 // UPI txn ID / card ref

    @Column({ type: 'text', nullable: true, default: null })
    notes!: string | null;

    @Column({ name: 'paid_at', type: 'timestamp', nullable: true, default: null })
    paidAt!: Date | null;                           // set server-side when status → Paid

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
