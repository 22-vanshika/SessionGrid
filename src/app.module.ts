import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigurationModule } from './config/config.module';
import { DatabaseConfig } from './config/database.config';
import { UsersModule } from './users/users.module';
import { CoursesModule } from './courses/courses.module';
import { OfferingsModule } from './offerings/offerings.module';
import { SessionsModule } from './sessions/sessions.module';
import { BookingsModule } from './bookings/bookings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ConfigurationModule,
    TypeOrmModule.forRootAsync({ useClass: DatabaseConfig }),
    UsersModule,
    CoursesModule,
    OfferingsModule,
    SessionsModule,
    BookingsModule,
  ],
})
export class AppModule {}
