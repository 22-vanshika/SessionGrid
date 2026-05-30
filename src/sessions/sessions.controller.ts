import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { MockAuthGuard } from '../common/guards/mock-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AddSessionDto } from './dto/add-session.dto';
import { SessionResponseDto } from './dto/session-response.dto';

// Sessions are nested under offerings in the URL: POST /offerings/:offeringId/sessions.
// Handled here (rather than OfferingsController) to avoid a circular module dependency —
// SessionsModule already imports OfferingsModule; the inverse would create a cycle.
@ApiTags('Offerings')
@ApiHeader({ name: 'x-user-id', required: true, description: 'UUID of the authenticated user' })
@ApiHeader({ name: 'x-user-role', required: true, description: '"teacher" or "parent"' })
@ApiHeader({ name: 'x-user-timezone', required: true, description: 'IANA timezone string, e.g. Asia/Kolkata' })
@Controller('offerings')
@UseGuards(MockAuthGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post(':offeringId/sessions')
  @ApiOperation({
    summary: 'Add a session to an offering (times interpreted in teacher\'s timezone)',
  })
  @ApiParam({ name: 'offeringId', format: 'uuid', description: 'ID of the offering' })
  @ApiResponse({ status: 201, description: 'Session created', type: SessionResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error or end time before start time' })
  @ApiResponse({ status: 401, description: 'Missing auth headers' })
  @ApiResponse({ status: 403, description: 'Caller is not a teacher or does not own the offering' })
  @ApiResponse({ status: 404, description: 'Offering not found' })
  async addSession(
    @Param('offeringId', ParseUUIDPipe) offeringId: string,
    @Body() dto: AddSessionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<SessionResponseDto> {
    const session = await this.sessionsService.addToOffering(
      offeringId,
      currentUser.id,
      currentUser.timezone,
      dto.startsAt,
      dto.endsAt,
    );
    return SessionResponseDto.fromEntity(session);
  }
}
