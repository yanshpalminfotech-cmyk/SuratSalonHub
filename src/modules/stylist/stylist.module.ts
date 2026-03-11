import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StylistController } from './stylist.controller';
import { StylistsService } from './stylist.service';
import { Stylist } from './entities/stylist.entity';
import { StylistWorkingSchedule } from './entities/stylist-working-schedule.entity';
import { StylistService as StylistServiceEntity } from './entities/stylist-service.entity';
import { ServiceModule } from '../service/service.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Stylist,
      StylistWorkingSchedule,
      StylistServiceEntity,
    ]),
    forwardRef(() => ServiceModule),   // circular: ServiceModule ↔ StylistModule
    forwardRef(() => UserModule),      // circular: UserModule ↔ StylistModule
  ],
  controllers: [StylistController],
  providers: [StylistsService],
  exports: [StylistsService],        // exported → UserModule uses createProfileInTransaction()
})
export class StylistModule { }