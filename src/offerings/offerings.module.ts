import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { CoursesModule } from '../courses/courses.module';
import { OfferingsController } from './offerings.controller';
import { OfferingsService } from './offerings.service';
import { OfferingsRepository } from './offerings.repository';

@Module({
  imports: [UsersModule, CoursesModule],
  controllers: [OfferingsController],
  providers: [OfferingsService, OfferingsRepository],
  exports: [OfferingsService],
})
export class OfferingsModule {}
