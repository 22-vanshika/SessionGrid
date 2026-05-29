import { Injectable } from '@nestjs/common';
import { Course } from './entities/course.entity';
import { CoursesRepository } from './courses.repository';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';
import { CourseNotFoundException } from '../common/exceptions/course-not-found.exception';
import { NotATeacherException } from '../common/exceptions/not-a-teacher.exception';

export interface CreateCourseData {
  title: string;
  description?: string;
}

@Injectable()
export class CoursesService {
  constructor(
    private readonly coursesRepository: CoursesRepository,
    private readonly usersService: UsersService,
  ) {}

  async create(teacherId: string, data: CreateCourseData): Promise<Course> {
    const teacher = await this.usersService.findById(teacherId);
    if (teacher.role !== UserRole.TEACHER) {
      throw new NotATeacherException();
    }
    return this.coursesRepository.save({
      teacherId,
      title: data.title,
      description: data.description ?? null,
    });
  }

  async findById(id: string): Promise<Course> {
    const course = await this.coursesRepository.findById(id);
    if (!course) {
      throw new CourseNotFoundException(id);
    }
    return course;
  }

  async findAllByTeacherId(teacherId: string): Promise<Course[]> {
    return this.coursesRepository.findAllByTeacherId(teacherId);
  }
}
