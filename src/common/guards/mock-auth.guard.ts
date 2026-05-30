import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { isUUID } from 'class-validator';
import { IANAZone } from 'luxon';
import { AppConfig } from '../../config/app.config';
import { UserRole } from '../../users/entities/user.entity';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { verifyJwt } from '../utils/jwt.util';

@Injectable()
export class MockAuthGuard implements CanActivate {
  constructor(private readonly appConfig: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedUser }>();

    // ── JWT Bearer path ─────────────────────────────────────────────────────
    // Clients that obtained a token via POST /users/login should send it as
    //   Authorization: Bearer <token>
    // The token encodes the user's id, role, and timezone, signed with
    // JWT_SECRET. This path provides real data-isolation guarantees: the
    // caller can only act as the user whose token they hold.
    const authHeader = request.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const payload = verifyJwt(token, this.appConfig.jwtSecret);
      if (!payload) {
        throw new UnauthorizedException('Invalid or expired JWT token');
      }
      if (!Object.values(UserRole).includes(payload.role as UserRole)) {
        throw new UnauthorizedException('Token contains an unrecognised role');
      }
      if (!IANAZone.isValidZone(payload.timezone)) {
        throw new UnauthorizedException('Token contains an invalid IANA timezone');
      }
      request.user = {
        id: payload.sub,
        role: payload.role as UserRole,
        timezone: payload.timezone,
      };
      return true;
    }

    // ── Mock-header fallback path ────────────────────────────────────────────
    // Used by the automated test suite and manual exploration. Any caller can
    // claim any identity by setting the three x-user-* headers, so this path
    // provides no data-isolation guarantee. Replace with JwtAuthGuard when
    // deploying to production.
    const userId = request.headers['x-user-id'];
    const userRole = request.headers['x-user-role'];
    const userTimezone = request.headers['x-user-timezone'];

    if (
      typeof userId !== 'string' ||
      typeof userRole !== 'string' ||
      typeof userTimezone !== 'string'
    ) {
      throw new UnauthorizedException('Missing required auth headers: x-user-id, x-user-role, x-user-timezone');
    }

    if (!isUUID(userId, '4')) {
      throw new UnauthorizedException('x-user-id must be a valid UUID v4');
    }

    if (!Object.values(UserRole).includes(userRole as UserRole)) {
      throw new UnauthorizedException(`Invalid role value: ${userRole}`);
    }

    if (!IANAZone.isValidZone(userTimezone)) {
      throw new UnauthorizedException(`Invalid IANA timezone in x-user-timezone: "${userTimezone}"`);
    }

    request.user = {
      id: userId,
      role: userRole as UserRole,
      timezone: userTimezone,
    };

    return true;
  }
}
