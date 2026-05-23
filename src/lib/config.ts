import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  VENDRE_API_KEY: z.string().min(1),
  VENDRE_BASE_URL: z.string().url().default('https://www.harmoniq.se'),
  DRY_RUN: z.string().default('true'),
  ALLOW_WRITES: z.string().default('false'),
});

const env = envSchema.parse(process.env);

export const config = {
  vendreApiKey: env.VENDRE_API_KEY,
  vendreBaseUrl: env.VENDRE_BASE_URL.replace(/\/$/, ''),
  dryRun: env.DRY_RUN.toLowerCase() !== 'false',
  allowWrites: env.ALLOW_WRITES.toLowerCase() === 'true',
};
