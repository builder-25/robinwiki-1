import { z } from 'zod'
import { createConfigVar } from '@robin/shared'

export const env = createConfigVar({
  schema: {
    DATABASE_URL: z.string().min(1).describe('Postgres connection string'),
    REDIS_URL: z.string().min(1).describe('Redis connection string'),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32)
      .describe('32+ char session signing key (openssl rand -hex 32)'),
    APP_URL: z.string().url().describe('Core public URL, e.g. https://core.example.com'),
    MASTER_KEY: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .describe('64 hex chars — generate with: openssl rand -hex 32'),
    KEY_ENCRYPTION_SECRET: z.string().min(32).describe('32+ char key encryption secret'),
    INITIAL_USERNAME: z.string().email().describe('Email for first admin user'),
    INITIAL_PASSWORD: z.string().min(6).describe('Password for first admin user'),
    OPENROUTER_API_KEY: z.string().min(1).describe('OpenRouter API key (openrouter.ai/keys)'),
    WIKI_ORIGIN: z
      .string()
      .min(1)
      .refine(
        (val) => val.split(',').every((u) => /^https?:\/\//.test(u.trim())),
        'Each comma-separated origin must start with http:// or https://',
      )
      .describe('Wiki frontend URL(s) for CORS — comma-separated for multiple origins'),
    PORT: z.coerce.number().default(3000).describe('Server port'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    LOG_LEVEL: z.string().default('info'),
  },
})
