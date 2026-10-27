import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../auth.constants.js';
import type { UserRole } from '../../users/user.types.js';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
