import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from '../user/user.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from './entities/refreshtoken.entity';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '../redis/redis.module';
import { JwtAccessStrategy } from 'src/common/strategy/access.strategy';
import { JwtRefreshStrategy } from 'src/common/strategy/jwt-refresh.strategy';

@Module({
  imports: [UserModule,
    RedisModule,
    TypeOrmModule.forFeature([RefreshToken]),
    ConfigModule,
  ],
  providers: [AuthService, JwtAccessStrategy, JwtRefreshStrategy],
  controllers: [AuthController],
  exports: [AuthService]
})
export class AuthModule { }
