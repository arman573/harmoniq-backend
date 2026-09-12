import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '../users/user.entity';
import type { UsersService } from '../users/users.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('returns the current database user instead of stale JWT identity claims', async () => {
    const currentUser = {
      id: 42,
      name: 'Customer',
      email: 'current@example.com',
      role: UserRole.USER,
    };
    const usersService = {
      findById: jest.fn().mockResolvedValue(currentUser),
    } as unknown as UsersService;
    const strategy = new JwtStrategy(usersService);

    await expect(
      strategy.validate({
        sub: 42,
        email: 'stale-token@example.com',
      }),
    ).resolves.toBe(currentUser);
    expect(usersService.findById).toHaveBeenCalledWith(42);
  });

  it('rejects a token whose subject no longer resolves to a user', async () => {
    const usersService = {
      findById: jest.fn().mockResolvedValue(null),
    } as unknown as UsersService;
    const strategy = new JwtStrategy(usersService);

    await expect(
      strategy.validate({ sub: 999, email: 'former@example.com' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
