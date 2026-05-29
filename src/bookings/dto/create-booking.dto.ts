import { IsUUID } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  offeringId: string;
}
