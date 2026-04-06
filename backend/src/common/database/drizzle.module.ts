import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDrizzleClient } from './drizzle.client';
import { DatabaseConfig } from '../types/database.types';

export const DRIZZLE = Symbol('DRIZZLE');

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService<{ database: DatabaseConfig; app: any }>,
      ) => {
        const { url } = configService.get('database', {
          infer: true,
        }) as DatabaseConfig;
        const isDevEnv = configService.get<boolean>('app.isDevelopment', {
          infer: true,
        }) as boolean;
        return createDrizzleClient(url, isDevEnv);
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule {}
