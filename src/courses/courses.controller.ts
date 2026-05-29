import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { MockAuthGuard } from '../common/guards/mock-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreateCourseDto } from './dto/create-course.dto';
import { CourseResponseDto } from './dto/course-response.dto';

@Controller('courses')
@UseGuards(MockAuthGuard)
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
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
  async findMine(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<CourseResponseDto[]> {
    const courses = await this.coursesService.findAllByTeacherId(currentUser.id);
    return courses.map(CourseResponseDto.fromEntity);
  }
}
