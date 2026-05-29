import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, DeepPartial } from 'typeorm';
import { Offering, OfferingStatus } from './entities/offering.entity';

@Injectable()
export class OfferingsRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async save(offering: DeepPartial<Offering>): Promise<Offering> {
    return this.dataSource
      .getRepository(Offering)
      .save(offering) as Promise<Offering>;
  }

  async findById(id: string): Promise<Offering | null> {
    return this.dataSource.getRepository(Offering).findOneBy({ id });
  }

  // Loads the offering with its course and sessions — required for booking flow and
  // session ownership checks. Sessions are ordered chronologically.
  async findByIdWithSessions(id: string): Promise<Offering | null> {
    return this.dataSource
      .getRepository(Offering)
      .createQueryBuilder('offering')
      .innerJoinAndSelect('offering.course', 'course')
      .leftJoinAndSelect('offering.sessions', 'session')
      .where('offering.id = :id', { id })
      .orderBy('session.startsAt', 'ASC')
      .getOne();
  }

  async findAllPublished(): Promise<Offering[]> {
    return this.dataSource
      .getRepository(Offering)
      .createQueryBuilder('offering')
      .innerJoinAndSelect('offering.course', 'course')
      .leftJoinAndSelect('offering.sessions', 'session')
      .where('offering.status = :status', { status: OfferingStatus.PUBLISHED })
      .orderBy('offering.createdAt', 'DESC')
      .addOrderBy('session.startsAt', 'ASC')
      .getMany();
  }

  // Joins through courses to find all offerings whose parent course belongs to the given teacher.
  async findAllByTeacherId(teacherId: string): Promise<Offering[]> {
    return this.dataSource
      .getRepository(Offering)
      .createQueryBuilder('offering')
      .innerJoinAndSelect('offering.course', 'course')
      .leftJoinAndSelect('offering.sessions', 'session')
      .where('course.teacherId = :teacherId', { teacherId })
      .orderBy('offering.createdAt', 'DESC')
      .addOrderBy('session.startsAt', 'ASC')
      .getMany();
  }
}
