import { IsISO8601, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddSessionDto {
  @ApiProperty({
    example: '2024-09-01T09:00:00',
    description:
      'Local ISO 8601 datetime string interpreted in the teacher\'s registered timezone',
  })
  @IsString()
  @IsNotEmpty()
  @IsISO8601()
  startsAt: string;

  @ApiProperty({
    example: '2024-09-01T10:00:00',
    description: 'Must be strictly after startsAt',
  })
  @IsString()
  @IsNotEmpty()
  @IsISO8601()
  endsAt: string;
}
