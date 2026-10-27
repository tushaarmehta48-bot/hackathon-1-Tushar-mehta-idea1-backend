import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import type { AuthenticatedUser } from '../../src/users/user.types.js';

describe('RolesGuard', () => {
  const customer: AuthenticatedUser = {
    id: 'user-customer',
    email: 'c@example.com',
    profile: {
      id: 'user-customer',
      displayName: null,
      role: 'CUSTOMER',
      preferredLocale: 'en',
      active: true,
    },
  };

  const staff: AuthenticatedUser = {
    ...customer,
    id: 'user-staff',
    profile: { ...customer.profile, id: 'user-staff', role: 'STAFF' },
  };

  it('allows when no roles metadata is set', () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = () => undefined;
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user: customer }) }),
    };
    expect(guard.canActivate(context as never)).toBe(true);
  });

  it('denies customer for admin route', () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = () => ['ADMIN'];
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user: customer }) }),
    };
    expect(() => guard.canActivate(context as never)).toThrow(ForbiddenException);
  });

  it('allows staff for staff route', () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = () => ['STAFF', 'ADMIN'];
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user: staff }) }),
    };
    expect(guard.canActivate(context as never)).toBe(true);
  });
});
