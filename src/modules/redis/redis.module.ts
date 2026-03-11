import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from 'src/common/constant/constant';
import { TokenBlacklistService } from 'src/common/services/token-blacklist.service';
import { radisConfig } from 'src/config/redis.config';
// @Global() — register once in AppModule
// REDIS_CLIENT available in every module without re-importing RedisModule
@Global()
@Module({
    providers: [radisConfig, TokenBlacklistService],
    exports: [REDIS_CLIENT, TokenBlacklistService],
})
export class RedisModule { }