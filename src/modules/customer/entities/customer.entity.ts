import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    OneToMany,
} from 'typeorm';
import { Gender } from 'src/common/enums';
import { STATUS } from 'src/common/constant/constant';
import { Appointment } from 'src/modules/appointment/entities/appointment.entity';

@Entity('customers')
@Index('idx_customers_phone', ['phone'])
@Index('idx_customers_status', ['status'])
export class Customer {
    @PrimaryGeneratedColumn({ unsigned: true })
    id!: number;

    @Column({ name: 'customer_code', type: 'varchar', length: 20, unique: true })
    customerCode!: string;                              // CUST-2025-001

    @Column({ type: 'varchar', length: 100 })
    name!: string;

    @Column({ type: 'varchar', length: 100, unique: true, nullable: true, default: null })
    email!: string | null;

    @Column({ type: 'varchar', length: 15, unique: true })
    phone!: string;

    @Column({ type: 'enum', enum: Gender, nullable: true, default: null })
    gender!: Gender | null;

    @Column({ name: 'date_of_birth', type: 'date', nullable: true, default: null })
    dateOfBirth!: string | null;

    @Column({ type: 'text', nullable: true, default: null })
    notes!: string | null;

    @Column({ type: 'tinyint', default: STATUS.ACTIVE })
    status!: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;

    @OneToMany(() => Appointment, (appointment) => appointment.customer)
    appointments!: Appointment[];
}
