import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';
import { AppointmentModule } from '../appointment/appointment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    AppointmentModule,    // AppointmentService.findOneOrFail() + totalAmount access
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],    // ReportModule will use PaymentService later
})
export class PaymentModule { }
