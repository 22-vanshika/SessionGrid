import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, DeepPartial } from 'typeorm';
import { Course } from './entities/course.entity';

@Injectable()
export class CoursesRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async save(course: DeepPartial<Course>): Promise<Course> {
    return this.dataSource.getRepository(Course).save(course) as Promise<Course>;
  }

  async findById(id: string): Promise<Course | null> {
    return this.dataSource.getRepository(Course).findOneBy({ id });
  }

  async findAllByTeacherId(teacherId: string): Promise<Course[]> {
    return this.dataSource
      .getRepository(Course)
      .createQueryBuilder('course')
      .where('course.teacherId = :teacherId', { teacherId })
      .orderBy('course.createdAt', 'DESC')
      .getMany();
  }
}
