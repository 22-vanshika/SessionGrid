import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const url = this.configService.get<string>('DATABASE_URL');
    if (url) {
      return {
        type: 'postgres',
        url,
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
        synchronize: false,
        logging: this.configService.get<string>('NODE_ENV') === 'development',
      };
    }
    return {
      type: 'postgres',
      host: this.configService.getOrThrow<string>('DB_HOST'),
      port: this.configService.get<number>('DB_PORT', 5432),
      username: this.configService.getOrThrow<string>('DB_USERNAME'),
      password: this.configService.getOrThrow<string>('DB_PASSWORD'),
      database: this.configService.getOrThrow<string>('DB_NAME'),
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
      synchronize: false,
      logging: this.configService.get<string>('NODE_ENV') === 'development',
    };
  }
}
