import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from 'src/common/constant/constant';
import { TokenBlacklistService } from './token-blacklist.service';
import { radisConfig } from 'src/config/redis.config';
 
@Global()
@Module({
    providers: [radisConfig, TokenBlacklistService],
    exports: [REDIS_CLIENT, TokenBlacklistService],
})
export class RedisModule { }