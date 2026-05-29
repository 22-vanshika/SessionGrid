import { BookingStatus, Booking } from '../entities/booking.entity';
import { OfferingStatus } from '../../offerings/entities/offering.entity';
import { LocalisedBooking, LocalisedBookingSession } from '../bookings.service';

// Used for POST /bookings — service returns a bare Booking entity.
export class BookingResponseDto {
  id: string;
  offeringId: string;
  parentId: string;
  status: BookingStatus;
  createdAt: Date;
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

class BookingSessionDto {
  id: string;
  offeringId: string;
  startsAt: string;
  endsAt: string;
}

class BookingOfferingDto {
  id: string;
  courseId: string;
  capacity: number;
  status: OfferingStatus;
  sessions: BookingSessionDto[];
}

// Used for GET /bookings/mine — service returns LocalisedBooking[] with localised session times.
export class BookingWithOfferingResponseDto {
  id: string;
  offeringId: string;
  parentId: string;
  status: BookingStatus;
  createdAt: Date;
  updatedAt: Date;
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
