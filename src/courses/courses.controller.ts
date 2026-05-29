import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { MockAuthGuard } from '../common/guards/mock-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreateCourseDto } from './dto/create-course.dto';
import { CourseResponseDto } from './dto/course-response.dto';

@ApiTags('Courses')
@ApiHeader({ name: 'x-user-id', required: true, description: 'UUID of the authenticated user' })
@ApiHeader({ name: 'x-user-role', required: true, description: '"teacher" or "parent"' })
@ApiHeader({ name: 'x-user-timezone', required: true, description: 'IANA timezone string, e.g. Asia/Kolkata' })
@Controller('courses')
@UseGuards(MockAuthGuard)
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a course (teacher only)' })
  @ApiResponse({ status: 201, description: 'Course created', type: CourseResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Missing auth headers' })
  @ApiResponse({ status: 403, description: 'Caller is not a teacher' })
  async create(
    @Body() dto: CreateCourseDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<CourseResponseDto> {
    const course = await this.coursesService.create(currentUser.id, {
      title: dto.title,
      description: dto.description,
    });
    return CourseResponseDto.fromEntity(course);
  }

  @Get('mine')
  @ApiOperation({ summary: "List the caller's courses (teacher only)" })
  @ApiResponse({ status: 200, description: 'List of courses', type: [CourseResponseDto] })
  @ApiResponse({ status: 401, description: 'Missing auth headers' })
  @ApiResponse({ status: 403, description: 'Caller is not a teacher' })
  async findMine(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<CourseResponseDto[]> {
    const courses = await this.coursesService.findAllByTeacherId(currentUser.id);
    return courses.map(CourseResponseDto.fromEntity);
  }
}
