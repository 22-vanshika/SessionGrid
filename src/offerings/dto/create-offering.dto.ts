import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { OfferingStatus } from '../entities/offering.entity';

export class CreateOfferingDto {
  @IsUUID()
  courseId: string;

  @IsInt()
  @Min(1)
  capacity: number;

  @IsOptional()
  @IsEnum(OfferingStatus)
  status?: OfferingStatus;
}
