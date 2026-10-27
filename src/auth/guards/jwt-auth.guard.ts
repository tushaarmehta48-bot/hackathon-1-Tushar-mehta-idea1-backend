import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../auth.constants.js';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { UsersService } from '../../users/users.service.js';
import type { AuthenticatedUser } from '../../users/user.types.js';

function extractBearerToken(request: Request): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  return header.slice('Bearer '.length).trim();
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const authUser = await this.supabase.verifyAccessToken(token);
    if (!authUser) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const profile = await this.users.syncProfileFromAuth(authUser.id);
    if (!profile.active) {
      throw new ForbiddenException('Account is inactive');
    }

    request.user = {
      id: authUser.id,
      email: authUser.email,
      profile,
    };

    return true;
  }
}
