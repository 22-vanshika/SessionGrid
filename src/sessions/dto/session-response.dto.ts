import { ApiProperty } from '@nestjs/swagger';
import { LocalisedSessionResult } from '../sessions.service';

export class SessionResponseDto {
  @ApiProperty({ example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' })
  id: string;

  @ApiProperty({ example: 'c3d4e5f6-a7b8-9012-cdef-123456789012' })
  offeringId: string;

  @ApiProperty({
    example: '2024-09-01T14:30:00.000+05:30',
    description: "Local ISO 8601 string with UTC offset in the teacher's timezone",
  })
  startsAt: string;

  @ApiProperty({ example: '2024-09-01T15:30:00.000+05:30' })
  endsAt: string;

  @ApiProperty({ example: '2024-09-01T09:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-09-01T09:00:00.000Z' })
  updatedAt: Date;

  static fromLocalised(session: LocalisedSessionResult): SessionResponseDto {
    const dto = new SessionResponseDto();
    dto.id = session.id;
    dto.offeringId = session.offeringId;
    dto.startsAt = session.startsAt;
    dto.endsAt = session.endsAt;
    dto.createdAt = session.createdAt;
    dto.updatedAt = session.updatedAt;
    return dto;
  }
}
