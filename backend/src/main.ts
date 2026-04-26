import '@common/config/env';
import 'module-alias/register';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { swaggerHelpers } from '@common/config/configurations/swagger.config';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { toNodeHandler } from 'better-auth/node';
import { auth } from '@common/auth/auth';
import type { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  // rawBody: true exposes req.rawBody for every request, which we need so
  // the Stripe webhook can verify its signature against the exact bytes.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const configService = app.get(ConfigService);

  // App config
  const port = configService.get<number>('app.port', { infer: true }) as number;
  const apiVersion = configService.get<string>('app.apiVersion', {
    infer: true,
  }) as string;
  const isProduction = configService.get<boolean>('app.isProduction', {
    infer: true,
  }) as boolean;

  // CORS config
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
    // In dev we accept any origin so the mobile app (expo) can talk to us.
    // Production uses the configured list.
    origin: isProduction ? allowedOrigins : true,
    credentials: true,
  });

  // Mount Better Auth only on /api/auth paths, so it does not intercept other routes
  const betterAuthHandler = toNodeHandler(auth);
  app.use((req, res, next) => {
    if (req.url?.startsWith('/api/auth')) {
      betterAuthHandler(req, res).catch(next);
    } else {
      next();
    }
  });

  app.setGlobalPrefix(`api/v${apiVersion}`);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      disableErrorMessages: isProduction ? true : false,
    }),
  );

  await app.listen(port, '0.0.0.0');
  console.log(`[Nest] App running on http://localhost:${port}`);
}
void bootstrap();
