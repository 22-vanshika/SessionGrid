import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus, Booking } from '../entities/booking.entity';
import { OfferingStatus } from '../../offerings/entities/offering.entity';
import { LocalisedBooking, LocalisedBookingSession } from '../bookings.service';

// Used for POST /bookings — service returns a bare Booking entity.
export class BookingResponseDto {
  @ApiProperty({ example: 'd4e5f6a7-b8c9-0123-def0-123456789012' })
  id: string;

  @ApiProperty({ example: 'c3d4e5f6-a7b8-9012-cdef-123456789012' })
  offeringId: string;

  @ApiProperty({ example: '3f9e0c8d-6ce8-492f-99c9-76fb3b0c62aa' })
  parentId: string;

  @ApiProperty({ enum: BookingStatus, example: BookingStatus.CONFIRMED })
  status: BookingStatus;

  @ApiProperty({ example: '2024-09-01T09:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-09-01T09:00:00.000Z' })
  updatedAt: Date;

  static fromEntity(booking: Booking): BookingResponseDto {
    const dto = new BookingResponseDto();
    dto.id = booking.id;
    dto.offeringId = booking.offeringId;
    dto.parentId = booking.parentId;
    dto.status = booking.status;
    dto.createdAt = booking.createdAt;
    dto.updatedAt = booking.updatedAt;
    return dto;
  }
}

export class BookingSessionDto {
  @ApiProperty({ example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' })
  id: string;

  @ApiProperty({ example: 'c3d4e5f6-a7b8-9012-cdef-123456789012' })
  offeringId: string;

  @ApiProperty({ example: '2024-09-01T14:30:00+05:30' })
  startsAt: string;

  @ApiProperty({ example: '2024-09-01T15:30:00+05:30' })
  endsAt: string;
}

export class BookingOfferingDto {
  @ApiProperty({ example: 'c3d4e5f6-a7b8-9012-cdef-123456789012' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  courseId: string;

  @ApiProperty({ example: 20 })
  capacity: number;

  @ApiProperty({ enum: OfferingStatus, example: OfferingStatus.PUBLISHED })
  status: OfferingStatus;

  @ApiProperty({ type: () => [BookingSessionDto] })
  sessions: BookingSessionDto[];
}

// Used for GET /bookings/mine — service returns LocalisedBooking[] with localised session times.
export class BookingWithOfferingResponseDto {
  @ApiProperty({ example: 'd4e5f6a7-b8c9-0123-def0-123456789012' })
  id: string;

  @ApiProperty({ example: 'c3d4e5f6-a7b8-9012-cdef-123456789012' })
  offeringId: string;

  @ApiProperty({ example: '3f9e0c8d-6ce8-492f-99c9-76fb3b0c62aa' })
  parentId: string;

  @ApiProperty({ enum: BookingStatus, example: BookingStatus.CONFIRMED })
  status: BookingStatus;

  @ApiProperty({ example: '2024-09-01T09:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-09-01T09:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ type: () => BookingOfferingDto })
  offering: BookingOfferingDto;

  static fromLocalised(booking: LocalisedBooking): BookingWithOfferingResponseDto {
    const dto = new BookingWithOfferingResponseDto();
    dto.id = booking.id;
    dto.offeringId = booking.offeringId;
    dto.parentId = booking.parentId;
    dto.status = booking.status;
    dto.createdAt = booking.createdAt;
    dto.updatedAt = booking.updatedAt;
    dto.offering = {
      id: booking.offering.id,
      courseId: booking.offering.courseId,
      capacity: booking.offering.capacity,
      status: booking.offering.status,
      sessions: booking.offering.sessions.map(
        (s: LocalisedBookingSession): BookingSessionDto => ({
          id: s.id,
          offeringId: s.offeringId,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
        }),
      ),
    };
    return dto;
  }
}
