import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OfferingStatus } from '../entities/offering.entity';

export class CreateOfferingDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', format: 'uuid' })
  @IsUUID()
  courseId: string;

  @ApiProperty({ example: 20, minimum: 1 })
  @IsInt()
  @Min(1)
  capacity: number;

  @ApiPropertyOptional({
    enum: OfferingStatus,
    example: OfferingStatus.PUBLISHED,
    description: 'Defaults to draft if omitted',
  })
  @IsOptional()
  @IsEnum(OfferingStatus)
  status?: OfferingStatus;
}
