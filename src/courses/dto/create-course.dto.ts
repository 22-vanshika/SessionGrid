import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCourseDto {
  @ApiProperty({ example: 'Algebra I' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Introduction to algebra for grades 6–8' })
  @IsOptional()
  @IsString()
  description?: string;
}
