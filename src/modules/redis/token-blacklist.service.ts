import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from 'src/common/constant/constant';


@Injectable()
export class TokenBlacklistService {
    private readonly logger = new Logger(TokenBlacklistService.name);
    private readonly PREFIX = 'blacklist:';

    constructor(
        @Inject(REDIS_CLIENT)
        private readonly redis: Redis,
    ) { }


    async blacklist(jti: string, exp: number): Promise<void> {
        const now = Math.floor(Date.now() / 1000);
        const ttlSeconds = exp - now;

        if (ttlSeconds <= 0) return;

        await this.redis.set(
            `${this.PREFIX}${jti}`,
            '1',
            'EX',
            ttlSeconds,
        );

        this.logger.debug(`Token blacklisted | jti=${jti} | ttl=${ttlSeconds}s`);
    }

    async isBlacklisted(jti: string): Promise<boolean> {
        const result = await this.redis.get(`${this.PREFIX}${jti}`);
        return result !== null;
    }
}