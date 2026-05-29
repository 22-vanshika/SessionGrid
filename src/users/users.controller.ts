import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

// No auth guard — register and login are the entry points for unauthenticated users.
@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user (teacher or parent)' })
  @ApiResponse({ status: 201, description: 'User created', type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body() dto: RegisterUserDto): Promise<UserResponseDto> {
    const user = await this.usersService.register({
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      password: dto.password,
      role: dto.role,
      timezone: dto.timezone,
    });
    return UserResponseDto.fromEntity(user);
  }

  // POST /users/login returns 200, not the default 201 for POST.
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate credentials and return the user profile' })
  @ApiResponse({ status: 200, description: 'Credentials valid', type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  async login(@Body() dto: LoginUserDto): Promise<UserResponseDto> {
    const user = await this.usersService.validatePassword(dto.email, dto.password);
    return UserResponseDto.fromEntity(user);
  }
}
