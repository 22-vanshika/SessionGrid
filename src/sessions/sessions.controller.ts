import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { MockAuthGuard } from '../common/guards/mock-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AddSessionDto } from './dto/add-session.dto';
import { SessionResponseDto } from './dto/session-response.dto';

// Sessions are nested under offerings in the URL: POST /offerings/:offeringId/sessions.
// Handled here (rather than OfferingsController) to avoid a circular module dependency —
// SessionsModule already imports OfferingsModule; the inverse would create a cycle.
@Controller('offerings')
@UseGuards(MockAuthGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post(':offeringId/sessions')
  async addSession(
    @Param('offeringId', ParseUUIDPipe) offeringId: string,
    @Body() dto: AddSessionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<SessionResponseDto> {
    const session = await this.sessionsService.addToOffering(
      offeringId,
      currentUser.id,
      currentUser.role,
      currentUser.timezone,
      dto.startsAt,
      dto.endsAt,
    );
    return SessionResponseDto.fromEntity(session);
  }
}
