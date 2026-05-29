import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppConfig } from './config/app.config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ---------------------------------------------------------------------------
  // Swagger / OpenAPI
  // ---------------------------------------------------------------------------
  const swaggerConfig = new DocumentBuilder()
    .setTitle('SessionGrid API')
    .setDescription(
      'Global Class Offering Booking System — teachers create courses and sessions, parents book them with full timezone support and race-condition-proof concurrency.',
    )
    .setVersion('1.0')
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-user-id' },
      'x-user-id',
    )
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-user-role' },
      'x-user-role',
    )
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-user-timezone' },
      'x-user-timezone',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Serve the UI at /api/docs
  SwaggerModule.setup('api/docs', app, document);

  // Write docs/openapi.json to the project root so it can be committed and
  // imported into Postman, Insomnia, or any other client.
  const docsDir = path.join(process.cwd(), 'docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(docsDir, 'openapi.json'),
    JSON.stringify(document, null, 2),
  );

  const appConfig = app.get(AppConfig);
  await app.listen(appConfig.port);
}

bootstrap().catch((err: unknown) => {
  Logger.error(
    err instanceof Error ? err.message : String(err),
    err instanceof Error ? err.stack : undefined,
    'Bootstrap',
  );
  process.exit(1);
});
