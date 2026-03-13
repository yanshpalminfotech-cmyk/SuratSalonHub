import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from 'src/common/constant/constant';


@Injectable()
export class TokenBlacklistService {
    private readonly logger = new Logger(TokenBlacklistService.name);
    private readonly PREFIX = 'blacklist:';

    constructor(
        // injected by RedisModule factory provider
        @Inject(REDIS_CLIENT)
        private readonly redis: Redis,
    ) { }

    /**
     * Blacklist a jti for the remaining lifetime of the token.
     * Redis auto-expires the key when the token would have expired anyway.
     *
     * @param jti — unique JWT ID from token payload
     * @param exp — token expiry as Unix timestamp (seconds)
     */
    async blacklist(jti: string, exp: number): Promise<void> {
        const now = Math.floor(Date.now() / 1000);
        const ttlSeconds = exp - now;

        // token already expired — no point storing
        if (ttlSeconds <= 0) return;

        await this.redis.set(
            `${this.PREFIX}${jti}`,
            '1',
            'EX',
            ttlSeconds,
        );

        this.logger.debug(`Token blacklisted | jti=${jti} | ttl=${ttlSeconds}s`);
    }

    /**
     * Returns true if jti exists in Redis blacklist.
     * Called on every protected request by JwtAccessStrategy.
     */
    async isBlacklisted(jti: string): Promise<boolean> {
        const result = await this.redis.get(`${this.PREFIX}${jti}`);
        return result !== null;
    }
}