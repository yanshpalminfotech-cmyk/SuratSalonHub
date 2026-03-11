import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Unique,
    Index,
} from 'typeorm';
import { Appointment } from './appointment.entity';
import { Service } from '../../service/entities/service.entity';

@Entity('appointment_services')
@Unique('uq_appt_service', ['appointment', 'service'])
export class AppointmentServiceEntity {
    @PrimaryGeneratedColumn({ unsigned: true })
    id!: number;

    @Index('idx_appt_svc_appointment_id')
    @ManyToOne(() => Appointment, (a) => a.appointmentServices, {
        nullable: false,
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'appointment_id' })
    appointment!: Appointment;

    @Index('idx_appt_svc_service_id')
    @ManyToOne(() => Service, {
        nullable: false,
        onDelete: 'RESTRICT',
    })
    @JoinColumn({ name: 'service_id' })
    service!: Service;

    // ── Snapshot fields — copied at booking time ──────────────────────────────
    @Column({ name: 'service_name', type: 'varchar', length: 100 })
    serviceName!: string;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    price!: number;

    @Column({ name: 'duration_mins', type: 'smallint', unsigned: true })
    durationMins!: number;
}
