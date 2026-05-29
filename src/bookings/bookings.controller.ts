import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { MockAuthGuard } from '../common/guards/mock-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  BookingResponseDto,
  BookingWithOfferingResponseDto,
} from './dto/booking-response.dto';

@Controller('bookings')
@UseGuards(MockAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  async create(
    @Body() dto: CreateBookingDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<BookingResponseDto> {
    const booking = await this.bookingsService.bookOffering(
      currentUser.id,
      dto.offeringId,
    );
    return BookingResponseDto.fromEntity(booking);
  }

  @Get('mine')
  async findMine(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<BookingWithOfferingResponseDto[]> {
    const bookings = await this.bookingsService.findByParentId(
      currentUser.id,
      currentUser.timezone,
    );
    return bookings.map(BookingWithOfferingResponseDto.fromLocalised);
  }

  // PATCH /bookings/:id/cancel — idempotent; returns 200 with no body on success.
  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    await this.bookingsService.cancelBooking(id, currentUser.id);
  }
}
