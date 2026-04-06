import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import appConfig from './configurations/app.config';
import swaggerConfig from './configurations/swagger.config';
import { appValidationSchema } from './validation/app.schema';
import { swaggerValidationSchema } from './validation/swagger.schema';
import { databaseValidationSchema } from './validation/database.schema';
import databaseConfig from './configurations/database.config';
import throttlerConfig from './configurations/throttler.config';
import { throttlerValidationSchema } from './validation/throttler.schema';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, swaggerConfig, databaseConfig, throttlerConfig],
      validationSchema: appValidationSchema
        .concat(swaggerValidationSchema)
        .concat(databaseValidationSchema)
        .concat(throttlerValidationSchema),
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
      cache: true,
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
