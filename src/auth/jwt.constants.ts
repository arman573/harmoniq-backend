import type { JwtSignOptions } from '@nestjs/jwt';

export const jwtSecret = process.env.JWT_SECRET ?? 'change-me-in-production';

export const jwtExpiresIn = (process.env.JWT_EXPIRES_IN ??
  '1d') as JwtSignOptions['expiresIn'];
