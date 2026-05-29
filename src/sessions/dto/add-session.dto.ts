import { IsISO8601, IsNotEmpty, IsString } from 'class-validator';

export class AddSessionDto {
  // Local ISO 8601 datetime string, e.g. "2025-09-01T09:00:00".
  // Interpreted against the authenticated teacher's registered timezone.
  @IsString()
  @IsNotEmpty()
  @IsISO8601()
  startsAt: string;

  @IsString()
  @IsNotEmpty()
  @IsISO8601()
  endsAt: string;
}
