import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './config/database.config';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { RedisModule } from './modules/redis/redis.module';
import configuration from './config/configuration';
import { ServiceCategoryModule } from './modules/service-category/service-category.module';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { HttpExceptionFilter } from './common/interceptor/http-exception.interceptor';
import { LoggingInterceptor } from './common/interceptor/logging.interceptor';
import { ResponseInterceptor } from './common/interceptor/response.interceptor';
import { AppService } from './app.service';
import { JwtModule } from '@nestjs/jwt';
import { ServiceModule } from './modules/service/service.module';
import { StylistModule } from './modules/stylist/stylist.module';
import { CustomerModule } from './modules/customer/customer.module';
import { TimeSlotModule } from './modules/time-slot/time-slot.module';
import { AppointmentModule } from './modules/appointment/appointment.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ReportModule } from './modules/report/report.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration]
    }),
    TypeOrmModule.forRootAsync(databaseConfig),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Even though you pass secrets in signAsync, 
        // the module needs a default config to initialize.
        secret: config.get<string>('jwt.accessSecret'),
        signOptions: {
          expiresIn: parseInt(config.get<string>('jwt.accessExpiresIn')!),
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('throttler.ttl') ?? 60000,
          limit: config.get<number>('throttler.limit') ?? 10,
        },
      ],
    }),
    UserModule, AuthModule, RedisModule, ServiceCategoryModule, ServiceModule, StylistModule, CustomerModule, TimeSlotModule, AppointmentModule, PaymentModule, ReportModule
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    AppService
  ],
})
export class AppModule { }
