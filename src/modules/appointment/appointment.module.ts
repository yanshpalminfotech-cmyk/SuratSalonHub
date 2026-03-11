import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';
import { Appointment } from './entities/appointment.entity';
import { AppointmentServiceEntity } from './entities/appointment-service.entity';
import { StylistService as StylistServiceJunction } from '../stylist/entities/stylist-service.entity';
import { CustomerModule } from '../customer/customer.module';
import { StylistModule } from '../stylist/stylist.module';
import { ServiceModule } from '../service/service.module';
import { TimeSlotModule } from '../time-slot/time-slot.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      AppointmentServiceEntity,
      StylistServiceJunction,   // needed to query stylist ↔ service assignments
    ]),
    CustomerModule,             // CustomerService.findOneOrFail()
    StylistModule,              // StylistsService.findOneOrFail()
    ServiceModule,              // ServiceService.findByIds()
    TimeSlotModule,             // TimeSlotService.bookSlots() + releaseSlots()
  ],
  controllers: [AppointmentController],
  providers: [AppointmentService],
  exports: [AppointmentService],  // PaymentModule will use AppointmentService later
})
export class AppointmentModule { }
