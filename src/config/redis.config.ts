import { Logger } from "@nestjs/common";
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from "src/common/constant/constant";


export const radisConfig = {
    provide: REDIS_CLIENT,

    inject: [ConfigService],

    useFactory: (config: ConfigService): Redis => {
        const logger = new Logger('RedisProvider');

        const client = new Redis({
            host: config.get<string>('redis.host') ?? 'localhost',
            port: config.get<number>('redis.port') ?? 6379,
            password: config.get<string>('redis.password') || undefined,

            // auto reconnect — same reliability as a DB connection pool
            retryStrategy: (times: number) => {
                const delay = Math.min(times * 100, 3000);
                logger.warn(`Redis reconnecting... attempt ${times} (delay: ${delay}ms)`);
                return delay;
            },

            // stop retrying after 10 attempts — prevent infinite loops
            maxRetriesPerRequest: 3,
        });

        client.on('connect', () =>
            logger.log('Redis connected successfully'),
        );

        client.on('ready', () =>
            logger.log('Redis client ready'),
        );

        client.on('error', (err: Error) =>
            logger.error(`Redis error: ${err.message}`),
        );

        client.on('close', () =>
            logger.warn('Redis connection closed'),
        );

        client.on('reconnecting', () =>
            logger.warn('Redis reconnecting...'),
        );

        return client;
    },
};