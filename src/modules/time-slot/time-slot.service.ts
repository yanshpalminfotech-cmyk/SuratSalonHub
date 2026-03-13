import {
    Injectable,
    Logger,
    ConflictException,
    OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { TimeSlot } from './entities/time-slot.entity';
import { Stylist } from '../stylist/entities/stylist.entity';
import { StylistWorkingSchedule } from '../stylist/entities/stylist-working-schedule.entity';
import { SlotStatus, StylistStatus, DayOfWeek } from 'src/common/enums';

// ─── Time helpers ─────────────────────────────────────────────────────────────
function timeToMins(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}

function minsToTime(mins: number): string {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
}

// Map JS Date.getDay() → DayOfWeek enum
const JS_DAY_TO_ENUM: DayOfWeek[] = [
    DayOfWeek.SUNDAY,
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
    DayOfWeek.SATURDAY,
];

const SLOT_DURATION_MINS = 15;

@Injectable()
export class TimeSlotService implements OnApplicationBootstrap {
    private readonly logger = new Logger(TimeSlotService.name);

    constructor(
        @InjectRepository(TimeSlot)
        private readonly slotRepo: Repository<TimeSlot>,

        @InjectRepository(Stylist)
        private readonly stylistRepo: Repository<Stylist>,

        @InjectRepository(StylistWorkingSchedule)
        private readonly scheduleRepo: Repository<StylistWorkingSchedule>,

        private readonly dataSource: DataSource,
    ) { }

    // ─────────────────────────────────────────────────────────────────────────
    // BOOTSTRAP — generate upcoming slots once on server start (idempotent)
    // ─────────────────────────────────────────────────────────────────────────
    async onApplicationBootstrap(): Promise<void> {
        try {
            await this.generateUpcomingSlots();
        } catch (err) {
            this.logger.error('Bootstrap slot generation failed — server startup continues', err);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CRON — every day at 23:30, add one more day to the rolling window
    // ─────────────────────────────────────────────────────────────────────────
    @Cron('30 11 * * *')
    async generateDailySlots(): Promise<void> {
        const target = new Date();
        target.setDate(target.getDate() + 7);
        const dateStr = this.toDateString(target);
        this.logger.log(`Cron: generating slots for ${dateStr}`);
        await this.generateSlotsForDate(dateStr);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC — today + next 7 days (8 days total)
    // ─────────────────────────────────────────────────────────────────────────
    async generateUpcomingSlots(): Promise<void> {
        for (let i = 0; i <= 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            await this.generateSlotsForDate(this.toDateString(d));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC — generate slots for ALL active stylists on one specific date
    // ─────────────────────────────────────────────────────────────────────────
    async generateSlotsForDate(date: string): Promise<void> {

        const dayEnum = this.dateToDayOfWeek(date);

        const stylists = await this.stylistRepo.find({
            where: { stylistStatus: StylistStatus.ACTIVE },
            relations: ['workingSchedules'],
        });

        let count = 0;
        for (const stylist of stylists) {
            const schedule = stylist.workingSchedules.find(
                (s) => s.dayOfWeek === dayEnum,
            );
            if (!schedule) continue;

            await this.generateSlotsForStylist(stylist.id, date, schedule);
            count++;
        }

        this.logger.log(`Slots generated for date: ${date} | stylists processed: ${count}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC — get all AVAILABLE slots for a stylist on a date
    // ─────────────────────────────────────────────────────────────────────────
    async getAvailableSlots(stylistId: number, date: string): Promise<TimeSlot[]> {
        return this.slotRepo.find({
            where: {
                stylist: { id: stylistId },
                date,
                status: SlotStatus.AVAILABLE,
            },
            order: { startTime: 'ASC' },
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC — find valid start times for consecutive available slots
    // ─────────────────────────────────────────────────────────────────────────
    async getConsecutiveSlots(
        stylistId: number,
        date: string,
        totalDurationMins: number,
    ): Promise<string[]> {
        const slotsNeeded = Math.ceil(totalDurationMins / SLOT_DURATION_MINS);

        const slots = await this.slotRepo.find({
            where: {
                stylist: { id: stylistId },
                date,
                status: SlotStatus.AVAILABLE,
            },
            order: { startTime: 'ASC' },
        });

        if (slots.length < slotsNeeded) return [];

        const validStartTimes: string[] = [];

        // sliding window
        for (let i = 0; i <= slots.length - slotsNeeded; i++) {
            const window = slots.slice(i, i + slotsNeeded);
            if (this.areConsecutive(window)) {
                validStartTimes.push(window[0].startTime.substring(0, 5)); // HH:MM
            }
        }

        return validStartTimes;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC — book slots inside an existing transaction (pessimistic lock)
    // ─────────────────────────────────────────────────────────────────────────
    async bookSlots(
        stylistId: number,
        date: string,
        startTime: string,             // HH:MM
        totalDurationMins: number,
        appointmentId: number,
        manager: EntityManager,
    ): Promise<TimeSlot[]> {
        const slotsNeeded = Math.ceil(totalDurationMins / SLOT_DURATION_MINS);

        const gridDurationMins = slotsNeeded * SLOT_DURATION_MINS;
        const endTime = minsToTime(timeToMins(startTime) + gridDurationMins);

        // SELECT ... FOR UPDATE — pessimistic row lock
        const slots = await manager
            .createQueryBuilder(TimeSlot, 'slot')
            .setLock('pessimistic_write')
            .where('slot.stylist_id = :stylistId', { stylistId })
            .andWhere('slot.date = :date', { date })
            .andWhere('slot.start_time >= :startTime', { startTime })
            .andWhere('slot.end_time <= :endTime', { endTime })
            .orderBy('slot.start_time', 'ASC')
            .getMany();

        if (
            slots.length !== slotsNeeded ||
            slots.some((s) => s.status !== SlotStatus.AVAILABLE)
        ) {
            throw new ConflictException(
                'Selected time slot is no longer available. Please choose another time.',
            );
        }

        // Mark all selected slots as BOOKED
        await manager
            .createQueryBuilder()
            .update(TimeSlot)
            .set({ status: SlotStatus.BOOKED, appointmentId })
            .whereInIds(slots.map((s) => s.id))
            .execute();

        this.logger.log(
            `Slots booked for stylist #${stylistId} on ${date} ` +
            `${startTime}–${endTime} | appointment #${appointmentId}`,
        );

        return slots;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC — release slots on appointment cancellation (inside transaction)
    // ─────────────────────────────────────────────────────────────────────────
    async releaseSlots(appointmentId: number, manager: EntityManager): Promise<void> {
        await manager
            .createQueryBuilder()
            .update(TimeSlot)
            .set({ status: SlotStatus.AVAILABLE, appointmentId: null })
            .where('appointment_id = :appointmentId', { appointmentId })
            .execute();

        this.logger.log(`Slots released for appointment #${appointmentId}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE — generate 15-min slots for ONE stylist on ONE date (idempotent)
    // ─────────────────────────────────────────────────────────────────────────
    private async generateSlotsForStylist(
        stylistId: number,
        date: string,
        schedule: StylistWorkingSchedule,
    ): Promise<void> {
        if (!schedule.isWorking || !schedule.startTime || !schedule.endTime) {
            return; // day off — skip
        }

        const startMins = timeToMins(schedule.startTime);
        const endMins = timeToMins(schedule.endTime);

        const slots: Partial<TimeSlot>[] = [];

        for (
            let current = startMins;
            current + SLOT_DURATION_MINS <= endMins;
            current += SLOT_DURATION_MINS
        ) {
            slots.push({
                stylist: { id: stylistId } as Stylist,
                date,
                startTime: minsToTime(current),
                endTime: minsToTime(current + SLOT_DURATION_MINS),
                status: SlotStatus.AVAILABLE,
            });
        }

        if (slots.length === 0) return;


        await this.dataSource
            .createQueryBuilder()
            .insert()
            .into(TimeSlot)
            .values(slots)
            .updateEntity(false)  // ← CRITICAL: skip post-insert entity sync
            .orIgnore()           // ON DUPLICATE KEY UPDATE — does nothing
            .execute();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE HELPERS
    // ─────────────────────────────────────────────────────────────────────────
    private toDateString(d: Date): string {
        // Local date in YYYY-MM-DD (avoid UTC shift from toISOString())
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    private dateToDayOfWeek(dateStr: string): DayOfWeek {
        const [y, m, d] = dateStr.split('-').map(Number);
        const jsDay = new Date(y, m - 1, d).getDay();  // 0=Sun, 1=Mon, ...
        return JS_DAY_TO_ENUM[jsDay];
    }

    private areConsecutive(slots: TimeSlot[]): boolean {
        for (let i = 0; i < slots.length - 1; i++) {
            const currentEndMins = timeToMins(slots[i].endTime.substring(0, 5));
            const nextStartMins = timeToMins(slots[i + 1].startTime.substring(0, 5));
            if (currentEndMins !== nextStartMins) return false;
        }
        return true;
    }
}
