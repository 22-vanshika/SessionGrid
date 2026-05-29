import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, DeepPartial } from 'typeorm';
import { Session } from './entities/session.entity';

@Injectable()
export class SessionsRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async saveBulk(sessions: DeepPartial<Session>[]): Promise<Session[]> {
    return this.dataSource
      .getRepository(Session)
      .save(sessions) as Promise<Session[]>;
  }

  async findByOfferingId(offeringId: string): Promise<Session[]> {
    return this.dataSource
      .getRepository(Session)
      .createQueryBuilder('session')
      .where('session.offeringId = :offeringId', { offeringId })
      .orderBy('session.startsAt', 'ASC')
      .getMany();
  }
}
