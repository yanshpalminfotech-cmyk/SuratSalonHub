export default () => ({
    port: parseInt(process.env.PORT!, 10) || 3000,
    database: {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT!, 10) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        name: process.env.DB_NAME,
    },
    security: {
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS!, 10) || 12,
        maxFailedAttempts: parseInt(process.env.MAX_FAILED_ATTEMPTS!, 10) || 5,
        lockDuration: parseInt(process.env.LOCK_DURATION_MINUTES!, 10) || 30,
    },
    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET,
        accessExpires: process.env.JWT_ACCESS_EXPIRES_IN,
        refreshSecret: process.env.JWT_REFRESH_SECRET,
        refreshExpires: process.env.JWT_REFRESH_EXPIRES_IN,
    },
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT!, 10) || 6379,
        password: process.env.REDIS_PASSWORD || '',
        db: parseInt(process.env.REDIS_DB!, 10) || 0,
    },
    throttler: {
        ttl: parseInt(process.env.THROTTLER_TTL!, 10) || 60000,
        limit: parseInt(process.env.THROTTLER_LIMIT!, 10) || 10,
    },
});