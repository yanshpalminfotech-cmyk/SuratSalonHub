import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToOne,
    OneToMany,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { StylistSpecialisation, StylistStatus } from 'src/common/enums/index';
import { StylistWorkingSchedule } from './stylist-working-schedule.entity';
import { StylistService } from './stylist-service.entity';


@Entity('stylists')
export class Stylist {
    @PrimaryGeneratedColumn({ unsigned: true })
    id!: number;

    @Index('idx_stylists_user_id')
    @OneToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: User;

    @Column({
        type: 'enum',
        enum: StylistSpecialisation,
        name: 'specialisation',
    })
    specialisation!: StylistSpecialisation;

    @Column({
        name: 'commission_rate',
        type: 'decimal',
        precision: 5,
        scale: 2,
        default: 0.00,
    })
    commissionRate!: number;                    // 0.00 – 100.00

    @Column({ type: 'text', nullable: true })
    bio!: string | null;

    @Index('idx_stylist_status')
    @Column({
        name: 'status',
        type: 'enum',
        enum: StylistStatus,
        default: StylistStatus.ACTIVE,
    })
    stylistStatus!: StylistStatus;

    @OneToMany(() => StylistWorkingSchedule, (schedule) => schedule.stylist, {
        cascade: true,
    })
    workingSchedules!: StylistWorkingSchedule[];

    @OneToMany(() => StylistService, (ss) => ss.stylist, {
        cascade: true,
    })
    stylistServices!: StylistService[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}