import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { TimeSlotService } from './time-slot.service';
import { TimeSlot } from './entities/time-slot.entity';
import { StylistModule } from '../stylist/stylist.module';
import { Stylist } from '../stylist/entities/stylist.entity';
import { StylistWorkingSchedule } from '../stylist/entities/stylist-working-schedule.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TimeSlot, Stylist, StylistWorkingSchedule]),
    ScheduleModule.forRoot(),
    StylistModule,              // one-way: TimeSlot → Stylist (no circular dep)
  ],
  providers: [TimeSlotService],
  exports: [TimeSlotService],  // AppointmentModule uses bookSlots + releaseSlots
})
export class TimeSlotModule { }
