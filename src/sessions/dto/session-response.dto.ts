import { ApiProperty } from '@nestjs/swagger';
import { Session } from '../entities/session.entity';

export class SessionResponseDto {
  @ApiProperty({ example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' })
  id: string;

  @ApiProperty({ example: 'c3d4e5f6-a7b8-9012-cdef-123456789012' })
  offeringId: string;

  @ApiProperty({
    example: '2024-09-01T09:00:00.000Z',
    description: 'UTC ISO 8601 string',
  })
  startsAt: string;

  @ApiProperty({ example: '2024-09-01T10:00:00.000Z' })
  endsAt: string;

  @ApiProperty({ example: '2024-09-01T09:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-09-01T09:00:00.000Z' })
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
