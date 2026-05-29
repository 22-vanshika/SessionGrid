import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';
import { User } from '../entities/user.entity';

export class UserResponseDto {
  @ApiProperty({ example: '3f9e0c8d-6ce8-492f-99c9-76fb3b0c62aa' })
  id: string;

  @ApiProperty({ example: 'alice@example.com' })
  email: string;

  @ApiProperty({ example: 'Alice' })
  firstName: string;

  @ApiProperty({ example: 'Smith' })
  lastName: string;

  @ApiProperty({ enum: UserRole, example: UserRole.TEACHER })
  role: UserRole;

  @ApiProperty({ example: 'Asia/Kolkata' })
  timezone: string;

  @ApiProperty({ example: '2024-09-01T09:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-09-01T09:00:00.000Z' })
  updatedAt: Date;

  static fromEntity(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.firstName = user.firstName;
    dto.lastName = user.lastName;
    dto.role = user.role;
    dto.timezone = user.timezone;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    return dto;
  }
}
