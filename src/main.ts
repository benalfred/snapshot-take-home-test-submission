import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import {ValidationPipe} from "@nestjs/common";
import {ResponseInterceptor} from "./common/interceptors/response.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(
        new ResponseInterceptor(),
    );

    app.useGlobalFilters(
        new AllExceptionsFilter(),
    );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`PeopleFlow API listening on http://localhost:${port}`);
}

bootstrap();
