import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.string().transform(Number).default('4001'),
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters long'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    FRONTEND_URL: z.string().url().default('http://localhost:3000'),
    REDIS_URL: z.string().url().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
    console.error('❌ Invalid environment variables:', JSON.stringify(parsedEnv.error.format(), null, 4));
    process.exit(1);
}

export const env = parsedEnv.data;
