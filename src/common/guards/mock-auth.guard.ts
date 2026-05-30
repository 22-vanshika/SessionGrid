import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { isUUID } from 'class-validator';
import { IANAZone } from 'luxon';
import { UserRole } from '../../users/entities/user.entity';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedUser }>();

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
