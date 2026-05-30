import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// This file is used exclusively by the TypeORM CLI (migration:generate, migration:run, etc.).
// It runs outside the NestJS container, so it must read process.env directly after loading .env.
// No application code reads process.env — this is the only justified exception.
dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env['DB_HOST'] ?? 'localhost',
  port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
  username: process.env['DB_USERNAME'] ?? 'sessiongrid',
  password: process.env['DB_PASSWORD'] ?? 'changeme',
  database: process.env['DB_NAME'] ?? 'sessiongrid',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  // synchronize is permanently false — all schema changes go through migrations
  synchronize: false,
});
