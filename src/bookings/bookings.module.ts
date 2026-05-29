import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { OfferingsModule } from '../offerings/offerings.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingsRepository } from './bookings.repository';

@Module({
  imports: [UsersModule, OfferingsModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsRepository],
  exports: [BookingsService],
})
export class BookingsModule {}
