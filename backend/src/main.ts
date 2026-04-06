import 'module-alias/register';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { swaggerHelpers } from '@common/config/configurations/swagger.config';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  // ========================
  // App config
  // ========================
  const port = configService.get<number>('app.port', { infer: true }) as number;
  const apiVersion = configService.get<string>('app.apiVersion', {
    infer: true,
  }) as string;
  const isProduction = configService.get<boolean>('app.isProduction', {
    infer: true,
  }) as boolean;
  // ========================
  // CORS config
  // ========================
  const allowedOrigins = configService.get<string | string[]>(
    'app.allowedOrigins',
    {
      infer: true,
    },
  ) as string | string[];
  // ========================
  // Swagger config
  // ========================
  const swaggerEnabled = configService.get<boolean>('swagger.enabled', {
    infer: true,
  }) as boolean;

  if (swaggerEnabled) {
    const swaggerConfig = swaggerHelpers.createConfig(
      configService,
    ) as OpenAPIObject;
    const swaggerPath = swaggerHelpers.getPath(configService);
    const swaggerDocs = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(swaggerPath, app, swaggerDocs);
    console.log(
      `[Nest] Swagger docs available at http://localhost:${port}/${swaggerPath}`,
    );
  }

  app.enableCors({
    origin: allowedOrigins,
  });
  app.setGlobalPrefix(`api/v${apiVersion}`);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: apiVersion,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      disableErrorMessages: isProduction ? true : false,
    }),
  );

  await app.listen(port);
  console.log(`[Nest] App running on http://localhost:${port}`);
}
void bootstrap();
