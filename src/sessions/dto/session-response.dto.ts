import { Session } from '../entities/session.entity';

export class SessionResponseDto {
  id: string;
  offeringId: string;
  // UTC ISO strings — the creation endpoint returns UTC since the service returns a raw entity.
  startsAt: string;
  endsAt: string;
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(session: Session): SessionResponseDto {
    const dto = new SessionResponseDto();
    dto.id = session.id;
    dto.offeringId = session.offeringId;
    dto.startsAt = session.startsAt.toISOString();
    dto.endsAt = session.endsAt.toISOString();
    dto.createdAt = session.createdAt;
    dto.updatedAt = session.updatedAt;
    return dto;
  }
}
