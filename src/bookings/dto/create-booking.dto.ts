import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({ example: 'c3d4e5f6-a7b8-9012-cdef-123456789012', format: 'uuid' })
  @IsUUID()
  offeringId: string;
}
