import { Module } from '@nestjs/common';
import { ServiceService } from './service.service';
import { Service } from './entities/service.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceCategoryService } from '../service-category/service-category.service';
import { ServiceCategoryModule } from '../service-category/service-category.module';
import { ServiceController } from './service.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Service]), ServiceCategoryModule],
  providers: [ServiceService],
  exports: [ServiceService],
  controllers: [ServiceController]
})
export class ServiceModule { }
