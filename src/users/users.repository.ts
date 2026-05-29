import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, DeepPartial } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findById(id: string): Promise<User | null> {
    return this.dataSource.getRepository(User).findOneBy({ id });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.dataSource.getRepository(User).findOneBy({ email });
  }

  async save(user: DeepPartial<User>): Promise<User> {
    return this.dataSource.getRepository(User).save(user) as Promise<User>;
  }
}
