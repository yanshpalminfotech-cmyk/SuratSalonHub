import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Index,
    Unique,
} from 'typeorm';
import { Stylist } from './stylist.entity';
import { DayOfWeek } from 'src/common/enums/index';

@Entity('stylist_working_schedules')
@Unique('uq_stylist_day', ['stylist', 'dayOfWeek'])   // one record per stylist per day
export class StylistWorkingSchedule {
    @PrimaryGeneratedColumn({ unsigned: true })
    id!: number;

    @Index('idx_schedule_stylist_id')
    @ManyToOne(() => Stylist, (stylist) => stylist.workingSchedules, {
        nullable: false,
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'stylist_id' })
    stylist!: Stylist;

    @Column({ name: 'day_of_week', type: 'enum', enum: DayOfWeek })
    dayOfWeek!: DayOfWeek;

    @Column({ name: 'is_working', type: 'boolean', default: false })
    isWorking!: boolean;

    @Column({ name: 'start_time', type: 'time', nullable: true })
    startTime!: string | null;              // '09:00:00'

    @Column({ name: 'end_time', type: 'time', nullable: true })
    endTime!: string | null;               // '18:00:00'
}