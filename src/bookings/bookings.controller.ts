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
import {
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { MockAuthGuard } from '../common/guards/mock-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  BookingResponseDto,
  BookingWithOfferingResponseDto,
} from './dto/booking-response.dto';

@ApiTags('Bookings')
@ApiHeader({ name: 'x-user-id', required: true, description: 'UUID of the authenticated user' })
@ApiHeader({ name: 'x-user-role', required: true, description: '"teacher" or "parent"' })
@ApiHeader({ name: 'x-user-timezone', required: true, description: 'IANA timezone string, e.g. Asia/Kolkata' })
@Controller('bookings')
@UseGuards(MockAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Book a published offering (parent only)' })
  @ApiResponse({ status: 201, description: 'Booking confirmed', type: BookingResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Missing auth headers' })
  @ApiResponse({ status: 403, description: 'Caller is not a parent' })
  @ApiResponse({ status: 404, description: 'Offering not found' })
  @ApiResponse({ status: 409, description: 'Duplicate booking or session time conflict' })
  @ApiResponse({ status: 422, description: 'Offering is not published' })
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
  @ApiOperation({
    summary: "List the parent's bookings with sessions in the parent's timezone",
  })
  @ApiResponse({
    status: 200,
    description: "Parent's bookings with localised session times",
    type: [BookingWithOfferingResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Missing auth headers' })
  async findMine(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<BookingWithOfferingResponseDto[]> {
    const bookings = await this.bookingsService.findByParentId(
      currentUser.id,
      currentUser.timezone,
    );
    return bookings.map(BookingWithOfferingResponseDto.fromLocalised);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a booking (parent only, idempotent)' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID of the booking to cancel' })
  @ApiResponse({ status: 200, description: 'Booking cancelled (or was already cancelled)' })
  @ApiResponse({ status: 401, description: 'Missing auth headers' })
  @ApiResponse({ status: 403, description: 'Booking does not belong to the caller' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    await this.bookingsService.cancelBooking(id, currentUser.id);
  }
}
